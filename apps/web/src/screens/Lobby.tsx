import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { GAME_NAME } from '@saffron/content';
import { MAX_PLAYERS, MIN_PLAYERS } from '@saffron/engine';
import { send } from '../net/socket.ts';
import { useStore } from '../state/store.ts';
import { ChatPanel } from '../components/ChatPanel.tsx';
import { RulesSheet } from '../components/RulesSheet.tsx';
import { Avatar } from '../components/Avatar.tsx';

const shareUrl = (code: string): string => `${location.origin}/r/${code}`;

export const Lobby = () => {
  const room = useStore((s) => s.room);
  const seatId = useStore((s) => s.seatId);
  const showToast = useStore((s) => s.showToast);
  const [rulesOpen, setRulesOpen] = useState(false);
  if (!room) return null;

  const isHost = seatId !== null && seatId === room.hostSeatId;
  const canStart = isHost && room.seats.length >= MIN_PLAYERS;
  const openSeats = MAX_PLAYERS - room.seats.length;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl(room.code));
      showToast('Invite link copied');
    } catch {
      showToast(shareUrl(room.code));
    }
  };

  return (
    <main className="lobby">
      <div className="lobby__backdrop" />
      <section className="lobby__main panel">
        <p className="eyebrow">{GAME_NAME}</p>
        <h1 className="lobby__title">The stall is open</h1>
        <div className="lobby__code">
          <span className="lobby__code-label">Room code</span>
          <span className="lobby__code-value">{room.code}</span>
          <button className="btn btn--ghost btn--small" type="button" onClick={copyLink}>
            Copy invite link
          </button>
        </div>

        <ul className="seats">
          <AnimatePresence initial={false}>
            {room.seats.map((seat, index) => (
              <motion.li
                key={seat.id}
                className="seat"
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <Avatar index={index} name={seat.name} />
                <span className="seat__name">
                  {seat.name}
                  {seat.id === seatId && <span className="seat__you"> (you)</span>}
                </span>
                {seat.id === room.hostSeatId && <span className="tag">Host</span>}
                {seat.kind === 'bot' && <span className="tag tag--muted">Bot</span>}
                {!seat.connected && <span className="tag tag--muted">Away</span>}
                {isHost && seat.id !== room.hostSeatId && (
                  <button
                    className="icon-btn"
                    type="button"
                    aria-label={`Remove ${seat.name}`}
                    onClick={() => send({ type: 'removeSeat', seatId: seat.id })}
                  >
                    ×
                  </button>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
          {Array.from({ length: openSeats }, (_, i) => (
            <li key={`open-${i}`} className="seat seat--open">
              <span className="seat__placeholder" />
              <span className="seat__name">Waiting for a merchant...</span>
            </li>
          ))}
        </ul>

        <div className="lobby__actions">
          {isHost ? (
            <>
              <button
                className="btn btn--ghost"
                type="button"
                disabled={openSeats === 0}
                onClick={() => send({ type: 'addBot' })}
              >
                Add a bot
              </button>
              <button
                className="btn btn--primary"
                type="button"
                disabled={!canStart}
                onClick={() => send({ type: 'start' })}
              >
                Open the market
              </button>
            </>
          ) : (
            <p className="muted">Waiting for the host to open the market...</p>
          )}
        </div>
        {isHost && room.seats.length < MIN_PLAYERS && (
          <p className="muted small">Share the link, or add a bot to play right away.</p>
        )}
        <button className="link-btn" type="button" onClick={() => setRulesOpen(true)}>
          How to play
        </button>
      </section>
      <aside className="lobby__chat panel">
        <ChatPanel />
      </aside>
      {rulesOpen && <RulesSheet onClose={() => setRulesOpen(false)} />}
    </main>
  );
};
