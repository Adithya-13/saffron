import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useCue } from '../audio/useCue.ts';
import { send } from '../net/socket.ts';
import { nameOf } from '../state/selectors.ts';
import { useStore } from '../state/store.ts';

const useSecondsLeft = (expiresAt: number | null): number => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (expiresAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [expiresAt]);
  return expiresAt === null ? 0 : Math.max(Math.ceil((expiresAt - now) / 1000), 0);
};

export const UndoBar = () => {
  const room = useStore((s) => s.room);
  const seatId = useStore((s) => s.seatId);
  const vote = room?.undoVote ?? null;
  const undoAvailableTo = room?.undoAvailableTo ?? null;
  useCue(vote?.requesterId ?? null, (before, after) => {
    if (after !== null) return { name: 'ask', volume: 0.35 };
    return before === undoAvailableTo
      ? { name: 'no', volume: 0.35 }
      : { name: 'yes', volume: 0.35 };
  });
  const seconds = useSecondsLeft(vote?.expiresAt ?? null);
  const mustVote = Boolean(
    vote && seatId && vote.voters.includes(seatId) && !vote.approvals.includes(seatId),
  );

  return (
    <AnimatePresence>
      {vote && (
        <motion.div
          key="vote"
          className="undo-bar"
          role="alertdialog"
          initial={{ y: -12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -12, opacity: 0 }}
        >
          <span>
            {nameOf(room, vote.requesterId)} wants to take back their last turn ({seconds}s)
          </span>
          {mustVote ? (
            <span className="undo-bar__actions">
              <button
                className="btn btn--small btn--ghost"
                type="button"
                onClick={() => send({ type: 'undoVote', approve: false })}
              >
                No
              </button>
              <button
                className="btn btn--small btn--primary"
                type="button"
                onClick={() => send({ type: 'undoVote', approve: true })}
              >
                Allow
              </button>
            </span>
          ) : (
            <span className="muted small">Waiting for votes...</span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
