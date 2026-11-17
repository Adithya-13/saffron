import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@saffron/protocol';
import { play } from '../audio/sound.ts';
import { seatIndex } from '../state/selectors.ts';
import { memberIdOf, useStore } from '../state/store.ts';
import { Avatar } from './Avatar.tsx';

const BUBBLE_MS = 3500;

type Props = { readonly suppressed: boolean; readonly onOpen: () => void };

export const ChatBubble = ({ suppressed, onOpen }: Props) => {
  const room = useStore((s) => s.room);
  const memberId = useStore(memberIdOf);
  const last = useStore((s) => s.chat.at(-1));
  const seenId = useRef(last?.id);
  const [shown, setShown] = useState<ChatMessage | null>(null);

  useEffect(() => {
    if (!last || last.id === seenId.current) return;
    seenId.current = last.id;
    if (suppressed || last.seatId === null || last.seatId === memberId) return;
    setShown(last);
    play('pop', { volume: 0.35 });
  }, [last, suppressed, memberId]);

  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => setShown(null), BUBBLE_MS);
    return () => clearTimeout(timer);
  }, [shown]);

  useEffect(() => {
    if (suppressed) setShown(null);
  }, [suppressed]);

  return (
    <div className="chat-bubble-slot" aria-live="polite">
      <AnimatePresence>
        {shown && (
          <motion.button
            key={shown.id}
            type="button"
            className="chat-bubble"
            onClick={() => {
              setShown(null);
              onOpen();
            }}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            aria-label={`${shown.name} says: ${shown.text}. Open chat`}
          >
            <Avatar index={seatIndex(room, shown.seatId ?? '')} name={shown.name} size={26} />
            <span className="chat-bubble__body">
              <span className="chat-bubble__name">
                {shown.name}
                {shown.watching && <span className="chat__watching"> watching</span>}
              </span>
              <span className="chat-bubble__text">{shown.text}</span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};
