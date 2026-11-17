import { describe, expect, it } from 'vitest';
import type { ClientMessage } from '@saffron/protocol';
import {
  DISCONNECT_GRACE_MS,
  EXTEND_MS,
  TURN_MS,
  UNDO_VOTE_MS,
  createRoom,
  disconnect,
  expireUndo,
  handleMessage,
  isAutoTurn,
  nextWakeAt,
  runBotTurn,
  setConnected,
  syncFor,
  tick,
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
    const sync = syncFor(themed, a.seatId, [], 0);
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
      ...omit(omit(omit(room, 'theme'), 'clock'), 'autopilot'),
      game: legacyGame,
      turnStart: legacyGame,
    });
    expect(upgraded.theme).toBe('paper');
    expect(upgraded.game?.targetPoints).toBe(15);
    expect(upgraded.clock).toBeNull();
    expect(upgraded.autopilot).toEqual([]);
  });

  it('turns late joiners into spectators once full or started', () => {
    const { room } = twoHumans();
    const late = send(room, null, { type: 'join', name: 'Citra' });
    expect(late.replies[0]).toEqual({ type: 'welcome', seatId: null, token: null });
    expect(late.room.seats).toHaveLength(2);
    expect(syncFor(late.room, null, [], 0)).toMatchObject({ type: 'sync', legal: [] });
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
    expect(isAutoTurn(started)).toBe(false);
    expect(nextWakeAt(started, 0)).toBe(started.clock?.deadline);
    const afterHuman = ok(
      send(started, a.seatId, { type: 'move', move: { type: 'takeDouble', spice: 'salt' } }),
    );
    expect(isAutoTurn(afterHuman)).toBe(true);
    expect(afterHuman.clock).toBeNull();
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

const salt = { type: 'move', move: { type: 'takeDouble', spice: 'salt' } } as const;

describe('turn clock', () => {
  it('starts a clock for each human turn', () => {
    const { room, a, b } = twoHumans();
    expect(room.clock).toMatchObject({ seatId: a, deadline: 1_000 + TURN_MS, extended: false });
    const moved = ok(send(room, a, salt, 5_000));
    expect(moved.clock).toMatchObject({ seatId: b, deadline: 5_000 + TURN_MS });
    const chatted = send(moved, a, { type: 'chat', text: 'hi' }, 9_000).room;
    expect(chatted.clock).toEqual(moved.clock);
  });

  it('hands a timed out seat to autopilot until they take back control', () => {
    const { room, a, b } = twoHumans();
    const deadline = room.clock?.deadline ?? 0;
    expect(tick(room, ctx(deadline - 1))).toBeNull();
    const away = tick(room, ctx(deadline));
    expect(away?.room.autopilot).toEqual([a]);
    expect(away?.room.clock).toBeNull();
    if (!away) throw new Error('no timeout');
    expect(isAutoTurn(away.room)).toBe(true);
    const played = tick(away.room, ctx(deadline + 1_000));
    expect(played?.room.game?.currentPlayer).toBe(1);
    expect(played?.room.clock?.seatId).toBe(b);
    if (!played) throw new Error('no bot move');
    const back = ok(send(played.room, a, { type: 'resume' }, deadline + 2_000));
    expect(back.autopilot).toEqual([]);
  });

  it('gives a fresh clock when taking back control on your own turn', () => {
    const { room, a } = twoHumans();
    const deadline = room.clock?.deadline ?? 0;
    const away = tick(room, ctx(deadline))?.room;
    if (!away) throw new Error('no timeout');
    const back = ok(send(away, a, { type: 'resume' }, deadline + 100));
    expect(back.clock).toMatchObject({ seatId: a, deadline: deadline + 100 + TURN_MS });
  });

  it('extends the clock once per turn', () => {
    const { room, a, b } = twoHumans();
    const deadline = room.clock?.deadline ?? 0;
    expect(send(room, b, { type: 'stillHere' }).sync).toBe(false);
    const extended = ok(send(room, a, { type: 'stillHere' }));
    expect(extended.clock).toMatchObject({ deadline: deadline + EXTEND_MS, extended: true });
    expect(send(extended, a, { type: 'stillHere' }).sync).toBe(false);
  });

  it('shortens the clock to a grace period when the player drops', () => {
    const { room, a } = twoHumans();
    const dropped = disconnect(room, a, 2_000).room;
    expect(dropped.clock?.deadline).toBe(2_000 + DISCONNECT_GRACE_MS);
    const later = send(dropped, a, { type: 'chat', text: 'x' }, 4_000).room;
    expect(later.clock?.deadline).toBe(2_000 + DISCONNECT_GRACE_MS);
  });

  it('pauses during an undo vote and restarts after it', () => {
    const { room, a } = twoHumans();
    const moved = ok(send(room, a, salt));
    const pending = ok(send(moved, a, { type: 'undoRequest' }, 3_000));
    expect(pending.clock).toBeNull();
    const expired = tick(pending, ctx(3_000 + UNDO_VOTE_MS))?.room;
    expect(expired?.clock?.deadline).toBe(3_000 + UNDO_VOTE_MS + TURN_MS);
  });

  it('takes a manual move as being back', () => {
    const { room, a } = twoHumans();
    const away = tick(room, ctx(room.clock?.deadline ?? 0))?.room;
    if (!away) throw new Error('no timeout');
    expect(ok(send(away, a, salt)).autopilot).toEqual([]);
  });
});

describe('kick and leave', () => {
  it('kicks from the lobby by removing the seat', () => {
    const a = joinAs(createRoom('ABCDE', 1), 'Ana');
    const b = joinAs(a.room, 'Budi');
    const outcome = send(b.room, a.seatId, { type: 'removeSeat', seatId: b.seatId });
    expect(outcome.kick).toBe(b.seatId);
    expect(outcome.room.seats).toHaveLength(1);
  });

  it('hands a kicked player to a bot mid-game and voids their token', () => {
    const { room, a, b } = twoHumans();
    expect(errorOf(send(room, b, { type: 'removeSeat', seatId: a }))).toEqual({
      type: 'error',
      code: 'notHost',
    });
    const outcome = send(room, a, { type: 'removeSeat', seatId: b });
    expect(outcome.kick).toBe(b);
    const seat = outcome.room.seats.find((s) => s.id === b);
    expect(seat).toMatchObject({ kind: 'bot', token: null, name: 'Budi (bot)' });
    expect(outcome.room.game?.players).toHaveLength(2);
  });

  it('lets a player leave mid-game and passes host on', () => {
    const { room, a, b } = twoHumans();
    const outcome = send(room, a, { type: 'leave' });
    expect(outcome.bind).toBeNull();
    expect(outcome.room.hostSeatId).toBe(b);
    expect(outcome.room.clock).toBeNull();
    expect(isAutoTurn(outcome.room)).toBe(true);
  });

  it('lets a player leave the lobby', () => {
    const a = joinAs(createRoom('ABCDE', 1), 'Ana');
    const b = joinAs(a.room, 'Budi');
    const outcome = send(b.room, a.seatId, { type: 'leave' });
    expect(outcome.room.seats.map((s) => s.id)).toEqual([b.seatId]);
    expect(outcome.room.hostSeatId).toBe(b.seatId);
  });
});
