import { emptyTokens } from './counts.ts';
import { seedRng, shuffle } from './rng.ts';
import type { RngState } from './rng.ts';
import { MARKET_SLOTS, SEAL_SUPPLY, SPICES, TIERS } from './types.ts';
import type {
  Card,
  Catalog,
  GameState,
  MarketRow,
  PlayerState,
  Tier,
  TokenCounts,
} from './types.ts';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;

const SPICE_SUPPLY_BY_PLAYERS: Readonly<Record<number, number>> = { 2: 4, 3: 5, 4: 7 };

export const supplyFor = (playerCount: number): TokenCounts => {
  const perSpice = SPICE_SUPPLY_BY_PLAYERS[playerCount];
  if (perSpice === undefined) throw new Error(`Unsupported player count: ${playerCount}`);
  return {
    ...(Object.fromEntries(SPICES.map((s) => [s, perSpice])) as Record<
      (typeof SPICES)[number],
      number
    >),
    seal: SEAL_SUPPLY,
  };
};

const newPlayer = (id: string): PlayerState => ({
  id,
  tokens: emptyTokens(),
  cards: [],
  reserved: [],
  guilds: [],
});

type Dealt = { readonly deck: readonly Card[]; readonly row: MarketRow; readonly rng: RngState };

const dealTier = (cards: readonly Card[], rng: RngState): Dealt => {
  const shuffled = shuffle(cards, rng);
  return {
    row: shuffled.items.slice(0, MARKET_SLOTS),
    deck: shuffled.items.slice(MARKET_SLOTS),
    rng: shuffled.next,
  };
};

export const createGame = (
  catalog: Catalog,
  playerIds: readonly string[],
  seed: number,
): GameState => {
  if (playerIds.length < MIN_PLAYERS || playerIds.length > MAX_PLAYERS) {
    throw new Error(`Player count must be ${MIN_PLAYERS}-${MAX_PLAYERS}`);
  }
  if (new Set(playerIds).size !== playerIds.length) throw new Error('Duplicate player ids');

  let rng = seedRng(seed);
  const decks: Partial<Record<Tier, readonly Card[]>> = {};
  const market: Partial<Record<Tier, MarketRow>> = {};
  for (const tier of TIERS) {
    const dealt = dealTier(
      catalog.cards.filter((c) => c.tier === tier),
      rng,
    );
    decks[tier] = dealt.deck;
    market[tier] = dealt.row;
    rng = dealt.rng;
  }

  const guildShuffle = shuffle(catalog.guilds, rng);
  rng = guildShuffle.next;

  return {
    rng,
    decks: decks as Record<Tier, readonly Card[]>,
    market: market as Record<Tier, MarketRow>,
    supply: supplyFor(playerIds.length),
    guilds: guildShuffle.items.slice(0, playerIds.length + 1),
    players: playerIds.map(newPlayer),
    currentPlayer: 0,
    phase: { kind: 'action' },
    turn: 1,
    finalRound: false,
    finished: false,
  };
};
