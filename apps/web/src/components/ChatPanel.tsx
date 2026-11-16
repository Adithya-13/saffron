import { useEffect, useRef, useState } from 'react';
import { MAX_CHAT_LENGTH } from '@saffron/protocol';
import { play } from '../audio/sound.ts';
import { send } from '../net/socket.ts';
import { useStore } from '../state/store.ts';

export const ChatPanel = ({ active = true }: { active?: boolean }) => {
  const chat = useStore((s) => s.chat);
  const seatId = useStore((s) => s.seatId);
  const markChatRead = useStore((s) => s.markChatRead);
  const [text, setText] = useState('');
  const listRef = useRef<HTMLOListElement>(null);
  const lastId = chat.at(-1)?.id;
  const lastSeat = chat.at(-1)?.seatId;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    if (active) markChatRead();
  }, [lastId, active, markChatRead]);

  const heardId = useRef(lastId);
  useEffect(() => {
    if (lastId === heardId.current) return;
    heardId.current = lastId;
    if (lastSeat && lastSeat !== seatId) play('pop', { volume: 0.35 });
  }, [lastId, lastSeat, seatId]);

  return (
    <div className="chat">
      <ol className="chat__list" ref={listRef}>
        {chat.length === 0 && <li className="chat__empty">Say hello to the other merchants.</li>}
        {chat.map((m) => (
          <li
            key={m.id}
            className={`chat__msg${m.seatId === null ? ' chat__msg--system' : ''}${m.seatId === seatId ? ' chat__msg--mine' : ''}`}
          >
            {m.seatId !== null && <span className="chat__name">{m.name}</span>}
            <span className="chat__text">{m.text}</span>
          </li>
        ))}
      </ol>
      {seatId && (
        <form
          className="chat__form"
          onSubmit={(e) => {
            e.preventDefault();
            const value = text.trim();
            if (!value) return;
            send({ type: 'chat', text: value });
            setText('');
          }}
        >
          <input
            className="field__input chat__input"
            value={text}
            maxLength={MAX_CHAT_LENGTH}
            onChange={(e) => setText(e.target.value)}
            placeholder="Message the table"
            aria-label="Chat message"
          />
          <button className="btn btn--small btn--primary" type="submit" disabled={!text.trim()}>
            Send
          </button>
        </form>
      )}
    </div>
  );
};
