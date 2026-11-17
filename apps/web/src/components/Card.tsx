import { SPICES } from '@saffron/engine';
import type { Card as CardData, Tier } from '@saffron/engine';
import { SPICE_INFO, TIER_INFO } from '@saffron/content';
import { SpiceIcon } from '../art/SpiceIcon.tsx';
import { CostPip } from './CostPip.tsx';

export const cardArt = (card: Pick<CardData, 'tier' | 'bonus'>): string =>
  `/assets/cards/t${card.tier}-${card.bonus}.webp`;

export const tierRoman = (tier: Tier): string => 'I'.repeat(tier);

export const describeCard = (card: CardData): string => {
  const costs = SPICES.filter((s) => card.cost[s] > 0)
    .map((s) => `${card.cost[s]} ${SPICE_INFO[s].label}`)
    .join(', ');
  return `${TIER_INFO[card.tier].label} card, ${card.points} points, gives ${SPICE_INFO[card.bonus].label}, costs ${costs}`;
};

export type CardState = 'affordable' | 'reachable' | 'selected' | 'idle';

type CardProps = {
  readonly card: CardData;
  readonly state?: CardState;
  readonly onClick?: () => void;
  readonly label?: string;
};

export const Card = ({ card, state = 'idle', onClick, label }: CardProps) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`card card--t${card.tier} card--${state}`}
      onClick={onClick}
      aria-label={label ?? describeCard(card)}
    >
      <span className="card__head">
        <span className="card__points">{card.points > 0 ? card.points : ''}</span>
        <SpiceIcon token={card.bonus} className="card__bonus" />
      </span>
      <img className="card__art" src={cardArt(card)} alt="" draggable={false} decoding="async" />
      <span className="card__cost">
        {SPICES.filter((s) => card.cost[s] > 0).map((s) => (
          <CostPip key={s} spice={s} amount={card.cost[s]} />
        ))}
      </span>
    </Tag>
  );
};

export const CardBack = ({ tier }: { readonly tier: Tier }) => (
  <div className="card-back" aria-label={`Hidden ${TIER_INFO[tier].label} card`}>
    <span className="card-back__tier">{tierRoman(tier)}</span>
    <span className="card-back__label">{TIER_INFO[tier].label}</span>
  </div>
);
