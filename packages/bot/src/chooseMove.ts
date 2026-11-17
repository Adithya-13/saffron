import {
  MAX_RESERVED,
  MAX_TOKENS,
  SPICES,
  addTokens,
  bonusesOf,
  deficitFor,
  nextFloat,
  paymentFor,
  subtractTokens,
  tokensFrom,
  totalTokens,
} from '@saffron/engine';
import type {
  Card,
  Guild,
  Move,
  PlayerPublic,
  PlayerView,
  RngState,
  Spice,
  SpiceCounts,
  TokenCounts,
} from '@saffron/engine';

type Holdings = {
  readonly tokens: TokenCounts;
  readonly bonuses: SpiceCounts;
  readonly points: number;
  readonly reserved: readonly Card[];
  readonly reservedSlots: number;
  readonly taken: ReadonlySet<string>;
};

type Context = {
  readonly view: PlayerView;
  readonly me: PlayerPublic;
  readonly opponents: readonly PlayerPublic[];
  readonly engineWeight: number;
};

const GAMMA = 0.6;
const TARGET_WEIGHTS = [1, 0.45, 0.2] as const;
const SCARCE_TURNS = 4;
const OVERFLOW_TURNS = 0.5;
const GUILD_WEIGHT = 0.6;
const TOKEN_VALUE = 0.04;
const SEAL_VALUE = 0.25;
const RESERVE_SLOT_COST = 0.35;
const BLIND_RESERVE_VALUE = 0.3;
const DENIAL_WEIGHT = 0.7;
const WIN_BONUS = 25;
const NOISE = 0.05;
const ENGINE_WEIGHT = 0.25;
const OVERFLOW_PENALTY = 0.6;

const sum = (counts: Readonly<Record<string, number>>): number =>
  Object.values(counts).reduce((a, b) => a + b, 0);

const marketCards = (view: PlayerView): Card[] =>
  Object.values(view.market).flatMap((row) => row.filter((c): c is Card => c !== null));

const turnsToBuy = (card: Card, h: Holdings, supply: TokenCounts): number => {
  const need = deficitFor(card.cost, h.bonuses, h.tokens);
  const uncovered = Math.max(sum(need) - h.tokens.seal, 0);
  if (uncovered === 0) return 0;
  const widest = Math.max(...SPICES.map((s) => need[s]));
  const scarce = SPICES.some((s) => need[s] > supply[s]) ? SCARCE_TURNS : 0;
  const overflow = Math.max(totalTokens(h.tokens) + uncovered - MAX_TOKENS, 0);
  return (
    Math.max(Math.ceil(uncovered / 3), Math.ceil(widest / 2)) + scarce + overflow * OVERFLOW_TURNS
  );
};

const demandFor = (ctx: Context, h: Holdings, spice: Spice): number => {
  const cards = marketCards(ctx.view);
  if (cards.length === 0) return 0;
  return cards.filter((c) => c.cost[spice] > h.bonuses[spice]).length / cards.length;
};

const guildPull = (ctx: Context, h: Holdings, spice: Spice): number =>
  ctx.view.guilds.reduce((acc, g) => {
    if (g.requires[spice] <= h.bonuses[spice]) return acc;
    const missing = SPICES.reduce((m, s) => m + Math.max(g.requires[s] - h.bonuses[s], 0), 0);
    return acc + g.points / (1 + missing);
  }, 0);

const bonusValue = (ctx: Context, h: Holdings, spice: Spice): number =>
  ctx.engineWeight * (0.5 + demandFor(ctx, h, spice)) + guildPull(ctx, h, spice) * 0.25;

const cardWorth = (ctx: Context, h: Holdings, card: Card): number =>
  card.points + bonusValue(ctx, h, card.bonus);

const planValue = (ctx: Context, h: Holdings): number => {
  const candidates = [...marketCards(ctx.view), ...h.reserved].filter((c) => !h.taken.has(c.id));
  const plans = candidates
    .map((card) => cardWorth(ctx, h, card) * GAMMA ** (turnsToBuy(card, h, ctx.view.supply) + 1))
    .sort((a, b) => b - a);
  return TARGET_WEIGHTS.reduce((acc, weight, i) => acc + weight * (plans[i] ?? 0), 0);
};

const guildValue = (ctx: Context, h: Holdings): number =>
  ctx.view.guilds.reduce((acc, g) => {
    const missing = SPICES.reduce((m, s) => m + Math.max(g.requires[s] - h.bonuses[s], 0), 0);
    return acc + g.points * GUILD_WEIGHT * GAMMA ** missing;
  }, 0);

const engineValue = (ctx: Context, h: Holdings): number =>
  sum(h.bonuses) * ctx.engineWeight * ENGINE_WEIGHT;

const tokenValue = (h: Holdings): number => {
  const held = totalTokens(h.tokens);
  const overflow = Math.max(held - MAX_TOKENS, 0);
  return (
    (held - h.tokens.seal) * TOKEN_VALUE + h.tokens.seal * SEAL_VALUE - overflow * OVERFLOW_PENALTY
  );
};

const positionValue = (ctx: Context, h: Holdings): number =>
  h.points + planValue(ctx, h) + guildValue(ctx, h) + engineValue(ctx, h) + tokenValue(h);

const holdingsOf = (me: PlayerPublic): Holdings => ({
  tokens: me.tokens,
  bonuses: bonusesOf(me.cards),
  points: me.points,
  reserved: me.reserved.flatMap((r) => (r.card ? [r.card] : [])),
  reservedSlots: me.reserved.length,
  taken: new Set(),
});

const withTokens = (h: Holdings, gained: Partial<TokenCounts>): Holdings => ({
  ...h,
  tokens: addTokens(h.tokens, tokensFrom(gained)),
});

const afterBuy = (h: Holdings, card: Card): Holdings | null => {
  const payment = paymentFor(card.cost, h.bonuses, h.tokens);
  if (!payment) return null;
  return {
    ...h,
    tokens: subtractTokens(h.tokens, payment),
    bonuses: { ...h.bonuses, [card.bonus]: h.bonuses[card.bonus] + 1 },
    points: h.points + card.points,
    reserved: h.reserved.filter((c) => c.id !== card.id),
    reservedSlots: h.reserved.some((c) => c.id === card.id) ? h.reservedSlots - 1 : h.reservedSlots,
    taken: new Set([...h.taken, card.id]),
  };
};

const sealIfAvailable = (view: PlayerView): Partial<TokenCounts> =>
  view.supply.seal > 0 ? { seal: 1 } : {};

const denialValue = (ctx: Context, card: Card): number =>
  ctx.opponents.reduce((acc, opp, i) => {
    if (!paymentFor(card.cost, bonusesOf(opp.cards), opp.tokens)) return acc;
    const wins = opp.points + card.points >= ctx.view.targetPoints;
    const threat = wins ? WIN_BONUS / 2 : card.points;
    return Math.max(acc, (threat * DENIAL_WEIGHT) / (i + 1));
  }, 0);

const cardAt = (view: PlayerView, h: Holdings, move: Extract<Move, { type: 'buy' }>) =>
  move.source.kind === 'market'
    ? view.market[move.source.tier][move.source.slot]
    : h.reserved[move.source.index];

const scoreMove = (ctx: Context, base: Holdings, move: Move): number => {
  switch (move.type) {
    case 'buy': {
      const card = cardAt(ctx.view, base, move);
      const after = card && afterBuy(base, card);
      if (!card || !after) return -Infinity;
      const wins = after.points >= ctx.view.targetPoints ? WIN_BONUS : 0;
      return positionValue(ctx, after) + wins;
    }
    case 'takeDistinct':
      return positionValue(
        ctx,
        withTokens(base, Object.fromEntries(move.spices.map((s) => [s, 1]))),
      );
    case 'takeDouble':
      return positionValue(ctx, withTokens(base, { [move.spice]: 2 }));
    case 'reserve': {
      const slotCost = base.reservedSlots * RESERVE_SLOT_COST;
      const gained = withTokens(base, sealIfAvailable(ctx.view));
      if (move.source.kind === 'deck') {
        return positionValue(ctx, gained) + BLIND_RESERVE_VALUE - slotCost;
      }
      const card = ctx.view.market[move.source.tier][move.source.slot];
      if (!card || base.reservedSlots >= MAX_RESERVED) return -Infinity;
      const after = { ...gained, reserved: [...base.reserved, card] };
      return positionValue(ctx, after) + denialValue(ctx, card) - slotCost;
    }
    case 'discard':
      return positionValue(ctx, {
        ...base,
        tokens: subtractTokens(base.tokens, tokensFrom(move.tokens)),
      });
    case 'chooseGuild': {
      const guild: Guild | undefined = ctx.view.guilds.find((g) => g.id === move.guildId);
      return guild ? guild.points : 0;
    }
    case 'pass':
      return -Infinity;
  }
};

const contextFor = (view: PlayerView): Context => {
  const me = view.players[view.currentPlayer];
  if (!me) throw new Error('No current player');
  const count = view.players.length;
  const opponents = Array.from(
    { length: count - 1 },
    (_, i) => view.players[(view.currentPlayer + 1 + i) % count],
  ).filter((p): p is PlayerPublic => p !== undefined);
  const leader = Math.max(...view.players.map((p) => p.points));
  return { view, me, opponents, engineWeight: Math.max(0, 1 - leader / view.targetPoints) * 1.5 };
};

export const chooseMove = (
  view: PlayerView,
  moves: readonly Move[],
  rng: RngState,
): { readonly move: Move; readonly next: RngState } => {
  const ctx = contextFor(view);
  const base = holdingsOf(ctx.me);
  let state = rng;
  let best: { move: Move; score: number } | null = null;
  for (const move of moves) {
    const step = nextFloat(state);
    state = step.next;
    const score = scoreMove(ctx, base, move) + step.value * NOISE;
    if (!best || score > best.score) best = { move, score };
  }
  if (!best) throw new Error('No legal moves');
  return { move: best.move, next: state };
};
