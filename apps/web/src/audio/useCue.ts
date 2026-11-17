import { useEffect, useRef } from 'react';
import { play } from './sound.ts';
import type { SfxName } from './sound.ts';

export type Cue = { readonly name: SfxName; readonly volume: number };

export const useCue = <T>(value: T, cueFor: (before: T, after: T) => Cue | null): void => {
  const previous = useRef(value);
  const pick = useRef(cueFor);
  pick.current = cueFor;
  useEffect(() => {
    const before = previous.current;
    previous.current = value;
    if (Object.is(before, value)) return;
    const cue = pick.current(before, value);
    if (cue) play(cue.name, { volume: cue.volume });
  }, [value]);
};
