import {
  addTokens,
  bonusesOf,
  hasNegative,
  paymentFor,
  pointsOf,
  subtractTokens,
  tokensFrom,
  totalTokens,
} from './counts.ts';
import { hasActionAvailable } from './legal.ts';
import { SPICES, TOKENS, DOUBLE_TAKE_MIN_PILE, MAX_RESERVED, MAX_TOKENS } from './types.ts';
import type {
  BuySource,
  Card,
  CardSource,
  GameEvent,
  GameState,
  Guild,
  Move,
  MoveResult,
  PlayerState,
  RuleError,
  Spice,
  Tier,
  TokenCounts,
} from './types.ts';

type Step = { readonly state: GameState; readonly events: readonly GameEvent[] };

const fail = (error: RuleError): MoveResult => ({ ok: false, error });

const currentOf = (state: GameState): PlayerState => {
  const player = state.players[state.currentPlayer];
  if (!player) throw new Error('Invalid current player index');
  return player;
};

const withCurrent = (state: GameState, update: (p: PlayerState) => PlayerState): GameState => ({
  ...state,
  players: state.players.map((p, i) => (i === state.currentPlayer ? update(p) : p)),
});

const refillSlot = (state: GameState, tier: Tier, slot: number): Step => {
  const [next, ...rest] = state.decks[tier];
  const card = next ?? null;
  return {
    state: {
      ...state,
      decks: { ...state.decks, [tier]: rest },
      market: {
        ...state.market,
        [tier]: state.market[tier].map((c, i) => (i === slot ? card : c)),
      },
    },
    events: [{ type: 'marketRefilled', tier, slot, card }],
  };
};

const marketCard = (state: GameState, tier: Tier, slot: number): Card | null =>
  state.market[tier][slot] ?? null;

const winnersOf = (players: readonly PlayerState[]): readonly string[] => {
  const ranked = players.map((p) => ({ id: p.id, points: pointsOf(p), cards: p.cards.length }));
  const topPoints = Math.max(...ranked.map((r) => r.points));
  const leaders = ranked.filter((r) => r.points === topPoints);
  const fewestCards = Math.min(...leaders.map((r) => r.cards));
  return leaders.filter((r) => r.cards === fewestCards).map((r) => r.id);
};

const endTurn = ({ state, events }: Step): Step => {
  const player = currentOf(state);
  const triggers = !state.finalRound && pointsOf(player) >= state.targetPoints;
  const finalRound = state.finalRound || triggers;
  const triggerEvents: GameEvent[] = triggers
    ? [{ type: 'finalRound', triggeredBy: player.id }]
    : [];
  const nextIndex = (state.currentPlayer + 1) % state.players.length;

  if (finalRound && nextIndex === 0) {
    return {
      state: { ...state, finalRound, finished: true, phase: { kind: 'action' } },
      events: [
        ...events,
        ...triggerEvents,
        { type: 'gameEnded', winners: winnersOf(state.players) },
      ],
    };
  }

  const nextPlayer = state.players[nextIndex];
  if (!nextPlayer) throw new Error('Invalid next player index');
  const turn = state.turn + 1;
  return {
    state: { ...state, finalRound, currentPlayer: nextIndex, turn, phase: { kind: 'action' } },
    events: [...events, ...triggerEvents, { type: 'turnStarted', playerId: nextPlayer.id, turn }],
  };
};

const eligibleGuilds = (state: GameState): readonly Guild[] => {
  const bonuses = bonusesOf(currentOf(state).cards);
  return state.guilds.filter((g) => SPICES.every((s) => bonuses[s] >= g.requires[s]));
};

const claimGuild = ({ state, events }: Step, guild: Guild): Step => {
  const player = currentOf(state);
  return {
    state: {
      ...withCurrent(state, (p) => ({ ...p, guilds: [...p.guilds, guild] })),
      guilds: state.guilds.filter((g) => g.id !== guild.id),
    },
    events: [...events, { type: 'guildClaimed', playerId: player.id, guild }],
  };
};

const resolveGuilds = (step: Step): Step => {
  const eligible = eligibleGuilds(step.state);
  const [only] = eligible;
  if (eligible.length === 0 || !only) return endTurn(step);
  if (eligible.length === 1) return endTurn(claimGuild(step, only));
  return {
    state: { ...step.state, phase: { kind: 'guild', options: eligible.map((g) => g.id) } },
    events: step.events,
  };
};

const afterAction = (step: Step): Step => {
  const excess = totalTokens(currentOf(step.state).tokens) - MAX_TOKENS;
  if (excess > 0) {
    return { state: { ...step.state, phase: { kind: 'discard', excess } }, events: step.events };
  }
  return resolveGuilds(step);
};

const takeTokens = (state: GameState, taken: TokenCounts): Step => {
  const player = currentOf(state);
  return {
    state: {
      ...withCurrent(state, (p) => ({ ...p, tokens: addTokens(p.tokens, taken) })),
      supply: subtractTokens(state.supply, taken),
    },
    events: [{ type: 'tokensTaken', playerId: player.id, tokens: taken }],
  };
};

const availableSpices = (state: GameState): readonly Spice[] =>
  SPICES.filter((s) => state.supply[s] > 0);

const takeDistinct = (state: GameState, spices: readonly Spice[]): MoveResult => {
  const unique = new Set(spices);
  const required = Math.min(3, availableSpices(state).length);
  if (unique.size !== spices.length || spices.length !== required || required === 0) {
    return fail('invalidTokens');
  }
  if (spices.some((s) => !SPICES.includes(s) || state.supply[s] < 1)) return fail('supplyEmpty');
  const taken = tokensFrom(Object.fromEntries(spices.map((s) => [s, 1])));
  return { ok: true, ...afterAction(takeTokens(state, taken)) };
};

const takeDouble = (state: GameState, spice: Spice): MoveResult => {
  if (!SPICES.includes(spice)) return fail('invalidTokens');
  if (state.supply[spice] < DOUBLE_TAKE_MIN_PILE) return fail('pileTooSmall');
  return { ok: true, ...afterAction(takeTokens(state, tokensFrom({ [spice]: 2 }))) };
};

const reserve = (state: GameState, source: CardSource): MoveResult => {
  const player = currentOf(state);
  if (player.reserved.length >= MAX_RESERVED) return fail('reserveFull');

  const fromMarket = source.kind === 'market';
  const card = fromMarket
    ? marketCard(state, source.tier, source.slot)
    : state.decks[source.tier][0];
  if (!card) return fail('noCard');

  const sealTaken = state.supply.seal > 0;
  const sealTokens = tokensFrom({ seal: sealTaken ? 1 : 0 });
  const reservedState: GameState = {
    ...withCurrent(state, (p) => ({
      ...p,
      reserved: [...p.reserved, { card, hidden: !fromMarket }],
      tokens: addTokens(p.tokens, sealTokens),
    })),
    supply: subtractTokens(state.supply, sealTokens),
    decks: fromMarket
      ? state.decks
      : { ...state.decks, [source.tier]: state.decks[source.tier].slice(1) },
  };
  const reserveEvent: GameEvent = {
    type: 'cardReserved',
    playerId: player.id,
    card,
    from: source,
    sealTaken,
  };
  const refilled: Step = fromMarket
    ? refillSlot(reservedState, source.tier, source.slot)
    : { state: reservedState, events: [] };

  return {
    ok: true,
    ...afterAction({ state: refilled.state, events: [reserveEvent, ...refilled.events] }),
  };
};

const buyableCard = (state: GameState, source: BuySource): Card | null => {
  if (source.kind === 'market') return marketCard(state, source.tier, source.slot);
  return currentOf(state).reserved[source.index]?.card ?? null;
};

const buy = (state: GameState, source: BuySource): MoveResult => {
  const player = currentOf(state);
  const card = buyableCard(state, source);
  if (!card) return fail('noCard');
  const paid = paymentFor(card.cost, bonusesOf(player.cards), player.tokens);
  if (!paid) return fail('cannotAfford');

  const paidState: GameState = {
    ...withCurrent(state, (p) => ({
      ...p,
      tokens: subtractTokens(p.tokens, paid),
      cards: [...p.cards, card],
      reserved:
        source.kind === 'reserve' ? p.reserved.filter((_, i) => i !== source.index) : p.reserved,
    })),
    supply: addTokens(state.supply, paid),
  };
  const buyEvent: GameEvent = { type: 'cardBought', playerId: player.id, card, from: source, paid };
  const refilled: Step =
    source.kind === 'market'
      ? refillSlot(paidState, source.tier, source.slot)
      : { state: paidState, events: [] };

  return {
    ok: true,
    ...afterAction({ state: refilled.state, events: [buyEvent, ...refilled.events] }),
  };
};

const discard = (state: GameState, excess: number, partial: Partial<TokenCounts>): MoveResult => {
  const tokens = tokensFrom(partial);
  const player = currentOf(state);
  const valid =
    TOKENS.every((t) => Number.isInteger(tokens[t]) && tokens[t] >= 0) &&
    totalTokens(tokens) === excess &&
    !hasNegative(subtractTokens(player.tokens, tokens));
  if (!valid) return fail('invalidDiscard');

  const discarded: Step = {
    state: {
      ...withCurrent(state, (p) => ({ ...p, tokens: subtractTokens(p.tokens, tokens) })),
      supply: addTokens(state.supply, tokens),
      phase: { kind: 'action' },
    },
    events: [{ type: 'tokensDiscarded', playerId: player.id, tokens }],
  };
  return { ok: true, ...resolveGuilds(discarded) };
};

const chooseGuild = (state: GameState, options: readonly string[], guildId: string): MoveResult => {
  const guild = state.guilds.find((g) => g.id === guildId);
  if (!guild || !options.includes(guildId)) return fail('invalidGuild');
  return { ok: true, ...endTurn(claimGuild({ state, events: [] }, guild)) };
};

const pass = (state: GameState): MoveResult => {
  if (hasActionAvailable(state)) return fail('passNotAllowed');
  const player = currentOf(state);
  return {
    ok: true,
    ...resolveGuilds({ state, events: [{ type: 'passed', playerId: player.id }] }),
  };
};

export const applyMove = (state: GameState, playerId: string, move: Move): MoveResult => {
  if (state.finished) return fail('gameFinished');
  if (currentOf(state).id !== playerId) return fail('notYourTurn');

  const { phase } = state;
  switch (phase.kind) {
    case 'discard':
      return move.type === 'discard'
        ? discard(state, phase.excess, move.tokens)
        : fail('wrongPhase');
    case 'guild':
      return move.type === 'chooseGuild'
        ? chooseGuild(state, phase.options, move.guildId)
        : fail('wrongPhase');
    case 'action':
      switch (move.type) {
        case 'takeDistinct':
          return takeDistinct(state, move.spices);
        case 'takeDouble':
          return takeDouble(state, move.spice);
        case 'reserve':
          return reserve(state, move.source);
        case 'buy':
          return buy(state, move.source);
        case 'pass':
          return pass(state);
        case 'discard':
        case 'chooseGuild':
          return fail('wrongPhase');
      }
  }
};
