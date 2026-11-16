import type { RngState } from './rng.ts';

export const SPICES = ['saffron', 'cardamom', 'sumac', 'pepper', 'salt'] as const;
export type Spice = (typeof SPICES)[number];

export const TOKENS = [...SPICES, 'seal'] as const;
export type Token = (typeof TOKENS)[number];

export type SpiceCounts = Readonly<Record<Spice, number>>;
export type TokenCounts = Readonly<Record<Token, number>>;

export const TIERS = [1, 2, 3] as const;
export type Tier = (typeof TIERS)[number];

export const MARKET_SLOTS = 4;
export const MAX_TOKENS = 10;
export const MAX_RESERVED = 3;
export const TARGET_POINTS = 15;
export const SEAL_SUPPLY = 5;
export const DOUBLE_TAKE_MIN_PILE = 4;

export type Card = {
  readonly id: string;
  readonly tier: Tier;
  readonly points: number;
  readonly bonus: Spice;
  readonly cost: SpiceCounts;
};

export type Guild = {
  readonly id: string;
  readonly name: string;
  readonly points: number;
  readonly requires: SpiceCounts;
};

export type Catalog = {
  readonly cards: readonly Card[];
  readonly guilds: readonly Guild[];
};

export type ReservedCard = { readonly card: Card; readonly hidden: boolean };

export type PlayerState = {
  readonly id: string;
  readonly tokens: TokenCounts;
  readonly cards: readonly Card[];
  readonly reserved: readonly ReservedCard[];
  readonly guilds: readonly Guild[];
};

export type Phase =
  | { readonly kind: 'action' }
  | { readonly kind: 'discard'; readonly excess: number }
  | { readonly kind: 'guild'; readonly options: readonly string[] };

export type MarketRow = readonly (Card | null)[];

export type GameState = {
  readonly rng: RngState;
  readonly decks: Readonly<Record<Tier, readonly Card[]>>;
  readonly market: Readonly<Record<Tier, MarketRow>>;
  readonly supply: TokenCounts;
  readonly guilds: readonly Guild[];
  readonly players: readonly PlayerState[];
  readonly currentPlayer: number;
  readonly phase: Phase;
  readonly turn: number;
  readonly finalRound: boolean;
  readonly finished: boolean;
};

export type CardSource =
  | { readonly kind: 'market'; readonly tier: Tier; readonly slot: number }
  | { readonly kind: 'deck'; readonly tier: Tier };

export type BuySource =
  | { readonly kind: 'market'; readonly tier: Tier; readonly slot: number }
  | { readonly kind: 'reserve'; readonly index: number };

export type Move =
  | { readonly type: 'takeDistinct'; readonly spices: readonly Spice[] }
  | { readonly type: 'takeDouble'; readonly spice: Spice }
  | { readonly type: 'reserve'; readonly source: CardSource }
  | { readonly type: 'buy'; readonly source: BuySource }
  | { readonly type: 'discard'; readonly tokens: Partial<TokenCounts> }
  | { readonly type: 'chooseGuild'; readonly guildId: string }
  | { readonly type: 'pass' };

export type GameEvent =
  | { readonly type: 'tokensTaken'; readonly playerId: string; readonly tokens: TokenCounts }
  | {
      readonly type: 'cardReserved';
      readonly playerId: string;
      readonly card: Card;
      readonly from: CardSource;
      readonly sealTaken: boolean;
    }
  | {
      readonly type: 'cardBought';
      readonly playerId: string;
      readonly card: Card;
      readonly from: BuySource;
      readonly paid: TokenCounts;
    }
  | { readonly type: 'tokensDiscarded'; readonly playerId: string; readonly tokens: TokenCounts }
  | { readonly type: 'guildClaimed'; readonly playerId: string; readonly guild: Guild }
  | {
      readonly type: 'marketRefilled';
      readonly tier: Tier;
      readonly slot: number;
      readonly card: Card | null;
    }
  | { readonly type: 'passed'; readonly playerId: string }
  | { readonly type: 'finalRound'; readonly triggeredBy: string }
  | { readonly type: 'turnStarted'; readonly playerId: string; readonly turn: number }
  | { readonly type: 'gameEnded'; readonly winners: readonly string[] };

export type RuleError =
  | 'gameFinished'
  | 'notYourTurn'
  | 'wrongPhase'
  | 'invalidTokens'
  | 'supplyEmpty'
  | 'pileTooSmall'
  | 'reserveFull'
  | 'noCard'
  | 'cannotAfford'
  | 'invalidDiscard'
  | 'invalidGuild'
  | 'passNotAllowed';

export type MoveResult =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly GameEvent[] }
  | { readonly ok: false; readonly error: RuleError };
