import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { SpiceIcon } from '../art/SpiceIcon.tsx';
import { Card, CardBack } from '../components/Card.tsx';
import { GuildChip } from '../components/Guilds.tsx';
import { hideBanner, removeFlight, useAnim } from './animStore.ts';
import type { Flight } from './animStore.ts';

const ghostWidth = (flight: Flight): number => {
  switch (flight.ghost.kind) {
    case 'token':
      return Math.max(Math.min(flight.from.w, flight.from.h, 40), 22);
    case 'guild':
      return Math.max(flight.from.w, 64);
    case 'card':
    case 'back':
      return Math.max(flight.from.w, 60);
  }
};

const GhostBody = ({ flight, width }: { flight: Flight; width: number }) => {
  const { ghost } = flight;
  switch (ghost.kind) {
    case 'token':
      return <SpiceIcon token={ghost.token} size={width} />;
    case 'card':
      return (
        <div className="ghost-card" style={{ width, ['--card-w' as string]: `${width}px` }}>
          <Card card={ghost.card} />
        </div>
      );
    case 'back':
      return (
        <div className="ghost-card" style={{ width, ['--card-w' as string]: `${width}px` }}>
          <CardBack tier={ghost.tier} />
        </div>
      );
    case 'guild':
      return (
        <div className="ghost-guild" style={{ width }}>
          <GuildChip guild={ghost.guild} />
        </div>
      );
  }
};

const FlightView = ({ flight }: { flight: Flight }) => {
  const width = ghostWidth(flight);
  const start = {
    x: flight.from.x + flight.from.w / 2 - width / 2,
    y: flight.from.y + flight.from.h / 2 - width / 2,
  };
  const end = {
    x: flight.to.x + flight.to.w / 2 - width / 2,
    y: flight.to.y + flight.to.h / 2 - width / 2,
  };
  const endScale = Math.max(Math.min(flight.to.w / width, 1), 0.35);
  return (
    <motion.div
      className="ghost"
      initial={{ x: start.x, y: start.y, scale: 1, opacity: 0 }}
      animate={{
        x: [start.x, end.x],
        y: [start.y, end.y],
        scale: [1, endScale],
        opacity: [1, 1, 0.85],
      }}
      transition={{
        duration: flight.duration / 1000,
        delay: flight.delay / 1000,
        ease: [0.4, 0, 0.2, 1],
      }}
      onAnimationComplete={() => removeFlight(flight.id)}
    >
      <GhostBody flight={flight} width={width} />
    </motion.div>
  );
};

const NOTE_MS = 1400;

export const FlyLayer = () => {
  const flights = useAnim((s) => s.flights);
  const banner = useAnim((s) => s.banner);

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => hideBanner(banner.id), NOTE_MS);
    return () => clearTimeout(timer);
  }, [banner]);

  return (
    <div className="fly-layer" aria-hidden>
      {flights.map((f) => (
        <FlightView key={f.id} flight={f} />
      ))}
      <AnimatePresence>
        {banner && (
          <motion.div
            key={banner.id}
            className={`turn-note${banner.tone === 'final' ? ' turn-note--final' : ''}`}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {banner.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
