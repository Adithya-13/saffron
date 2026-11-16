import { useEffect, useRef, useState } from 'react';
import { play } from '../audio/sound.ts';
import { useStore } from '../state/store.ts';
import type { SyncMessage } from '../state/store.ts';
import { addFlights, nextAnimId, prefersReducedMotion, showBanner } from './animStore.ts';
import type { Flight, Point } from './animStore.ts';
import { planEvents } from './plan.ts';
import type { FlightSpec } from './plan.ts';

const SETTLE_MS = 120;

const pointOf = (anchors: readonly string[]): Point | null => {
  for (const anchor of anchors) {
    const el = document.querySelector(`[data-anchor="${anchor}"]`);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }
  return null;
};

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const perform = async (message: SyncMessage): Promise<void> => {
  const store = useStore.getState();
  const firstSync = store.view === null;
  const viewerId = store.seatId;
  const plan = planEvents(message.events, viewerId);
  const reduced = prefersReducedMotion();

  const sources = plan.flights.map((f) => pointOf(f.from));
  store.commitSync(message);
  if (firstSync) return;

  for (const cue of plan.sounds)
    play(cue.name, {
      delay: cue.delay,
      ...(cue.volume === undefined ? {} : { volume: cue.volume }),
    });
  if (plan.banner) showBanner(plan.banner);
  if (reduced || plan.flights.length === 0) {
    await wait(reduced ? 0 : SETTLE_MS);
    return;
  }

  await nextFrame();
  const flights: Flight[] = plan.flights.flatMap((spec: FlightSpec, i) => {
    const from = sources[i];
    const to = pointOf(spec.to);
    if (!from || !to) return [];
    return [
      {
        id: nextAnimId(),
        ghost: spec.ghost,
        from,
        to,
        delay: spec.delay,
        duration: spec.duration,
      },
    ];
  });
  addFlights(flights);
  await wait(plan.duration + SETTLE_MS);
};

export const Choreographer = () => {
  const busy = useRef(false);
  const [tick, setTick] = useState(0);
  const queueLength = useStore((s) => s.queue.length);

  useEffect(() => {
    if (busy.current || queueLength === 0) return;
    const message = useStore.getState().shiftQueue();
    if (!message) return;
    busy.current = true;
    void perform(message).finally(() => {
      busy.current = false;
      setTick((t) => t + 1);
    });
  }, [queueLength, tick]);

  return null;
};
