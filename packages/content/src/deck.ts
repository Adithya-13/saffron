import { SPICES, emptySpices } from '@saffron/engine';
import type { Card, Spice, SpiceCounts, Tier } from '@saffron/engine';

type Offset = 0 | 1 | 2 | 3 | 4;

export type CostPattern = {
  readonly points: number;
  readonly cost: Readonly<Partial<Record<Offset, number>>>;
};

export const PATTERNS: Readonly<Record<Tier, readonly CostPattern[]>> = {
  1: [
    { points: 0, cost: { 1: 1, 2: 1, 3: 1, 4: 1 } },
    { points: 0, cost: { 1: 1, 2: 2, 4: 1 } },
    { points: 0, cost: { 2: 2, 3: 2 } },
    { points: 0, cost: { 4: 3 } },
    { points: 0, cost: { 1: 2, 3: 1 } },
    { points: 0, cost: { 0: 1, 1: 1, 3: 2 } },
    { points: 1, cost: { 2: 4 } },
  ],
  2: [
    { points: 1, cost: { 1: 3, 3: 2, 4: 2 } },
    { points: 1, cost: { 0: 2, 2: 2, 4: 3 } },
    { points: 2, cost: { 1: 1, 3: 4, 4: 2 } },
    { points: 2, cost: { 2: 5 } },
    { points: 2, cost: { 0: 3, 1: 5 } },
    { points: 3, cost: { 0: 6 } },
  ],
  3: [
    { points: 3, cost: { 1: 3, 2: 5, 3: 3, 4: 3 } },
    { points: 4, cost: { 4: 7 } },
    { points: 4, cost: { 0: 3, 3: 6, 4: 3 } },
    { points: 5, cost: { 0: 3, 4: 7 } },
  ],
};

export const REPRINT_PATTERNS: Readonly<Record<Tier, readonly CostPattern[]>> = {
  1: [
    { points: 0, cost: { 1: 2, 2: 1, 3: 1 } },
    { points: 0, cost: { 2: 1, 3: 1, 4: 2 } },
    { points: 0, cost: { 1: 2, 4: 2 } },
    { points: 0, cost: { 3: 3 } },
    { points: 0, cost: { 1: 1, 2: 2 } },
    { points: 0, cost: { 0: 1, 1: 2, 2: 1 } },
    { points: 1, cost: { 4: 4 } },
  ],
  2: [
    { points: 1, cost: { 1: 2, 2: 3, 3: 2 } },
    { points: 1, cost: { 0: 2, 3: 3, 4: 2 } },
    { points: 2, cost: { 1: 4, 2: 1, 3: 2 } },
    { points: 2, cost: { 4: 5 } },
    { points: 2, cost: { 0: 3, 2: 5 } },
    { points: 3, cost: { 3: 6 } },
  ],
  3: [
    { points: 3, cost: { 1: 3, 2: 3, 3: 3, 4: 5 } },
    { points: 4, cost: { 3: 7 } },
    { points: 4, cost: { 0: 3, 1: 6, 3: 3 } },
    { points: 5, cost: { 0: 3, 3: 7 } },
  ],
};

const costFor = (bonus: Spice, pattern: CostPattern): SpiceCounts => {
  const base = SPICES.indexOf(bonus);
  const entries = Object.entries(pattern.cost).map(([offset, amount]) => {
    const spice = SPICES[(base + Number(offset)) % SPICES.length];
    if (!spice) throw new Error('Invalid offset');
    return [spice, amount] as const;
  });
  return { ...emptySpices(), ...Object.fromEntries(entries) };
};

export const buildDeck = (
  patterns: Readonly<Record<Tier, readonly CostPattern[]>>,
  suffix = '',
): Card[] =>
  ([1, 2, 3] as const).flatMap((tier) =>
    SPICES.flatMap((bonus) =>
      patterns[tier].map((pattern, index) => ({
        id: `t${tier}-${bonus}-${index + 1}${suffix}`,
        tier,
        points: pattern.points,
        bonus,
        cost: costFor(bonus, pattern),
      })),
    ),
  );

export const CARDS: readonly Card[] = buildDeck(PATTERNS);
export const REPRINT: readonly Card[] = buildDeck(REPRINT_PATTERNS, '-b');
