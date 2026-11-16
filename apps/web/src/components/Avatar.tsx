import { SPICES } from '@saffron/engine';

const SEAT_SPICES = [SPICES[0], SPICES[2], SPICES[1], SPICES[3]] as const;

type Props = { readonly index: number; readonly name: string; readonly size?: number };

export const Avatar = ({ index, name, size = 36 }: Props) => (
  <span
    className={`avatar spice--${SEAT_SPICES[index % SEAT_SPICES.length] ?? 'saffron'}`}
    style={{ width: size, height: size, fontSize: size * 0.46 }}
    aria-hidden
  >
    {name.trim().charAt(0).toUpperCase()}
  </span>
);
