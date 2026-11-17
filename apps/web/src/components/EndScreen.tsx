import { motion } from 'motion/react';
import { useEffect } from 'react';
import { play } from '../audio/sound.ts';
import { navigate } from '../App.tsx';
import { send } from '../net/socket.ts';
import { nameOf, seatIndex } from '../state/selectors.ts';
import { useStore } from '../state/store.ts';
import { Avatar } from './Avatar.tsx';

type Props = { readonly onChat?: (() => void) | undefined };

export const EndScreen = ({ onChat }: Props) => {
  const view = useStore((s) => s.view);
  const room = useStore((s) => s.room);
  const seatId = useStore((s) => s.seatId);
  const unread = useStore((s) => s.unreadChat);

  useEffect(() => {
    play('victory', { delay: 300, volume: 0.45 });
  }, []);

  if (!view || !room) return null;
  const ranked = [...view.players].sort(
    (a, b) => b.points - a.points || a.cards.length - b.cards.length,
  );
  const top = ranked[0];
  const winners = ranked.filter(
    (p) => top && p.points === top.points && p.cards.length === top.cards.length,
  );
  const isHost = seatId === room.hostSeatId;
  const iWon = winners.some((w) => w.id === seatId);

  return (
    <div className="end">
      <motion.div
        className="end__panel"
        role="dialog"
        aria-label="Final scores"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="eyebrow">The market closes</p>
        <h2 className="end__title">
          {iWon
            ? 'You win the bazaar'
            : `${winners.map((w) => nameOf(room, w.id)).join(' & ')} ${winners.length > 1 ? 'share the win' : 'wins'}`}
        </h2>
        <p className="end__goal">Goal: {view.targetPoints} prestige</p>
        <ol className="end__ranks">
          {ranked.map((p, i) => (
            <li
              key={p.id}
              className={`end__rank${winners.includes(p) ? ' end__rank--winner' : ''}`}
            >
              <span className="end__place">{i + 1}</span>
              <Avatar index={seatIndex(room, p.id)} name={nameOf(room, p.id)} />
              <span className="end__name">{nameOf(room, p.id)}</span>
              <span className="end__detail">
                {p.cards.length} cards · {p.guilds.length} guilds
              </span>
              <span className="end__points">{p.points}</span>
            </li>
          ))}
        </ol>
        <div className="end__actions">
          {isHost ? (
            <button
              className="btn btn--primary"
              type="button"
              onClick={() => send({ type: 'rematch' })}
            >
              Play again
            </button>
          ) : (
            <p className="muted">Waiting for the host to start a rematch...</p>
          )}
          {onChat && (
            <button className="btn btn--ghost" type="button" onClick={onChat}>
              {unread > 0 ? `Chat (${unread})` : 'Chat'}
            </button>
          )}
          <button className="btn btn--ghost" type="button" onClick={() => navigate('/')}>
            Leave
          </button>
        </div>
      </motion.div>
    </div>
  );
};
