import { motion } from 'motion/react';
import { send } from '../net/socket.ts';
import { nameOf } from '../state/selectors.ts';
import { useStore } from '../state/store.ts';

type Props = { readonly onChat?: (() => void) | undefined; readonly onMenu: () => void };

export const PauseScreen = ({ onChat, onMenu }: Props) => {
  const room = useStore((s) => s.room);
  const seatId = useStore((s) => s.seatId);
  if (!room) return null;
  const isHost = seatId !== null && seatId === room.hostSeatId;
  const host = room.hostSeatId ? nameOf(room, room.hostSeatId) : 'The host';

  return (
    <motion.div
      className="pause"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div className="pause__panel" role="dialog" aria-label="Game paused">
        <p className="eyebrow">Paused</p>
        <h2 className="pause__title">The market is resting</h2>
        <p className="pause__text">
          {isHost ? 'You paused the game.' : `${host} paused the game.`} The turn clock is stopped,
          and chat stays open.
        </p>
        <div className="pause__actions">
          {onChat && (
            <button className="btn btn--ghost" type="button" onClick={onChat}>
              Chat
            </button>
          )}
          <button className="btn btn--ghost" type="button" onClick={onMenu}>
            Menu
          </button>
          {isHost && (
            <button
              className="btn btn--primary pause__resume"
              type="button"
              onClick={() => send({ type: 'setPaused', paused: false })}
            >
              Resume game
            </button>
          )}
        </div>
        {!isHost && <p className="pause__wait muted small">Waiting for {host} to resume...</p>}
      </div>
    </motion.div>
  );
};
