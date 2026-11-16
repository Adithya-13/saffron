import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { GAME_NAME } from '@saffron/content';
import { MAX_PLAYERS, MIN_PLAYERS } from '@saffron/engine';
import { THEMES } from '@saffron/protocol';
import type { Theme } from '@saffron/protocol';
import { send } from '../net/socket.ts';
import { useStore } from '../state/store.ts';
import { ChatPanel } from '../components/ChatPanel.tsx';
import { RulesSheet } from '../components/RulesSheet.tsx';
import { Avatar } from '../components/Avatar.tsx';
import { CloseIcon } from '../art/Icons.tsx';
import { shareUrl } from '../components/MenuSheet.tsx';
import { THEME_INFO } from '../theme/useRoomTheme.ts';

const SWATCHES: Readonly<Record<Theme, readonly string[]>> = {
  paper: ['#f4eee3', '#1e1b16', '#d6941c'],
  night: ['#15132b', '#f2e9d6', '#d8b25a'],
  harbour: ['#e8edef', '#1b2830', '#2c6d66'],
};

const ThemePicker = ({ theme, isHost }: { readonly theme: Theme; readonly isHost: boolean }) => (
  <fieldset className="theme-pick">
    <legend>{isHost ? 'Table look' : 'Table look, picked by the host'}</legend>
    {THEMES.map((t) => (
      <label key={t} className="theme-pick__option">
        <input
          type="radio"
          name="theme"
          value={t}
          checked={theme === t}
          disabled={!isHost}
          onChange={() => send({ type: 'setTheme', theme: t })}
        />
        <span className="theme-pick__swatch" aria-hidden>
          {SWATCHES[t].map((c) => (
            <span key={c} style={{ background: c }} />
          ))}
        </span>
        {THEME_INFO[t].label}
      </label>
    ))}
  </fieldset>
);

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

        <ThemePicker theme={room.theme} isHost={isHost} />

        <ul className={`seats${room.seats.length > 4 ? ' seats--many' : ''}`}>
          <AnimatePresence initial={false}>
            {room.seats.map((seat, index) => (
              <motion.li
                key={seat.id}
                className="seat"
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
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
                    <CloseIcon />
                  </button>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
          {openSeats > 0 && (
            <li className="seat seat--open">
              <span className="seat__placeholder" />
              <span className="seat__name">
                {openSeats === 1 ? '1 seat left' : `Waiting for merchants, ${openSeats} seats left`}
              </span>
            </li>
          )}
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
