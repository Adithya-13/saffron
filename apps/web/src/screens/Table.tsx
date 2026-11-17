import { useEffect, useState } from 'react';
import { SPICES, TIERS } from '@saffron/engine';
import { TURN_MS } from '@saffron/protocol';
import { useAnim } from '../anim/animStore.ts';
import { AwaySheet } from '../components/AwaySheet.tsx';
import { ChatIcon, CompareIcon, LogIcon, MenuIcon } from '../art/Icons.tsx';
import { cardArt } from '../components/Card.tsx';
import { CardDetail } from '../components/CardDetail.tsx';
import { ChatBubble } from '../components/ChatBubble.tsx';
import { ChatPanel } from '../components/ChatPanel.tsx';
import { Dock } from '../components/Dock.tsx';
import { EndScreen } from '../components/EndScreen.tsx';
import { GuildDetail, GuildStrip, guildArt } from '../components/Guilds.tsx';
import { LogPanel } from '../components/LogPanel.tsx';
import { Market } from '../components/Market.tsx';
import { MenuSheet } from '../components/MenuSheet.tsx';
import { PlayerDetail, Players } from '../components/Opponents.tsx';
import { PhaseSheets } from '../components/PhaseSheets.tsx';
import { PlayersTable } from '../components/PlayersTable.tsx';
import { RulesSheet } from '../components/RulesSheet.tsx';
import { Sheet } from '../components/Sheet.tsx';
import { SoundSettings } from '../components/SoundSettings.tsx';
import { Supply } from '../components/Supply.tsx';
import { UndoBar } from '../components/UndoBar.tsx';
import { useTurnRemaining } from '../state/clock.ts';
import { currentOf, isMyTurn, meOf, nameOf } from '../state/selectors.ts';
import { useStore } from '../state/store.ts';

type Panel =
  | { readonly kind: 'log' | 'chat' | 'menu' | 'rules' | 'sound' | 'compare' }
  | { readonly kind: 'player'; readonly id: string }
  | { readonly kind: 'guild'; readonly id: string }
  | null;

const END_SCREEN_DELAY_MS = 500;
const LOW_TIME_MS = 10_000;

const preload = (urls: readonly string[]): void => {
  for (const url of urls) {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
  }
};

export const Table = () => {
  const view = useStore((s) => s.view);
  const room = useStore((s) => s.room);
  const seatId = useStore((s) => s.seatId);
  const unread = useStore((s) => s.unreadChat);
  const [panel, setPanel] = useState<Panel>(null);
  const flightsActive = useAnim((s) => s.flights.length > 0);
  const finished = view?.finished ?? false;
  const [showEnd, setShowEnd] = useState(false);
  const guildIds = view?.guilds.map((g) => g.id).join(',') ?? '';
  const remaining = useTurnRemaining();
  const myTurn = isMyTurn(view, seatId);

  useEffect(() => {
    window.scrollTo(0, 0);
    preload(TIERS.flatMap((tier) => SPICES.map((bonus) => cardArt({ tier, bonus }))));
  }, []);

  useEffect(() => {
    preload(guildIds ? guildIds.split(',').map((id) => guildArt({ id })) : []);
  }, [guildIds]);

  useEffect(() => {
    if (!finished) {
      setShowEnd(false);
      return;
    }
    if (flightsActive) return;
    const timer = setTimeout(() => setShowEnd(true), END_SCREEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [finished, flightsActive]);

  useEffect(() => {
    if (!myTurn) return;
    const base = document.title;
    document.title = `Your turn · ${base}`;
    return () => {
      document.title = base;
    };
  }, [myTurn]);

  if (!view || !room) return null;

  const me = meOf(view, seatId);
  const interactive = myTurn && view.phase.kind === 'action' && !room.undoVote;
  const current = currentOf(view);
  const lowTime = remaining !== null && remaining <= LOW_TIME_MS;
  const close = () => setPanel(null);

  return (
    <div className="table">
      <header className="topbar">
        <span className="topbar__status">
          {current && !view.finished && (
            <span className={`topbar__turn${myTurn ? ' topbar__turn--mine' : ''}`}>
              {myTurn ? 'Your turn' : `${nameOf(room, current.id)}'s turn`}
            </span>
          )}
          {remaining !== null && (
            <span className={`topbar__clock${lowTime ? ' topbar__clock--low' : ''}`}>
              {Math.ceil(remaining / 1000)}s
            </span>
          )}
          {view.finalRound && !view.finished && <span className="tag tag--final">Final round</span>}
        </span>
        {remaining !== null && (
          <span
            className={`topbar__timer${lowTime ? ' topbar__timer--low' : ''}`}
            style={{ transform: `scaleX(${remaining / Math.max(TURN_MS, remaining)})` }}
            aria-hidden
          />
        )}
        <button
          className="icon-btn"
          type="button"
          onClick={() => setPanel({ kind: 'compare' })}
          aria-label="Compare all merchants"
        >
          <CompareIcon />
        </button>
        <button
          className="icon-btn"
          type="button"
          onClick={() => setPanel({ kind: 'log' })}
          aria-label="Move log"
        >
          <LogIcon />
        </button>
        <button
          className="icon-btn"
          type="button"
          onClick={() => setPanel({ kind: 'chat' })}
          aria-label={unread > 0 ? `Chat, ${unread} unread` : 'Chat'}
        >
          <ChatIcon />
          {unread > 0 && <span className="icon-btn__dot" />}
        </button>
        <button
          className="icon-btn"
          type="button"
          onClick={() => setPanel({ kind: 'menu' })}
          aria-label="Menu"
        >
          <MenuIcon />
        </button>
      </header>

      <ChatBubble suppressed={panel?.kind === 'chat'} onOpen={() => setPanel({ kind: 'chat' })} />
      <UndoBar />

      <main className="board">
        <Players onOpen={(id) => setPanel({ kind: 'player', id })} />
        <GuildStrip onOpen={(id) => setPanel({ kind: 'guild', id })} />
        <Market me={me} />
        <Supply interactive={interactive} />
      </main>

      {me && <Dock me={me} myTurn={myTurn} />}

      <CardDetail me={me} interactive={interactive} />
      <PhaseSheets me={me} myTurn={myTurn} />
      <AwaySheet myTurn={myTurn} remaining={remaining} />
      {panel?.kind === 'log' && (
        <Sheet title="Move log" onClose={close} tall>
          <LogPanel />
        </Sheet>
      )}
      {panel?.kind === 'chat' && (
        <Sheet title="Chat" onClose={close} tall>
          <ChatPanel />
        </Sheet>
      )}
      {panel?.kind === 'menu' && (
        <MenuSheet
          onClose={close}
          onRules={() => setPanel({ kind: 'rules' })}
          onSound={() => setPanel({ kind: 'sound' })}
        />
      )}
      {panel?.kind === 'rules' && <RulesSheet onClose={close} />}
      {panel?.kind === 'sound' && <SoundSettings onClose={close} />}
      {panel?.kind === 'compare' && <PlayersTable onClose={close} />}
      {panel?.kind === 'player' && <PlayerDetail playerId={panel.id} onClose={close} />}
      {panel?.kind === 'guild' && <GuildDetail guildId={panel.id} onClose={close} />}
      {showEnd && <EndScreen />}
    </div>
  );
};
