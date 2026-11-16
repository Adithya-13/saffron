import { SPICE_INFO, TIER_INFO } from '@saffron/content';
import { TOKENS } from '@saffron/engine';
import type { PlayerPublic, PlayerView, TokenCounts, VisibleEvent } from '@saffron/engine';
import type { RoomSnapshot } from '@saffron/protocol';

export const nameOf = (room: RoomSnapshot | null, id: string): string =>
  room?.seats.find((s) => s.id === id)?.name ?? 'A merchant';

export const seatIndex = (room: RoomSnapshot | null, id: string): number =>
  Math.max(room?.seats.findIndex((s) => s.id === id) ?? 0, 0);

export const meOf = (view: PlayerView | null, seatId: string | null): PlayerPublic | null =>
  view?.players.find((p) => p.id === seatId) ?? null;

export const currentOf = (view: PlayerView | null): PlayerPublic | null =>
  view?.players[view.currentPlayer] ?? null;

export const isMyTurn = (view: PlayerView | null, seatId: string | null): boolean =>
  Boolean(view && !view.finished && seatId && currentOf(view)?.id === seatId);

const listTokens = (tokens: TokenCounts): string =>
  TOKENS.filter((t) => tokens[t] > 0)
    .map((t) => `${tokens[t]} ${SPICE_INFO[t].label}`)
    .join(', ');

export const describeEvent = (event: VisibleEvent, room: RoomSnapshot | null): string | null => {
  switch (event.type) {
    case 'tokensTaken':
      return `${nameOf(room, event.playerId)} took ${listTokens(event.tokens)}`;
    case 'tokensDiscarded':
      return `${nameOf(room, event.playerId)} returned ${listTokens(event.tokens)}`;
    case 'cardBought':
      return `${nameOf(room, event.playerId)} bought a ${SPICE_INFO[event.card.bonus].label} ${TIER_INFO[event.card.tier].label.slice(0, -1).toLowerCase()}${event.card.points ? ` (+${event.card.points})` : ''}`;
    case 'cardReserved':
      return `${nameOf(room, event.playerId)} reserved ${event.card ? `a ${SPICE_INFO[event.card.bonus].label}` : 'a hidden'} ${TIER_INFO[event.tier].label.slice(0, -1).toLowerCase()}${event.sealTaken ? ' and took a Seal' : ''}`;
    case 'guildClaimed':
      return `${event.guild.name} joined ${nameOf(room, event.playerId)} (+${event.guild.points})`;
    case 'passed':
      return `${nameOf(room, event.playerId)} had no move and passed`;
    case 'finalRound':
      return `${nameOf(room, event.triggeredBy)} reached the target. Final round!`;
    case 'gameEnded':
      return `The market closes. ${event.winners.map((w) => nameOf(room, w)).join(' and ')} ${event.winners.length > 1 ? 'share the win' : 'wins'}!`;
    case 'marketRefilled':
    case 'turnStarted':
      return null;
  }
};
