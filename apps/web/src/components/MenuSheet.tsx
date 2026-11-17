import { navigate } from '../App.tsx';
import { send } from '../net/socket.ts';
import { useStore } from '../state/store.ts';
import { ConfirmAction } from './ConfirmAction.tsx';
import { Sheet } from './Sheet.tsx';

type Props = {
  readonly onClose: () => void;
  readonly onRules: () => void;
  readonly onSound: () => void;
};

export const shareUrl = (code: string): string => `${location.origin}/r/${code}`;

export const MenuSheet = ({ onClose, onRules, onSound }: Props) => {
  const code = useStore((s) => s.room?.code ?? '');
  const showToast = useStore((s) => s.showToast);
  const status = useStore((s) => s.room?.status);
  const seated = useStore((s) => s.seatId !== null);
  const watching = useStore((s) => s.viewerId !== null);
  const isHost = useStore((s) => s.seatId !== null && s.seatId === s.room?.hostSeatId);
  const paused = useStore((s) => s.room?.pausedAt != null);
  const handsSeat = seated && status !== 'finished';

  const leave = () => {
    if (handsSeat || watching) send({ type: 'leave' });
    navigate('/');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl(code));
      showToast('Invite link copied');
    } catch {
      showToast(shareUrl(code));
    }
  };

  return (
    <Sheet title="Menu" onClose={onClose}>
      <div className="menu">
        <div className="menu__code">
          <span>
            <span className="muted small">Room code</span>
            <br />
            <span className="menu__code-value">{code}</span>
          </span>
          <button className="btn btn--ghost btn--small" type="button" onClick={copy}>
            Copy link
          </button>
        </div>
        {isHost && status === 'playing' && (
          <button
            className="menu__item"
            type="button"
            onClick={() => {
              send({ type: 'setPaused', paused: !paused });
              onClose();
            }}
          >
            {paused ? 'Resume game' : 'Pause game'}
          </button>
        )}
        <button className="menu__item" type="button" onClick={onRules}>
          How to play
        </button>
        <button className="menu__item" type="button" onClick={onSound}>
          Sound
        </button>
        {handsSeat && status === 'playing' ? (
          <ConfirmAction
            label="Leave table"
            prompt="Leave this game? A bot takes over your stall and you can't come back to it."
            confirmLabel="Leave game"
            cancelLabel="Stay"
            triggerClassName="menu__item"
            onConfirm={leave}
          />
        ) : (
          <button className="menu__item" type="button" onClick={leave}>
            Leave table
          </button>
        )}
        {isHost && (
          <ConfirmAction
            label="Close room for everyone"
            prompt="Close this room? Everyone is sent back home and the game ends for good."
            confirmLabel="Close room"
            triggerClassName="menu__item menu__item--danger"
            onConfirm={() => send({ type: 'closeRoom' })}
          />
        )}
      </div>
    </Sheet>
  );
};
