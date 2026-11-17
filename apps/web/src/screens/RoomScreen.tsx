import { useEffect, useState } from 'react';
import { Choreographer } from '../anim/Choreographer.tsx';
import { FlyLayer } from '../anim/FlyLayer.tsx';
import { navigate } from '../App.tsx';
import { connect, disconnect } from '../net/socket.ts';
import { loadName, saveName } from '../net/storage.ts';
import { useStore } from '../state/store.ts';
import { Toasts } from '../components/Toasts.tsx';
import { useRoomTheme } from '../theme/useRoomTheme.ts';
import { Lobby } from './Lobby.tsx';
import { Table } from './Table.tsx';
import { MAX_NAME_LENGTH } from '@saffron/protocol';

const NamePrompt = ({ onDone }: { onDone: (watch: boolean) => void }) => {
  const [name, setName] = useState('');
  const finish = (watch: boolean) => {
    if (!name.trim()) return;
    saveName(name.trim());
    onDone(watch);
  };
  return (
    <main className="center-screen">
      <form
        className="panel name-prompt"
        onSubmit={(e) => {
          e.preventDefault();
          finish(false);
        }}
      >
        <h1 className="name-prompt__title">Join the bazaar</h1>
        <label className="field">
          <span className="field__label">Your merchant name</span>
          <input
            className="field__input"
            value={name}
            maxLength={MAX_NAME_LENGTH}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </label>
        <div className="name-prompt__actions">
          <button className="btn btn--primary" type="submit" disabled={!name.trim()}>
            Take a seat
          </button>
          <button
            className="btn btn--ghost"
            type="button"
            disabled={!name.trim()}
            onClick={() => finish(true)}
          >
            Just watch
          </button>
        </div>
      </form>
    </main>
  );
};

const Connecting = ({ failed }: { failed: boolean }) => (
  <main className="center-screen">
    <div className="panel connecting">
      {failed ? (
        <>
          <h1>Room not found</h1>
          <p>The stall may have closed. Check the code or host a new game.</p>
          <button className="btn btn--primary" type="button" onClick={() => navigate('/')}>
            Back to the bazaar
          </button>
        </>
      ) : (
        <>
          <div className="spinner" aria-hidden />
          <p>Walking to the stall...</p>
        </>
      )}
    </div>
  </main>
);

const REMOVED_TEXT = {
  kicked: { title: 'Removed from the table', body: 'The host removed you from this table.' },
  closed: { title: 'The room is closed', body: 'The host closed this room for everyone.' },
} as const;

const Removed = ({ reason }: { readonly reason: keyof typeof REMOVED_TEXT }) => (
  <main className="center-screen">
    <div className="panel connecting">
      <h1>{REMOVED_TEXT[reason].title}</h1>
      <p>{REMOVED_TEXT[reason].body}</p>
      <button className="btn btn--primary" type="button" onClick={() => navigate('/')}>
        Back to the bazaar
      </button>
    </div>
  </main>
);

const watchRequested = (): boolean => new URLSearchParams(location.search).has('watch');

export const RoomScreen = ({ code }: { code: string }) => {
  const [hasName, setHasName] = useState(() => loadName().trim().length > 0);
  const [watch, setWatch] = useState(watchRequested);
  const connection = useStore((s) => s.connection);
  const room = useStore((s) => s.room);
  const removed = useStore((s) => s.removed);
  const reconnecting = connection === 'reconnecting';
  useRoomTheme(room?.theme);

  useEffect(() => {
    if (!hasName) return;
    connect(code, watch);
    return () => disconnect();
  }, [code, hasName, watch]);

  if (!hasName) {
    return (
      <NamePrompt
        onDone={(asViewer) => {
          setWatch(asViewer);
          setHasName(true);
        }}
      />
    );
  }
  if (removed) return <Removed reason={removed} />;
  if (!room) {
    return (
      <>
        <Choreographer />
        <Connecting failed={connection === 'failed'} />
      </>
    );
  }

  return (
    <>
      <Choreographer />
      {room.status === 'lobby' ? <Lobby /> : <Table />}
      <FlyLayer />
      <Toasts />
      {reconnecting && <div className="reconnect-pill">Reconnecting...</div>}
    </>
  );
};
