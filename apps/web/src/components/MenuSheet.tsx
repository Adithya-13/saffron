import { navigate } from '../App.tsx';
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
        <button className="menu__item" type="button" onClick={() => navigate('/')}>
          Leave table
        </button>
      </div>
    </Sheet>
  );
};
