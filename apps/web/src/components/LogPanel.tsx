import { describeEvent } from '../state/selectors.ts';
import { useStore } from '../state/store.ts';
import { useScrollToLatest } from './useScrollToLatest.ts';

export const LogPanel = () => {
  const log = useStore((s) => s.log);
  const room = useStore((s) => s.room);
  const lines = log.flatMap((event, i) => {
    const text = describeEvent(event, room);
    return text ? [{ key: i, text, kind: event.type }] : [];
  });

  const listRef = useScrollToLatest<HTMLOListElement>(lines.length);

  return (
    <ol className="log" ref={listRef} aria-label="Move log">
      {lines.length === 0 && <li className="log__empty">The market is quiet...</li>}
      {lines.map((line) => (
        <li key={line.key} className={`log__line log__line--${line.kind}`}>
          {line.text}
        </li>
      ))}
    </ol>
  );
};
