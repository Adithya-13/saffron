import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { START_INTRO_MS } from '@saffron/protocol';
import { play } from '../audio/sound.ts';
import { useStore } from '../state/store.ts';
import { Avatar } from './Avatar.tsx';

const SPIN_MS = 1_900;
const MIN_STEPS = 12;
const FADE_MS = 250;

export const spinDelays = (seats: number, target: number): readonly number[] => {
  const laps = Math.max(1, Math.ceil((MIN_STEPS - target) / seats));
  const steps = laps * seats + target;
  const weights = Array.from(
    { length: steps },
    (_, i) => 1 + 4 * (i / Math.max(steps - 1, 1)) ** 2,
  );
  const total = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => (w / total) * SPIN_MS);
};

export const FirstTurn = ({ onDone }: { readonly onDone: () => void }) => {
  const room = useStore((s) => s.room);
  const openerId = useStore((s) => s.view?.players[0]?.id ?? null);
  const seatId = useStore((s) => s.seatId);
  const reduced = useReducedMotion() ?? false;
  const seats = room?.seats ?? [];
  const target = Math.max(
    seats.findIndex((s) => s.id === openerId),
    0,
  );
  const [lit, setLit] = useState(reduced ? target : 0);
  const [landed, setLanded] = useState(reduced);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (reduced) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let at = 0;
    spinDelays(seats.length, target).forEach((delay, i, all) => {
      at += delay;
      const last = i === all.length - 1;
      timers.push(
        setTimeout(() => {
          setLit((i + 1) % seats.length);
          if (last) {
            setLanded(true);
            play('bell', { volume: 0.4 });
          } else {
            play('clink1', { volume: 0.15 });
          }
        }, at),
      );
    });
    return () => timers.forEach(clearTimeout);
  }, [reduced, seats.length, target]);

  useEffect(() => {
    const timer = setTimeout(() => setOpen(false), START_INTRO_MS - FADE_MS);
    return () => clearTimeout(timer);
  }, []);

  const opener = seats[target];
  const title = !landed
    ? 'Who opens the market?'
    : opener?.id === seatId
      ? 'You go first'
      : `${opener?.name ?? 'A merchant'} goes first`;

  return (
    <AnimatePresence onExitComplete={onDone}>
      {open && (
        <motion.div
          className="first-turn"
          role="status"
          aria-live="polite"
          onClick={() => setOpen(false)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: FADE_MS / 1000 }}
        >
          <div className="first-turn__panel">
            <p className="eyebrow">Turn order</p>
            <h2 className="first-turn__title">{title}</h2>
            <ul className="first-turn__seats">
              {seats.map((s, i) => (
                <li
                  key={s.id}
                  className={`first-turn__seat${i === lit ? ' first-turn__seat--lit' : ''}${landed && i === target ? ' first-turn__seat--chosen' : ''}`}
                >
                  <Avatar index={i} name={s.name} size={40} />
                  <span className="first-turn__name">{s.id === seatId ? 'You' : s.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
