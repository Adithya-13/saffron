import { useEffect, useSyncExternalStore } from 'react';
import { unlockAudio } from './audio/sound.ts';
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
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  return code ? <RoomScreen code={code} /> : <Home />;
};
