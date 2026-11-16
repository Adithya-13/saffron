import { AnimatePresence, motion } from 'motion/react';
import { SPICE_INFO } from '@saffron/content';
import { MAX_RESERVED } from '@saffron/engine';
import type { Card as CardData, Move, PlayerPublic, PlayerView } from '@saffron/engine';
import { SpiceIcon } from '../art/SpiceIcon.tsx';
import { send } from '../net/socket.ts';
import { buyMove, draftToMove, isLegal, reserveMove } from '../state/moves.ts';
import { currentOf, nameOf } from '../state/selectors.ts';
import { useStore } from '../state/store.ts';
import type { Selection } from '../state/store.ts';

const selectedCard = (
  selection: Selection,
  me: PlayerPublic | null,
  view: PlayerView,
): CardData | null => {
  if (!selection) return null;
  if (selection.kind === 'market') return view.market[selection.tier][selection.slot] ?? null;
  if (selection.kind === 'reserve') return me?.reserved[selection.index]?.card ?? null;
  return null;
};

const submit = (move: Move) => send({ type: 'move', move });

export const ActionDock = ({ me, myTurn }: { me: PlayerPublic | null; myTurn: boolean }) => {
  const view = useStore((s) => s.view);
  const room = useStore((s) => s.room);
  const legal = useStore((s) => s.legal);
  const draft = useStore((s) => s.draft);
  const selection = useStore((s) => s.selection);
  const setDraft = useStore((s) => s.setDraft);
  const select = useStore((s) => s.select);
  if (!view || !room) return null;

  const current = currentOf(view);
  const phase = view.phase;

  const content = (() => {
    if (view.finished)
      return { key: 'done', node: <p className="dock__hint">The market has closed.</p> };
    if (room.undoVote)
      return { key: 'vote', node: <p className="dock__hint">Waiting on the take-back vote...</p> };
    if (!myTurn) {
      return {
        key: 'wait',
        node: (
          <p className="dock__hint">
            <span className="dock__waiting" aria-hidden />
            {current ? `${nameOf(room, current.id)} is trading...` : 'Waiting...'}
          </p>
        ),
      };
    }
    if (phase.kind !== 'action') {
      return {
        key: 'phase',
        node: <p className="dock__hint">Finish your turn in the window above.</p>,
      };
    }
    if (legal.length === 1 && legal[0]?.type === 'pass') {
      return {
        key: 'pass',
        node: (
          <div className="dock__row">
            <p className="dock__hint">No moves are possible.</p>
            <button
              className="btn btn--primary"
              type="button"
              onClick={() => submit({ type: 'pass' })}
            >
              Pass
            </button>
          </div>
        ),
      };
    }
    if (draft.length > 0) {
      const move = draftToMove(draft);
      const ready = move !== null && isLegal(legal, move);
      return {
        key: 'draft',
        node: (
          <div className="dock__row">
            <div className="dock__draft">
              {draft.map((s, i) => (
                <motion.button
                  type="button"
                  key={`${s}-${i}`}
                  className="dock__draft-token"
                  initial={{ y: -30, opacity: 0, scale: 0.6 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  onClick={() => setDraft(draft.filter((_, j) => j !== i))}
                  aria-label={`Put back ${SPICE_INFO[s].label}`}
                >
                  <SpiceIcon token={s} size={40} />
                </motion.button>
              ))}
            </div>
            <button
              className="btn btn--ghost btn--small"
              type="button"
              onClick={() => setDraft([])}
            >
              Clear
            </button>
            <button
              className="btn btn--primary"
              type="button"
              disabled={!ready}
              onClick={() => move && submit(move)}
            >
              {ready ? 'Take spices' : 'Pick more'}
            </button>
          </div>
        ),
      };
    }
    if (selection) {
      const card = selectedCard(selection, me, view);
      const buy =
        selection.kind === 'market'
          ? buyMove({ kind: 'market', tier: selection.tier, slot: selection.slot })
          : selection.kind === 'reserve'
            ? buyMove({ kind: 'reserve', index: selection.index })
            : null;
      const reserve =
        selection.kind === 'market'
          ? reserveMove({ kind: 'market', tier: selection.tier, slot: selection.slot })
          : selection.kind === 'deck'
            ? reserveMove({ kind: 'deck', tier: selection.tier })
            : null;
      const canBuy = buy !== null && isLegal(legal, buy);
      const canReserve = reserve !== null && isLegal(legal, reserve);
      const reserveFull = (me?.reserved.length ?? 0) >= MAX_RESERVED;
      return {
        key: `sel-${JSON.stringify(selection)}`,
        node: (
          <div className="dock__row">
            <p className="dock__hint">
              {selection.kind === 'deck'
                ? 'Reserve the top card of this deck, unseen'
                : card
                  ? `${card.points > 0 ? `${card.points} prestige, ` : ''}+1 ${SPICE_INFO[card.bonus].label} discount`
                  : ''}
            </p>
            <button
              className="btn btn--ghost btn--small"
              type="button"
              onClick={() => select(null)}
            >
              Cancel
            </button>
            {reserve && (
              <button
                className="btn btn--ghost"
                type="button"
                disabled={!canReserve}
                title={reserveFull ? 'You already hold 3 reserved cards' : undefined}
                onClick={() => submit(reserve)}
              >
                Reserve{view.supply.seal > 0 ? ' + Seal' : ''}
              </button>
            )}
            {buy && (
              <button
                className="btn btn--primary"
                type="button"
                disabled={!canBuy}
                onClick={() => submit(buy)}
              >
                {canBuy ? 'Buy' : "Can't afford"}
              </button>
            )}
          </div>
        ),
      };
    }
    return {
      key: 'idle',
      node: (
        <p className="dock__hint dock__hint--strong">
          Your turn: pick spices from the supply, or choose a card.
        </p>
      ),
    };
  })();

  return (
    <div className={`dock${myTurn ? ' dock--mine' : ''}`}>
      <AnimatePresence mode="wait">
        <motion.div
          key={content.key}
          className="dock__inner"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          {content.node}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
