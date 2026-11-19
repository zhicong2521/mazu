import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import {
  appendUniqueChatMessage,
  appendUniqueLantern,
  normalizeRoomId,
  sanitizeAvatarConfig,
  sanitizeChatText,
  sanitizeEmote,
  sanitizeRemoteTransform,
  type ClientWsMessage,
  type RemotePlayerState,
  type ServerWsMessage,
} from './src/game/multiplayer.ts';
import type { ChatMessage, LitLantern } from './src/game/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;

interface ConnectedClient {
  id: string;
  roomId: string;
  ws: WebSocket;
  isAlive: boolean;
  player: RemotePlayerState;
}

interface TempleRoom {
  id: string;
  clients: Map<string, ConnectedClient>;
  messages: ChatMessage[];
  lanterns: LitLantern[];
}

const rooms = new Map<string, TempleRoom>();

function getOrCreateRoom(roomId: string): TempleRoom {
  const normalized = normalizeRoomId(roomId);
  let room = rooms.get(normalized);
  if (!room) {
    room = {
      id: normalized,
      clients: new Map(),
      messages: [
        {
          id: `sys-welcome-${normalized}`,
          sender: '廟祝公告',
          text:
            normalized === 'main'
              ? '歡迎來到《雲端天后宮》線上本殿大廳！來自各地的香客皆可即時同殿參拜、聊天祈福與共點光明燈。'
              : `歡迎來到私人進香房「${normalized}」！可複製連結邀請親友一同入廟參拜。`,
          timestamp: '剛剛',
          isSystem: true,
        },
      ],
      lanterns: [],
    };
    rooms.set(normalized, room);
  }
  return room;
}

function sendJson(ws: WebSocket, payload: ServerWsMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastRoom(room: TempleRoom, payload: ServerWsMessage, excludeId?: string): void {
  const serialized = JSON.stringify(payload);
  for (const client of room.clients.values()) {
    if (excludeId && client.id === excludeId) continue;
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(serialized);
    }
  }
}

function formatNowLabel(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json());

  // Lightweight room presence REST endpoint
  app.get('/api/rooms/:roomId', (req, res) => {
    const id = normalizeRoomId(req.params.roomId);
    const room = rooms.get(id);
    res.json({
      roomId: id,
      onlineCount: room ? room.clients.size : 0,
      lanternCount: room ? room.lanterns.length : 0,
    });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const reqUrl = new URL(req.url || '/ws', `http://${req.headers.host || 'localhost'}`);
    const roomId = normalizeRoomId(reqUrl.searchParams.get('room'));
    const room = getOrCreateRoom(roomId);
    const clientId = `pilgrim-${crypto.randomBytes(5).toString('hex')}`;

    const initialPlayer: RemotePlayerState = {
      id: clientId,
      x: (Math.random() - 0.5) * 2.4,
      z: 4.2 + (Math.random() - 0.5) * 0.8,
      yaw: Math.PI,
      emote: 'idle',
      holdingIncense: false,
      avatar: sanitizeAvatarConfig(null),
    };

    const client: ConnectedClient = {
      id: clientId,
      roomId,
      ws,
      isAlive: true,
      player: initialPlayer,
    };

    let joined = false;

    ws.on('pong', () => {
      client.isAlive = true;
    });

    ws.on('message', (rawBuf) => {
      let msg: ClientWsMessage;
      try {
        msg = JSON.parse(rawBuf.toString()) as ClientWsMessage;
      } catch {
        return;
      }
      if (!msg || typeof msg.type !== 'string') return;

      if (msg.type === 'player:join') {
        const avatar = sanitizeAvatarConfig(msg.avatar);
        const transform = sanitizeRemoteTransform(msg.x, msg.z, msg.yaw);
        client.player = {
          id: clientId,
          x: transform.x,
          z: transform.z,
          yaw: transform.yaw,
          emote: 'idle',
          holdingIncense: Boolean(msg.holdingIncense),
          avatar,
        };

        const wasJoined = joined;
        joined = true;
        room.clients.set(clientId, client);

        // Send authoritative room snapshot to joining client
        const otherPlayers = Array.from(room.clients.values())
          .filter((c) => c.id !== clientId)
          .map((c) => c.player);

        sendJson(ws, {
          type: 'room:init',
          selfId: clientId,
          roomId,
          players: otherPlayers,
          messages: room.messages,
          lanterns: room.lanterns,
        });

        // Notify peers in the same room
        broadcastRoom(
          room,
          {
            type: 'player:joined',
            player: client.player,
          },
          clientId,
        );

        if (!wasJoined) {
          const joinNotice: ChatMessage = {
            id: `sys-join-${clientId}`,
            sender: '廟祝廣播',
            text: `香客「${avatar.name}」踏入本殿同參祈福！`,
            timestamp: formatNowLabel(),
            isSystem: true,
          };
          room.messages = appendUniqueChatMessage(room.messages, joinNotice);
          broadcastRoom(room, { type: 'chat:message', message: joinNotice });
        }
        return;
      }

      if (!joined) return;

      if (msg.type === 'player:move') {
        const transform = sanitizeRemoteTransform(msg.x, msg.z, msg.yaw);
        client.player.x = transform.x;
        client.player.z = transform.z;
        client.player.yaw = transform.yaw;
        client.player.emote = sanitizeEmote(msg.emote);
        client.player.holdingIncense = Boolean(msg.holdingIncense);

        broadcastRoom(
          room,
          {
            type: 'player:updated',
            id: clientId,
            x: client.player.x,
            z: client.player.z,
            yaw: client.player.yaw,
            emote: client.player.emote,
            holdingIncense: client.player.holdingIncense,
          },
          clientId,
        );
        return;
      }

      if (msg.type === 'player:avatar') {
        client.player.avatar = sanitizeAvatarConfig(msg.avatar);
        broadcastRoom(
          room,
          {
            type: 'player:updated',
            id: clientId,
            x: client.player.x,
            z: client.player.z,
            yaw: client.player.yaw,
            emote: client.player.emote,
            holdingIncense: client.player.holdingIncense,
            avatar: client.player.avatar,
          },
          clientId,
        );
        return;
      }

      if (msg.type === 'chat:send') {
        const text = sanitizeChatText(msg.text);
        if (!text) return;
        const safeId =
          typeof msg.id === 'string' && msg.id.trim().length > 0
            ? msg.id.slice(0, 64)
            : `chat-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
        const chatMsg: ChatMessage = {
          id: safeId,
          sender: client.player.avatar.name,
          text,
          timestamp: formatNowLabel(),
        };
        room.messages = appendUniqueChatMessage(room.messages, chatMsg);
        broadcastRoom(room, {
          type: 'chat:message',
          message: chatMsg,
          playerId: clientId,
        });
        return;
      }

      if (msg.type === 'ritual:announce') {
        const text = sanitizeChatText(msg.text);
        if (!text) return;
        const safeId =
          typeof msg.id === 'string' && msg.id.trim().length > 0
            ? msg.id.slice(0, 64)
            : `ritual-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
        const sysMsg: ChatMessage = {
          id: safeId,
          sender: '祈福喜報',
          text,
          timestamp: formatNowLabel(),
          isSystem: true,
        };
        room.messages = appendUniqueChatMessage(room.messages, sysMsg);
        broadcastRoom(room, { type: 'chat:message', message: sysMsg });
        return;
      }

      if (msg.type === 'lantern:light') {
        const rawL = msg.lantern;
        if (!rawL || typeof rawL !== 'object') return;
        const allowedTypes = new Set<LitLantern['type']>(['平安燈', '姻緣燈', '財神燈', '文昌燈']);
        const safeType = allowedTypes.has(rawL.type) ? rawL.type : '平安燈';
        const usedSlots = new Set(room.lanterns.map((l) => l.slotIndex));
        let slotIndex =
          typeof rawL.slotIndex === 'number' && Number.isInteger(rawL.slotIndex)
            ? ((rawL.slotIndex % 30) + 30) % 30
            : 0;
        if (usedSlots.has(slotIndex)) {
          for (let s = 0; s < 30; s++) {
            if (!usedSlots.has(s)) {
              slotIndex = s;
              break;
            }
          }
        }
        const safeLantern: LitLantern = {
          id:
            typeof rawL.id === 'string' && rawL.id.trim().length > 0
              ? rawL.id.slice(0, 64)
              : `lamp-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          ownerName: client.player.avatar.name,
          type: safeType,
          wish: sanitizeChatText(rawL.wish) || '祈求平安順心、萬事大吉',
          slotIndex,
        };
        room.lanterns = appendUniqueLantern(room.lanterns, safeLantern);
        broadcastRoom(room, { type: 'lantern:lit', lantern: safeLantern });
        return;
      }

      if (msg.type === 'bell:ring') {
        broadcastRoom(room, {
          type: 'bell:rung',
          playerId: clientId,
          byName: client.player.avatar.name,
        });
      }
    });

    ws.on('close', () => {
      if (room.clients.has(clientId)) {
        room.clients.delete(clientId);
        broadcastRoom(room, { type: 'player:left', id: clientId });
      }
      // Clean up empty private rooms (keep 'main' persistent in memory)
      if (room.id !== 'main' && room.clients.size === 0 && room.lanterns.length === 0) {
        rooms.delete(room.id);
      }
    });
  });

  // Periodic heartbeat to evict dead sockets
  const heartbeat = setInterval(() => {
    for (const room of rooms.values()) {
      for (const client of room.clients.values()) {
        if (!client.isAlive) {
          client.ws.terminate();
          continue;
        }
        client.isAlive = false;
        client.ws.ping();
      }
    }
  }, 25000);
  heartbeat.unref();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[雲端天后宮] Multiplayer server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
