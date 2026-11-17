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

const NamePrompt = ({ onDone }: { onDone: () => void }) => {
  const [name, setName] = useState('');
  return (
    <main className="center-screen">
      <form
        className="panel name-prompt"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          saveName(name.trim());
          onDone();
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
        <button className="btn btn--primary btn--wide" type="submit" disabled={!name.trim()}>
          Enter
        </button>
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

const Kicked = () => (
  <main className="center-screen">
    <div className="panel connecting">
      <h1>Removed from the table</h1>
      <p>The host removed you from this table.</p>
      <button className="btn btn--primary" type="button" onClick={() => navigate('/')}>
        Back to the bazaar
      </button>
    </div>
  </main>
);

export const RoomScreen = ({ code }: { code: string }) => {
  const [hasName, setHasName] = useState(() => loadName().trim().length > 0);
  const connection = useStore((s) => s.connection);
  const room = useStore((s) => s.room);
  const kicked = useStore((s) => s.kicked);
  const reconnecting = connection === 'reconnecting';
  useRoomTheme(room?.theme);

  useEffect(() => {
    if (!hasName) return;
    connect(code);
    return () => disconnect();
  }, [code, hasName]);

  if (!hasName) return <NamePrompt onDone={() => setHasName(true)} />;
  if (kicked) return <Kicked />;
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
