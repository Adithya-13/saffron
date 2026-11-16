import { pointsOf } from './counts.ts';
import { TIERS } from './types.ts';
import type {
  Card,
  CardSource,
  GameEvent,
  GameState,
  Guild,
  MarketRow,
  Phase,
  PlayerState,
  Tier,
  TokenCounts,
} from './types.ts';

export type VisibleReserved = {
  readonly tier: Tier;
  readonly hidden: boolean;
  readonly card: Card | null;
};

export type PlayerPublic = {
  readonly id: string;
  readonly tokens: TokenCounts;
  readonly cards: readonly Card[];
  readonly reserved: readonly VisibleReserved[];
  readonly guilds: readonly Guild[];
  readonly points: number;
};

export type PlayerView = {
  readonly viewerId: string | null;
  readonly market: Readonly<Record<Tier, MarketRow>>;
  readonly deckCounts: Readonly<Record<Tier, number>>;
  readonly supply: TokenCounts;
  readonly guilds: readonly Guild[];
  readonly players: readonly PlayerPublic[];
  readonly currentPlayer: number;
  readonly phase: Phase;
  readonly turn: number;
  readonly targetPoints: number;
  readonly finalRound: boolean;
  readonly finished: boolean;
};

export type VisibleEvent =
  | Exclude<GameEvent, { type: 'cardReserved' }>
  | {
      readonly type: 'cardReserved';
      readonly playerId: string;
      readonly card: Card | null;
      readonly tier: Tier;
      readonly from: CardSource;
      readonly sealTaken: boolean;
    };

const publicPlayer = (player: PlayerState, viewerId: string | null): PlayerPublic => ({
  id: player.id,
  tokens: player.tokens,
  cards: player.cards,
  reserved: player.reserved.map((r) => ({
    tier: r.card.tier,
    hidden: r.hidden,
    card: r.hidden && player.id !== viewerId ? null : r.card,
  })),
  guilds: player.guilds,
  points: pointsOf(player),
});

export const viewFor = (state: GameState, viewerId: string | null): PlayerView => ({
  viewerId,
  market: state.market,
  deckCounts: Object.fromEntries(TIERS.map((t) => [t, state.decks[t].length])) as Record<
    Tier,
    number
  >,
  supply: state.supply,
  guilds: state.guilds,
  players: state.players.map((p) => publicPlayer(p, viewerId)),
  currentPlayer: state.currentPlayer,
  phase: state.phase,
  turn: state.turn,
  targetPoints: state.targetPoints,
  finalRound: state.finalRound,
  finished: state.finished,
});

export const eventFor = (event: GameEvent, viewerId: string | null): VisibleEvent => {
  if (event.type !== 'cardReserved') return event;
  const concealed = event.from.kind === 'deck' && event.playerId !== viewerId;
  return { ...event, tier: event.card.tier, card: concealed ? null : event.card };
};
