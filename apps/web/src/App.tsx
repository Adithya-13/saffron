import { useEffect, useSyncExternalStore } from 'react';
import { play, unlockAudio } from './audio/sound.ts';
import { Home } from './screens/Home.tsx';
import { RoomScreen } from './screens/RoomScreen.tsx';

const ROOM_PATH = /^\/r\/([A-Za-z0-9]+)\/?$/;

const subscribe = (callback: () => void): (() => void) => {
  window.addEventListener('popstate', callback);
  return () => window.removeEventListener('popstate', callback);
};

export const navigate = (path: string): void => {
  history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

export const App = () => {
  const path = useSyncExternalStore(subscribe, () => location.pathname);
  const code = ROOM_PATH.exec(path)?.[1]?.toUpperCase();

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    const tap = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('.btn') : null;
      if (target && !target.matches(':disabled')) play('tap', { volume: 0.4 });
    };
    window.addEventListener('click', tap, { capture: true });
    return () => {
      window.removeEventListener('click', tap, { capture: true });
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  return code ? <RoomScreen code={code} /> : <Home />;
};
