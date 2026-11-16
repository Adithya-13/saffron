import { emptyTokens } from './counts.ts';
import { seedRng, shuffle } from './rng.ts';
import type { RngState } from './rng.ts';
import { MARKET_SLOTS, SPICES, TIERS } from './types.ts';
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
export const MAX_PLAYERS = 8;

export type TableRules = {
  readonly spicePerPile: number;
  readonly seals: number;
  readonly targetPoints: number;
  readonly guilds: number;
  readonly deckCopies: number;
};

const RULES_BY_PLAYERS: Readonly<Record<number, TableRules>> = {
  2: { spicePerPile: 4, seals: 5, targetPoints: 15, guilds: 3, deckCopies: 1 },
  3: { spicePerPile: 5, seals: 5, targetPoints: 15, guilds: 4, deckCopies: 1 },
  4: { spicePerPile: 7, seals: 5, targetPoints: 15, guilds: 5, deckCopies: 1 },
  5: { spicePerPile: 8, seals: 6, targetPoints: 13, guilds: 6, deckCopies: 2 },
  6: { spicePerPile: 9, seals: 7, targetPoints: 13, guilds: 7, deckCopies: 2 },
  7: { spicePerPile: 10, seals: 7, targetPoints: 12, guilds: 7, deckCopies: 2 },
  8: { spicePerPile: 11, seals: 8, targetPoints: 12, guilds: 8, deckCopies: 2 },
};

export const rulesFor = (playerCount: number): TableRules => {
  const rules = RULES_BY_PLAYERS[playerCount];
  if (!rules) throw new Error(`Unsupported player count: ${playerCount}`);
  return rules;
};

export const supplyFor = (playerCount: number): TokenCounts => {
  const { spicePerPile, seals } = rulesFor(playerCount);
  return {
    ...(Object.fromEntries(SPICES.map((s) => [s, spicePerPile])) as Record<
      (typeof SPICES)[number],
      number
    >),
    seal: seals,
  };
};

const COPY_SUFFIXES = ['', '-b', '-c'] as const;

export const printDeck = (cards: readonly Card[], copies: number): readonly Card[] =>
  COPY_SUFFIXES.slice(0, copies).flatMap((suffix) =>
    cards.map((card) => ({ ...card, id: `${card.id}${suffix}` })),
  );

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

  const rules = rulesFor(playerIds.length);
  const cards = printDeck(catalog.cards, rules.deckCopies);
  let rng = seedRng(seed);
  const decks: Partial<Record<Tier, readonly Card[]>> = {};
  const market: Partial<Record<Tier, MarketRow>> = {};
  for (const tier of TIERS) {
    const dealt = dealTier(
      cards.filter((c) => c.tier === tier),
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
    guilds: guildShuffle.items.slice(0, rules.guilds),
    players: playerIds.map(newPlayer),
    currentPlayer: 0,
    phase: { kind: 'action' },
    turn: 1,
    targetPoints: rules.targetPoints,
    finalRound: false,
    finished: false,
  };
};
