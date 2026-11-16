import { SPICE_INFO } from '@saffron/content';
import { SPICES } from '@saffron/engine';
import type { Spice } from '@saffron/engine';
import { anchors } from '../anim/plan.ts';
import { SpiceIcon } from '../art/SpiceIcon.tsx';
import { canAddToDraft } from '../state/moves.ts';
import { useStore } from '../state/store.ts';

export const Supply = ({ interactive }: { readonly interactive: boolean }) => {
  const view = useStore((s) => s.view);
  const legal = useStore((s) => s.legal);
  const draft = useStore((s) => s.draft);
  const setDraft = useStore((s) => s.setDraft);
  const showToast = useStore((s) => s.showToast);
  if (!view) return null;

  const pick = (spice: Spice) => {
    if (!interactive) {
      showToast('Wait for your turn to take spices');
      return;
    }
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
        const picked = token === 'seal' ? 0 : draft.filter((s) => s === token).length;
        const left = view.supply[token] - picked;
        const available = token !== 'seal' && interactive && canAddToDraft(legal, draft, token);
        return (
          <button
            key={token}
            type="button"
            className={`pile${available ? ' pile--available' : ''}${picked > 0 ? ' pile--picked' : ''}${left === 0 ? ' pile--empty' : ''}`}
            disabled={token === 'seal'}
            onClick={token === 'seal' ? undefined : () => pick(token)}
            aria-label={`${SPICE_INFO[token].label}: ${view.supply[token]} left`}
            data-anchor={anchors.supply(token)}
          >
            <SpiceIcon token={token} size={32} className="spice-disc" />
            <span className="pile__count">
              {left}
              {picked > 0 && <span className="pile__picked"> −{picked}</span>}
            </span>
          </button>
        );
      })}
    </section>
  );
};
