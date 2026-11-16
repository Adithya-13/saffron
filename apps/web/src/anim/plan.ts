import { TOKENS } from '@saffron/engine';
import type { Card, Guild, Tier, Token, TokenCounts, VisibleEvent } from '@saffron/engine';
import type { SfxName } from '../audio/sound.ts';

export type Ghost =
  | { readonly kind: 'token'; readonly token: Token }
  | { readonly kind: 'card'; readonly card: Card }
  | { readonly kind: 'back'; readonly tier: Tier }
  | { readonly kind: 'guild'; readonly guild: Guild };

export type FlightSpec = {
  readonly ghost: Ghost;
  readonly from: readonly string[];
  readonly to: readonly string[];
  readonly delay: number;
  readonly duration: number;
  readonly showcase?: boolean;
};

export type SoundCue = { readonly name: SfxName; readonly delay: number; readonly volume?: number };

export type Banner = { readonly text: string; readonly tone: 'turn' | 'final' };

export type Plan = {
  readonly flights: readonly FlightSpec[];
  readonly sounds: readonly SoundCue[];
  readonly banner: Banner | null;
  readonly burst: boolean;
  readonly duration: number;
};

const TOKEN_GAP = 70;
const TOKEN_FLIGHT = 520;
const CARD_FLIGHT = 640;
const SHOWCASE_FLIGHT = 1700;

export const anchors = {
  supply: (t: Token) => `supply-${t}`,
  tokens: (playerId: string, t: Token) => `tokens-${playerId}-${t}`,
  player: (playerId: string) => `player-${playerId}`,
  bonus: (playerId: string, spice: string) => `bonus-${playerId}-${spice}`,
  reserve: (playerId: string) => `reserve-${playerId}`,
  reserveSlot: (playerId: string, index: number) => `reserve-${playerId}-${index}`,
  market: (tier: Tier, slot: number) => `market-${tier}-${slot}`,
  deck: (tier: Tier) => `deck-${tier}`,
  guild: (id: string) => `guild-${id}`,
  guilds: (playerId: string) => `guilds-${playerId}`,
};

const tokenFlights = (
  tokens: TokenCounts,
  from: (t: Token) => readonly string[],
  to: (t: Token) => readonly string[],
  startDelay: number,
): FlightSpec[] =>
  TOKENS.flatMap((t) => Array.from({ length: tokens[t] }, () => t)).map((token, i) => ({
    ghost: { kind: 'token', token },
    from: from(token),
    to: to(token),
    delay: startDelay + i * TOKEN_GAP,
    duration: TOKEN_FLIGHT,
  }));

const countTokens = (tokens: TokenCounts): number => TOKENS.reduce((s, t) => s + tokens[t], 0);

const clinks = (count: number, start: number, volume = 0.8): SoundCue[] =>
  Array.from({ length: Math.min(count, 6) }, (_, i) => ({
    name: (['clink1', 'clink2', 'clink3'] as const)[i % 3] ?? 'clink1',
    delay: start + TOKEN_FLIGHT - 60 + i * TOKEN_GAP,
    volume,
  }));

type Part = { flights: FlightSpec[]; sounds: SoundCue[]; banner?: Banner; burst?: boolean };

const planEvent = (event: VisibleEvent, viewerId: string | null, at: number): Part => {
  switch (event.type) {
    case 'tokensTaken': {
      const p = event.playerId;
      return {
        flights: tokenFlights(
          event.tokens,
          (t) => [anchors.supply(t)],
          (t) => [anchors.tokens(p, t), anchors.player(p)],
          at,
        ),
        sounds: clinks(countTokens(event.tokens), at),
      };
    }
    case 'tokensDiscarded': {
      const p = event.playerId;
      return {
        flights: tokenFlights(
          event.tokens,
          (t) => [anchors.tokens(p, t), anchors.player(p)],
          (t) => [anchors.supply(t)],
          at,
        ),
        sounds: clinks(countTokens(event.tokens), at, 0.5),
      };
    }
    case 'cardBought': {
      const p = event.playerId;
      const from =
        event.from.kind === 'market'
          ? [anchors.market(event.from.tier, event.from.slot)]
          : [anchors.reserveSlot(p, event.from.index), anchors.reserve(p), anchors.player(p)];
      const paid = tokenFlights(
        event.paid,
        (t) => [anchors.tokens(p, t), anchors.player(p)],
        (t) => [anchors.supply(t)],
        at + 200,
      );
      return {
        flights: [
          {
            ghost: { kind: 'card', card: event.card },
            from,
            to: [anchors.bonus(p, event.card.bonus), anchors.player(p)],
            delay: at,
            duration: CARD_FLIGHT,
          },
          ...paid,
        ],
        sounds: [
          { name: 'slide', delay: at, volume: 0.5 },
          { name: 'chime', delay: at + CARD_FLIGHT - 120 },
          ...clinks(countTokens(event.paid), at + 200, 0.6),
        ],
      };
    }
    case 'cardReserved': {
      const p = event.playerId;
      const from =
        event.from.kind === 'market'
          ? [anchors.market(event.from.tier, event.from.slot)]
          : [anchors.deck(event.from.tier)];
      const ghost: Ghost = event.card
        ? { kind: 'card', card: event.card }
        : { kind: 'back', tier: event.tier };
      const seal: FlightSpec[] = event.sealTaken
        ? [
            {
              ghost: { kind: 'token', token: 'seal' },
              from: [anchors.supply('seal')],
              to: [anchors.tokens(p, 'seal'), anchors.player(p)],
              delay: at + 260,
              duration: TOKEN_FLIGHT,
            },
          ]
        : [];
      return {
        flights: [
          {
            ghost,
            from,
            to: [anchors.reserve(p), anchors.player(p)],
            delay: at,
            duration: CARD_FLIGHT,
          },
          ...seal,
        ],
        sounds: [
          { name: 'slide', delay: at, volume: 0.5 },
          ...(event.sealTaken
            ? [{ name: 'stamp' as const, delay: at + 260 + TOKEN_FLIGHT - 80 }]
            : []),
        ],
      };
    }
    case 'guildClaimed':
      return {
        flights: [
          {
            ghost: { kind: 'guild', guild: event.guild },
            from: [anchors.guild(event.guild.id)],
            to: [anchors.guilds(event.playerId), anchors.player(event.playerId)],
            delay: at,
            duration: SHOWCASE_FLIGHT,
            showcase: true,
          },
        ],
        sounds: [{ name: 'fanfare', delay: at + 150 }],
        burst: true,
      };
    case 'marketRefilled':
      return event.card
        ? { flights: [], sounds: [{ name: 'flip', delay: at + 380, volume: 0.6 }] }
        : { flights: [], sounds: [] };
    case 'turnStarted':
      return event.playerId === viewerId
        ? {
            flights: [],
            sounds: [{ name: 'bell', delay: at + 150 }],
            banner: { text: 'Your turn', tone: 'turn' },
          }
        : { flights: [], sounds: [] };
    case 'finalRound':
      return {
        flights: [],
        sounds: [{ name: 'drum', delay: at }],
        banner: { text: 'Final round', tone: 'final' },
      };
    case 'passed':
      return { flights: [], sounds: [{ name: 'thunk', delay: at, volume: 0.5 }] };
    case 'gameEnded':
      return { flights: [], sounds: [] };
  }
};

const STEP_GAP: Partial<Record<VisibleEvent['type'], number>> = {
  tokensTaken: 0,
  cardBought: 0,
  cardReserved: 0,
  tokensDiscarded: 0,
  guildClaimed: 500,
};

export const planEvents = (events: readonly VisibleEvent[], viewerId: string | null): Plan => {
  let cursor = 0;
  const flights: FlightSpec[] = [];
  const sounds: SoundCue[] = [];
  let banner: Banner | null = null;
  let burst = false;
  for (const event of events) {
    cursor += STEP_GAP[event.type] ?? 0;
    const part = planEvent(event, viewerId, cursor);
    flights.push(...part.flights);
    sounds.push(...part.sounds);
    if (part.banner && banner?.tone !== 'final') banner = part.banner;
    burst = burst || Boolean(part.burst);
    const partEnd = Math.max(cursor, ...part.flights.map((f) => f.delay + f.duration));
    if (
      event.type === 'guildClaimed' ||
      event.type === 'cardBought' ||
      event.type === 'cardReserved'
    ) {
      cursor = partEnd - 200;
    }
  }
  const duration = Math.max(0, ...flights.map((f) => f.delay + f.duration));
  return { flights, sounds, banner, burst, duration };
};
