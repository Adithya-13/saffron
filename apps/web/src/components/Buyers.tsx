import type { Card } from '@saffron/engine';
import { buyersOf, listNames, nameOf, seatIndex } from '../state/selectors.ts';
import { useStore } from '../state/store.ts';
import { Avatar } from './Avatar.tsx';

const MAX_AVATARS = 3;

export const Buyers = ({ card }: { readonly card: Card }) => {
  const view = useStore((s) => s.view);
  const room = useStore((s) => s.room);
  const seatId = useStore((s) => s.seatId);
  if (!view) return null;
  const buyers = buyersOf(view, card, seatId);
  if (buyers.length === 0) return null;
  const names = buyers.map((p) => nameOf(room, p.id));
  const hidden = buyers.length - MAX_AVATARS;
  return (
    <span className="buyers" role="img" aria-label={`${listNames(names)} can buy this`}>
      {buyers.slice(0, MAX_AVATARS).map((p) => (
        <Avatar key={p.id} index={seatIndex(room, p.id)} name={nameOf(room, p.id)} size={16} />
      ))}
      {hidden > 0 && <span className="buyers__more">+{hidden}</span>}
    </span>
  );
};
