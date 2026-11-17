import type { ViewerInfo } from '@saffron/protocol';
import { CloseIcon } from '../art/Icons.tsx';
import { send } from '../net/socket.ts';
import { listNames } from '../state/selectors.ts';
import { useStore } from '../state/store.ts';

const NO_VIEWERS: readonly ViewerInfo[] = [];
const NAMED = 4;

const namesOf = (viewers: readonly ViewerInfo[], selfId: string | null): string => {
  const names = viewers.map((v) => (v.id === selfId ? 'you' : v.name));
  if (names.length <= NAMED) return listNames(names);
  return `${names.slice(0, NAMED - 1).join(', ')} and ${names.length - NAMED + 1} more`;
};

export const Watchers = () => {
  const viewers = useStore((s) => s.room?.viewers ?? NO_VIEWERS);
  const viewerId = useStore((s) => s.viewerId);
  const isHost = useStore((s) => s.seatId !== null && s.seatId === s.room?.hostSeatId);
  if (viewers.length === 0) return null;
  if (!isHost) {
    return (
      <p className="watchers">
        <span className="watchers__count">Watching: {viewers.length}</span>
        <span className="watchers__names">{namesOf(viewers, viewerId)}</span>
      </p>
    );
  }
  return (
    <div className="watchers">
      <span className="watchers__count">Watching: {viewers.length}</span>
      <ul className="watchers__list">
        {viewers.map((v) => (
          <li key={v.id} className="watchers__item">
            <span className="watchers__name">{v.name}</span>
            <button
              className="icon-btn"
              type="button"
              aria-label={`Remove ${v.name}`}
              onClick={() => send({ type: 'removeSeat', seatId: v.id })}
            >
              <CloseIcon />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
