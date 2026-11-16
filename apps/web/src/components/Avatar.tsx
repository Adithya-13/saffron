const SEAT_COLORS = [
  'spice--saffron',
  'spice--sumac',
  'spice--cardamom',
  'spice--seal',
  'spice--pepper',
  'avatar--plum',
  'avatar--teal',
  'spice--salt',
] as const;

type Props = { readonly index: number; readonly name: string; readonly size?: number };

export const Avatar = ({ index, name, size = 36 }: Props) => (
  <span
    className={`avatar ${SEAT_COLORS[index % SEAT_COLORS.length] ?? SEAT_COLORS[0]}`}
    style={{ width: size, height: size, fontSize: size * 0.46 }}
    aria-hidden
  >
    {name.trim().charAt(0).toUpperCase()}
  </span>
);
