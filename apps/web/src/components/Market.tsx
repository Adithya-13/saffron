import { AnimatePresence, motion } from 'motion/react';
import { TIERS } from '@saffron/engine';
import type { Card as CardData, PlayerPublic, Tier } from '@saffron/engine';
import { TIER_INFO } from '@saffron/content';
import { anchors } from '../anim/plan.ts';
import { markBlindTipSeen } from '../net/storage.ts';
import { canAfford } from '../state/selectors.ts';
import { useStore } from '../state/store.ts';
import type { Selection } from '../state/store.ts';
import { Card, CardBack, tierRoman } from './Card.tsx';

export const sameSelection = (a: Selection, b: Selection): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

export const affordable = (me: PlayerPublic | null, card: CardData): boolean =>
  me !== null && canAfford(me, card);

const ReserveRow = ({ me }: { readonly me: PlayerPublic }) => {
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  if (me.reserved.length === 0) return null;
  return (
    <div
      className="market__row market__row--reserve"
      data-anchor={anchors.reserve(me.id)}
      aria-label="Your reserved cards"
    >
      <span className="reserve-label" aria-hidden>
        Held
      </span>
      {me.reserved.map((r, index) => {
        const target: Selection = { kind: 'reserve', playerId: me.id, index };
        return (
          <div
            key={`${index}-${r.card?.id ?? r.tier}`}
            className="market__slot"
            data-anchor={anchors.reserveSlot(me.id, index)}
          >
            {r.card ? (
              <Card
                card={r.card}
                state={
                  sameSelection(selection, target)
                    ? 'selected'
                    : affordable(me, r.card)
                      ? 'affordable'
                      : 'idle'
                }
                onClick={() => select(target)}
              />
            ) : (
              <button
                type="button"
                className="fit reserve-hidden"
                onClick={() => select(target)}
                aria-label="Your hidden reserved card"
              >
                <CardBack tier={r.tier} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export const Market = ({ me }: { readonly me: PlayerPublic | null }) => {
  const view = useStore((s) => s.view);
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  if (!view) return null;

  return (
    <section className="market" aria-label="Market">
      {[...TIERS].reverse().map((tier: Tier) => (
        <div key={tier} className={`market__row market__row--t${tier}`}>
          <button
            type="button"
            className={`deck${sameSelection(selection, { kind: 'deck', tier }) ? ' deck--selected' : ''}`}
            data-anchor={anchors.deck(tier)}
            disabled={view.deckCounts[tier] === 0}
            onClick={() => {
              markBlindTipSeen();
              select({ kind: 'deck', tier });
            }}
            aria-label={`${TIER_INFO[tier].label} deck, ${view.deckCounts[tier]} cards left. Reserve the top card blind`}
          >
            <span className="deck__tier">{tierRoman(tier)}</span>
            <span className="deck__blind" aria-hidden>
              +
            </span>
            <span className="deck__count">{view.deckCounts[tier]}</span>
          </button>
          {view.market[tier].map((card, slot) => {
            const target: Selection = { kind: 'market', tier, slot };
            return (
              <div key={slot} className="market__slot" data-anchor={anchors.market(tier, slot)}>
                <AnimatePresence mode="popLayout">
                  {card ? (
                    <motion.div
                      key={card.id}
                      className="market__card"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: 0.3, duration: 0.3 }}
                    >
                      <Card
                        card={card}
                        state={
                          sameSelection(selection, target)
                            ? 'selected'
                            : affordable(me, card)
                              ? 'affordable'
                              : 'idle'
                        }
                        onClick={() => select(target)}
                      />
                    </motion.div>
                  ) : (
                    <div className="card-slot--empty" />
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      ))}
      {me && <ReserveRow me={me} />}
    </section>
  );
};
