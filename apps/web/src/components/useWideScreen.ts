import { useSyncExternalStore } from 'react';

const WIDE_QUERY = '(min-width: 900px)';

const media = (): MediaQueryList | null =>
  typeof matchMedia === 'undefined' ? null : matchMedia(WIDE_QUERY);

const subscribe = (onChange: () => void): (() => void) => {
  const list = media();
  list?.addEventListener('change', onChange);
  return () => list?.removeEventListener('change', onChange);
};

const snapshot = (): boolean => media()?.matches ?? false;

export const useWideScreen = (): boolean => useSyncExternalStore(subscribe, snapshot, () => false);
