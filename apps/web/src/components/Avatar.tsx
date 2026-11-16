import { SPICES } from '@saffron/engine';
import { PALETTES } from '../art/SpiceIcon.tsx';

const SEAT_SPICES = [SPICES[0], SPICES[2], SPICES[1], SPICES[4]] as const;

type Props = { readonly index: number; readonly name: string; readonly size?: number };

export const Avatar = ({ index, name, size = 36 }: Props) => {
  const spice = SEAT_SPICES[index % SEAT_SPICES.length] ?? 'saffron';
  const p = PALETTES[spice];
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.44,
        background: `radial-gradient(circle at 35% 30%, ${p.light}, ${p.base} 60%, ${p.dark})`,
        color: p.glyph,
      }}
      aria-hidden
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
};
