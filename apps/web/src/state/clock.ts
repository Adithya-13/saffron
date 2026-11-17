import { useEffect, useState } from 'react';
import type { GameTime } from '@saffron/protocol';
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

const ELAPSED_TICK_MS = 1_000;

export const elapsedMs = (time: GameTime, pausedAt: number | null, serverNow: number): number =>
  Math.max((time.endedAt ?? pausedAt ?? serverNow) - time.startedAt - time.pausedMs, 0);

export const formatElapsed = (ms: number): string => {
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`;
};

export const describeElapsed = (ms: number): string => {
  const minutes = Math.max(Math.round(ms / 60_000), 1);
  if (minutes < 60) return minutes === 1 ? '1 minute' : `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const head = hours === 1 ? '1 hour' : `${hours} hours`;
  return rest === 0 ? head : `${head} ${rest} min`;
};

export const useGameElapsed = (): number | null => {
  const time = useStore((s) => s.room?.gameTime ?? null);
  const pausedAt = useStore((s) => s.room?.pausedAt ?? null);
  const serverOffset = useStore((s) => s.serverOffset);
  const [now, setNow] = useState(() => Date.now());
  const running = time !== null && time.endedAt === null && pausedAt === null;

  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), ELAPSED_TICK_MS);
    return () => clearInterval(timer);
  }, [running]);

  return time && elapsedMs(time, pausedAt, now + serverOffset);
};
