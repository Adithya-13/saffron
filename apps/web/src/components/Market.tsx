import { AnimatePresence, motion } from 'motion/react';
import { TIERS, bonusesOf, paymentFor } from '@saffron/engine';
import type { Card as CardData, PlayerPublic, Tier } from '@saffron/engine';
import { anchors } from '../anim/plan.ts';
import { useStore } from '../state/store.ts';
import type { Selection } from '../state/store.ts';
import { Card, CardBack } from './Card.tsx';

const sameSelection = (a: Selection, b: Selection): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

export const affordable = (me: PlayerPublic | null, card: CardData): boolean =>
  me !== null && paymentFor(card.cost, bonusesOf(me.cards), me.tokens) !== null;

type Props = { readonly me: PlayerPublic | null; readonly interactive: boolean };

export const Market = ({ me, interactive }: Props) => {
  const view = useStore((s) => s.view);
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  if (!view) return null;

  const toggle = (next: Selection) => select(sameSelection(selection, next) ? null : next);

  return (
    <section className="market" aria-label="Market">
      {[...TIERS].reverse().map((tier: Tier) => (
        <div key={tier} className={`market__row market__row--t${tier}`}>
          <div className="market__deck" data-anchor={anchors.deck(tier)}>
            {view.deckCounts[tier] > 0 ? (
              <CardBack
                tier={tier}
                count={view.deckCounts[tier]}
                selected={sameSelection(selection, { kind: 'deck', tier })}
                {...(interactive ? { onClick: () => toggle({ kind: 'deck', tier }) } : {})}
              />
            ) : (
              <div className="card-slot card-slot--empty" />
            )}
          </div>
          {view.market[tier].map((card, slot) => {
            const target: Selection = { kind: 'market', tier, slot };
            const selected = sameSelection(selection, target);
            return (
              <div key={slot} className="market__slot" data-anchor={anchors.market(tier, slot)}>
                <AnimatePresence mode="popLayout">
                  {card ? (
                    <motion.div
                      key={card.id}
                      className="market__card"
                      initial={{ rotateY: 90, opacity: 0, y: -12 }}
                      animate={{ rotateY: 0, opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: 0.35, type: 'spring', stiffness: 180, damping: 20 }}
                    >
                      <Card
                        card={card}
                        state={selected ? 'selected' : affordable(me, card) ? 'affordable' : 'idle'}
                        {...(interactive ? { onClick: () => toggle(target) } : {})}
                      />
                    </motion.div>
                  ) : (
                    <div className="card-slot card-slot--empty" />
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
};
