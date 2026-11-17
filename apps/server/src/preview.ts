import { GAME_NAME } from '@saffron/content';
import { MAX_PLAYERS } from '@saffron/engine';
import type { RoomStatus } from '@saffron/protocol';

export type RoomInfo = {
  readonly host: string | null;
  readonly seats: number;
  readonly status: RoomStatus;
};

export type Preview = { readonly title: string; readonly description: string };

export const HOME_PREVIEW: Preview = {
  title: `${GAME_NAME}, a card game of the spice market`,
  description:
    'Trade spices, buy stalls, caravans and fleets, and win over the guilds. Play with friends in your browser, 2 to 8 players.',
};

const seatsLeft = (seats: number): string => {
  const open = MAX_PLAYERS - seats;
  if (open <= 0) return 'The table is full, but you can watch.';
  return open === 1 ? '1 seat left.' : `${open} seats left.`;
};

export const roomPreview = (code: string, info: RoomInfo | null): Preview => {
  if (!info) {
    return {
      title: `${GAME_NAME} · Room ${code}`,
      description: `Room code ${code}. Open the link to find the table.`,
    };
  }
  const table = info.host ? `${info.host}'s table` : 'a table';
  if (info.status === 'playing') {
    return {
      title: `Watch ${table} · Room ${code}`,
      description: `A game of ${GAME_NAME} is under way with ${info.seats} merchants. Room code ${code}.`,
    };
  }
  return {
    title: `Join ${table} · Room ${code}`,
    description: `Room code ${code}. ${seatsLeft(info.seats)} Play ${GAME_NAME} together in your browser.`,
  };
};
