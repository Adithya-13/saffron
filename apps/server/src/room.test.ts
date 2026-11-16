import { describe, expect, it } from 'vitest';
import type { ClientMessage } from '@saffron/protocol';
import {
  UNDO_VOTE_MS,
  createRoom,
  expireUndo,
  handleMessage,
  isBotTurn,
  nextWakeAt,
  runBotTurn,
  setConnected,
  syncFor,
  upgradeRoom,
} from './room.ts';
import type { Ctx, Outcome, RoomState } from './room.ts';

let counter = 0;
const ctx = (now = 1_000): Ctx => ({ now, seed: 42, randomId: () => `id${++counter}` });

const send = (room: RoomState, sender: string | null, msg: ClientMessage, now?: number): Outcome =>
  handleMessage(room, sender, msg, ctx(now));

const ok = (outcome: Outcome): RoomState => {
  const error = outcome.replies.find((r) => r.type === 'error');
  if (error) throw new Error(JSON.stringify(error));
  return outcome.room;
};

const joinAs = (
  room: RoomState,
  name: string,
): { room: RoomState; seatId: string; token: string } => {
  const outcome = send(room, null, { type: 'join', name });
  const welcome = outcome.replies[0];
  if (welcome?.type !== 'welcome' || !welcome.seatId || !welcome.token) throw new Error('no seat');
  return { room: outcome.room, seatId: welcome.seatId, token: welcome.token };
};

const twoHumans = () => {
  const a = joinAs(createRoom('ABCDE', 1), 'Ana');
  const b = joinAs(a.room, 'Budi');
  const room = ok(send(b.room, a.seatId, { type: 'start' }));
  return { room, a: a.seatId, b: b.seatId, tokenA: a.token };
};

const omit = <T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> =>
  Object.fromEntries(Object.entries(value).filter(([k]) => k !== key)) as Omit<T, K>;

const errorOf = (outcome: Outcome) => outcome.replies.find((r) => r.type === 'error');

describe('lobby', () => {
  it('makes the first joiner host and reconnects by token', () => {
    const a = joinAs(createRoom('ABCDE', 1), 'Ana');
    expect(a.room.hostSeatId).toBe(a.seatId);
    const offline = setConnected(a.room, a.seatId, false);
    const again = send(offline, null, { type: 'join', name: 'whatever', token: a.token });
    expect(again.bind).toBe(a.seatId);
    expect(again.room.seats).toHaveLength(1);
    expect(again.room.seats[0]?.connected).toBe(true);
  });

  it('only lets the host start, add bots and remove seats', () => {
    const a = joinAs(createRoom('ABCDE', 1), 'Ana');
    const b = joinAs(a.room, 'Budi');
    expect(errorOf(send(b.room, b.seatId, { type: 'start' }))).toEqual({
      type: 'error',
      code: 'notHost',
    });
    expect(errorOf(send(b.room, b.seatId, { type: 'addBot' }))).toEqual({
      type: 'error',
      code: 'notHost',
    });
    const removed = ok(send(b.room, a.seatId, { type: 'removeSeat', seatId: b.seatId }));
    expect(removed.seats).toHaveLength(1);
    expect(errorOf(send(removed, a.seatId, { type: 'start' }))).toEqual({
      type: 'error',
      code: 'notEnoughPlayers',
    });
  });

  it('lets only the host pick the theme in the lobby', () => {
    const a = joinAs(createRoom('ABCDE', 1), 'Ana');
    const b = joinAs(a.room, 'Budi');
    expect(b.room.theme).toBe('paper');
    expect(errorOf(send(b.room, b.seatId, { type: 'setTheme', theme: 'night' }))).toEqual({
      type: 'error',
      code: 'notHost',
    });
    const themed = ok(send(b.room, a.seatId, { type: 'setTheme', theme: 'harbour' }));
    const sync = syncFor(themed, a.seatId, []);
    expect(sync.type === 'sync' ? sync.room.theme : null).toBe('harbour');
  });

  it('seats up to eight merchants and starts a scaled game', () => {
    const a = joinAs(createRoom('ABCDE', 1), 'Ana');
    const full = Array.from({ length: 7 }).reduce<RoomState>(
      (room) => ok(send(room, a.seatId, { type: 'addBot' })),
      a.room,
    );
    expect(full.seats).toHaveLength(8);
    expect(new Set(full.seats.map((s) => s.name)).size).toBe(8);
    expect(errorOf(send(full, a.seatId, { type: 'addBot' }))).toEqual({
      type: 'error',
      code: 'roomFull',
    });
    const started = ok(send(full, a.seatId, { type: 'start' }));
    expect(started.game?.players).toHaveLength(8);
    expect(started.game?.targetPoints).toBe(12);
  });

  it('upgrades rooms stored before themes and per-table targets', () => {
    const { room } = twoHumans();
    if (!room.game) throw new Error('no game');
    const legacyGame = omit(room.game, 'targetPoints');
    const upgraded = upgradeRoom({
      ...omit(room, 'theme'),
      game: legacyGame,
      turnStart: legacyGame,
    });
    expect(upgraded.theme).toBe('paper');
    expect(upgraded.game?.targetPoints).toBe(15);
  });

  it('turns late joiners into spectators once full or started', () => {
    const { room } = twoHumans();
    const late = send(room, null, { type: 'join', name: 'Citra' });
    expect(late.replies[0]).toEqual({ type: 'welcome', seatId: null, token: null });
    expect(late.room.seats).toHaveLength(2);
    expect(syncFor(late.room, null, [])).toMatchObject({ type: 'sync', legal: [] });
  });

  it('rejects messages from sockets that have not joined', () => {
    expect(errorOf(send(createRoom('X', 1), null, { type: 'start' }))).toEqual({
      type: 'error',
      code: 'notJoined',
    });
  });
});

describe('play', () => {
  it('validates moves through the engine and emits events', () => {
    const { room, a, b } = twoHumans();
    expect(
      errorOf(send(room, b, { type: 'move', move: { type: 'takeDouble', spice: 'salt' } })),
    ).toEqual({ type: 'error', code: 'notYourTurn' });
    const outcome = send(room, a, { type: 'move', move: { type: 'takeDouble', spice: 'salt' } });
    expect(outcome.sync).toBe(true);
    expect(outcome.events.map((e) => e.type)).toEqual(['tokensTaken', 'turnStarted']);
    expect(outcome.room.log).toHaveLength(2);
  });

  it('runs bot turns and schedules wakeups', () => {
    const a = joinAs(createRoom('ABCDE', 1), 'Ana');
    const withBot = ok(send(a.room, a.seatId, { type: 'addBot' }));
    const started = ok(send(withBot, a.seatId, { type: 'start' }));
    expect(isBotTurn(started)).toBe(false);
    expect(nextWakeAt(started, 0)).toBeNull();
    const afterHuman = ok(
      send(started, a.seatId, { type: 'move', move: { type: 'takeDouble', spice: 'salt' } }),
    );
    expect(isBotTurn(afterHuman)).toBe(true);
    expect(nextWakeAt(afterHuman, 0)).toBeGreaterThan(0);
    const afterBot = runBotTurn(afterHuman);
    expect(afterBot?.room.game?.currentPlayer).toBe(0);
  });
});

describe('undo', () => {
  it('needs every other connected human to approve', () => {
    const { room, a, b } = twoHumans();
    const before = room.game;
    const moved = ok(send(room, a, { type: 'move', move: { type: 'takeDouble', spice: 'salt' } }));
    expect(errorOf(send(moved, b, { type: 'undoRequest' }))).toEqual({
      type: 'error',
      code: 'undoUnavailable',
    });
    const pending = ok(send(moved, a, { type: 'undoRequest' }));
    expect(pending.undoVote?.voters).toEqual([b]);
    expect(
      errorOf(send(pending, b, { type: 'move', move: { type: 'takeDouble', spice: 'salt' } })),
    ).toEqual({ type: 'error', code: 'undoPending' });
    const undone = ok(send(pending, b, { type: 'undoVote', approve: true }));
    expect(undone.game).toEqual(before);
    expect(undone.undoVote).toBeNull();
  });

  it('can be declined or expire', () => {
    const { room, a, b } = twoHumans();
    const moved = ok(send(room, a, { type: 'move', move: { type: 'takeDouble', spice: 'salt' } }));
    const pending = ok(send(moved, a, { type: 'undoRequest' }, 1_000));
    expect(ok(send(pending, b, { type: 'undoVote', approve: false })).game).toEqual(moved.game);
    expect(expireUndo(pending, ctx(1_000))).toBeNull();
    expect(expireUndo(pending, ctx(1_000 + UNDO_VOTE_MS))?.room.undoVote).toBeNull();
  });

  it('is instant with no other humans and gone once the next player acts', () => {
    const { room, a, b } = twoHumans();
    const moved = ok(send(room, a, { type: 'move', move: { type: 'takeDouble', spice: 'salt' } }));
    const solo = setConnected(moved, b, false);
    expect(ok(send(solo, a, { type: 'undoRequest' })).game).toEqual(room.game);
    const next = ok(
      send(moved, b, { type: 'move', move: { type: 'takeDouble', spice: 'pepper' } }),
    );
    expect(next.undoPoint?.actorId).toBe(b);
    expect(errorOf(send(next, a, { type: 'undoRequest' }))).toEqual({
      type: 'error',
      code: 'undoUnavailable',
    });
  });
});

describe('chat', () => {
  it('rate limits per seat', () => {
    const { room, a } = twoHumans();
    const first = send(room, a, { type: 'chat', text: 'hi' }, 5_000);
    expect(first.chat).toHaveLength(1);
    expect(errorOf(send(first.room, a, { type: 'chat', text: 'again' }, 5_100))).toEqual({
      type: 'error',
      code: 'rateLimited',
    });
  });
});
