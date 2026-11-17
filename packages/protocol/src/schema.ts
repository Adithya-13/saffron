import { z } from 'zod';
import { SPICES, TOKENS } from '@saffron/engine';
import type { Move } from '@saffron/engine';
import { MAX_CHAT_LENGTH, MAX_NAME_LENGTH, THEMES } from './index.ts';
import type { ClientMessage } from './index.ts';

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

export const clientMessageSchema: z.ZodType<ClientMessage> = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('join'),
    name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
    token: z.string().max(128).optional(),
  }),
  z.object({ type: z.literal('start') }),
  z.object({ type: z.literal('addBot') }),
  z.object({ type: z.literal('removeSeat'), seatId: z.string().max(64) }),
  z.object({ type: z.literal('setTheme'), theme: z.enum(THEMES) }),
  z.object({ type: z.literal('move'), move: moveSchema }),
  z.object({ type: z.literal('chat'), text: z.string().trim().min(1).max(MAX_CHAT_LENGTH) }),
  z.object({ type: z.literal('undoRequest') }),
  z.object({ type: z.literal('undoVote'), approve: z.boolean() }),
  z.object({ type: z.literal('rematch') }),
  z.object({ type: z.literal('stillHere') }),
  z.object({ type: z.literal('resume') }),
  z.object({ type: z.literal('leave') }),
  z.object({ type: z.literal('closeRoom') }),
]);

export const parseClientMessage = (raw: string): ClientMessage | null => {
  try {
    const parsed = clientMessageSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};
