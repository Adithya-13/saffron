import { SPICES } from '@saffron/engine';
import type { Card as CardData, Tier } from '@saffron/engine';
import { TIER_INFO } from '@saffron/content';
import { SpiceIcon } from '../art/SpiceIcon.tsx';
import { CostPip } from './CostPip.tsx';

export const cardArt = (card: Pick<CardData, 'tier' | 'bonus'>): string =>
  `/assets/cards/t${card.tier}-${card.bonus}.webp`;

type CardProps = {
  readonly card: CardData;
  readonly state?: 'affordable' | 'selected' | 'dimmed' | 'idle';
  readonly onClick?: () => void;
  readonly label?: string;
};

export const Card = ({ card, state = 'idle', onClick, label }: CardProps) => {
  const costs = SPICES.filter((s) => card.cost[s] > 0);
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`card card--t${card.tier} card--${state}`}
      onClick={onClick}
      aria-label={
        label ??
        `${TIER_INFO[card.tier].label} card, ${card.points} points, gives ${card.bonus}, costs ${costs
          .map((s) => `${card.cost[s]} ${s}`)
          .join(', ')}`
      }
    >
      <span className="card__art" style={{ backgroundImage: `url(${cardArt(card)})` }} />
      <span className="card__shade" />
      <span className="card__top">
        <span className="card__points">{card.points > 0 ? card.points : ''}</span>
        <SpiceIcon token={card.bonus} size={30} className="card__bonus" />
      </span>
      <span className="card__cost">
        {costs.map((s) => (
          <CostPip key={s} spice={s} amount={card.cost[s]} />
        ))}
      </span>
    </Tag>
  );
};

type BackProps = {
  readonly tier: Tier;
  readonly count?: number;
  readonly onClick?: () => void;
  readonly selected?: boolean;
};

export const CardBack = ({ tier, count, onClick, selected = false }: BackProps) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`card-back card-back--t${tier}${selected ? ' card-back--selected' : ''}`}
      onClick={onClick}
      aria-label={`${TIER_INFO[tier].label} deck${count === undefined ? '' : `, ${count} cards left`}`}
    >
      <span className="card-back__ornament" />
      <span className="card-back__tier">{'I'.repeat(tier)}</span>
      <span className="card-back__label">{TIER_INFO[tier].label}</span>
      {count !== undefined && <span className="card-back__count">{count}</span>}
    </Tag>
  );
};
