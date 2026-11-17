import { useLayoutEffect, useRef } from 'react';
import { SPICE_INFO } from '@saffron/content';
import { TOKENS, bonusesOf, totalTokens } from '@saffron/engine';
import type { Move, PlayerPublic } from '@saffron/engine';
import { anchors } from '../anim/plan.ts';
import { SpiceIcon } from '../art/SpiceIcon.tsx';
import { send } from '../net/socket.ts';
import { blindTipSeen } from '../net/storage.ts';
import { draftToMove, isLegal } from '../state/moves.ts';
import { currentOf, nameOf } from '../state/selectors.ts';
import { useStore } from '../state/store.ts';
import { Points } from './Opponents.tsx';

const submit = (move: Move) => send({ type: 'move', move });

const Holdings = ({ me }: { readonly me: PlayerPublic }) => {
  const bonuses = bonusesOf(me.cards);
  return (
    <div className="holdings" aria-label="Your discounts and tokens">
      {TOKENS.map((t) => (
        <span
          key={t}
          className={`holding${me.tokens[t] === 0 ? ' holding--zero' : ''}`}
          title={SPICE_INFO[t].label}
        >
          <span
            className={`holding__bonus spice--${t}${t === 'seal' ? ' holding__bonus--none' : bonuses[t] === 0 ? ' holding__bonus--zero' : ''}`}
            data-anchor={t === 'seal' ? undefined : anchors.bonus(me.id, t)}
            aria-label={t === 'seal' ? undefined : `${bonuses[t]} ${SPICE_INFO[t].label} discount`}
          >
            {t === 'seal' ? '' : bonuses[t]}
          </span>
          <span
            className="holding__tokens"
            data-anchor={anchors.tokens(me.id, t)}
            aria-label={`${me.tokens[t]} ${SPICE_INFO[t].label} tokens`}
          >
            <SpiceIcon token={t} size={20} className="spice-disc" />
            {me.tokens[t]}
          </span>
        </span>
      ))}
    </div>
  );
};

const Action = ({ me, myTurn }: { readonly me: PlayerPublic; readonly myTurn: boolean }) => {
  const view = useStore((s) => s.view);
  const room = useStore((s) => s.room);
  const seatId = useStore((s) => s.seatId);
  const legal = useStore((s) => s.legal);
  const draft = useStore((s) => s.draft);
  const setDraft = useStore((s) => s.setDraft);
  if (!view || !room) return null;
  const current = currentOf(view);

  if (view.finished) return <p className="dock__hint">The market has closed.</p>;
  if (room.undoVote) return <p className="dock__hint">Waiting on the take-back vote...</p>;
  if (!myTurn) {
    const canUndo = Boolean(seatId && room.undoAvailableTo === seatId);
    return (
      <>
        <p className="dock__hint">
          {current ? `${nameOf(room, current.id)} is playing...` : 'Waiting...'}
        </p>
        {canUndo && (
          <button
            className="btn btn--ghost btn--small"
            type="button"
            onClick={() => send({ type: 'undoRequest' })}
          >
            Take back my turn
          </button>
        )}
      </>
    );
  }
  if (view.phase.kind !== 'action')
    return <p className="dock__hint dock__hint--strong">Finish your turn in the window above.</p>;
  if (legal.length === 1 && legal[0]?.type === 'pass') {
    return (
      <>
        <p className="dock__hint">No moves are possible.</p>
        <button className="btn btn--primary" type="button" onClick={() => submit({ type: 'pass' })}>
          Pass
        </button>
      </>
    );
  }
  if (draft.length > 0) {
    const move = draftToMove(draft);
    const ready = move !== null && isLegal(legal, move);
    return (
      <>
        <p className="dock__hint dock__hint--strong">{ready ? 'Ready to take' : 'Pick one more'}</p>
        <span className="dock__actions">
          <button className="btn btn--ghost btn--small" type="button" onClick={() => setDraft([])}>
            Clear
          </button>
          <button
            className="btn btn--primary btn--small"
            type="button"
            disabled={!ready}
            onClick={() => move && submit(move)}
          >
            Take spices
          </button>
        </span>
      </>
    );
  }
  if (!blindTipSeen() && me.reserved.length === 0 && me.cards.length < 4) {
    return (
      <p className="dock__hint dock__hint--strong">
        Your turn. Tip: tap a deck <span className="dock__deck-chip">III</span> to reserve a hidden
        card and a Seal.
      </p>
    );
  }
  return (
    <p className="dock__hint dock__hint--strong">
      {me.reserved.length > 0
        ? 'Your turn. Tap spices or any card.'
        : 'Your turn. Tap spices to take, or a card to buy.'}
    </p>
  );
};

const useDockHeight = () => {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const dock = ref.current;
    if (!dock) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => {
      root.style.setProperty('--dock-h', `${dock.offsetHeight}px`);
    });
    observer.observe(dock);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--dock-h');
    };
  }, []);
  return ref;
};

export const Dock = ({ me, myTurn }: { readonly me: PlayerPublic; readonly myTurn: boolean }) => {
  const held = totalTokens(me.tokens);
  const ref = useDockHeight();
  return (
    <footer
      ref={ref}
      className={`dock${myTurn ? ' dock--active' : ''}`}
      data-anchor={anchors.player(me.id)}
      aria-label="Your stall"
    >
      <div className="me">
        <div className="me__score" data-anchor={anchors.guilds(me.id)}>
          <Points points={me.points} className="me__points" />
          <span className={`me__held${held >= 9 ? ' me__held--full' : ''}`}>{held}/10</span>
        </div>
        <Holdings me={me} />
      </div>
      <div className="dock__row">
        <Action me={me} myTurn={myTurn} />
      </div>
    </footer>
  );
};
