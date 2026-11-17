import { useState } from 'react';
import type { FormEvent } from 'react';
import { GAME_NAME } from '@saffron/content';
import { MAX_NAME_LENGTH, ROOM_CODE_LENGTH } from '@saffron/protocol';
import { navigate } from '../App.tsx';
import { RulesSheet } from '../components/RulesSheet.tsx';
import { SoundSettings } from '../components/SoundSettings.tsx';
import { createRoom } from '../net/socket.ts';
import { loadName, saveName } from '../net/storage.ts';
import { GoalSection, GuildSection, Plate, TierSection, TurnSection } from './HomeSections.tsx';

export const Home = () => {
  const [name, setName] = useState(loadName);
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [soundOpen, setSoundOpen] = useState(false);
  const trimmed = name.trim();
  const codeReady = joinCode.trim().length === ROOM_CODE_LENGTH;

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

  const enter = (watch: boolean) => {
    const code = joinCode.trim().toUpperCase();
    if (!trimmed || code.length !== ROOM_CODE_LENGTH) return;
    saveName(trimmed);
    navigate(watch ? `/r/${code}?watch` : `/r/${code}`);
  };

  const join = (event: FormEvent) => {
    event.preventDefault();
    enter(false);
  };

  return (
    <main className="landing">
      <div className="hero">
        <Plate numeral="I" caption="The saffron market at midday." className="hero__plate">
          <img className="hero__art" src="/assets/misc/hero.webp" alt="" fetchPriority="high" />
        </Plate>

        <div className="hero__body">
          <header className="hero__intro">
            <p className="hero__eyebrow">A card game of the spice market</p>
            <h1 className="hero__title">{GAME_NAME}</h1>
            <p className="hero__tagline">
              Trade spices, buy stalls, caravans and fleets, and win over the guilds before your
              friends do.
            </p>
            <p className="hero__facts">
              <span>2 to 8 players</span>
              <span>About 30 minutes</span>
              <span>Plays on your phone</span>
            </p>
          </header>

          <section id="play" className="entry" aria-labelledby="entry-title">
            <h2 id="entry-title" className="entry__title">
              Take a seat
            </h2>
            <label className="entry__field">
              <span className="entry__label">Your merchant name</span>
              <input
                className="entry__name"
                value={name}
                maxLength={MAX_NAME_LENGTH}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="nickname"
              />
            </label>

            <form className="entry__host" onSubmit={host}>
              <button
                className="btn btn--primary btn--wide"
                disabled={!trimmed || busy}
                type="submit"
              >
                {busy ? 'Opening a stall...' : 'Host a game'}
              </button>
              <p className="entry__note">You get a 5-letter code to send to friends.</p>
            </form>

            <p className="entry__or">
              <span>or join a friend&apos;s table</span>
            </p>

            <form className="entry__join" onSubmit={join}>
              <input
                className="field__input field__input--code"
                value={joinCode}
                maxLength={ROOM_CODE_LENGTH}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="CODE"
                aria-label="Room code"
                autoCapitalize="characters"
                autoComplete="off"
              />
              <button
                className={`btn ${codeReady ? 'btn--primary' : 'btn--ghost'}`}
                disabled={!trimmed || !codeReady}
                type="submit"
              >
                Join
              </button>
              <button
                className="btn btn--ghost"
                type="button"
                disabled={!trimmed || !codeReady}
                onClick={() => enter(true)}
              >
                Watch
              </button>
            </form>

            {!trimmed && (
              <p className="entry__hint">Add your name first, so friends know who you are.</p>
            )}
            {error && (
              <p className="entry__error" role="alert">
                {error}
              </p>
            )}
          </section>
        </div>
      </div>

      <TurnSection />
      <TierSection />
      <GuildSection />
      <GoalSection onRules={() => setRulesOpen(true)} />

      <footer className="colophon">
        <span className="colophon__name">{GAME_NAME}</span>
        <button className="link-btn" type="button" onClick={() => setSoundOpen(true)}>
          Sound
        </button>
      </footer>

      {rulesOpen && <RulesSheet onClose={() => setRulesOpen(false)} />}
      {soundOpen && <SoundSettings onClose={() => setSoundOpen(false)} />}
    </main>
  );
};
