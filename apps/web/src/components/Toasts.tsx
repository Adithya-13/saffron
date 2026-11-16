import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { play } from '../audio/sound.ts';
import { useStore } from '../state/store.ts';

const TOAST_MS = 2600;

export const Toasts = () => {
  const toast = useStore((s) => s.toast);
  const clearToast = useStore((s) => s.clearToast);

  useEffect(() => {
    if (!toast) return;
    if (toast.tone === 'error') play('thunk', { volume: 0.3 });
    const timer = setTimeout(() => clearToast(toast.id), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast, clearToast]);

  return (
    <div className="toasts" role="status" aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            className={`toast toast--${toast.tone}`}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              x: toast.tone === 'error' ? [0, -6, 6, -3, 0] : 0,
            }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.35 }}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
