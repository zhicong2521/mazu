import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  clampYawForRules,
  isPresenceFresh,
  normalizeRoomId,
  sanitizeAvatarConfig,
  sanitizeChatText,
  sanitizeEmote,
  sanitizeFirestoreId,
  sanitizeRemoteTransform,
  sortByCreatedAtAsc,
  sortByCreatedAtDesc,
  type RemotePlayerState,
} from './multiplayer';
import type { MultiplayerClientCallbacks } from './multiplayerClient';
import type { AvatarConfig, ChatMessage, EmoteType, LitLantern } from './types';

export interface MultiplayerTransport {
  getRoomId(): string;
  sendMove(
    x: number,
    z: number,
    yaw: number,
    emote: EmoteType,
    holdingIncense: boolean,
    force?: boolean,
  ): void;
  sendAvatarUpdate(avatar: AvatarConfig): void;
  sendChat(id: string, text: string): void;
  sendLanternLit(lantern: LitLantern): void;
  sendBellRing(): void;
  sendRitualAnnounce(id: string, text: string): void;
  switchRoom(nextRoomId: string): void;
  dispose(): void;
}

const ALLOWED_LANTERN_TYPES = new Set<LitLantern['type']>([
  '平安燈',
  '姻緣燈',
  '財神燈',
  '文昌燈',
]);

function timestampToMs(val: unknown): number | null {
  if (val instanceof Timestamp) {
    return val.toMillis();
  }
  if (val && typeof val === 'object' && 'toMillis' in val && typeof (val as { toMillis: unknown }).toMillis === 'function') {
    return (val as { toMillis: () => number }).toMillis();
  }
  return null;
}

function formatMessageTime(ms: number | null): string {
  if (ms === null) return '剛剛';
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return '剛剛';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分鐘前`;
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface TrackedRemotePlayer {
  state: RemotePlayerState;
  updatedAtMs: number | null;
  lastSeenLocalMs: number;
}

/**
 * Cross-device, cross-URL global real-time multiplayer client backed by Firebase Firestore.
 * Synchronizes 3D pilgrim avatars, live typing chat & speech bubbles, shared blessing lanterns,
 * and temple bell rings across any device or URL (ais-dev, ais-pre, custom domains) in the same room.
 */
export class FirestoreMultiplayerClient implements MultiplayerTransport {
  private readonly uid: string;
  private roomId: string;
  private callbacks: MultiplayerClientCallbacks;
  private disposed = false;
  private joinGeneration = 0;

  private unsubs: Unsubscribe[] = [];
  private heartbeatTimer: number | null = null;
  private pruneTimer: number | null = null;
  private roomReady = false;

  private currentBellSeq = 0;
  private bellInitialized = false;
  private playersInitialized = false;
  private messagesInitialized = false;

  private knownRemotes = new Map<string, TrackedRemotePlayer>();
  private seenMessageIds = new Set<string>();
  private seenLanternIds = new Set<string>();

  private latestJoinState: {
    avatar: AvatarConfig;
    x: number;
    z: number;
    yaw: number;
    emote: EmoteType;
    holdingIncense: boolean;
  };

  private lastMoveSentAt = 0;
  private lastSentTransform = {
    x: 0,
    z: 0,
    yaw: 0,
    emote: 'idle' as EmoteType,
    holdingIncense: false,
  };

  private readonly handleBeforeUnload = () => {
    void this.leavePresenceBestEffort(this.roomId);
  };

  constructor(
    uid: string,
    roomId: string,
    initialJoin: {
      avatar: AvatarConfig;
      x: number;
      z: number;
      yaw: number;
      holdingIncense: boolean;
    },
    callbacks: MultiplayerClientCallbacks,
  ) {
    this.uid = uid;
    this.roomId = normalizeRoomId(roomId);
    this.callbacks = callbacks;
    const safePos = sanitizeRemoteTransform(initialJoin.x, initialJoin.z, initialJoin.yaw);
    this.latestJoinState = {
      avatar: sanitizeAvatarConfig(initialJoin.avatar),
      x: safePos.x,
      z: safePos.z,
      yaw: clampYawForRules(safePos.yaw),
      emote: 'idle',
      holdingIncense: Boolean(initialJoin.holdingIncense),
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', this.handleBeforeUnload);
      window.addEventListener('beforeunload', this.handleBeforeUnload);
    }

    void this.connectRoom(this.roomId);
  }

  public getRoomId(): string {
    return this.roomId;
  }

  private clearListeners(): void {
    for (const unsub of this.unsubs) {
      try {
        unsub();
      } catch {
        // Ignore cleanup errors
      }
    }
    this.unsubs = [];

    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.pruneTimer !== null) {
      window.clearInterval(this.pruneTimer);
      this.pruneTimer = null;
    }
  }

  private async leavePresenceBestEffort(targetRoomId: string): Promise<void> {
    const playerPath = `rooms/${targetRoomId}/players/${this.uid}`;
    try {
      await deleteDoc(doc(db, 'rooms', targetRoomId, 'players', this.uid));
    } catch {
      // Best-effort cleanup on unload/switch; stale presence is also pruned after 60s
      void playerPath;
    }
  }

  private async ensureRoomDocument(roomId: string): Promise<void> {
    const roomPath = `rooms/${roomId}`;
    const roomRef = doc(db, 'rooms', roomId);
    let exists = false;

    try {
      const snap = await getDoc(roomRef);
      exists = snap.exists();
      if (exists) {
        const data = snap.data();
        if (data && typeof data.bellSeq === 'number') {
          this.currentBellSeq = data.bellSeq;
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, roomPath);
    }

    if (!exists) {
      try {
        await setDoc(roomRef, {
          roomId,
          createdBy: this.uid,
          isPublic: true,
          bellSeq: 0,
          lastBellBy: '',
          lastBellByUid: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        this.currentBellSeq = 0;
      } catch (error) {
        // Handle race where another player created the room simultaneously
        try {
          const retrySnap = await getDoc(roomRef);
          if (retrySnap.exists()) {
            const data = retrySnap.data();
            if (data && typeof data.bellSeq === 'number') {
              this.currentBellSeq = data.bellSeq;
            }
            return;
          }
        } catch {
          // Fall through to structured error handler below
        }
        handleFirestoreError(error, OperationType.CREATE, roomPath);
      }
    }
  }

  private async upsertSelfPresence(roomId: string): Promise<void> {
    const playerPath = `rooms/${roomId}/players/${this.uid}`;
    const playerRef = doc(db, 'rooms', roomId, 'players', this.uid);
    const safePos = sanitizeRemoteTransform(
      this.latestJoinState.x,
      this.latestJoinState.z,
      this.latestJoinState.yaw,
    );
    const safeYaw = clampYawForRules(safePos.yaw);
    const safeAvatar = sanitizeAvatarConfig(this.latestJoinState.avatar);
    const safeEmote = sanitizeEmote(this.latestJoinState.emote);
    const roundedX = Math.round(safePos.x * 100) / 100;
    const roundedZ = Math.round(safePos.z * 100) / 100;

    let exists = false;
    try {
      const snap = await getDoc(playerRef);
      exists = snap.exists();
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, playerPath);
    }

    if (!exists) {
      try {
        await setDoc(playerRef, {
          uid: this.uid,
          roomId,
          x: roundedX,
          z: roundedZ,
          yaw: safeYaw,
          emote: safeEmote,
          holdingIncense: Boolean(this.latestJoinState.holdingIncense),
          avatar: safeAvatar,
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, playerPath);
      }
    } else {
      try {
        await updateDoc(playerRef, {
          x: roundedX,
          z: roundedZ,
          yaw: safeYaw,
          emote: safeEmote,
          holdingIncense: Boolean(this.latestJoinState.holdingIncense),
          avatar: safeAvatar,
          isActive: true,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, playerPath);
      }
    }

    this.lastMoveSentAt = performance.now();
    this.lastSentTransform = {
      x: roundedX,
      z: roundedZ,
      yaw: safeYaw,
      emote: safeEmote,
      holdingIncense: Boolean(this.latestJoinState.holdingIncense),
    };
  }

  private async connectRoom(targetRoomId: string): Promise<void> {
    const gen = ++this.joinGeneration;
    this.roomReady = false;
    this.bellInitialized = false;
    this.playersInitialized = false;
    this.messagesInitialized = false;
    this.knownRemotes.clear();
    this.seenMessageIds.clear();
    this.seenLanternIds.clear();
    this.clearListeners();

    this.callbacks.onStatusChange('connecting');

    try {
      await this.ensureRoomDocument(targetRoomId);
      if (this.disposed || gen !== this.joinGeneration) return;

      await this.upsertSelfPresence(targetRoomId);
      if (this.disposed || gen !== this.joinGeneration) return;

      this.roomReady = true;
      this.callbacks.onStatusChange('connected');
      this.attachSnapshots(targetRoomId, gen);
      this.startPresenceTimers(targetRoomId, gen);
    } catch (error) {
      if (this.disposed || gen !== this.joinGeneration) return;
      this.callbacks.onStatusChange('reconnecting');
      console.error('Failed to connect Firestore temple room:', error);
    }
  }

  private attachSnapshots(roomId: string, gen: number): void {
    // 1. Room document listener (synchronized Peace Bell)
    const roomPath = `rooms/${roomId}`;
    const unsubRoom = onSnapshot(
      doc(db, 'rooms', roomId),
      (snap) => {
        if (this.disposed || gen !== this.joinGeneration || !snap.exists()) return;
        const data = snap.data();
        const nextBellSeq = typeof data.bellSeq === 'number' ? data.bellSeq : 0;
        if (!this.bellInitialized) {
          this.bellInitialized = true;
          this.currentBellSeq = nextBellSeq;
          return;
        }
        if (nextBellSeq > this.currentBellSeq) {
          this.currentBellSeq = nextBellSeq;
          const byUid = typeof data.lastBellByUid === 'string' ? data.lastBellByUid : '';
          const byName = typeof data.lastBellBy === 'string' && data.lastBellBy ? data.lastBellBy : '香客';
          if (byUid && byUid !== this.uid) {
            this.callbacks.onMessage({
              type: 'bell:rung',
              playerId: byUid,
              byName,
            });
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, roomPath);
      },
    );

    // 2. Real-time players presence subcollection (single-field query to avoid composite index)
    const playersPath = `rooms/${roomId}/players`;
    const playersQuery = query(
      collection(db, 'rooms', roomId, 'players'),
      where('roomId', '==', roomId),
      limit(40),
    );
    const unsubPlayers = onSnapshot(
      playersQuery,
      (snap) => {
        if (this.disposed || gen !== this.joinGeneration) return;
        const nowMs = Date.now();
        const freshMap = new Map<string, TrackedRemotePlayer>();

        for (const docSnap of snap.docs) {
          if (docSnap.id === this.uid) continue;
          const data = docSnap.data();
          const updatedAtMs = timestampToMs(data.updatedAt);
          const active = data.isActive === true;
          if (!isPresenceFresh(active, updatedAtMs, nowMs, 60_000)) {
            continue;
          }
          const safePos = sanitizeRemoteTransform(data.x, data.z, data.yaw);
          const remoteState: RemotePlayerState = {
            id: docSnap.id,
            x: safePos.x,
            z: safePos.z,
            yaw: safePos.yaw,
            emote: sanitizeEmote(data.emote),
            holdingIncense: Boolean(data.holdingIncense),
            avatar: sanitizeAvatarConfig(data.avatar),
          };
          freshMap.set(docSnap.id, {
            state: remoteState,
            updatedAtMs,
            lastSeenLocalMs: nowMs,
          });
        }

        if (!this.playersInitialized) {
          this.playersInitialized = true;
          this.knownRemotes = freshMap;
          this.callbacks.onMessage({
            type: 'room:init',
            selfId: this.uid,
            roomId,
            players: Array.from(freshMap.values()).map((r) => r.state),
            messages: [],
            lanterns: [],
          });
          return;
        }

        // Diff removals
        for (const prevId of Array.from(this.knownRemotes.keys())) {
          if (!freshMap.has(prevId)) {
            this.knownRemotes.delete(prevId);
            this.callbacks.onMessage({ type: 'player:left', id: prevId });
          }
        }

        // Diff joins & updates
        for (const [id, nextEntry] of freshMap.entries()) {
          const prevEntry = this.knownRemotes.get(id);
          this.knownRemotes.set(id, nextEntry);
          if (!prevEntry) {
            this.callbacks.onMessage({
              type: 'player:joined',
              player: nextEntry.state,
            });
          } else {
            this.callbacks.onMessage({
              type: 'player:updated',
              id,
              x: nextEntry.state.x,
              z: nextEntry.state.z,
              yaw: nextEntry.state.yaw,
              emote: nextEntry.state.emote,
              holdingIncense: nextEntry.state.holdingIncense,
              avatar: nextEntry.state.avatar,
            });
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, playersPath);
      },
    );

    // 3. Real-time chat & ritual messages (single-field query, sorted in memory)
    const messagesPath = `rooms/${roomId}/messages`;
    const messagesQuery = query(
      collection(db, 'rooms', roomId, 'messages'),
      where('roomId', '==', roomId),
      limit(60),
    );
    const unsubMessages = onSnapshot(
      messagesQuery,
      (snap) => {
        if (this.disposed || gen !== this.joinGeneration) return;
        const parsed: Array<{
          id: string;
          createdAtMs: number;
          senderUid: string;
          message: ChatMessage;
        }> = [];

        for (const docSnap of snap.docs) {
          const data = docSnap.data();
          const text = sanitizeChatText(data.text);
          if (!text) continue;
          const ms = timestampToMs(data.createdAt);
          const isSystem = Boolean(data.isSystem);
          const senderUid = typeof data.senderUid === 'string' ? data.senderUid : '';
          const senderName =
            typeof data.senderName === 'string' && data.senderName.trim()
              ? data.senderName.trim().slice(0, 24)
              : '香客';

          parsed.push({
            id: docSnap.id,
            createdAtMs: ms ?? Date.now(),
            senderUid,
            message: {
              id: docSnap.id,
              sender: isSystem ? '廟祝公告' : senderName,
              text,
              timestamp: formatMessageTime(ms),
              isSystem,
              isPlayer: !isSystem && senderUid === this.uid,
            },
          });
        }

        const sorted = sortByCreatedAtAsc(parsed);
        const isInitialBatch = !this.messagesInitialized;
        this.messagesInitialized = true;

        for (const item of sorted) {
          if (this.seenMessageIds.has(item.id)) continue;
          this.seenMessageIds.add(item.id);
          this.callbacks.onMessage({
            type: 'chat:message',
            message: item.message,
            // Only pop 3D speech bubbles for live messages arriving after initial join
            playerId: isInitialBatch || item.message.isSystem ? undefined : item.senderUid,
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, messagesPath);
      },
    );

    // 4. Shared persistent 3D Blessing Lanterns (single-field query, sorted in memory)
    const lanternsPath = `rooms/${roomId}/lanterns`;
    const lanternsQuery = query(
      collection(db, 'rooms', roomId, 'lanterns'),
      where('roomId', '==', roomId),
      limit(30),
    );
    const unsubLanterns = onSnapshot(
      lanternsQuery,
      (snap) => {
        if (this.disposed || gen !== this.joinGeneration) return;
        const parsed: Array<{ id: string; createdAtMs: number; lantern: LitLantern }> = [];

        for (const docSnap of snap.docs) {
          const data = docSnap.data();
          const type = ALLOWED_LANTERN_TYPES.has(data.type as LitLantern['type'])
            ? (data.type as LitLantern['type'])
            : '平安燈';
          const wish = sanitizeChatText(data.wish) || '闔家平安';
          const ownerName =
            typeof data.ownerName === 'string' && data.ownerName.trim()
              ? data.ownerName.trim().slice(0, 24)
              : '香客';
          const slotIndex =
            typeof data.slotIndex === 'number' && Number.isFinite(data.slotIndex)
              ? Math.max(0, Math.min(29, Math.trunc(data.slotIndex)))
              : 0;
          const ms = timestampToMs(data.createdAt);

          parsed.push({
            id: docSnap.id,
            createdAtMs: ms ?? Date.now(),
            lantern: {
              id: docSnap.id,
              ownerName,
              type,
              wish,
              slotIndex,
            },
          });
        }

        const sorted = sortByCreatedAtDesc(parsed);
        for (const item of sorted) {
          if (this.seenLanternIds.has(item.id)) continue;
          this.seenLanternIds.add(item.id);
          this.callbacks.onMessage({
            type: 'lantern:lit',
            lantern: item.lantern,
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, lanternsPath);
      },
    );

    this.unsubs.push(unsubRoom, unsubPlayers, unsubMessages, unsubLanterns);
  }

  private startPresenceTimers(roomId: string, gen: number): void {
    // Heartbeat every 15s so standing players stay fresh
    this.heartbeatTimer = window.setInterval(() => {
      if (this.disposed || gen !== this.joinGeneration || !this.roomReady) return;
      this.sendMove(
        this.latestJoinState.x,
        this.latestJoinState.z,
        this.latestJoinState.yaw,
        this.latestJoinState.emote,
        this.latestJoinState.holdingIncense,
        true,
      );
    }, 15_000);

    // Local stale-player sweep every 15s in case a remote browser closed abruptly
    this.pruneTimer = window.setInterval(() => {
      if (this.disposed || gen !== this.joinGeneration) return;
      const nowMs = Date.now();
      for (const [id, entry] of Array.from(this.knownRemotes.entries())) {
        const refMs = entry.updatedAtMs ?? entry.lastSeenLocalMs;
        if (nowMs - refMs > 65_000) {
          this.knownRemotes.delete(id);
          this.callbacks.onMessage({ type: 'player:left', id });
        }
      }
    }, 15_000);
  }

  public sendMove(
    x: number,
    z: number,
    yaw: number,
    emote: EmoteType,
    holdingIncense: boolean,
    force = false,
  ): void {
    const safePos = sanitizeRemoteTransform(x, z, yaw);
    const roundedX = Math.round(safePos.x * 100) / 100;
    const roundedZ = Math.round(safePos.z * 100) / 100;
    const safeYaw = clampYawForRules(safePos.yaw);
    const safeEmote = sanitizeEmote(emote);
    const safeIncense = Boolean(holdingIncense);

    this.latestJoinState.x = roundedX;
    this.latestJoinState.z = roundedZ;
    this.latestJoinState.yaw = safeYaw;
    this.latestJoinState.emote = safeEmote;
    this.latestJoinState.holdingIncense = safeIncense;

    if (!this.roomReady || this.disposed) return;

    const now = performance.now();
    const moved =
      Math.hypot(roundedX - this.lastSentTransform.x, roundedZ - this.lastSentTransform.z) > 0.06 ||
      Math.abs(safeYaw - this.lastSentTransform.yaw) > 0.08 ||
      safeEmote !== this.lastSentTransform.emote ||
      safeIncense !== this.lastSentTransform.holdingIncense;

    // 350ms throttle keeps Firestore writes lightweight while Three.js interpolation keeps movement smooth
    if (!force && (!moved || now - this.lastMoveSentAt < 350)) {
      return;
    }

    this.lastMoveSentAt = now;
    this.lastSentTransform = {
      x: roundedX,
      z: roundedZ,
      yaw: safeYaw,
      emote: safeEmote,
      holdingIncense: safeIncense,
    };

    const roomId = this.roomId;
    const playerPath = `rooms/${roomId}/players/${this.uid}`;
    void updateDoc(doc(db, 'rooms', roomId, 'players', this.uid), {
      x: roundedX,
      z: roundedZ,
      yaw: safeYaw,
      emote: safeEmote,
      holdingIncense: safeIncense,
      isActive: true,
      updatedAt: serverTimestamp(),
    }).catch((error) => {
      if (this.disposed || roomId !== this.roomId) return;
      handleFirestoreError(error, OperationType.UPDATE, playerPath);
    });
  }

  public sendAvatarUpdate(avatar: AvatarConfig): void {
    const safeAvatar = sanitizeAvatarConfig(avatar);
    this.latestJoinState.avatar = safeAvatar;
    if (!this.roomReady || this.disposed) return;

    const roomId = this.roomId;
    const playerPath = `rooms/${roomId}/players/${this.uid}`;
    void updateDoc(doc(db, 'rooms', roomId, 'players', this.uid), {
      avatar: safeAvatar,
      updatedAt: serverTimestamp(),
    }).catch((error) => {
      if (this.disposed || roomId !== this.roomId) return;
      handleFirestoreError(error, OperationType.UPDATE, playerPath);
    });
  }

  public sendChat(id: string, text: string): void {
    void this.writeMessage(id, text, false);
  }

  public sendRitualAnnounce(id: string, text: string): void {
    void this.writeMessage(id, text, true);
  }

  private async writeMessage(rawId: string, rawText: string, isSystem: boolean): Promise<void> {
    if (!this.roomReady || this.disposed) return;
    const cleanText = sanitizeChatText(rawText);
    if (!cleanText) return;

    const roomId = this.roomId;
    const msgId = sanitizeFirestoreId(rawId, 'msg');
    const msgPath = `rooms/${roomId}/messages/${msgId}`;
    this.seenMessageIds.add(msgId);

    try {
      await setDoc(doc(db, 'rooms', roomId, 'messages', msgId), {
        id: msgId,
        roomId,
        senderUid: this.uid,
        senderName: (this.latestJoinState.avatar.name || '香客').slice(0, 24),
        text: cleanText,
        isSystem,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      if (this.disposed || roomId !== this.roomId) return;
      handleFirestoreError(error, OperationType.CREATE, msgPath);
    }
  }

  public sendLanternLit(lantern: LitLantern): void {
    if (!this.roomReady || this.disposed) return;
    const roomId = this.roomId;
    const lanternId = sanitizeFirestoreId(lantern.id, 'lamp');
    const lanternPath = `rooms/${roomId}/lanterns/${lanternId}`;
    const safeType = ALLOWED_LANTERN_TYPES.has(lantern.type) ? lantern.type : '平安燈';
    const safeWish = sanitizeChatText(lantern.wish) || '闔家平安';
    const safeOwner = (lantern.ownerName || this.latestJoinState.avatar.name || '香客').trim().slice(0, 24);
    const safeSlot = Math.max(0, Math.min(29, Math.trunc(lantern.slotIndex)));

    this.seenLanternIds.add(lanternId);

    void setDoc(doc(db, 'rooms', roomId, 'lanterns', lanternId), {
      id: lanternId,
      roomId,
      ownerUid: this.uid,
      ownerName: safeOwner,
      type: safeType,
      wish: safeWish,
      slotIndex: safeSlot,
      createdAt: serverTimestamp(),
    }).catch((error) => {
      if (this.disposed || roomId !== this.roomId) return;
      handleFirestoreError(error, OperationType.CREATE, lanternPath);
    });
  }

  public sendBellRing(): void {
    if (!this.roomReady || this.disposed) return;
    const roomId = this.roomId;
    const roomPath = `rooms/${roomId}`;
    const roomRef = doc(db, 'rooms', roomId);

    void (async () => {
      try {
        const snap = await getDoc(roomRef);
        const latestSeq =
          snap.exists() && typeof snap.data().bellSeq === 'number'
            ? (snap.data().bellSeq as number)
            : this.currentBellSeq;
        const nextSeq = Math.min(1_000_000, latestSeq + 1);
        this.currentBellSeq = nextSeq;
        await updateDoc(roomRef, {
          bellSeq: nextSeq,
          lastBellBy: (this.latestJoinState.avatar.name || '香客').slice(0, 24),
          lastBellByUid: this.uid,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        if (this.disposed || roomId !== this.roomId) return;
        handleFirestoreError(error, OperationType.UPDATE, roomPath);
      }
    })();
  }

  public switchRoom(nextRoomId: string): void {
    const normalized = normalizeRoomId(nextRoomId);
    if (normalized === this.roomId) return;
    const previousRoomId = this.roomId;
    this.roomId = normalized;
    void this.leavePresenceBestEffort(previousRoomId);
    void this.connectRoom(normalized);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.roomReady = false;
    this.clearListeners();
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.handleBeforeUnload);
      window.removeEventListener('beforeunload', this.handleBeforeUnload);
    }
    void this.leavePresenceBestEffort(this.roomId);
  }
}
