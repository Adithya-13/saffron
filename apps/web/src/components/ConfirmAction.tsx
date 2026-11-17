import { useState } from 'react';

type Props = {
  readonly label: string;
  readonly prompt: string;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  readonly triggerClassName: string;
  readonly onConfirm: () => void;
};

export const ConfirmAction = ({
  label,
  prompt,
  confirmLabel,
  cancelLabel = 'Cancel',
  triggerClassName,
  onConfirm,
}: Props) => {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button className={triggerClassName} type="button" onClick={() => setConfirming(true)}>
        {label}
      </button>
    );
  }
  return (
    <div className="confirm">
      <p className="small">{prompt}</p>
      <span className="confirm__actions">
        <button
          className="btn btn--ghost btn--small"
          type="button"
          onClick={() => setConfirming(false)}
        >
          {cancelLabel}
        </button>
        <button className="btn btn--danger btn--small" type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </span>
    </div>
  );
};
