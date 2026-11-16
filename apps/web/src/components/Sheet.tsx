import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

type Props = {
  readonly title: string;
  readonly onClose?: () => void;
  readonly children: ReactNode;
};

export const Sheet = ({ title, onClose, children }: Props) => {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose?.();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose?.();
      }}
    >
      <div className="sheet__body">
        <header className="sheet__header">
          <h2 className="sheet__title">{title}</h2>
          {onClose && (
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              ×
            </button>
          )}
        </header>
        {children}
      </div>
    </dialog>
  );
};
