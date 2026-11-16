import { useState } from 'react';
import type { FormEvent } from 'react';
import { GAME_NAME } from '@saffron/content';
import { MAX_NAME_LENGTH, ROOM_CODE_LENGTH } from '@saffron/protocol';
import { navigate } from '../App.tsx';
import { SpiceIcon } from '../art/SpiceIcon.tsx';
import { createRoom } from '../net/socket.ts';
import { loadName, saveName } from '../net/storage.ts';
import { RulesSheet } from '../components/RulesSheet.tsx';

export const Home = () => {
  const [name, setName] = useState(loadName);
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const trimmed = name.trim();

  const host = async (event: FormEvent) => {
    event.preventDefault();
    if (!trimmed) return;
    saveName(trimmed);
    setBusy(true);
    setError(null);
    try {
      navigate(`/r/${await createRoom()}`);
    } catch {
      setError('The bazaar is closed right now. Try again in a moment.');
      setBusy(false);
    }
  };

  const join = (event: FormEvent) => {
    event.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!trimmed || code.length !== ROOM_CODE_LENGTH) return;
    saveName(trimmed);
    navigate(`/r/${code}`);
  };

  return (
    <main className="home">
      <div className="home__hero" />
      <section className="home__panel">
        <div className="home__tokens" aria-hidden>
          {(['saffron', 'cardamom', 'sumac', 'pepper', 'salt'] as const).map((t, i) => (
            <SpiceIcon key={t} token={t} size={34} className={`home__token home__token--${i}`} />
          ))}
        </div>
        <h1 className="home__title">{GAME_NAME}</h1>
        <p className="home__tagline">
          Trade spices by lantern light, grow your caravans into fleets, and win the favour of the
          guilds. 2 to 4 merchants, about 30 minutes.
        </p>

        <label className="field">
          <span className="field__label">Your merchant name</span>
          <input
            className="field__input"
            value={name}
            maxLength={MAX_NAME_LENGTH}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Adit"
            autoComplete="nickname"
          />
        </label>

        <form onSubmit={host}>
          <button className="btn btn--primary btn--wide" disabled={!trimmed || busy} type="submit">
            {busy ? 'Opening a stall...' : 'Host a new game'}
          </button>
        </form>

        <div className="home__divider">
          <span>or join a friend</span>
        </div>

        <form className="home__join" onSubmit={join}>
          <input
            className="field__input field__input--code"
            value={joinCode}
            maxLength={ROOM_CODE_LENGTH}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="ROOM CODE"
            aria-label="Room code"
            autoCapitalize="characters"
          />
          <button
            className="btn btn--ghost"
            disabled={!trimmed || joinCode.trim().length !== ROOM_CODE_LENGTH}
            type="submit"
          >
            Join
          </button>
        </form>

        {error && <p className="home__error">{error}</p>}
        <button className="link-btn" type="button" onClick={() => setRulesOpen(true)}>
          How to play
        </button>
      </section>
      {rulesOpen && <RulesSheet onClose={() => setRulesOpen(false)} />}
    </main>
  );
};
