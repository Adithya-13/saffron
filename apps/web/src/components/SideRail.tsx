import { useStore } from '../state/store.ts';
import { ChatPanel } from './ChatPanel.tsx';
import { LogPanel } from './LogPanel.tsx';
import { Watchers } from './Watchers.tsx';

export type RailTab = 'chat' | 'log';

type Props = { readonly tab: RailTab; readonly onTab: (tab: RailTab) => void };

const TABS: readonly { readonly id: RailTab; readonly label: string }[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'log', label: 'Move log' },
];

export const SideRail = ({ tab, onTab }: Props) => {
  const unread = useStore((s) => s.unreadChat);
  return (
    <aside className="rail" aria-label="Chat and move log">
      <div className="rail__tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`rail-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`rail-panel-${t.id}`}
            className={`rail__tab${tab === t.id ? ' rail__tab--active' : ''}`}
            onClick={() => onTab(t.id)}
          >
            {t.label}
            {t.id === 'chat' && tab !== 'chat' && unread > 0 && (
              <span className="rail__unread">{unread}</span>
            )}
          </button>
        ))}
      </div>
      <div
        className="rail__panel"
        role="tabpanel"
        id={`rail-panel-${tab}`}
        aria-labelledby={`rail-tab-${tab}`}
      >
        {tab === 'chat' ? (
          <>
            <Watchers />
            <ChatPanel />
          </>
        ) : (
          <LogPanel />
        )}
      </div>
    </aside>
  );
};
