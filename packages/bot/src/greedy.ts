import {
  SPICES,
  TOKENS,
  bonusesOf,
  deficitFor,
  nextFloat,
  totalTokens,
  MAX_TOKENS,
} from '@saffron/engine';
import type {
  Card,
  Move,
  PlayerPublic,
  PlayerView,
  RngState,
  Spice,
  SpiceCounts,
} from '@saffron/engine';

type Target = {
  readonly card: Card;
  readonly value: number;
  readonly need: SpiceCounts;
  readonly effort: number;
};

const NOISE = 0.35;
const TARGET_COUNT = 3;

const sum = (counts: Readonly<Record<string, number>>): number =>
  Object.values(counts).reduce((a, b) => a + b, 0);

const meOf = (view: PlayerView): PlayerPublic => {
  const me = view.players[view.currentPlayer];
  if (!me) throw new Error('No current player');
  return me;
};

const guildPull = (view: PlayerView, bonuses: SpiceCounts, spice: Spice): number =>
  view.guilds.reduce((acc, guild) => {
    const missing = SPICES.reduce((m, s) => m + Math.max(guild.requires[s] - bonuses[s], 0), 0);
    const helps = guild.requires[spice] > bonuses[spice];
    return helps ? acc + guild.points / (1 + missing) : acc;
  }, 0);

const visibleCards = (view: PlayerView, me: PlayerPublic): Card[] => [
  ...Object.values(view.market).flatMap((row) => row.filter((c): c is Card => c !== null)),
  ...me.reserved.flatMap((r) => (r.card ? [r.card] : [])),
];

const cardValue = (view: PlayerView, me: PlayerPublic, card: Card): number => {
  const bonuses = bonusesOf(me.cards);
  const earlyGame = Math.max(0, 1 - me.points / 12);
  return card.points * 2.2 + guildPull(view, bonuses, card.bonus) * 1.4 + earlyGame * 1.2;
};

const targetsFor = (view: PlayerView, me: PlayerPublic): Target[] => {
  const bonuses = bonusesOf(me.cards);
  return visibleCards(view, me)
    .map((card) => {
      const need = deficitFor(card.cost, bonuses, me.tokens);
      const effort = Math.max(sum(need) - me.tokens.seal, 0);
      return { card, need, effort, value: cardValue(view, me, card) };
    })
    .sort((a, b) => b.value / (1 + b.effort) - a.value / (1 + a.effort))
    .slice(0, TARGET_COUNT);
};

const spiceDemand = (targets: readonly Target[]): SpiceCounts =>
  Object.fromEntries(
    SPICES.map((s) => [
      s,
      targets.reduce(
        (acc, t, rank) => acc + (t.need[s] > 0 ? t.value / (1 + t.effort) / (rank + 1) : 0),
        0,
      ),
    ]),
  ) as Record<Spice, number>;

const tokenGain = (
  taken: Partial<Record<Spice, number>>,
  demand: SpiceCounts,
  held: number,
): number => {
  const count = sum(taken);
  const overflow = Math.max(held + count - MAX_TOKENS, 0);
  return (
    SPICES.reduce((acc, s) => acc + Math.min(taken[s] ?? 0, 2) * demand[s], 0) +
    count * 0.15 -
    overflow * 0.8
  );
};

const scoreMove = (
  view: PlayerView,
  me: PlayerPublic,
  targets: readonly Target[],
  move: Move,
): number => {
  const demand = spiceDemand(targets);
  const held = totalTokens(me.tokens);
  switch (move.type) {
    case 'buy': {
      const card =
        move.source.kind === 'market'
          ? view.market[move.source.tier][move.source.slot]
          : me.reserved[move.source.index]?.card;
      return card ? 3 + cardValue(view, me, card) * 1.5 : -Infinity;
    }
    case 'takeDistinct':
      return tokenGain(Object.fromEntries(move.spices.map((s) => [s, 1])), demand, held);
    case 'takeDouble':
      return tokenGain({ [move.spice]: 2 }, demand, held) - 0.2;
    case 'reserve': {
      if (move.source.kind === 'deck')
        return 0.1 + (view.supply.seal > 0 ? 0.3 : 0) - me.reserved.length;
      const card = view.market[move.source.tier][move.source.slot];
      if (!card) return -Infinity;
      const isTop = targets[0]?.card.id === card.id;
      return (
        (isTop ? card.points * 0.45 : 0) +
        (view.supply.seal > 0 ? 0.6 : 0) -
        me.reserved.length * 0.7
      );
    }
    case 'discard':
      return -TOKENS.reduce(
        (acc, t) => acc + (move.tokens[t] ?? 0) * (t === 'seal' ? 5 : 1 + (demand[t] ?? 0)),
        0,
      );
    case 'chooseGuild':
      return 0;
    case 'pass':
      return -100;
  }
};

export const chooseMoveGreedy = (
  view: PlayerView,
  moves: readonly Move[],
  rng: RngState,
): { readonly move: Move; readonly next: RngState } => {
  const me = meOf(view);
  const targets = targetsFor(view, me);
  let state = rng;
  let best: { move: Move; score: number } | null = null;
  for (const move of moves) {
    const step = nextFloat(state);
    state = step.next;
    const score = scoreMove(view, me, targets, move) + step.value * NOISE;
    if (!best || score > best.score) best = { move, score };
  }
  if (!best) throw new Error('No legal moves');
  return { move: best.move, next: state };
};
