import { motion } from 'motion/react';
import { SPICE_INFO } from '@saffron/content';
import { SPICES } from '@saffron/engine';
import type { Spice } from '@saffron/engine';
import { anchors } from '../anim/plan.ts';
import { SpiceIcon } from '../art/SpiceIcon.tsx';
import { canAddToDraft } from '../state/moves.ts';
import { useStore } from '../state/store.ts';

const MAX_STACK = 4;

export const Supply = ({ interactive }: { interactive: boolean }) => {
  const view = useStore((s) => s.view);
  const legal = useStore((s) => s.legal);
  const draft = useStore((s) => s.draft);
  const setDraft = useStore((s) => s.setDraft);
  const showToast = useStore((s) => s.showToast);
  if (!view) return null;

  const pick = (spice: Spice) => {
    if (!interactive) return;
    if (canAddToDraft(legal, draft, spice)) {
      setDraft([...draft, spice]);
      return;
    }
    showToast(
      draft.includes(spice)
        ? 'Two of a kind needs a pile of 4 or more, and nothing else in hand'
        : 'Take 3 different spices, or 2 of the same',
      'error',
    );
  };

  return (
    <section className="supply" aria-label="Spice supply">
      {[...SPICES, 'seal' as const].map((token) => {
        const count = view.supply[token];
        const pending = token === 'seal' ? 0 : draft.filter((s) => s === token).length;
        const available = token !== 'seal' && interactive && canAddToDraft(legal, draft, token);
        const Tag = token === 'seal' ? 'div' : 'button';
        return (
          <Tag
            key={token}
            type={Tag === 'button' ? 'button' : undefined}
            className={`pile${available ? ' pile--available' : ''}${count === 0 ? ' pile--empty' : ''}`}
            onClick={token === 'seal' ? undefined : () => pick(token)}
            aria-label={`${SPICE_INFO[token].label}: ${count} left`}
            data-anchor={anchors.supply(token)}
          >
            <span className="pile__stack">
              {Array.from({ length: Math.min(Math.max(count - pending, 0), MAX_STACK) }, (_, i) => (
                <motion.span
                  key={i}
                  className="pile__token"
                  style={{ bottom: i * 5, zIndex: i }}
                  layout
                >
                  <SpiceIcon token={token} size={48} />
                </motion.span>
              ))}
              {count === 0 && <span className="pile__ghost" />}
            </span>
            <span className="pile__count">{count - pending}</span>
            <span className="pile__label">{SPICE_INFO[token].label}</span>
          </Tag>
        );
      })}
    </section>
  );
};
