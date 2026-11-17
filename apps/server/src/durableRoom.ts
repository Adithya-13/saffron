import { DurableObject } from 'cloudflare:workers';
import { parseClientMessage } from '@saffron/protocol/schema';
import type { ServerMessage } from '@saffron/protocol';
import {
  createRoom,
  disconnect,
  handleMessage,
  nextWakeAt,
  syncFor,
  tick,
  upgradeRoom,
} from './room.ts';
import type { Ctx, Outcome, RoomState, StoredRoom } from './room.ts';
import { randomId, randomSeed } from './random.ts';

type Attachment = { readonly seatId: string | null };

const ROOM_KEY = 'room';

const attachmentOf = (ws: WebSocket): Attachment =>
  (ws.deserializeAttachment() as Attachment | null) ?? { seatId: null };

const send = (ws: WebSocket, message: ServerMessage): void => {
  try {
    ws.send(JSON.stringify(message));
  } catch {
    return;
  }
};

export class Room extends DurableObject {
  private async load(): Promise<RoomState | undefined> {
    const stored = await this.ctx.storage.get<StoredRoom>(ROOM_KEY);
    return stored && upgradeRoom(stored);
  }

  private context(): Ctx {
    return { now: Date.now(), randomId, seed: randomSeed() };
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const existing = await this.load();

    if (url.pathname.endsWith('/init')) {
      if (existing) return new Response('exists', { status: 409 });
      const code = url.searchParams.get('code') ?? '';
      await this.ctx.storage.put(ROOM_KEY, createRoom(code, randomSeed()));
      return new Response('ok');
    }

    if (!existing) return new Response('Room not found', { status: 404 });
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected websocket', { status: 426 });
    }
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({ seatId: null } satisfies Attachment);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  override async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    const room = await this.load();
    const message = typeof data === 'string' ? parseClientMessage(data) : null;
    if (!room) return;
    if (!message) {
      send(ws, { type: 'error', code: 'badMessage' });
      return;
    }
    await this.apply(handleMessage(room, attachmentOf(ws).seatId, message, this.context()), ws);
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    await this.disconnect(ws);
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    await this.disconnect(ws);
  }

  override async alarm(): Promise<void> {
    const room = await this.load();
    if (!room) return;
    const outcome = tick(room, this.context());
    if (outcome) await this.apply(outcome, null);
    else await this.schedule(room);
  }

  private async disconnect(ws: WebSocket): Promise<void> {
    const { seatId } = attachmentOf(ws);
    const room = await this.load();
    if (!room || seatId === null) return;
    const stillConnected = this.ctx
      .getWebSockets()
      .some((other) => other !== ws && attachmentOf(other).seatId === seatId);
    if (stillConnected) return;
    await this.apply(disconnect(room, seatId, Date.now()), null);
  }

  private async apply(outcome: Outcome, sender: WebSocket | null): Promise<void> {
    const { room } = outcome;
    await this.ctx.storage.put(ROOM_KEY, room);

    if (sender && outcome.bind !== undefined) {
      sender.serializeAttachment({ seatId: outcome.bind } satisfies Attachment);
    }
    for (const reply of outcome.replies) if (sender) send(sender, reply);

    const sockets = this.ctx.getWebSockets();
    if (outcome.kick !== undefined) {
      for (const ws of sockets) {
        if (attachmentOf(ws).seatId !== outcome.kick) continue;
        send(ws, { type: 'kicked' });
        ws.serializeAttachment({ seatId: null } satisfies Attachment);
      }
    }
    if (outcome.sync) {
      const now = Date.now();
      for (const ws of sockets) {
        send(ws, syncFor(room, attachmentOf(ws).seatId, outcome.events, now));
      }
    }
    const justJoined = sender && outcome.bind !== undefined ? sender : null;
    if (justJoined) send(justJoined, { type: 'chat', messages: room.chat, replace: true });
    if (outcome.chat.length > 0) {
      for (const ws of sockets) {
        if (ws !== justJoined) send(ws, { type: 'chat', messages: outcome.chat, replace: false });
      }
    }
    await this.schedule(room);
  }

  private async schedule(room: RoomState): Promise<void> {
    const wake = nextWakeAt(room, Date.now());
    if (wake === null) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    const current = await this.ctx.storage.getAlarm();
    if (current === null || wake < current) await this.ctx.storage.setAlarm(wake);
  }
}
