import { SPICES, TOKENS } from './types.ts';
import type { Card, PlayerState, Spice, SpiceCounts, Token, TokenCounts } from './types.ts';

export const emptySpices = (): SpiceCounts => ({
  saffron: 0,
  cardamom: 0,
  sumac: 0,
  pepper: 0,
  salt: 0,
});

export const emptyTokens = (): TokenCounts => ({ ...emptySpices(), seal: 0 });

export const tokensFrom = (partial: Partial<TokenCounts>): TokenCounts => ({
  ...emptyTokens(),
  ...partial,
});

export const totalTokens = (tokens: TokenCounts): number =>
  TOKENS.reduce((sum, token) => sum + tokens[token], 0);

export const addTokens = (a: TokenCounts, b: TokenCounts): TokenCounts =>
  Object.fromEntries(TOKENS.map((t) => [t, a[t] + b[t]])) as Record<Token, number>;

export const subtractTokens = (a: TokenCounts, b: TokenCounts): TokenCounts =>
  Object.fromEntries(TOKENS.map((t) => [t, a[t] - b[t]])) as Record<Token, number>;

export const hasNegative = (tokens: TokenCounts): boolean => TOKENS.some((t) => tokens[t] < 0);

export const bonusesOf = (cards: readonly Card[]): SpiceCounts =>
  cards.reduce<Record<Spice, number>>(
    (acc, card) => ({ ...acc, [card.bonus]: acc[card.bonus] + 1 }),
    { ...emptySpices() },
  );

export const pointsOf = (player: PlayerState): number =>
  player.cards.reduce((sum, card) => sum + card.points, 0) +
  player.guilds.reduce((sum, guild) => sum + guild.points, 0);

export const paymentFor = (
  cost: SpiceCounts,
  bonuses: SpiceCounts,
  tokens: TokenCounts,
): TokenCounts | null => {
  const spicePaid = Object.fromEntries(
    SPICES.map((s) => [s, Math.min(Math.max(cost[s] - bonuses[s], 0), tokens[s])]),
  ) as Record<Spice, number>;
  const shortfall = SPICES.reduce(
    (sum, s) => sum + Math.max(cost[s] - bonuses[s], 0) - spicePaid[s],
    0,
  );
  return shortfall > tokens.seal ? null : { ...spicePaid, seal: shortfall };
};

export const deficitFor = (
  cost: SpiceCounts,
  bonuses: SpiceCounts,
  tokens: TokenCounts,
): SpiceCounts =>
  Object.fromEntries(
    SPICES.map((s) => [s, Math.max(cost[s] - bonuses[s] - tokens[s], 0)]),
  ) as Record<Spice, number>;
