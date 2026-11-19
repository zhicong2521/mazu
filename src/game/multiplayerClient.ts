import {
  normalizeRoomId,
  type ClientWsMessage,
  type ServerWsMessage,
} from './multiplayer';
import type { AvatarConfig, EmoteType, LitLantern } from './types';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting';

export interface MultiplayerClientCallbacks {
  onStatusChange: (status: ConnectionStatus) => void;
  onMessage: (msg: ServerWsMessage) => void;
}

/**
 * Resilient WebSocket client for real-time online temple multiplayer.
 * Supports automatic room join, throttled transform updates, queued non-move events,
 * and exponential-backoff reconnection with full state reconciliation.
 */
export class TempleMultiplayerClient {
  private ws: WebSocket | null = null;
  private roomId: string;
  private callbacks: MultiplayerClientCallbacks;
  private disposed = false;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private pendingQueue: ClientWsMessage[] = [];

  private latestJoinState: {
    avatar: AvatarConfig;
    x: number;
    z: number;
    yaw: number;
    holdingIncense: boolean;
  };

  // Throttle state for player:move
  private lastMoveSentAt = 0;
  private lastSentTransform = { x: 0, z: 0, yaw: 0, emote: 'idle' as EmoteType, holdingIncense: false };

  constructor(
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
    this.roomId = normalizeRoomId(roomId);
    this.latestJoinState = { ...initialJoin };
    this.callbacks = callbacks;
    this.connect();
  }

  public getRoomId(): string {
    return this.roomId;
  }

  private buildWsUrl(): string {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws?room=${encodeURIComponent(this.roomId)}`;
  }

  private connect(): void {
    if (this.disposed) return;
    this.callbacks.onStatusChange(this.reconnectAttempts === 0 ? 'connecting' : 'reconnecting');

    let socket: WebSocket;
    try {
      socket = new WebSocket(this.buildWsUrl());
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = socket;

    socket.onopen = () => {
      if (this.disposed || this.ws !== socket) return;
      this.reconnectAttempts = 0;
      this.callbacks.onStatusChange('connected');

      // Send authoritative join payload immediately on open/reconnect
      this.rawSend({
        type: 'player:join',
        avatar: this.latestJoinState.avatar,
        x: this.latestJoinState.x,
        z: this.latestJoinState.z,
        yaw: this.latestJoinState.yaw,
        holdingIncense: this.latestJoinState.holdingIncense,
      });

      // Flush any queued non-movement actions made while disconnected
      while (this.pendingQueue.length > 0) {
        const queued = this.pendingQueue.shift()!;
        this.rawSend(queued);
      }
    };

    socket.onmessage = (event) => {
      if (this.disposed) return;
      try {
        const parsed = JSON.parse(String(event.data)) as ServerWsMessage;
        this.callbacks.onMessage(parsed);
      } catch {
        // Ignore malformed server frames
      }
    };

    socket.onclose = () => {
      if (this.disposed || this.ws !== socket) return;
      this.ws = null;
      this.scheduleReconnect();
    };

    socket.onerror = () => {
      // onclose will trigger reconnection cleanly
    };
  }

  private scheduleReconnect(): void {
    if (this.disposed) return;
    this.callbacks.onStatusChange('reconnecting');
    const delay = Math.min(8000, 1000 * Math.pow(2, this.reconnectAttempts));
    this.reconnectAttempts += 1;
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private rawSend(payload: ClientWsMessage): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }

  private sendOrQueue(payload: ClientWsMessage): void {
    if (!this.rawSend(payload)) {
      if (this.pendingQueue.length < 25) {
        this.pendingQueue.push(payload);
      }
    }
  }

  /**
   * Throttled movement & state sync (~12.5 Hz) — only transmits when values changed.
   */
  public sendMove(
    x: number,
    z: number,
    yaw: number,
    emote: EmoteType,
    holdingIncense: boolean,
    force = false,
  ): void {
    this.latestJoinState.x = x;
    this.latestJoinState.z = z;
    this.latestJoinState.yaw = yaw;
    this.latestJoinState.holdingIncense = holdingIncense;

    const now = performance.now();
    const moved =
      Math.hypot(x - this.lastSentTransform.x, z - this.lastSentTransform.z) > 0.03 ||
      Math.abs(yaw - this.lastSentTransform.yaw) > 0.05 ||
      emote !== this.lastSentTransform.emote ||
      holdingIncense !== this.lastSentTransform.holdingIncense;

    if (!force && (!moved || now - this.lastMoveSentAt < 80)) {
      return;
    }

    this.lastMoveSentAt = now;
    this.lastSentTransform = { x, z, yaw, emote, holdingIncense };

    this.rawSend({
      type: 'player:move',
      x: Math.round(x * 100) / 100,
      z: Math.round(z * 100) / 100,
      yaw: Math.round(yaw * 100) / 100,
      emote,
      holdingIncense,
    });
  }

  public sendAvatarUpdate(avatar: AvatarConfig): void {
    this.latestJoinState.avatar = avatar;
    this.sendOrQueue({ type: 'player:avatar', avatar });
  }

  public sendChat(id: string, text: string): void {
    this.sendOrQueue({ type: 'chat:send', id, text });
  }

  public sendLanternLit(lantern: LitLantern): void {
    this.sendOrQueue({ type: 'lantern:light', lantern });
  }

  public sendBellRing(): void {
    this.sendOrQueue({ type: 'bell:ring' });
  }

  public sendRitualAnnounce(id: string, text: string): void {
    this.sendOrQueue({ type: 'ritual:announce', id, text });
  }

  public switchRoom(nextRoomId: string): void {
    const normalized = normalizeRoomId(nextRoomId);
    if (normalized === this.roomId) return;
    this.roomId = normalized;
    this.reconnectAttempts = 0;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      const old = this.ws;
      this.ws = null;
      old.close();
    }
    this.connect();
  }

  public dispose(): void {
    this.disposed = true;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      const old = this.ws;
      this.ws = null;
      old.close();
    }
  }
}
