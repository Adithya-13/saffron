import { SPICES } from '@saffron/engine';
import type { BuySource, CardSource, Move, Spice } from '@saffron/engine';

const sortSpices = (spices: readonly Spice[]): Spice[] =>
  [...spices].sort((a, b) => SPICES.indexOf(a) - SPICES.indexOf(b));

export const moveKey = (move: Move): string =>
  move.type === 'takeDistinct'
    ? JSON.stringify({ ...move, spices: sortSpices(move.spices) })
    : JSON.stringify(move);

export const isLegal = (legal: readonly Move[], move: Move): boolean => {
  const key = moveKey(move);
  return legal.some((m) => moveKey(m) === key);
};

export const draftToMove = (draft: readonly Spice[]): Move | null => {
  if (draft.length === 0) return null;
  const [first, second] = draft;
  if (draft.length === 2 && first === second && first) return { type: 'takeDouble', spice: first };
  return { type: 'takeDistinct', spices: sortSpices(draft) };
};

export const canAddToDraft = (
  legal: readonly Move[],
  draft: readonly Spice[],
  spice: Spice,
): boolean => {
  const next = [...draft, spice];
  return legal.some((m) => {
    if (m.type === 'takeDouble') return next.length <= 2 && next.every((s) => s === m.spice);
    if (m.type === 'takeDistinct') {
      const unique = new Set(next);
      return unique.size === next.length && next.every((s) => m.spices.includes(s));
    }
    return false;
  });
};

export const buyMove = (source: BuySource): Move => ({ type: 'buy', source });
export const reserveMove = (source: CardSource): Move => ({ type: 'reserve', source });
