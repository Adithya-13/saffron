import { useEffect, useState } from 'react';
import { useStore } from './store.ts';

const TICK_MS = 250;

export const remainingMs = (deadline: number, serverOffset: number, now: number): number =>
  Math.max(deadline - (now + serverOffset), 0);

export const useTurnRemaining = (): number | null => {
  const deadline = useStore((s) => s.room?.turnDeadline ?? null);
  const pausedAt = useStore((s) => s.room?.pausedAt ?? null);
  const serverOffset = useStore((s) => s.serverOffset);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (deadline === null || pausedAt !== null) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [deadline, pausedAt]);

  if (deadline === null) return null;
  if (pausedAt !== null) return Math.max(deadline - pausedAt, 0);
  return remainingMs(deadline, serverOffset, now);
};
