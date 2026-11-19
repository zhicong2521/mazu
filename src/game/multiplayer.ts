import { DEFAULT_AVATAR, WORLD_BOUNDS } from './data.ts';
import { clampPlayerPosition } from './rules.ts';
import type { AvatarConfig, ChatMessage, EmoteType, LitLantern } from './types.ts';

export interface RemotePlayerState {
  id: string;
  x: number;
  z: number;
  yaw: number;
  emote: EmoteType;
  holdingIncense: boolean;
  avatar: AvatarConfig;
  speechBubble?: string;
}

export interface RoomStateSnapshot {
  selfId: string;
  roomId: string;
  players: RemotePlayerState[];
  messages: ChatMessage[];
  lanterns: LitLantern[];
}

export type ClientWsMessage =
  | {
      type: 'player:join';
      avatar: AvatarConfig;
      x: number;
      z: number;
      yaw: number;
      holdingIncense: boolean;
    }
  | {
      type: 'player:move';
      x: number;
      z: number;
      yaw: number;
      emote: EmoteType;
      holdingIncense: boolean;
    }
  | {
      type: 'player:avatar';
      avatar: AvatarConfig;
    }
  | {
      type: 'chat:send';
      id: string;
      text: string;
    }
  | {
      type: 'lantern:light';
      lantern: LitLantern;
    }
  | {
      type: 'bell:ring';
    }
  | {
      type: 'ritual:announce';
      id: string;
      text: string;
    };

export type ServerWsMessage =
  | {
      type: 'room:init';
      selfId: string;
      roomId: string;
      players: RemotePlayerState[];
      messages: ChatMessage[];
      lanterns: LitLantern[];
    }
  | {
      type: 'player:joined';
      player: RemotePlayerState;
    }
  | {
      type: 'player:updated';
      id: string;
      x: number;
      z: number;
      yaw: number;
      emote: EmoteType;
      holdingIncense: boolean;
      avatar?: AvatarConfig;
    }
  | {
      type: 'player:left';
      id: string;
    }
  | {
      type: 'chat:message';
      message: ChatMessage;
      playerId?: string;
    }
  | {
      type: 'lantern:lit';
      lantern: LitLantern;
    }
  | {
      type: 'bell:rung';
      playerId: string;
      byName: string;
    };

const VALID_EMOTES = new Set<EmoteType>([
  'idle',
  'kneel',
  'meditate',
  'jump',
  'wave',
  'bow',
]);

/**
 * Normalizes a room ID from URL query or user input. Defaults to 'main' (本殿大廳).
 */
export function normalizeRoomId(raw?: string | null): string {
  if (!raw) return 'main';
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 24);
  return cleaned || 'main';
}

/**
 * Sanitizes chat/wish text (trimmed, single-line, bounded to 120 chars).
 */
export function sanitizeChatText(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/\s+/g, ' ').trim().slice(0, 120);
}

/**
 * Sanitizes emote values against allowed set.
 */
export function sanitizeEmote(raw: unknown): EmoteType {
  return typeof raw === 'string' && VALID_EMOTES.has(raw as EmoteType)
    ? (raw as EmoteType)
    : 'idle';
}

/**
 * Authoritatively clamps remote player coordinates inside the temple world bounds
 * and avoids NaN/Infinity injection.
 */
export function sanitizeRemoteTransform(
  x: unknown,
  z: unknown,
  yaw: unknown,
): { x: number; z: number; yaw: number } {
  const safeX = typeof x === 'number' && Number.isFinite(x) ? x : 0;
  const safeZ = typeof z === 'number' && Number.isFinite(z) ? z : 4.2;
  const safeYaw = typeof yaw === 'number' && Number.isFinite(yaw) ? yaw : Math.PI;
  const clamped = clampPlayerPosition(
    Math.max(WORLD_BOUNDS.minX, Math.min(WORLD_BOUNDS.maxX, safeX)),
    Math.max(WORLD_BOUNDS.minZ, Math.min(WORLD_BOUNDS.maxZ, safeZ)),
  );
  return { x: clamped.x, z: clamped.z, yaw: safeYaw };
}

/**
 * Safely merges untrusted client avatar config over defaults.
 */
export function sanitizeAvatarConfig(raw: unknown): AvatarConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_AVATAR };
  const obj = raw as Partial<AvatarConfig>;
  const rawName = typeof obj.name === 'string' ? obj.name.trim().slice(0, 14) : '';
  return {
    name: rawName || DEFAULT_AVATAR.name,
    skinColor: typeof obj.skinColor === 'string' ? obj.skinColor.slice(0, 20) : DEFAULT_AVATAR.skinColor,
    eyeStyle: obj.eyeStyle || DEFAULT_AVATAR.eyeStyle,
    eyebrowStyle: obj.eyebrowStyle || DEFAULT_AVATAR.eyebrowStyle,
    mouthStyle: obj.mouthStyle || DEFAULT_AVATAR.mouthStyle,
    blushColor: typeof obj.blushColor === 'string' ? obj.blushColor.slice(0, 20) : DEFAULT_AVATAR.blushColor,
    hairStyle: obj.hairStyle || DEFAULT_AVATAR.hairStyle,
    hairColor: typeof obj.hairColor === 'string' ? obj.hairColor.slice(0, 20) : DEFAULT_AVATAR.hairColor,
    outfitStyle: obj.outfitStyle || DEFAULT_AVATAR.outfitStyle,
    headwear: obj.headwear || DEFAULT_AVATAR.headwear,
    glasses: obj.glasses || DEFAULT_AVATAR.glasses,
  };
}

/**
 * Idempotently upserts a remote player (guards against duplicate joins on reconnect).
 */
export function upsertRemotePlayer(
  list: RemotePlayerState[],
  incoming: RemotePlayerState,
  selfId?: string | null,
): RemotePlayerState[] {
  if (selfId && incoming.id === selfId) return list;
  const idx = list.findIndex((p) => p.id === incoming.id);
  if (idx === -1) return [...list, incoming];
  const next = list.slice();
  next[idx] = { ...next[idx], ...incoming };
  return next;
}

/**
 * Updates an existing remote player's transform/emote/avatar; no-op if unknown.
 */
export function updateRemotePlayer(
  list: RemotePlayerState[],
  patch: {
    id: string;
    x: number;
    z: number;
    yaw: number;
    emote: EmoteType;
    holdingIncense: boolean;
    avatar?: AvatarConfig;
  },
): RemotePlayerState[] {
  const idx = list.findIndex((p) => p.id === patch.id);
  if (idx === -1) return list;
  const next = list.slice();
  const prev = next[idx];
  next[idx] = {
    ...prev,
    x: patch.x,
    z: patch.z,
    yaw: patch.yaw,
    emote: patch.emote,
    holdingIncense: patch.holdingIncense,
    avatar: patch.avatar ?? prev.avatar,
  };
  return next;
}

/**
 * Idempotently removes a remote player by ID.
 */
export function removeRemotePlayer(
  list: RemotePlayerState[],
  playerId: string,
): RemotePlayerState[] {
  if (!list.some((p) => p.id === playerId)) return list;
  return list.filter((p) => p.id !== playerId);
}

/**
 * Idempotently appends a chat message (deduplicates by message.id to handle reconnect races).
 */
export function appendUniqueChatMessage(
  list: ChatMessage[],
  incoming: ChatMessage,
  maxMessages = 60,
): ChatMessage[] {
  if (list.some((m) => m.id === incoming.id)) return list;
  const next = [...list, incoming];
  return next.length > maxMessages ? next.slice(next.length - maxMessages) : next;
}

/**
 * Idempotently prepends a shared blessing lantern (deduplicates by lantern.id).
 */
export function appendUniqueLantern(
  list: LitLantern[],
  incoming: LitLantern,
  maxLanterns = 30,
): LitLantern[] {
  if (list.some((l) => l.id === incoming.id)) return list;
  const next = [incoming, ...list];
  return next.length > maxLanterns ? next.slice(0, maxLanterns) : next;
}

/**
 * Sanitizes a Firestore document ID so it matches ^[a-zA-Z0-9_-]+$ and <= 64 chars.
 */
export function sanitizeFirestoreId(raw: string, fallbackPrefix = 'item'): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  if (cleaned.length > 0) return cleaned;
  return `${fallbackPrefix}-${Date.now()}`;
}

/**
 * Wraps yaw angle into [-PI, PI] so it always satisfies Firestore rule bounds [-10, 10].
 */
export function clampYawForRules(yaw: number): number {
  if (!Number.isFinite(yaw)) return Math.PI;
  let wrapped = ((yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  if (!Number.isFinite(wrapped)) wrapped = Math.PI;
  return Math.round(wrapped * 100) / 100;
}

/**
 * Determines whether a Firestore remote player presence record is currently active and fresh.
 * When `updatedAtMs` is null (local pending serverTimestamp latency compensation), an active
 * record is treated as fresh.
 */
export function isPresenceFresh(
  isActive: boolean,
  updatedAtMs: number | null,
  nowMs: number,
  maxAgeMs = 60_000,
): boolean {
  if (!isActive) return false;
  if (updatedAtMs === null) return true;
  return nowMs - updatedAtMs <= maxAgeMs;
}

/**
 * Deterministically sorts timestamped records ascending (oldest first) for chat history.
 */
export function sortByCreatedAtAsc<T extends { createdAtMs: number; id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.createdAtMs - b.createdAtMs || a.id.localeCompare(b.id));
}

/**
 * Deterministically sorts timestamped records descending (newest first) for lantern wall.
 */
export function sortByCreatedAtDesc<T extends { createdAtMs: number; id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.createdAtMs - a.createdAtMs || b.id.localeCompare(a.id));
}

