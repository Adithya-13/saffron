import { TURN_WARN_MS } from '@saffron/protocol';
import { send } from '../net/socket.ts';
import { useStore } from '../state/store.ts';
import { Sheet } from './Sheet.tsx';

type Props = { readonly myTurn: boolean; readonly remaining: number | null };

export const AwaySheet = ({ myTurn, remaining }: Props) => {
  const seatId = useStore((s) => s.seatId);
  const room = useStore((s) => s.room);
  const finished = useStore((s) => s.view?.finished ?? true);
  if (!room || !seatId || finished) return null;

  if (room.autopilot.includes(seatId)) {
    return (
      <Sheet title="The bot is playing for you">
        <p className="sheet__lead">
          You were away, so a bot is moving for you. Take back control whenever you are ready.
        </p>
        <button
          className="btn btn--primary btn--wide"
          type="button"
          onClick={() => send({ type: 'resume' })}
        >
          Take back control
        </button>
      </Sheet>
    );
  }

  const warning =
    myTurn &&
    !room.turnExtended &&
    remaining !== null &&
    remaining > 0 &&
    remaining <= TURN_WARN_MS;
  if (!warning) return null;

  return (
    <Sheet title="Still there?">
      <p className="sheet__lead">The bot plays for you in {Math.ceil(remaining / 1000)}s.</p>
      <button
        className="btn btn--primary btn--wide"
        type="button"
        onClick={() => send({ type: 'stillHere' })}
      >
        I'm here, give me 30s
      </button>
    </Sheet>
  );
};
