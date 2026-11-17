import { CATALOG } from '@saffron/content';
import { chooseMove } from './chooseMove.ts';
import { chooseMoveGreedy } from './greedy.ts';
import { simulateGame } from './simulate.ts';
import type { Strategy } from './simulate.ts';

const games = Number(process.argv[2] ?? 400);

for (const players of [2, 3, 4, 6, 8]) {
  let wins = 0;
  let unfinished = 0;
  for (let seed = 1; seed <= games; seed++) {
    const seat = seed % players;
    const strategies: Strategy[] = Array.from({ length: players }, (_, i) =>
      i === seat ? chooseMove : chooseMoveGreedy,
    );
    const result = simulateGame(CATALOG, players, seed * 104_729 + players, strategies);
    if (!result.state.finished) unfinished++;
    if (result.winners.includes(`p${seat + 1}`)) wins += 1 / result.winners.length;
  }
  console.log(
    `${players}p: planner wins ${((wins / games) * 100).toFixed(1)}% (fair ${(100 / players).toFixed(1)}%), unfinished ${unfinished}`,
  );
}
