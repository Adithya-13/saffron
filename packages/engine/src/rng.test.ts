import { describe, expect, it } from 'vitest';
import { nextFloat, seedRng, shuffle } from './rng.ts';

describe('rng', () => {
  it('is deterministic for the same seed', () => {
    expect(nextFloat(seedRng(42))).toEqual(nextFloat(seedRng(42)));
  });

  it('produces values in [0, 1)', () => {
    let state = seedRng(7);
    for (let i = 0; i < 1000; i++) {
      const step = nextFloat(state);
      expect(step.value).toBeGreaterThanOrEqual(0);
      expect(step.value).toBeLessThan(1);
      state = step.next;
    }
  });

  it('shuffles as a permutation without mutating input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const { items } = shuffle(input, seedRng(3));
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...items].sort((a, b) => a - b)).toEqual(input);
  });
});
