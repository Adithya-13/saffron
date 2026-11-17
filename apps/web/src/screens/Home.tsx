import { useState } from 'react';
import type { FormEvent } from 'react';
import { CATALOG, GAME_NAME } from '@saffron/content';
import type { Card as CardData, Spice, Tier } from '@saffron/engine';
import { MAX_NAME_LENGTH, ROOM_CODE_LENGTH } from '@saffron/protocol';
import { navigate } from '../App.tsx';
import { SpiceIcon } from '../art/SpiceIcon.tsx';
import { Card } from '../components/Card.tsx';
import { RulesSheet } from '../components/RulesSheet.tsx';
import { SoundSettings } from '../components/SoundSettings.tsx';
import { createRoom } from '../net/socket.ts';
import { loadName, saveName } from '../net/storage.ts';

const STEP_SPICES: readonly Spice[] = ['saffron', 'cardamom', 'sumac'];

const sampleCard = (tier: Tier, bonus: Spice): CardData | undefined =>
  CATALOG.cards
    .filter((c) => c.tier === tier && c.bonus === bonus)
    .sort((a, b) => b.points - a.points)[0];

const BUY_CARD = sampleCard(1, 'saffron');
const SCORE_CARD = sampleCard(3, 'pepper');

type HowToPlayProps = { readonly onRules: () => void; readonly onSound: () => void };

const HowToPlay = ({ onRules, onSound }: HowToPlayProps) => (
  <section className="home__how" aria-labelledby="home-how-title">
    <h2 id="home-how-title" className="home__section-title">
      How a turn works
    </h2>
    <ol className="home__steps">
      <li className="home__step">
        <span className="home__step-art home__step-art--spices" aria-hidden>
          {STEP_SPICES.map((s) => (
            <SpiceIcon key={s} token={s} size={30} className="spice-disc" />
          ))}
        </span>
        <h3 className="home__step-title">Take spices</h3>
        <p className="home__step-text">Three different kinds, or two of one kind.</p>
      </li>
      <li className="home__step">
        <span className="home__step-art" aria-hidden>
          {BUY_CARD && <Card card={BUY_CARD} />}
        </span>
        <h3 className="home__step-title">Buy a card</h3>
        <p className="home__step-text">Its spice becomes a discount on every card after it.</p>
      </li>
      <li className="home__step">
        <span className="home__step-art" aria-hidden>
          {SCORE_CARD && <Card card={SCORE_CARD} />}
        </span>
        <h3 className="home__step-title">Earn prestige</h3>
        <p className="home__step-text">Reach the target first, and the guilds come calling.</p>
      </li>
    </ol>
    <span className="home__links">
      <button className="link-btn" type="button" onClick={onRules}>
        Read the full rules
      </button>
      <button className="link-btn" type="button" onClick={onSound}>
        Sound
      </button>
    </span>
  </section>
);

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

  const join = (event: FormEvent) => {
    event.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!trimmed || code.length !== ROOM_CODE_LENGTH) return;
    saveName(trimmed);
    navigate(`/r/${code}`);
  };

  return (
    <main className="home">
      <div className="home__art">
        <img src="/assets/misc/hero.webp" alt="" />
      </div>

      <div className="home__content">
        <header className="home__intro">
          <p className="home__eyebrow">A spice-market card game</p>
          <h1 className="home__title">{GAME_NAME}</h1>
          <p className="home__tagline">
            Trade spices, buy stalls, caravans and ships, and win over the guilds before your
            friends do.
          </p>
          <ul className="home__facts">
            <li>2 to 8 players</li>
            <li>About 30 minutes</li>
            <li>Made for phones</li>
          </ul>
        </header>

        <section className="home__play" aria-label="Play">
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

          <div className="home__options">
            <form className="home__option" onSubmit={host}>
              <h2 className="home__option-title">Start a table</h2>
              <p className="home__option-text">You get a code to send to friends.</p>
              <button
                className="btn btn--primary btn--wide"
                disabled={!trimmed || busy}
                type="submit"
              >
                {busy ? 'Opening a stall...' : 'Host a game'}
              </button>
            </form>

            <form className="home__option" onSubmit={join}>
              <h2 className="home__option-title">Join a table</h2>
              <p className="home__option-text">Type the 5-letter code from the host.</p>
              <span className="home__join">
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
              </span>
            </form>
          </div>

          {!trimmed && (
            <p className="home__hint">Add your name first, so friends know who you are.</p>
          )}
          {error && <p className="home__error">{error}</p>}
        </section>

        <HowToPlay onRules={() => setRulesOpen(true)} onSound={() => setSoundOpen(true)} />
      </div>

      {rulesOpen && <RulesSheet onClose={() => setRulesOpen(false)} />}
      {soundOpen && <SoundSettings onClose={() => setSoundOpen(false)} />}
    </main>
  );
};
