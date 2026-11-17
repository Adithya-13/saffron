import { describe, expect, it } from 'vitest';
import { SPICES, TIERS } from '@saffron/engine';
import { CARDS, GUILDS, REPRINT } from './index.ts';

const BIG_TABLE = [...CARDS, ...REPRINT];

const totalCost = (cost: Record<string, number>): number =>
  Object.values(cost).reduce((a, b) => a + b, 0);

describe('deck', () => {
  it('never repeats an id or a card, even with the reprint on big tables', () => {
    expect(REPRINT).toHaveLength(CARDS.length);
    expect(new Set(BIG_TABLE.map((c) => c.id)).size).toBe(BIG_TABLE.length);
    const keys = BIG_TABLE.map(
      (c) => `${c.tier}:${c.bonus}:${SPICES.map((s) => c.cost[s]).join(',')}`,
    );
    expect(new Set(keys).size).toBe(BIG_TABLE.length);
  });

  it('gives the reprint the same points and total cost as the first printing', () => {
    const profile = (cards: typeof CARDS) =>
      cards.map((c) => `${c.tier}:${c.bonus}:${c.points}:${totalCost(c.cost)}`).sort();
    expect(profile(REPRINT)).toEqual(profile(CARDS));
  });

  it('is colour-symmetric within each tier', () => {
    for (const tier of TIERS) {
      const counts = SPICES.map(
        (s) => BIG_TABLE.filter((c) => c.tier === tier && c.bonus === s).length,
      );
      expect(new Set(counts).size).toBe(1);
    }
  });

  it('keeps costs and points inside tier bands', () => {
    const bands = {
      1: { cost: [3, 5], points: [0, 1] },
      2: { cost: [5, 8], points: [1, 3] },
      3: { cost: [7, 14], points: [3, 5] },
    };
    for (const card of BIG_TABLE) {
      const band = bands[card.tier];
      const cost = totalCost(card.cost);
      expect(cost).toBeGreaterThanOrEqual(band.cost[0] as number);
      expect(cost).toBeLessThanOrEqual(band.cost[1] as number);
      expect(card.points).toBeGreaterThanOrEqual(band.points[0] as number);
      expect(card.points).toBeLessThanOrEqual(band.points[1] as number);
      expect(SPICES.every((s) => card.cost[s] >= 0)).toBe(true);
    }
  });

  it('has enough cards to fill the market and a deck behind it', () => {
    for (const tier of TIERS) {
      expect(CARDS.filter((c) => c.tier === tier).length).toBeGreaterThan(8);
    }
  });
});

describe('guilds', () => {
  it('has unique ids and enough guilds for 4 players', () => {
    expect(new Set(GUILDS.map((g) => g.id)).size).toBe(GUILDS.length);
    expect(GUILDS.length).toBeGreaterThanOrEqual(5);
  });

  it('requires between 6 and 10 bonuses each', () => {
    for (const guild of GUILDS) {
      const total = totalCost(guild.requires);
      expect(total).toBeGreaterThanOrEqual(6);
      expect(total).toBeLessThanOrEqual(10);
    }
  });
});
