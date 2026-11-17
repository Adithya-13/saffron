import { describe, expect, it } from 'vitest';
import { START_INTRO_MS } from '@saffron/protocol';
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

  it('picks the theme with the most votes, host breaking ties', () => {
    const a = joinAs(createRoom('ABCDE', 1), 'Ana');
    const b = joinAs(a.room, 'Budi');
    const c = joinAs(b.room, 'Citra');
    expect(c.room.theme).toBe('paper');
    const vote = (room: RoomState, seat: string, theme: 'paper' | 'night' | 'harbour') =>
      ok(send(room, seat, { type: 'setTheme', theme }));
    const budiNight = vote(c.room, b.seatId, 'night');
    expect(budiNight.theme).toBe('night');
    const anaHarbour = vote(budiNight, a.seatId, 'harbour');
    expect(anaHarbour.theme).toBe('harbour');
    const citraNight = vote(anaHarbour, c.seatId, 'night');
    expect(citraNight.theme).toBe('night');
    const sync = syncFor(citraNight, a.seatId, [], 0);
    expect(sync.type === 'sync' ? sync.room.seats.map((s) => s.themeVote) : null).toEqual([
      'harbour',
      'night',
      'night',
    ]);
    const citraGone = ok(send(citraNight, c.seatId, { type: 'leave' }));
    expect(citraGone.theme).toBe('harbour');
  });

  it('only takes theme votes in the lobby', () => {
    const { room, b } = twoHumans();
    expect(errorOf(send(room, b, { type: 'setTheme', theme: 'night' }))).toEqual({
      type: 'error',
      code: 'notInLobby',
    });
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
    expect(started.game?.targetPoints).toBe(15);
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

  it('turns late joiners into viewers once full or started', () => {
    const { room } = twoHumans();
    const late = send(room, null, { type: 'join', name: 'Citra' });
    const welcome = late.replies[0];
    expect(welcome).toMatchObject({ type: 'welcome', seatId: null });
    if (welcome?.type !== 'welcome' || !welcome.viewerId) throw new Error('no viewer');
    expect(late.bind).toBe(welcome.viewerId);
    expect(late.room.seats).toHaveLength(2);
    expect(late.room.viewers.map((v) => v.name)).toEqual(['Citra']);
    expect(syncFor(late.room, welcome.viewerId, [], 0)).toMatchObject({
      type: 'sync',
      legal: [],
      room: { viewers: [{ id: welcome.viewerId, name: 'Citra' }] },
    });
  });

  it('rejects messages from sockets that have not joined', () => {
    expect(errorOf(send(createRoom('X', 1), null, { type: 'start' }))).toEqual({
      type: 'error',
      code: 'notJoined',
    });
  });
});

const watchAs = (
  room: RoomState,
  name: string,
): { room: RoomState; viewerId: string; token: string } => {
  const outcome = send(room, null, { type: 'join', name, watch: true });
  const welcome = outcome.replies[0];
  if (welcome?.type !== 'welcome' || !welcome.viewerId || !welcome.token)
    throw new Error('no viewer');
  return { room: outcome.room, viewerId: welcome.viewerId, token: welcome.token };
};

describe('opening', () => {
  const seatedRoom = (count: number): { room: RoomState; ids: string[] } => {
    let room = createRoom('ABCDE', 1);
    const ids: string[] = [];
    for (const name of ['Ana', 'Budi', 'Citra', 'Dewi'].slice(0, count)) {
      const joined = joinAs(room, name);
      room = joined.room;
      ids.push(joined.seatId);
    }
    return { room, ids };
  };

  it('picks the first merchant from the seed and keeps seat order around the table', () => {
    const { room, ids } = seatedRoom(4);
    const started = handleMessage(
      room,
      ids[0] ?? null,
      { type: 'start' },
      {
        now: 1_000,
        seed: 6,
        randomId: () => `x${++counter}`,
      },
    ).room;
    expect(started.game?.players.map((p) => p.id)).toEqual([ids[2], ids[3], ids[0], ids[1]]);
    expect(started.chat.at(-1)?.text).toBe('The market opens. Citra goes first');
  });

  it('holds a bot opener until the intro has played', () => {
    const a = joinAs(createRoom('ABCDE', 1), 'Ana');
    const withBot = ok(send(a.room, a.seatId, { type: 'addBot' }));
    const started = handleMessage(
      withBot,
      a.seatId,
      { type: 'start' },
      {
        now: 1_000,
        seed: 1,
        randomId: () => `y${++counter}`,
      },
    ).room;
    expect(isAutoTurn(started)).toBe(true);
    expect(nextWakeAt(started, 1_000)).toBe(1_000 + START_INTRO_MS);
    expect(tick(started, ctx(1_000 + START_INTRO_MS - 1))).toBeNull();
    expect(tick(started, ctx(1_000 + START_INTRO_MS))?.events.length).toBeGreaterThan(0);
  });
});

describe('pause', () => {
  const salt = { type: 'move', move: { type: 'takeDouble', spice: 'salt' } } as const;

  it('lets only the host pause, and freezes moves, bots and the clock', () => {
    const { room, a, b } = twoHumans();
    expect(errorOf(send(room, b, { type: 'setPaused', paused: true }))).toEqual({
      type: 'error',
      code: 'notHost',
    });
    const paused = ok(send(room, a, { type: 'setPaused', paused: true }, 10_000));
    expect(paused.pausedAt).toBe(10_000);
    expect(paused.chat.at(-1)?.text).toBe('Ana paused the game');
    expect(errorOf(send(paused, a, salt, 11_000))).toEqual({ type: 'error', code: 'paused' });
    expect(nextWakeAt(paused, 11_000)).toBeNull();
    expect(tick(paused, ctx((paused.clock?.deadline ?? 0) + 1))).toBeNull();
    expect(send(paused, b, { type: 'chat', text: 'brb' }, 12_000).chat).toHaveLength(1);
  });

  it('gives back the frozen time on resume', () => {
    const { room, a } = twoHumans();
    const deadline = room.clock?.deadline ?? 0;
    const paused = ok(send(room, a, { type: 'setPaused', paused: true }, 10_000));
    const resumed = ok(send(paused, a, { type: 'setPaused', paused: false }, 70_000));
    expect(resumed.pausedAt).toBeNull();
    expect(resumed.clock?.deadline).toBe(deadline + 60_000);
    expect(resumed.chat.at(-1)?.text).toBe('Ana resumed the game');
    expect(errorOf(send(resumed, a, salt, 71_000))).toBeUndefined();
  });

  it('keeps game time: starts after the intro, skips pauses, stops at the end', () => {
    const { room, a } = twoHumans();
    expect(room.gameTime).toEqual({
      startedAt: 1_000 + START_INTRO_MS,
      pausedMs: 0,
      endedAt: null,
    });
    const paused = ok(send(room, a, { type: 'setPaused', paused: true }, 10_000));
    const resumed = ok(send(paused, a, { type: 'setPaused', paused: false }, 70_000));
    expect(resumed.gameTime?.pausedMs).toBe(60_000);
    const over: RoomState = { ...resumed, status: 'finished' };
    const ended = ok(send(over, a, { type: 'chat', text: 'gg' }, 90_000));
    expect(ended.gameTime?.endedAt).toBe(90_000);
    const later = ok(send(ended, a, { type: 'chat', text: 'again?' }, 120_000));
    expect(later.gameTime?.endedAt).toBe(90_000);
    expect(ok(send(later, a, { type: 'rematch' }, 121_000)).gameTime).toBeNull();
  });

  it('only pauses a game in progress', () => {
    const a = joinAs(createRoom('ABCDE', 1), 'Ana');
    expect(errorOf(send(a.room, a.seatId, { type: 'setPaused', paused: true }))).toEqual({
      type: 'error',
      code: 'notPlaying',
    });
  });
});

describe('viewers', () => {
  it('lets someone watch the lobby without taking a seat', () => {
    const a = joinAs(createRoom('ABCDE', 1), 'Ana');
    const v = watchAs(a.room, 'Vera');
    expect(v.room.seats).toHaveLength(1);
    expect(v.room.viewers).toHaveLength(1);
    expect(v.room.chat.at(-1)?.text).toBe('Vera is watching');
  });

  it('lets viewers chat, tagged as watching, with the same cooldown', () => {
    const { room } = twoHumans();
    const v = watchAs(room, 'Vera');
    const said = send(v.room, v.viewerId, { type: 'chat', text: 'go Ana' }, 5_000);
    expect(said.chat).toEqual([
      expect.objectContaining({ seatId: v.viewerId, name: 'Vera', text: 'go Ana', watching: true }),
    ]);
    expect(errorOf(send(said.room, v.viewerId, { type: 'chat', text: 'again' }, 5_100))).toEqual({
      type: 'error',
      code: 'rateLimited',
    });
  });

  it('keeps viewers out of play and host actions', () => {
    const { room } = twoHumans();
    const v = watchAs(room, 'Vera');
    const move = { type: 'move', move: { type: 'takeDouble', spice: 'salt' } } as const;
    expect(errorOf(send(v.room, v.viewerId, move))).toBeDefined();
    expect(errorOf(send(v.room, v.viewerId, { type: 'undoRequest' }))).toBeDefined();
    expect(errorOf(send(v.room, v.viewerId, { type: 'closeRoom' }))).toEqual({
      type: 'error',
      code: 'notHost',
    });
    expect(errorOf(send(v.room, v.viewerId, { type: 'takeSeat' }))).toEqual({
      type: 'error',
      code: 'notInLobby',
    });
  });

  it('reconnects a viewer by token and hides them while away', () => {
    const v = watchAs(createRoom('ABCDE', 1), 'Vera');
    const away = disconnect(v.room, v.viewerId, 0).room;
    expect(syncFor(away, null, [], 0)).toMatchObject({ room: { viewers: [] } });
    const back = send(away, null, { type: 'join', name: 'x', token: v.token });
    expect(back.bind).toBe(v.viewerId);
    expect(back.room.viewers).toHaveLength(1);
    expect(back.room.viewers[0]?.connected).toBe(true);
  });

  it('moves a viewer into an open lobby seat, keeping their token', () => {
    const a = joinAs(createRoom('ABCDE', 1), 'Ana');
    const v = watchAs(a.room, 'Vera');
    const seated = send(v.room, v.viewerId, { type: 'takeSeat' });
    expect(seated.replies[0]).toEqual({
      type: 'welcome',
      seatId: v.viewerId,
      viewerId: null,
      token: v.token,
    });
    expect(seated.room.viewers).toHaveLength(0);
    expect(seated.room.seats.map((s) => s.name)).toEqual(['Ana', 'Vera']);
    const back = send(seated.room, null, { type: 'join', name: 'x', token: v.token });
    expect(back.bind).toBe(v.viewerId);
    expect(back.room.seats).toHaveLength(2);
  });

  it('lets only the host remove a viewer', () => {
    const a = joinAs(createRoom('ABCDE', 1), 'Ana');
    const b = joinAs(a.room, 'Budi');
    const v = watchAs(b.room, 'Vera');
    const remove = { type: 'removeSeat', seatId: v.viewerId } as const;
    expect(errorOf(send(v.room, b.seatId, remove))).toEqual({ type: 'error', code: 'notHost' });
    expect(errorOf(send(v.room, v.viewerId, remove))).toEqual({ type: 'error', code: 'notHost' });
    const removed = send(v.room, a.seatId, remove);
    expect(removed.kick).toBe(v.viewerId);
    expect(removed.room.viewers).toHaveLength(0);
    const back = send(removed.room, null, { type: 'join', name: 'Vera', token: v.token });
    expect(back.room.viewers.map((x) => x.id)).not.toContain(v.viewerId);
  });

  it('drops a viewer from the list when they leave', () => {
    const v = watchAs(createRoom('ABCDE', 1), 'Vera');
    const left = send(v.room, v.viewerId, { type: 'leave' });
    expect(left.bind).toBeNull();
    expect(left.room.viewers).toHaveLength(0);
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
    expect(room.clock).toMatchObject({
      seatId: a,
      deadline: 1_000 + START_INTRO_MS + TURN_MS,
      extended: false,
    });
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

describe('close room', () => {
  it('lets only the host close the room', () => {
    const { room, a, b } = twoHumans();
    expect(send(room, b, { type: 'closeRoom' }).close).toBeUndefined();
    expect(send(room, a, { type: 'closeRoom' }).close).toBe(true);
  });
});
