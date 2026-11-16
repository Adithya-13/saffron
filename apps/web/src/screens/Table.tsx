import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useAnim } from '../anim/animStore.ts';
import { GAME_NAME } from '@saffron/content';
import { TARGET_POINTS } from '@saffron/engine';
import { anchors } from '../anim/plan.ts';
import { ActionDock } from '../components/ActionDock.tsx';
import { ChatPanel } from '../components/ChatPanel.tsx';
import { EndScreen } from '../components/EndScreen.tsx';
import { GuildTile } from '../components/GuildTile.tsx';
import { LogPanel } from '../components/LogPanel.tsx';
import { Market } from '../components/Market.tsx';
import { PhaseSheets } from '../components/PhaseSheets.tsx';
import { PlayerPanel } from '../components/PlayerPanel.tsx';
import { RulesSheet } from '../components/RulesSheet.tsx';
import { SoundSettings } from '../components/SoundSettings.tsx';
import { Supply } from '../components/Supply.tsx';
import { UndoBar } from '../components/UndoBar.tsx';
import { currentOf, isMyTurn, meOf, nameOf, seatIndex } from '../state/selectors.ts';
import { useStore } from '../state/store.ts';

type SideTab = 'log' | 'chat';

const END_SCREEN_DELAY_MS = 500;

export const Table = () => {
  const view = useStore((s) => s.view);
  const room = useStore((s) => s.room);
  const seatId = useStore((s) => s.seatId);
  const unread = useStore((s) => s.unreadChat);
  const [tab, setTab] = useState<SideTab>('log');
  const [sheet, setSheet] = useState<'rules' | 'sound' | null>(null);
  const flightsActive = useAnim((s) => s.flights.length > 0);
  const finished = view?.finished ?? false;
  const [showEnd, setShowEnd] = useState(false);

  useEffect(() => {
    if (!finished) {
      setShowEnd(false);
      return;
    }
    if (flightsActive) return;
    const timer = setTimeout(() => setShowEnd(true), END_SCREEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [finished, flightsActive]);

  if (!view || !room) return null;

  const me = meOf(view, seatId);
  const myTurn = isMyTurn(view, seatId);
  const interactive = myTurn && view.phase.kind === 'action' && !room.undoVote;
  const current = currentOf(view);
  const others = view.players.filter((p) => p.id !== seatId);
  const connected = (id: string) => room.seats.find((s) => s.id === id)?.connected ?? false;

  return (
    <div className={`table${myTurn ? ' table--my-turn' : ''}`}>
      <header className="topbar">
        <span className="topbar__brand">{GAME_NAME}</span>
        <span className="topbar__status">
          {view.finalRound && !view.finished ? (
            <span className="tag tag--final">Final round</span>
          ) : (
            <span className="muted small">First to {TARGET_POINTS} prestige</span>
          )}
          {current && !view.finished && (
            <span className="topbar__turn">
              {myTurn ? 'Your turn' : `${nameOf(room, current.id)}'s turn`}
            </span>
          )}
        </span>
        <span className="topbar__actions">
          <span className="topbar__code" title="Room code">
            {room.code}
          </span>
          <button
            className="icon-btn"
            type="button"
            onClick={() => setSheet('rules')}
            aria-label="How to play"
          >
            ?
          </button>
          <button
            className="icon-btn"
            type="button"
            onClick={() => setSheet('sound')}
            aria-label="Sound settings"
          >
            ♪
          </button>
        </span>
      </header>

      <UndoBar />

      <div className="table__board">
        <div className="table__center">
          <section className="guild-row" aria-label="Guilds">
            <AnimatePresence>
              {view.guilds.map((g) => (
                <motion.div
                  key={g.id}
                  data-anchor={anchors.guild(g.id)}
                  layout
                  exit={{ opacity: 0, scale: 0.6 }}
                  className="guild-row__item"
                >
                  <GuildTile guild={g} />
                </motion.div>
              ))}
            </AnimatePresence>
          </section>
          <div className="table__market-wrap">
            <Market me={me} interactive={interactive} />
            <Supply interactive={interactive} />
          </div>
        </div>

        <aside className="table__side">
          <div className="opponents">
            {others.map((p) => (
              <PlayerPanel
                key={p.id}
                player={p}
                index={seatIndex(room, p.id)}
                name={nameOf(room, p.id)}
                active={current?.id === p.id && !view.finished}
                self={false}
                connected={connected(p.id)}
              />
            ))}
          </div>
          <div className="side-tabs panel">
            <div className="side-tabs__bar" role="tablist">
              <button
                role="tab"
                type="button"
                aria-selected={tab === 'log'}
                className={`side-tabs__tab${tab === 'log' ? ' is-active' : ''}`}
                onClick={() => setTab('log')}
              >
                Log
              </button>
              <button
                role="tab"
                type="button"
                aria-selected={tab === 'chat'}
                className={`side-tabs__tab${tab === 'chat' ? ' is-active' : ''}`}
                onClick={() => setTab('chat')}
              >
                Chat
                {unread > 0 && tab !== 'chat' && <span className="badge">{unread}</span>}
              </button>
            </div>
            <div className="side-tabs__body">
              {tab === 'log' ? <LogPanel /> : <ChatPanel active={tab === 'chat'} />}
            </div>
          </div>
        </aside>
      </div>

      <footer className="table__me">
        {me && (
          <PlayerPanel
            player={me}
            index={seatIndex(room, me.id)}
            name={nameOf(room, me.id)}
            active={myTurn}
            self
            connected
            interactive={interactive}
          />
        )}
        <ActionDock me={me} myTurn={myTurn} />
      </footer>

      <PhaseSheets me={me} myTurn={myTurn} />
      {showEnd && <EndScreen />}
      {sheet === 'rules' && <RulesSheet onClose={() => setSheet(null)} />}
      {sheet === 'sound' && <SoundSettings onClose={() => setSheet(null)} />}
    </div>
  );
};
