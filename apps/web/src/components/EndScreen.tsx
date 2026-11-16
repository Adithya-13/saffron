import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { SPICES } from '@saffron/engine';
import { PALETTES } from '../art/SpiceIcon.tsx';
import { play } from '../audio/sound.ts';
import { navigate } from '../App.tsx';
import { send } from '../net/socket.ts';
import { nameOf, seatIndex } from '../state/selectors.ts';
import { useStore } from '../state/store.ts';
import { Avatar } from './Avatar.tsx';

const CONFETTI = 70;

const Confetti = () => {
  const pieces = useMemo(
    () =>
      Array.from({ length: CONFETTI }, (_, i) => ({
        i,
        left: (i * 37) % 100,
        delay: (i % 14) * 0.12,
        duration: 2.6 + ((i * 13) % 10) / 6,
        rotate: (i * 47) % 360,
        color: PALETTES[SPICES[i % SPICES.length] ?? 'saffron'].light,
      })),
    [],
  );
  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p) => (
        <motion.span
          key={p.i}
          className="confetti__piece"
          style={{ left: `${p.left}%`, background: p.color }}
          initial={{ y: -40, rotate: p.rotate, opacity: 0 }}
          animate={{ y: '110vh', rotate: p.rotate + 540, opacity: [0, 1, 1, 0.8] }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: 'easeIn',
            repeat: 1,
            repeatDelay: 0.4,
          }}
        />
      ))}
    </div>
  );
};

const CountUp = ({ to, delay }: { to: number; delay: number }) => {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let current = 0;
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      timer = setInterval(() => {
        current += 1;
        setValue(Math.min(current, to));
        if (current >= to && timer) clearInterval(timer);
      }, 60);
    }, delay);
    return () => {
      clearTimeout(start);
      if (timer) clearInterval(timer);
    };
  }, [to, delay]);
  return <>{value}</>;
};

export const EndScreen = () => {
  const view = useStore((s) => s.view);
  const room = useStore((s) => s.room);
  const seatId = useStore((s) => s.seatId);

  useEffect(() => {
    play('victory', { delay: 300 });
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
      <Confetti />
      <motion.div
        className="end__panel panel"
        initial={{ scale: 0.8, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 160, damping: 18, delay: 0.2 }}
      >
        <p className="eyebrow">The market closes</p>
        <h2 className="end__title">
          {iWon
            ? 'You are the merchant prince!'
            : `${winners.map((w) => nameOf(room, w.id)).join(' & ')} ${winners.length > 1 ? 'share the crown' : 'wins the bazaar'}`}
        </h2>
        <ol className="end__ranks">
          {ranked.map((p, i) => (
            <motion.li
              key={p.id}
              className={`end__rank${winners.includes(p) ? ' end__rank--winner' : ''}`}
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + i * 0.25 }}
            >
              <span className="end__place">{i + 1}</span>
              <Avatar index={seatIndex(room, p.id)} name={nameOf(room, p.id)} />
              <span className="end__name">{nameOf(room, p.id)}</span>
              <span className="end__detail muted small">
                {p.cards.length} cards · {p.guilds.length} guilds
              </span>
              <span className="end__points">
                <CountUp to={p.points} delay={800 + i * 250} />
              </span>
            </motion.li>
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
          <button className="btn btn--ghost" type="button" onClick={() => navigate('/')}>
            Leave
          </button>
        </div>
      </motion.div>
    </div>
  );
};
