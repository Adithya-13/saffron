import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { CATALOG } from '@saffron/content';
import {
  MAX_RESERVED,
  MAX_TOKENS,
  TIERS,
  TOKENS,
  addTokens,
  rulesFor,
  supplyFor,
  totalTokens,
} from '@saffron/engine';
import type { GameState } from '@saffron/engine';
import { simulateGame } from './simulate.ts';

const tokenTotals = (state: GameState) =>
  state.players.reduce((acc, p) => addTokens(acc, p.tokens), state.supply);

const cardCount = (state: GameState): number =>
  TIERS.reduce(
    (sum, t) => sum + state.decks[t].length + state.market[t].filter((c) => c !== null).length,
    0,
  ) + state.players.reduce((sum, p) => sum + p.cards.length + p.reserved.length, 0);

describe('random bot games', () => {
  it('preserve every invariant and always finish', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 8 }),
        fc.integer({ min: 1, max: 2 ** 31 }),
        (players, seed) => {
          const result = simulateGame(CATALOG, players, seed);
          expect(result.state.finished).toBe(true);
          expect(result.winners.length).toBeGreaterThan(0);
          const expectedSupply = supplyFor(players);
          for (const state of result.states) {
            expect(tokenTotals(state)).toEqual(expectedSupply);
            expect(cardCount(state)).toBe(CATALOG.cards.length * rulesFor(players).deckCopies);
            expect(TOKENS.every((t) => state.supply[t] >= 0)).toBe(true);
            for (const player of state.players) {
              expect(player.reserved.length).toBeLessThanOrEqual(MAX_RESERVED);
              expect(TOKENS.every((t) => player.tokens[t] >= 0)).toBe(true);
              if (state.phase.kind === 'action') {
                expect(totalTokens(player.tokens)).toBeLessThanOrEqual(MAX_TOKENS);
              }
            }
          }
        },
      ),
      { numRuns: 60 },
    );
  });
});
