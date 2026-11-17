import type { Move, PlayerView, RuleError, VisibleEvent } from '@saffron/engine';

export const MAX_NAME_LENGTH = 20;
export const MAX_CHAT_LENGTH = 280;
export const ROOM_CODE_LENGTH = 5;

export const THEMES = ['paper', 'night', 'harbour'] as const;
export type Theme = (typeof THEMES)[number];
export const DEFAULT_THEME: Theme = 'paper';

export const TURN_WARN_MS = 5_000;

export type ClientMessage =
  | { readonly type: 'join'; readonly name: string; readonly token?: string | undefined }
  | { readonly type: 'start' }
  | { readonly type: 'addBot' }
  | { readonly type: 'removeSeat'; readonly seatId: string }
  | { readonly type: 'setTheme'; readonly theme: Theme }
  | { readonly type: 'move'; readonly move: Move }
  | { readonly type: 'chat'; readonly text: string }
  | { readonly type: 'undoRequest' }
  | { readonly type: 'undoVote'; readonly approve: boolean }
  | { readonly type: 'rematch' }
  | { readonly type: 'stillHere' }
  | { readonly type: 'resume' }
  | { readonly type: 'leave' };

export type SeatKind = 'human' | 'bot';

export type SeatInfo = {
  readonly id: string;
  readonly name: string;
  readonly kind: SeatKind;
  readonly connected: boolean;
};

export type RoomStatus = 'lobby' | 'playing' | 'finished';

export type UndoVoteInfo = {
  readonly requesterId: string;
  readonly approvals: readonly string[];
  readonly voters: readonly string[];
  readonly expiresAt: number;
};

export type ChatMessage = {
  readonly id: string;
  readonly seatId: string | null;
  readonly name: string;
  readonly text: string;
  readonly at: number;
};

export type RoomSnapshot = {
  readonly code: string;
  readonly status: RoomStatus;
  readonly hostSeatId: string | null;
  readonly theme: Theme;
  readonly seats: readonly SeatInfo[];
  readonly undoAvailableTo: string | null;
  readonly undoVote: UndoVoteInfo | null;
  readonly turnDeadline: number | null;
  readonly turnExtended: boolean;
  readonly autopilot: readonly string[];
};

export type ErrorCode =
  | RuleError
  | 'badMessage'
  | 'notHost'
  | 'notSeated'
  | 'roomFull'
  | 'notInLobby'
  | 'notEnoughPlayers'
  | 'notPlaying'
  | 'rateLimited'
  | 'undoUnavailable'
  | 'notJoined'
  | 'undoPending';

export type ServerMessage =
  | { readonly type: 'welcome'; readonly seatId: string | null; readonly token: string | null }
  | {
      readonly type: 'sync';
      readonly serverNow: number;
      readonly room: RoomSnapshot;
      readonly view: PlayerView | null;
      readonly legal: readonly Move[];
      readonly events: readonly VisibleEvent[];
      readonly log: readonly VisibleEvent[];
    }
  | { readonly type: 'chat'; readonly messages: readonly ChatMessage[]; readonly replace: boolean }
  | { readonly type: 'error'; readonly code: ErrorCode }
  | { readonly type: 'kicked' };
