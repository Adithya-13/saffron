import { applyMove, createGame, legalMoves, seedRng, viewFor } from '@saffron/engine';
import type { Catalog, GameEvent, GameState, Move, PlayerView, RngState } from '@saffron/engine';
import { chooseMove } from './chooseMove.ts';

export type Strategy = (
  view: PlayerView,
  moves: readonly Move[],
  rng: RngState,
) => { readonly move: Move; readonly next: RngState };

export const MAX_SIM_STEPS = 2000;

export type SimResult = {
  readonly state: GameState;
  readonly states: readonly GameState[];
  readonly events: readonly GameEvent[];
  readonly winners: readonly string[];
  readonly rounds: number;
};

export const simulateGame = (
  catalog: Catalog,
  playerCount: number,
  seed: number,
  strategies: readonly Strategy[] = [],
): SimResult => {
  const ids = Array.from({ length: playerCount }, (_, i) => `p${i + 1}`);
  let state = createGame(catalog, ids, seed);
  let rng = seedRng(seed ^ 0x9e3779b9);
  const states: GameState[] = [state];
  const events: GameEvent[] = [];

  for (let step = 0; step < MAX_SIM_STEPS && !state.finished; step++) {
    const player = state.players[state.currentPlayer];
    if (!player) throw new Error('No current player');
    const strategy = strategies[state.currentPlayer] ?? chooseMove;
    const choice = strategy(viewFor(state, player.id), legalMoves(state, player.id), rng);
    rng = choice.next;
    const result = applyMove(state, player.id, choice.move);
    if (!result.ok) throw new Error(`Bot made illegal move: ${result.error}`);
    state = result.state;
    states.push(state);
    events.push(...result.events);
  }

  const ended = events.find((e) => e.type === 'gameEnded');
  return {
    state,
    states,
    events,
    winners: ended?.type === 'gameEnded' ? ended.winners : [],
    rounds: Math.ceil(state.turn / playerCount),
  };
};
