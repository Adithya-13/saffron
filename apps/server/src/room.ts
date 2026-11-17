import { CATALOG } from '@saffron/content';
import { chooseMove } from '@saffron/bot';
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  applyMove,
  createGame,
  eventFor,
  legalMoves,
  seedRng,
  viewFor,
} from '@saffron/engine';
import type { GameEvent, GameState, Move, RngState } from '@saffron/engine';
import { DEFAULT_THEME } from '@saffron/protocol';
import type {
  ChatMessage,
  ClientMessage,
  ErrorCode,
  RoomSnapshot,
  RoomStatus,
  SeatInfo,
  ServerMessage,
  Theme,
  UndoVoteInfo,
} from '@saffron/protocol';

export const BOT_DELAY_MS = 1100;
export const UNDO_VOTE_MS = 20_000;
export const CHAT_COOLDOWN_MS = 600;
export const TURN_MS = 60_000;
export const EXTEND_MS = 30_000;
export const DISCONNECT_GRACE_MS = 15_000;
const LOG_LIMIT = 300;
const CHAT_LIMIT = 100;
const SYSTEM_NAME = 'Bazaar';
const BOT_NAMES = [
  'Zafira (bot)',
  'Idris (bot)',
  'Leyla (bot)',
  'Tariq (bot)',
  'Nadia (bot)',
  'Omar (bot)',
  'Samira (bot)',
] as const;

export type Seat = SeatInfo & { readonly token: string | null; readonly lastChatAt: number };

export type UndoPoint = { readonly snapshot: GameState; readonly actorId: string };

export type TurnClock = {
  readonly seatId: string;
  readonly turn: number;
  readonly deadline: number;
  readonly extended: boolean;
};

export type RoomState = {
  readonly code: string;
  readonly status: RoomStatus;
  readonly hostSeatId: string | null;
  readonly theme: Theme;
  readonly seats: readonly Seat[];
  readonly game: GameState | null;
  readonly turnStart: GameState | null;
  readonly undoPoint: UndoPoint | null;
  readonly undoVote: UndoVoteInfo | null;
  readonly log: readonly GameEvent[];
  readonly chat: readonly ChatMessage[];
  readonly botRng: RngState;
  readonly clock: TurnClock | null;
  readonly autopilot: readonly string[];
};

export type Ctx = { readonly now: number; readonly randomId: () => string; readonly seed: number };

export type Outcome = {
  readonly room: RoomState;
  readonly replies: readonly ServerMessage[];
  readonly sync: boolean;
  readonly events: readonly GameEvent[];
  readonly chat: readonly ChatMessage[];
  readonly bind?: string | null;
  readonly kick?: string;
};

const unchanged = (room: RoomState, replies: readonly ServerMessage[] = []): Outcome => ({
  room,
  replies,
  sync: false,
  events: [],
  chat: [],
});

const failure = (room: RoomState, code: ErrorCode): Outcome =>
  unchanged(room, [{ type: 'error', code }]);

const synced = (room: RoomState, extra: Partial<Omit<Outcome, 'room' | 'sync'>> = {}): Outcome => ({
  room,
  replies: [],
  events: [],
  chat: [],
  ...extra,
  sync: true,
});

export const createRoom = (code: string, seed: number): RoomState => ({
  code,
  status: 'lobby',
  hostSeatId: null,
  theme: DEFAULT_THEME,
  seats: [],
  game: null,
  turnStart: null,
  undoPoint: null,
  undoVote: null,
  log: [],
  chat: [],
  botRng: seedRng(seed),
  clock: null,
  autopilot: [],
});

const LEGACY_TARGET_POINTS = 15;

type StoredGame = Omit<GameState, 'targetPoints'> & { readonly targetPoints?: number };
export type StoredRoom = Omit<
  RoomState,
  'theme' | 'game' | 'turnStart' | 'undoPoint' | 'clock' | 'autopilot'
> & {
  readonly theme?: Theme;
  readonly clock?: TurnClock | null;
  readonly autopilot?: readonly string[];
  readonly game: StoredGame | null;
  readonly turnStart: StoredGame | null;
  readonly undoPoint: (Omit<UndoPoint, 'snapshot'> & { readonly snapshot: StoredGame }) | null;
};

const upgradeGame = (game: StoredGame): GameState => ({
  ...game,
  targetPoints: game.targetPoints ?? LEGACY_TARGET_POINTS,
});

export const upgradeRoom = (stored: StoredRoom): RoomState => ({
  ...stored,
  theme: stored.theme ?? DEFAULT_THEME,
  clock: stored.clock ?? null,
  autopilot: stored.autopilot ?? [],
  game: stored.game && upgradeGame(stored.game),
  turnStart: stored.turnStart && upgradeGame(stored.turnStart),
  undoPoint: stored.undoPoint && {
    ...stored.undoPoint,
    snapshot: upgradeGame(stored.undoPoint.snapshot),
  },
});

const systemChat = (ctx: Ctx, text: string): ChatMessage => ({
  id: ctx.randomId(),
  seatId: null,
  name: SYSTEM_NAME,
  text,
  at: ctx.now,
});

const withChat = (room: RoomState, messages: readonly ChatMessage[]): RoomState => ({
  ...room,
  chat: [...room.chat, ...messages].slice(-CHAT_LIMIT),
});

const seatOf = (room: RoomState, seatId: string | null): Seat | undefined =>
  seatId === null ? undefined : room.seats.find((s) => s.id === seatId);

const nameOf = (room: RoomState, seatId: string): string => seatOf(room, seatId)?.name ?? 'Someone';

const currentSeatId = (room: RoomState): string | null =>
  room.game && !room.game.finished
    ? (room.game.players[room.game.currentPlayer]?.id ?? null)
    : null;

export const setConnected = (room: RoomState, seatId: string, connected: boolean): RoomState => ({
  ...room,
  seats: room.seats.map((s) => (s.id === seatId ? { ...s, connected } : s)),
});

const join = (
  room: RoomState,
  msg: Extract<ClientMessage, { type: 'join' }>,
  ctx: Ctx,
): Outcome => {
  const existing = msg.token ? room.seats.find((s) => s.token === msg.token) : undefined;
  if (existing) {
    return synced(setConnected(room, existing.id, true), {
      replies: [{ type: 'welcome', seatId: existing.id, token: existing.token }],
      bind: existing.id,
    });
  }
  if (room.status !== 'lobby' || room.seats.length >= MAX_PLAYERS) {
    return synced(room, { replies: [{ type: 'welcome', seatId: null, token: null }], bind: null });
  }
  const seat: Seat = {
    id: ctx.randomId(),
    name: msg.name,
    kind: 'human',
    connected: true,
    token: ctx.randomId() + ctx.randomId(),
    lastChatAt: 0,
  };
  const joined: RoomState = {
    ...room,
    seats: [...room.seats, seat],
    hostSeatId: room.hostSeatId ?? seat.id,
  };
  const note = systemChat(ctx, `${seat.name} joined the bazaar`);
  return synced(withChat(joined, [note]), {
    replies: [{ type: 'welcome', seatId: seat.id, token: seat.token }],
    chat: [note],
    bind: seat.id,
  });
};

const requireHostInLobby = (room: RoomState, senderId: string | null): ErrorCode | null => {
  if (senderId === null || senderId !== room.hostSeatId) return 'notHost';
  if (room.status !== 'lobby') return 'notInLobby';
  return null;
};

const addBot = (room: RoomState, senderId: string | null, ctx: Ctx): Outcome => {
  const error = requireHostInLobby(room, senderId);
  if (error) return failure(room, error);
  if (room.seats.length >= MAX_PLAYERS) return failure(room, 'roomFull');
  const usedNames = new Set(room.seats.map((s) => s.name));
  const name = BOT_NAMES.find((n) => !usedNames.has(n)) ?? 'Merchant (bot)';
  const bot: Seat = {
    id: ctx.randomId(),
    name,
    kind: 'bot',
    connected: true,
    token: null,
    lastChatAt: 0,
  };
  return synced({ ...room, seats: [...room.seats, bot] });
};

const BOT_SUFFIX = ' (bot)';

const hostAfter = (seats: readonly Seat[], hostSeatId: string | null): string | null =>
  seats.some((s) => s.id === hostSeatId && s.kind === 'human')
    ? hostSeatId
    : (seats.find((s) => s.kind === 'human')?.id ?? null);

const withoutSeat = (room: RoomState, seatId: string): RoomState => {
  const seats = room.seats.filter((s) => s.id !== seatId);
  return { ...room, seats, hostSeatId: hostAfter(seats, room.hostSeatId) };
};

const handToBot = (room: RoomState, seatId: string, note: ChatMessage): Outcome => {
  const seats = room.seats.map((s) =>
    s.id === seatId
      ? {
          ...s,
          name: s.name.endsWith(BOT_SUFFIX) ? s.name : `${s.name}${BOT_SUFFIX}`,
          kind: 'bot' as const,
          connected: true,
          token: null,
        }
      : s,
  );
  const vote = room.undoVote;
  const voteTouched = vote && (vote.requesterId === seatId || vote.voters.includes(seatId));
  const handed: RoomState = {
    ...room,
    seats,
    hostSeatId: hostAfter(seats, room.hostSeatId),
    autopilot: room.autopilot.filter((id) => id !== seatId),
    undoVote: voteTouched ? null : vote,
  };
  return synced(withChat(handed, [note]), { chat: [note], kick: seatId });
};

const removeSeat = (
  room: RoomState,
  senderId: string | null,
  seatId: string,
  ctx: Ctx,
): Outcome => {
  if (senderId === null || senderId !== room.hostSeatId) return failure(room, 'notHost');
  const seat = seatOf(room, seatId);
  if (seatId === room.hostSeatId || !seat) return failure(room, 'notSeated');
  if (room.status === 'lobby') return synced(withoutSeat(room, seatId), { kick: seatId });
  if (seat.kind === 'bot') return failure(room, 'notSeated');
  return handToBot(
    room,
    seatId,
    systemChat(ctx, `The host removed ${seat.name}. A bot takes over their stall`),
  );
};

const leave = (room: RoomState, senderId: string, ctx: Ctx): Outcome => {
  const seat = seatOf(room, senderId);
  if (!seat || seat.kind === 'bot') return failure(room, 'notSeated');
  if (room.status === 'lobby') {
    return synced(withoutSeat(room, senderId), { bind: null, kick: senderId });
  }
  const handed = handToBot(
    room,
    senderId,
    systemChat(ctx, `${seat.name} left. A bot takes over their stall`),
  );
  return { ...handed, bind: null };
};

const setTheme = (room: RoomState, senderId: string | null, theme: Theme): Outcome => {
  const error = requireHostInLobby(room, senderId);
  if (error) return failure(room, error);
  return synced({ ...room, theme });
};

const start = (room: RoomState, senderId: string | null, ctx: Ctx): Outcome => {
  const error = requireHostInLobby(room, senderId);
  if (error) return failure(room, error);
  if (room.seats.length < MIN_PLAYERS) return failure(room, 'notEnoughPlayers');
  const game = createGame(
    CATALOG,
    room.seats.map((s) => s.id),
    ctx.seed,
  );
  const note = systemChat(ctx, 'The market opens. Good trading!');
  return synced(
    withChat(
      {
        ...room,
        status: 'playing',
        game,
        turnStart: game,
        undoPoint: null,
        undoVote: null,
        log: [],
      },
      [note],
    ),
    { chat: [note] },
  );
};

const rematch = (room: RoomState, senderId: string | null): Outcome => {
  if (senderId === null || senderId !== room.hostSeatId) return failure(room, 'notHost');
  if (room.status !== 'finished') return failure(room, 'notPlaying');
  return synced({
    ...room,
    status: 'lobby',
    game: null,
    turnStart: null,
    undoPoint: null,
    undoVote: null,
    log: [],
  });
};

const applyGameMove = (room: RoomState, actorId: string, move: Move): Outcome => {
  const game = room.game;
  if (!game || room.status !== 'playing') return failure(room, 'notPlaying');
  if (room.undoVote) return failure(room, 'undoPending');
  const result = applyMove(game, actorId, move);
  if (!result.ok) return failure(room, result.error);

  const next = result.state;
  const turnEnded = next.finished || next.currentPlayer !== game.currentPlayer;
  const turnStart = room.turnStart ?? game;
  const undoPoint: UndoPoint | null = turnEnded
    ? { snapshot: turnStart, actorId }
    : room.undoPoint && room.undoPoint.actorId !== actorId
      ? null
      : room.undoPoint;

  return synced(
    {
      ...room,
      game: next,
      status: next.finished ? 'finished' : 'playing',
      turnStart: turnEnded ? next : turnStart,
      undoPoint: next.finished ? null : undoPoint,
      log: [...room.log, ...result.events].slice(-LOG_LIMIT),
    },
    { events: result.events },
  );
};

const humanVoters = (room: RoomState, requesterId: string): string[] =>
  room.seats
    .filter(
      (s) =>
        s.kind === 'human' &&
        s.connected &&
        s.id !== requesterId &&
        !room.autopilot.includes(s.id),
    )
    .map((s) => s.id);

const performUndo = (room: RoomState, ctx: Ctx): Outcome => {
  if (!room.undoPoint) return failure(room, 'undoUnavailable');
  const note = systemChat(ctx, `${nameOf(room, room.undoPoint.actorId)} took back their last turn`);
  return synced(
    withChat(
      {
        ...room,
        game: room.undoPoint.snapshot,
        turnStart: room.undoPoint.snapshot,
        undoPoint: null,
        undoVote: null,
      },
      [note],
    ),
    { chat: [note] },
  );
};

const requestUndo = (room: RoomState, senderId: string | null, ctx: Ctx): Outcome => {
  if (room.status !== 'playing') return failure(room, 'notPlaying');
  if (room.undoVote) return failure(room, 'undoPending');
  if (!room.undoPoint || room.undoPoint.actorId !== senderId)
    return failure(room, 'undoUnavailable');
  const voters = humanVoters(room, senderId);
  if (voters.length === 0) return performUndo(room, ctx);
  const note = systemChat(ctx, `${nameOf(room, senderId)} asks to take back their last turn`);
  return synced(
    withChat(
      {
        ...room,
        undoVote: {
          requesterId: senderId,
          approvals: [],
          voters,
          expiresAt: ctx.now + UNDO_VOTE_MS,
        },
      },
      [note],
    ),
    { chat: [note] },
  );
};

const voteUndo = (
  room: RoomState,
  senderId: string | null,
  approve: boolean,
  ctx: Ctx,
): Outcome => {
  const vote = room.undoVote;
  if (!vote || senderId === null || !vote.voters.includes(senderId)) {
    return failure(room, 'undoUnavailable');
  }
  if (!approve) {
    const note = systemChat(ctx, `${nameOf(room, senderId)} declined the take-back`);
    return synced(withChat({ ...room, undoVote: null }, [note]), { chat: [note] });
  }
  const approvals = [...new Set([...vote.approvals, senderId])];
  if (vote.voters.every((v) => approvals.includes(v))) return performUndo(room, ctx);
  return synced({ ...room, undoVote: { ...vote, approvals } });
};

const chat = (room: RoomState, senderId: string | null, text: string, ctx: Ctx): Outcome => {
  const seat = seatOf(room, senderId);
  if (!seat) return failure(room, 'notSeated');
  if (ctx.now - seat.lastChatAt < CHAT_COOLDOWN_MS) return failure(room, 'rateLimited');
  const message: ChatMessage = {
    id: ctx.randomId(),
    seatId: seat.id,
    name: seat.name,
    text,
    at: ctx.now,
  };
  const updated = {
    ...room,
    seats: room.seats.map((s) => (s.id === seat.id ? { ...s, lastChatAt: ctx.now } : s)),
  };
  return { ...unchanged(withChat(updated, [message])), chat: [message] };
};

const isAutoSeat = (room: RoomState, seat: Seat): boolean =>
  seat.kind === 'bot' || room.autopilot.includes(seat.id);

const offAutopilot = (room: RoomState, seatId: string): RoomState =>
  room.autopilot.includes(seatId)
    ? { ...room, autopilot: room.autopilot.filter((id) => id !== seatId) }
    : room;

export const withClock = (room: RoomState, now: number): RoomState => {
  const game = room.game;
  const seat = seatOf(room, currentSeatId(room));
  if (!game || room.status !== 'playing' || room.undoVote || !seat || isAutoSeat(room, seat)) {
    return room.clock === null ? room : { ...room, clock: null };
  }
  const current = room.clock;
  const kept: TurnClock =
    current && current.seatId === seat.id && current.turn === game.turn
      ? current
      : { seatId: seat.id, turn: game.turn, deadline: now + TURN_MS, extended: false };
  const deadline = seat.connected
    ? kept.deadline
    : Math.min(kept.deadline, now + DISCONNECT_GRACE_MS);
  if (kept === current && deadline === current.deadline) return room;
  return { ...room, clock: { ...kept, deadline } };
};

const clocked = (outcome: Outcome, now: number): Outcome => ({
  ...outcome,
  room: withClock(outcome.room, now),
});

const stillHere = (room: RoomState, senderId: string): Outcome => {
  const clock = room.clock;
  if (!clock || clock.seatId !== senderId || clock.extended) return unchanged(room);
  return synced({
    ...room,
    clock: { ...clock, deadline: clock.deadline + EXTEND_MS, extended: true },
  });
};

const resume = (room: RoomState, senderId: string): Outcome =>
  room.autopilot.includes(senderId) ? synced(offAutopilot(room, senderId)) : unchanged(room);

const playerMove = (room: RoomState, senderId: string, move: Move): Outcome => {
  const outcome = applyGameMove(room, senderId, move);
  return outcome.sync ? { ...outcome, room: offAutopilot(outcome.room, senderId) } : outcome;
};

export const handleMessage = (
  room: RoomState,
  senderId: string | null,
  msg: ClientMessage,
  ctx: Ctx,
): Outcome => clocked(route(room, senderId, msg, ctx), ctx.now);

const route = (
  room: RoomState,
  senderId: string | null,
  msg: ClientMessage,
  ctx: Ctx,
): Outcome => {
  if (msg.type === 'join') return join(room, msg, ctx);
  if (senderId === null) return failure(room, 'notJoined');
  switch (msg.type) {
    case 'start':
      return start(room, senderId, ctx);
    case 'addBot':
      return addBot(room, senderId, ctx);
    case 'removeSeat':
      return removeSeat(room, senderId, msg.seatId, ctx);
    case 'setTheme':
      return setTheme(room, senderId, msg.theme);
    case 'move':
      return playerMove(room, senderId, msg.move);
    case 'stillHere':
      return stillHere(room, senderId);
    case 'resume':
      return resume(room, senderId);
    case 'leave':
      return leave(room, senderId, ctx);
    case 'chat':
      return chat(room, senderId, msg.text, ctx);
    case 'undoRequest':
      return requestUndo(room, senderId, ctx);
    case 'undoVote':
      return voteUndo(room, senderId, msg.approve, ctx);
    case 'rematch':
      return rematch(room, senderId);
  }
};

export const isAutoTurn = (room: RoomState): boolean => {
  const seat = seatOf(room, currentSeatId(room));
  return room.status === 'playing' && !room.undoVote && !!seat && isAutoSeat(room, seat);
};

export const runBotTurn = (room: RoomState): Outcome | null => {
  const botId = currentSeatId(room);
  if (!room.game || !botId || !isAutoTurn(room)) return null;
  const choice = chooseMove(viewFor(room.game, botId), legalMoves(room.game, botId), room.botRng);
  const outcome = applyGameMove({ ...room, botRng: choice.next }, botId, choice.move);
  return outcome.sync ? outcome : null;
};

export const expireUndo = (room: RoomState, ctx: Ctx): Outcome | null => {
  if (!room.undoVote || room.undoVote.expiresAt > ctx.now) return null;
  const note = systemChat(ctx, 'The take-back request expired');
  return synced(withChat({ ...room, undoVote: null }, [note]), { chat: [note] });
};

export const expireClock = (room: RoomState, ctx: Ctx): Outcome | null => {
  const clock = room.clock;
  if (!clock || clock.deadline > ctx.now || clock.seatId !== currentSeatId(room)) return null;
  const note = systemChat(ctx, `${nameOf(room, clock.seatId)} is away. A bot plays for them`);
  const away: RoomState = { ...room, clock: null, autopilot: [...room.autopilot, clock.seatId] };
  return synced(withChat(away, [note]), { chat: [note] });
};

export const tick = (room: RoomState, ctx: Ctx): Outcome | null => {
  const outcome = expireUndo(room, ctx) ?? expireClock(room, ctx) ?? runBotTurn(room);
  return outcome && clocked(outcome, ctx.now);
};

export const disconnect = (room: RoomState, seatId: string, now: number): Outcome =>
  synced(withClock(setConnected(room, seatId, false), now));

export const nextWakeAt = (room: RoomState, now: number): number | null => {
  const wakes = [
    room.undoVote?.expiresAt,
    room.clock?.deadline,
    isAutoTurn(room) ? now + BOT_DELAY_MS : undefined,
  ].filter((t): t is number => t !== undefined);
  return wakes.length > 0 ? Math.min(...wakes) : null;
};

export const snapshotOf = (room: RoomState): RoomSnapshot => ({
  code: room.code,
  status: room.status,
  hostSeatId: room.hostSeatId,
  theme: room.theme,
  seats: room.seats.map(({ id, name, kind, connected }) => ({ id, name, kind, connected })),
  undoAvailableTo: room.undoVote ? null : (room.undoPoint?.actorId ?? null),
  undoVote: room.undoVote,
  turnDeadline: room.clock?.deadline ?? null,
  turnExtended: room.clock?.extended ?? false,
  autopilot: room.autopilot,
});

export const syncFor = (
  room: RoomState,
  viewerId: string | null,
  events: readonly GameEvent[],
  now: number,
): ServerMessage => ({
  type: 'sync',
  serverNow: now,
  room: snapshotOf(room),
  view: room.game ? viewFor(room.game, viewerId) : null,
  legal: room.game && viewerId && !room.undoVote ? legalMoves(room.game, viewerId) : [],
  events: events.map((e) => eventFor(e, viewerId)),
  log: room.log.map((e) => eventFor(e, viewerId)),
});
