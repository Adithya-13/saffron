import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { CloseIcon } from '../art/Icons.tsx';

type Props = {
  readonly title: string;
  readonly onClose?: () => void;
  readonly tall?: boolean;
  readonly children: ReactNode;
};

export const Sheet = ({ title, onClose, tall = false, children }: Props) => {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className={`sheet${tall ? ' sheet--tall' : ''}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose?.();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose?.();
      }}
    >
      <header className="sheet__header">
        <h2 className="sheet__title">{title}</h2>
        {onClose && (
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        )}
      </header>
      <div className="sheet__body">{children}</div>
    </dialog>
  );
};
