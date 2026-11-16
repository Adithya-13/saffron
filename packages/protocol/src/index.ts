import { z } from 'zod';
import { SPICES, TOKENS } from '@saffron/engine';
import type { Move, PlayerView, RuleError, VisibleEvent } from '@saffron/engine';

export const MAX_NAME_LENGTH = 20;
export const MAX_CHAT_LENGTH = 280;
export const ROOM_CODE_LENGTH = 5;

const spice = z.enum(SPICES);
const tier = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const slot = z.number().int().min(0).max(3);

const tokenCounts = z
  .object(Object.fromEntries(TOKENS.map((t) => [t, z.number().int().min(0).max(10)])))
  .partial();

export const moveSchema: z.ZodType<Move> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('takeDistinct'), spices: z.array(spice).min(1).max(3) }),
  z.object({ type: z.literal('takeDouble'), spice }),
  z.object({
    type: z.literal('reserve'),
    source: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('market'), tier, slot }),
      z.object({ kind: z.literal('deck'), tier }),
    ]),
  }),
  z.object({
    type: z.literal('buy'),
    source: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('market'), tier, slot }),
      z.object({ kind: z.literal('reserve'), index: z.number().int().min(0).max(2) }),
    ]),
  }),
  z.object({ type: z.literal('discard'), tokens: tokenCounts }),
  z.object({ type: z.literal('chooseGuild'), guildId: z.string().max(64) }),
  z.object({ type: z.literal('pass') }),
]) as z.ZodType<Move>;

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('join'),
    name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
    token: z.string().max(128).optional(),
  }),
  z.object({ type: z.literal('start') }),
  z.object({ type: z.literal('addBot') }),
  z.object({ type: z.literal('removeSeat'), seatId: z.string().max(64) }),
  z.object({ type: z.literal('move'), move: moveSchema }),
  z.object({ type: z.literal('chat'), text: z.string().trim().min(1).max(MAX_CHAT_LENGTH) }),
  z.object({ type: z.literal('undoRequest') }),
  z.object({ type: z.literal('undoVote'), approve: z.boolean() }),
  z.object({ type: z.literal('rematch') }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

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
  readonly seats: readonly SeatInfo[];
  readonly undoAvailableTo: string | null;
  readonly undoVote: UndoVoteInfo | null;
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
      readonly room: RoomSnapshot;
      readonly view: PlayerView | null;
      readonly legal: readonly Move[];
      readonly events: readonly VisibleEvent[];
      readonly log: readonly VisibleEvent[];
    }
  | { readonly type: 'chat'; readonly messages: readonly ChatMessage[]; readonly replace: boolean }
  | { readonly type: 'error'; readonly code: ErrorCode };

export const parseClientMessage = (raw: string): ClientMessage | null => {
  try {
    const parsed = clientMessageSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};
