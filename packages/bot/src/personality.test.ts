import { describe, expect, it } from 'vitest';
import { personalityOf } from './chooseMove.ts';

describe('bot personality', () => {
  it('is stable per player and differs between players', () => {
    expect(personalityOf('seat-a')).toEqual(personalityOf('seat-a'));
    const ids = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
    const gammas = new Set(ids.map((id) => personalityOf(id).gamma.toFixed(3)));
    expect(gammas.size).toBe(ids.length);
  });

  it('stays within tuned ranges', () => {
    for (const id of ['x', 'y', 'z', 'long-random-seat-id-1234']) {
      const p = personalityOf(id);
      expect(p.gamma).toBeGreaterThanOrEqual(0.6 * 0.85);
      expect(p.gamma).toBeLessThanOrEqual(0.6 * 1.15);
      expect(p.reserve).toBeGreaterThanOrEqual(0.6);
      expect(p.reserve).toBeLessThanOrEqual(1.4);
    }
  });
});
