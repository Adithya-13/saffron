import type { Spice } from '@saffron/engine';
import { PALETTES } from '../art/SpiceIcon.tsx';

type Props = { readonly spice: Spice; readonly amount: number; readonly met?: boolean };

export const CostPip = ({ spice, amount, met }: Props) => {
  const p = PALETTES[spice];
  return (
    <span
      className={`pip${met ? ' pip--met' : ''}`}
      style={{
        background: `radial-gradient(circle at 35% 30%, ${p.light}, ${p.base} 55%, ${p.dark})`,
        color: p.glyph,
      }}
      aria-label={`${amount} ${spice}`}
    >
      {amount}
    </span>
  );
};
