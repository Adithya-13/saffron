import type { Spice } from '@saffron/engine';

type Props = { readonly spice: Spice; readonly amount: number };

export const CostPip = ({ spice, amount }: Props) => (
  <span className={`pip spice--${spice}`} aria-label={`${amount} ${spice}`}>
    {amount}
  </span>
);
