import type { ReactElement } from 'react';
import type { Token } from '@saffron/engine';

type Palette = {
  readonly light: string;
  readonly base: string;
  readonly dark: string;
  readonly glyph: string;
};

export const PALETTES: Readonly<Record<Token, Palette>> = {
  saffron: { light: '#ffd27a', base: '#e8962e', dark: '#9c4f12', glyph: '#5a2a07' },
  cardamom: { light: '#b8e0a0', base: '#5f9e5a', dark: '#24502c', glyph: '#f3f7e6' },
  sumac: { light: '#f08a9b', base: '#b8324a', dark: '#5f1023', glyph: '#fde9ec' },
  pepper: { light: '#8a8794', base: '#45434d', dark: '#16151b', glyph: '#e9e4f5' },
  salt: { light: '#ffffff', base: '#e6dfd2', dark: '#9d9384', glyph: '#5b5346' },
  seal: { light: '#fff0a8', base: '#d4a72c', dark: '#7a5208', glyph: '#5e3a02' },
};

const GLYPHS: Readonly<Record<Token, (color: string) => ReactElement>> = {
  saffron: (c) => (
    <g fill="none" stroke={c} strokeWidth="4.5" strokeLinecap="round">
      <path d="M50 72 C46 58 38 46 30 32" />
      <path d="M50 72 C50 56 51 42 53 27" />
      <path d="M50 72 C56 59 63 48 72 36" />
      <circle cx="30" cy="31" r="3.5" fill={c} stroke="none" />
      <circle cx="53" cy="26" r="3.5" fill={c} stroke="none" />
      <circle cx="72" cy="35" r="3.5" fill={c} stroke="none" />
    </g>
  ),
  cardamom: (c) => (
    <g fill="none" stroke={c} strokeWidth="4" strokeLinecap="round">
      <path d="M50 24 C66 34 66 66 50 76 C34 66 34 34 50 24 Z" fill={c} fillOpacity="0.22" />
      <path d="M50 28 L50 72" />
      <path d="M43 36 C41 48 41 56 43 66" />
      <path d="M57 36 C59 48 59 56 57 66" />
      <path d="M50 24 L52 18" />
    </g>
  ),
  sumac: (c) => (
    <g fill={c}>
      {[
        [50, 30],
        [40, 44],
        [60, 44],
        [32, 58],
        [50, 58],
        [68, 58],
        [42, 71],
        [58, 71],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="7" />
      ))}
    </g>
  ),
  pepper: (c) => (
    <g fill={c}>
      <circle cx="38" cy="58" r="12" />
      <circle cx="62" cy="58" r="12" />
      <circle cx="50" cy="37" r="12" />
      <g fill="#000" fillOpacity="0.25">
        <path d="M33 55 q5 -4 10 0" />
        <path d="M57 55 q5 -4 10 0" />
        <path d="M45 34 q5 -4 10 0" />
      </g>
    </g>
  ),
  salt: (c) => (
    <g fill="none" stroke={c} strokeWidth="4" strokeLinejoin="round">
      <path d="M50 22 L74 36 L74 62 L50 76 L26 62 L26 36 Z" fill={c} fillOpacity="0.12" />
      <path d="M26 36 L50 50 L74 36" />
      <path d="M50 50 L50 76" />
    </g>
  ),
  seal: (c) => (
    <g>
      <path
        d="M50 20 l7 15 16 2 -12 11 3 16 -14 -8 -14 8 3 -16 -12 -11 16 -2 Z"
        fill={c}
        fillOpacity="0.85"
      />
      <circle
        cx="50"
        cy="50"
        r="27"
        fill="none"
        stroke={c}
        strokeWidth="2.5"
        strokeDasharray="3 4"
      />
    </g>
  ),
};

type Props = { readonly token: Token; readonly size?: number; readonly className?: string };

export const SpiceIcon = ({ token, size = 40, className }: Props) => {
  const p = PALETTES[token];
  const id = `spice-${token}`;
  const isSeal = token === 'seal';
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={token}
    >
      <defs>
        <radialGradient id={`${id}-face`} cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor={p.light} />
          <stop offset="55%" stopColor={p.base} />
          <stop offset="100%" stopColor={p.dark} />
        </radialGradient>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fbe7a8" />
          <stop offset="50%" stopColor="#b8873a" />
          <stop offset="100%" stopColor="#6b4a17" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="53" r="46" fill="#000" opacity="0.35" />
      {isSeal ? (
        <path
          d="M50 4 C64 4 72 10 80 16 C90 24 96 36 95 50 C96 64 88 76 80 84 C70 92 60 96 50 95 C36 96 26 90 18 82 C8 72 4 62 5 50 C4 36 10 24 20 16 C28 9 38 4 50 4 Z"
          fill={`url(#${id}-face)`}
        />
      ) : (
        <>
          <circle cx="50" cy="50" r="46" fill={`url(#${id}-rim)`} />
          <circle cx="50" cy="50" r="39" fill={`url(#${id}-face)`} />
          <circle
            cx="50"
            cy="50"
            r="39"
            fill="none"
            stroke="#000"
            strokeOpacity="0.25"
            strokeWidth="1.5"
          />
        </>
      )}
      {GLYPHS[token](p.glyph)}
      <ellipse
        cx="36"
        cy="28"
        rx="16"
        ry="8"
        fill="#fff"
        opacity="0.28"
        transform="rotate(-25 36 28)"
      />
    </svg>
  );
};
