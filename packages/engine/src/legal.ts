import { bonusesOf, paymentFor, tokensFrom } from './counts.ts';
import {
  DOUBLE_TAKE_MIN_PILE,
  MARKET_SLOTS,
  MAX_RESERVED,
  SPICES,
  TIERS,
  TOKENS,
} from './types.ts';
import type { GameState, Move, PlayerState, Spice, Token, TokenCounts } from './types.ts';

const combinations = <T>(items: readonly T[], size: number): T[][] => {
  if (size === 0) return [[]];
  return items.flatMap((item, i) =>
    combinations(items.slice(i + 1), size - 1).map((rest) => [item, ...rest]),
  );
};

const playerAt = (state: GameState): PlayerState => {
  const player = state.players[state.currentPlayer];
  if (!player) throw new Error('Invalid current player index');
  return player;
};

const takeMoves = (state: GameState): Move[] => {
  const available = SPICES.filter((s) => state.supply[s] > 0);
  const size = Math.min(3, available.length);
  const distinct: Move[] =
    size === 0
      ? []
      : combinations(available, size).map((spices) => ({ type: 'takeDistinct', spices }));
  const doubles: Move[] = SPICES.filter((s) => state.supply[s] >= DOUBLE_TAKE_MIN_PILE).map(
    (spice: Spice) => ({ type: 'takeDouble', spice }),
  );
  return [...distinct, ...doubles];
};

const marketSlots = (state: GameState) =>
  TIERS.flatMap((tier) =>
    Array.from({ length: MARKET_SLOTS }, (_, slot) => ({ tier, slot })).filter(
      ({ tier: t, slot: s }) => state.market[t][s],
    ),
  );

const reserveMoves = (state: GameState, player: PlayerState): Move[] => {
  if (player.reserved.length >= MAX_RESERVED) return [];
  const fromMarket: Move[] = marketSlots(state).map(({ tier, slot }) => ({
    type: 'reserve',
    source: { kind: 'market', tier, slot },
  }));
  const fromDeck: Move[] = TIERS.filter((tier) => state.decks[tier].length > 0).map((tier) => ({
    type: 'reserve',
    source: { kind: 'deck', tier },
  }));
  return [...fromMarket, ...fromDeck];
};

const buyMoves = (state: GameState, player: PlayerState): Move[] => {
  const bonuses = bonusesOf(player.cards);
  const fromMarket: Move[] = marketSlots(state)
    .filter(({ tier, slot }) => {
      const card = state.market[tier][slot];
      return card ? paymentFor(card.cost, bonuses, player.tokens) !== null : false;
    })
    .map(({ tier, slot }) => ({ type: 'buy', source: { kind: 'market', tier, slot } }));
  const fromReserve: Move[] = player.reserved
    .map((r, index) => ({ r, index }))
    .filter(({ r }) => paymentFor(r.card.cost, bonuses, player.tokens) !== null)
    .map(({ index }) => ({ type: 'buy', source: { kind: 'reserve', index } }));
  return [...fromMarket, ...fromReserve];
};

const actionMoves = (state: GameState): Move[] => {
  const player = playerAt(state);
  return [...buyMoves(state, player), ...takeMoves(state), ...reserveMoves(state, player)];
};

export const hasActionAvailable = (state: GameState): boolean => actionMoves(state).length > 0;

export const discardOptions = (tokens: TokenCounts, excess: number): TokenCounts[] => {
  const held = TOKENS.filter((t) => tokens[t] > 0);
  const build = (
    index: number,
    remaining: number,
    acc: Partial<Record<Token, number>>,
  ): TokenCounts[] => {
    if (remaining === 0) return [tokensFrom(acc)];
    const token = held[index];
    if (token === undefined) return [];
    const max = Math.min(tokens[token], remaining);
    return Array.from({ length: max + 1 }, (_, n) => n).flatMap((n) =>
      build(index + 1, remaining - n, n > 0 ? { ...acc, [token]: n } : acc),
    );
  };
  return build(0, excess, {});
};

export const legalMoves = (state: GameState, playerId: string): Move[] => {
  if (state.finished) return [];
  const player = playerAt(state);
  if (player.id !== playerId) return [];
  const { phase } = state;
  switch (phase.kind) {
    case 'discard':
      return discardOptions(player.tokens, phase.excess).map((tokens) => ({
        type: 'discard',
        tokens,
      }));
    case 'guild':
      return phase.options.map((guildId) => ({ type: 'chooseGuild', guildId }));
    case 'action': {
      const moves = actionMoves(state);
      return moves.length > 0 ? moves : [{ type: 'pass' }];
    }
  }
};
