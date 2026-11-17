import { SPICE_INFO, TIER_INFO } from '@saffron/content';
import { MAX_RESERVED, SPICES, TOKENS, bonusesOf, paymentFor } from '@saffron/engine';
import type { Card as CardData, Move, PlayerPublic, PlayerView, Tier } from '@saffron/engine';
import { SpiceIcon } from '../art/SpiceIcon.tsx';
import { send } from '../net/socket.ts';
import { buyMove, isLegal, reserveMove } from '../state/moves.ts';
import { nameOf } from '../state/selectors.ts';
import { useStore } from '../state/store.ts';
import type { Selection } from '../state/store.ts';
import { Card, CardBack } from './Card.tsx';
import { CostPip } from './CostPip.tsx';
import { Sheet } from './Sheet.tsx';

type Resolved = {
  readonly card: CardData | null;
  readonly tier: Tier;
  readonly owner: string | null;
  readonly buy: Move | null;
  readonly reserve: Move | null;
};

const resolve = (
  selection: NonNullable<Selection>,
  view: PlayerView,
  seatId: string | null,
): Resolved | null => {
  switch (selection.kind) {
    case 'market': {
      const card = view.market[selection.tier][selection.slot] ?? null;
      if (!card) return null;
      const source = { kind: 'market', tier: selection.tier, slot: selection.slot } as const;
      return {
        card,
        tier: selection.tier,
        owner: null,
        buy: buyMove(source),
        reserve: reserveMove(source),
      };
    }
    case 'deck':
      return {
        card: null,
        tier: selection.tier,
        owner: null,
        buy: null,
        reserve: reserveMove({ kind: 'deck', tier: selection.tier }),
      };
    case 'reserve': {
      const entry = view.players.find((p) => p.id === selection.playerId)?.reserved[
        selection.index
      ];
      if (!entry) return null;
      const mine = selection.playerId === seatId;
      return {
        card: entry.card,
        tier: entry.tier,
        owner: selection.playerId,
        buy: mine ? buyMove({ kind: 'reserve', index: selection.index }) : null,
        reserve: null,
      };
    }
  }
};

const Payment = ({ card, me }: { readonly card: CardData; readonly me: PlayerPublic }) => {
  const bonuses = bonusesOf(me.cards);
  const payment = paymentFor(card.cost, bonuses, me.tokens);
  if (!payment) return null;
  const spent = TOKENS.filter((t) => payment[t] > 0);
  return (
    <div className="detail__fact">
      <dt>You pay</dt>
      <dd>
        {spent.length === 0
          ? 'Nothing, your cards cover it'
          : spent.map((t) =>
              t === 'seal' ? (
                <span key={t} className="pip spice--seal" aria-label={`${payment.seal} seal`}>
                  {payment.seal}
                </span>
              ) : (
                <CostPip key={t} spice={t} amount={payment[t]} />
              ),
            )}
      </dd>
    </div>
  );
};

type Props = {
  readonly me: PlayerPublic | null;
  readonly interactive: boolean;
};

export const CardDetail = ({ me, interactive }: Props) => {
  const view = useStore((s) => s.view);
  const room = useStore((s) => s.room);
  const legal = useStore((s) => s.legal);
  const seatId = useStore((s) => s.seatId);
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  if (!view || !selection) return null;
  const resolved = resolve(selection, view, seatId);
  if (!resolved) return null;

  const { card, tier, owner, buy, reserve } = resolved;
  const canBuy = interactive && buy !== null && isLegal(legal, buy);
  const canReserve = interactive && reserve !== null && isLegal(legal, reserve);
  const reserveFull = (me?.reserved.length ?? 0) >= MAX_RESERVED;
  const close = () => select(null);
  const submit = (move: Move) => {
    send({ type: 'move', move });
    close();
  };
  const title =
    owner && owner !== seatId
      ? `${nameOf(room, owner)}'s reserve`
      : card
        ? TIER_INFO[tier].label.slice(0, -1)
        : `${TIER_INFO[tier].label} deck`;

  const note = (() => {
    if (owner && owner !== seatId) return null;
    if (!interactive) return 'You can act on your turn.';
    if (reserve && !canReserve && reserveFull) return 'You already hold 3 reserved cards.';
    return null;
  })();

  return (
    <Sheet title={title} onClose={close}>
      <div className="detail">
        <div className="detail__card fit">
          {card ? <Card card={card} /> : <CardBack tier={tier} />}
        </div>
        {card ? (
          <dl className="detail__facts">
            <div className="detail__fact">
              <dt>Prestige</dt>
              <dd>{card.points}</dd>
            </div>
            <div className="detail__fact">
              <dt>Gives forever</dt>
              <dd>
                <SpiceIcon token={card.bonus} size={20} />
                {SPICE_INFO[card.bonus].label} discount
              </dd>
            </div>
            <div className="detail__fact">
              <dt>Costs</dt>
              <dd>
                {SPICES.filter((s) => card.cost[s] > 0).map((s) => (
                  <CostPip key={s} spice={s} amount={card.cost[s]} />
                ))}
              </dd>
            </div>
            {me && interactive && (!owner || owner === seatId) && <Payment card={card} me={me} />}
          </dl>
        ) : (
          <div className="detail__blind">
            <p className="detail__note">
              <strong>Blind reserve.</strong> Take the top card of this deck into your hand without
              seeing it first. Nobody else sees it either, so they can&apos;t tell what you&apos;re
              building.
            </p>
            <p className="detail__note">
              {view.supply.seal > 0
                ? 'You also get a Royal Seal, which pays for any spice.'
                : 'No Royal Seals left, so you only get the card.'}{' '}
              {view.deckCounts[tier]} cards left.
            </p>
          </div>
        )}
        {note && <p className="detail__note">{note}</p>}
        {interactive && (buy || reserve) && (
          <div className="detail__actions">
            {reserve && (
              <button
                className="btn btn--ghost"
                type="button"
                disabled={!canReserve}
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
        )}
      </div>
    </Sheet>
  );
};
