import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { SpiceIcon } from '../art/SpiceIcon.tsx';
import { Card, CardBack } from '../components/Card.tsx';
import { GuildTile } from '../components/GuildTile.tsx';
import { hideBanner, removeFlight, useAnim } from './animStore.ts';
import type { Flight } from './animStore.ts';
import { SPICES } from '@saffron/engine';
import { PALETTES } from '../art/SpiceIcon.tsx';

const ghostWidth = (flight: Flight): number => {
  switch (flight.ghost.kind) {
    case 'token':
      return Math.max(Math.min(flight.from.w, flight.from.h, 56), 26);
    case 'guild':
      return Math.max(flight.from.w, 80);
    case 'card':
    case 'back':
      return Math.max(flight.from.w, 70);
  }
};

const GhostBody = ({ flight, width }: { flight: Flight; width: number }) => {
  const { ghost } = flight;
  switch (ghost.kind) {
    case 'token':
      return <SpiceIcon token={ghost.token} size={width} />;
    case 'card':
      return (
        <div className="ghost-card" style={{ width }}>
          <Card card={ghost.card} />
        </div>
      );
    case 'back':
      return (
        <div className="ghost-card" style={{ width }}>
          <CardBack tier={ghost.tier} />
        </div>
      );
    case 'guild':
      return (
        <div className="ghost-guild" style={{ width }}>
          <GuildTile guild={ghost.guild} />
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
  const endScale = Math.max(Math.min(flight.to.w / width, 1), 0.35);
  const end = {
    x: flight.to.x + flight.to.w / 2 - width / 2,
    y: flight.to.y + flight.to.h / 2 - width / 2,
  };
  const seconds = flight.duration / 1000;

  if (flight.showcase) {
    const center = { x: window.innerWidth / 2 - width / 2, y: window.innerHeight / 2 - width / 2 };
    return (
      <motion.div
        className="ghost ghost--showcase"
        initial={{ x: start.x, y: start.y, scale: 1, opacity: 1 }}
        animate={{
          x: [start.x, center.x, center.x, end.x],
          y: [start.y, center.y, center.y, end.y],
          scale: [1, 2, 2, endScale],
          rotate: [0, -4, 4, 0],
        }}
        transition={{
          duration: seconds,
          delay: flight.delay / 1000,
          times: [0, 0.3, 0.7, 1],
          ease: 'easeInOut',
        }}
        onAnimationComplete={() => removeFlight(flight.id)}
      >
        <GhostBody flight={flight} width={width} />
      </motion.div>
    );
  }

  const lift = flight.ghost.kind === 'token' ? 70 : 40;
  const mid = { x: (start.x + end.x) / 2, y: Math.min(start.y, end.y) - lift };
  return (
    <motion.div
      className="ghost"
      initial={{ x: start.x, y: start.y, scale: 1, opacity: 0 }}
      animate={{
        x: [start.x, mid.x, end.x],
        y: [start.y, mid.y, end.y],
        scale: [1, flight.ghost.kind === 'token' ? 1.15 : 1.08, endScale],
        opacity: [1, 1, 0.9],
        rotate: flight.ghost.kind === 'token' ? 0 : [0, -6, 0],
      }}
      transition={{ duration: seconds, delay: flight.delay / 1000, ease: [0.3, 0.1, 0.25, 1] }}
      onAnimationComplete={() => removeFlight(flight.id)}
    >
      <GhostBody flight={flight} width={width} />
    </motion.div>
  );
};

const BURST_PARTICLES = 28;

const Burst = ({ id }: { id: number }) => {
  const particles = Array.from({ length: BURST_PARTICLES }, (_, i) => {
    const angle = (i / BURST_PARTICLES) * Math.PI * 2;
    const distance = 140 + ((i * 37) % 90);
    const spice = SPICES[i % SPICES.length] ?? 'saffron';
    return {
      i,
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      color: PALETTES[spice].light,
    };
  });
  return (
    <div className="burst" key={id} aria-hidden>
      {particles.map((p) => (
        <motion.span
          key={p.i}
          className="burst__spark"
          style={{ background: p.color }}
          initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
          animate={{ x: p.dx, y: p.dy, scale: 0.2, opacity: 0 }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
};

const BANNER_MS = 1600;

export const FlyLayer = () => {
  const flights = useAnim((s) => s.flights);
  const banner = useAnim((s) => s.banner);
  const burstId = useAnim((s) => s.burstId);
  const [visibleBurst, setVisibleBurst] = useState(0);

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => hideBanner(banner.id), BANNER_MS);
    return () => clearTimeout(timer);
  }, [banner]);

  useEffect(() => {
    if (burstId === 0) return;
    setVisibleBurst(burstId);
    const timer = setTimeout(() => setVisibleBurst(0), 1300);
    return () => clearTimeout(timer);
  }, [burstId]);

  return (
    <div className="fly-layer" aria-hidden>
      {flights.map((f) => (
        <FlightView key={f.id} flight={f} />
      ))}
      {visibleBurst > 0 && <Burst id={visibleBurst} />}
      <AnimatePresence>
        {banner && (
          <motion.div
            key={banner.id}
            className={`turn-banner turn-banner--${banner.tone}`}
            initial={{ opacity: 0, scaleX: 0.6, y: -10 }}
            animate={{ opacity: 1, scaleX: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          >
            <span className="turn-banner__text">{banner.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
