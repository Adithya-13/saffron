import { useState } from 'react';
import { navigate } from '../App.tsx';
import { send } from '../net/socket.ts';
import { useStore } from '../state/store.ts';
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
  const [confirmLeave, setConfirmLeave] = useState(false);
  const handsSeat = seated && status !== 'finished';

  const leave = () => {
    if (handsSeat) send({ type: 'leave' });
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
        <button className="menu__item" type="button" onClick={onRules}>
          How to play
        </button>
        <button className="menu__item" type="button" onClick={onSound}>
          Sound
        </button>
        {confirmLeave ? (
          <div className="confirm">
            <p className="small">
              Leave this game? A bot takes over your stall and you can't come back to it.
            </p>
            <span className="confirm__actions">
              <button
                className="btn btn--ghost btn--small"
                type="button"
                onClick={() => setConfirmLeave(false)}
              >
                Stay
              </button>
              <button className="btn btn--danger btn--small" type="button" onClick={leave}>
                Leave game
              </button>
            </span>
          </div>
        ) : (
          <button
            className="menu__item"
            type="button"
            onClick={() => (handsSeat && status === 'playing' ? setConfirmLeave(true) : leave())}
          >
            Leave table
          </button>
        )}
      </div>
    </Sheet>
  );
};
