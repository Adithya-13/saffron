import { CATALOG } from '@saffron/content';
import { simulateGame } from './simulate.ts';

const games = Number(process.argv[2] ?? 500);

const percent = (n: number, total: number): string => `${((n / total) * 100).toFixed(1)}%`;

for (const players of [2, 3, 4, 5, 6, 7, 8]) {
  const seatWins = new Map<string, number>();
  const cardBuys = new Map<string, number>();
  const tierBuys = new Map<number, number>();
  let rounds = 0;
  let unfinished = 0;
  let guildClaims = 0;
  let winnerPoints = 0;
  const tierEmptied = new Map<number, number>();

  for (let seed = 1; seed <= games; seed++) {
    const result = simulateGame(CATALOG, players, seed * 7919 + players);
    if (!result.state.finished) unfinished++;
    rounds += result.rounds;
    for (const w of result.winners)
      seatWins.set(w, (seatWins.get(w) ?? 0) + 1 / result.winners.length);
    for (const event of result.events) {
      if (event.type === 'cardBought') {
        cardBuys.set(event.card.id, (cardBuys.get(event.card.id) ?? 0) + 1);
        tierBuys.set(event.card.tier, (tierBuys.get(event.card.tier) ?? 0) + 1);
      }
      if (event.type === 'guildClaimed') guildClaims++;
    }
    for (const tier of [1, 2, 3] as const) {
      if (result.states.some((st) => st.decks[tier].length === 0))
        tierEmptied.set(tier, (tierEmptied.get(tier) ?? 0) + 1);
    }
    const top = Math.max(
      ...result.state.players.map(
        (p) =>
          p.cards.reduce((s, c) => s + c.points, 0) + p.guilds.reduce((s, g) => s + g.points, 0),
      ),
    );
    winnerPoints += top;
  }

  const buys = [...cardBuys.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`\n== ${players} players, ${games} games ==`);
  console.log(
    `avg rounds ${(rounds / games).toFixed(1)}, unfinished ${unfinished}, avg winner pts ${(winnerPoints / games).toFixed(1)}, guilds/game ${(guildClaims / games).toFixed(2)}`,
  );
  console.log(
    `seat wins ${[...seatWins.entries()]
      .sort()
      .map(([s, w]) => `${s}=${percent(w, games)}`)
      .join(' ')}`,
  );
  console.log(
    `buys/game by tier ${[1, 2, 3].map((t) => `t${t}=${((tierBuys.get(t) ?? 0) / games).toFixed(1)}`).join(' ')}`,
  );
  console.log(
    `deck emptied ${[1, 2, 3].map((t) => `t${t}=${percent(tierEmptied.get(t) ?? 0, games)}`).join(' ')}`,
  );
  console.log(
    `most bought ${buys
      .slice(0, 5)
      .map(([id, n]) => `${id}:${n}`)
      .join(' ')}`,
  );
  console.log(
    `least bought ${buys
      .slice(-5)
      .map(([id, n]) => `${id}:${n}`)
      .join(' ')}`,
  );
  console.log(
    `never bought ${
      CATALOG.cards
        .filter((c) => !cardBuys.has(c.id))
        .map((c) => c.id)
        .join(' ') || 'none'
    }`,
  );
}
