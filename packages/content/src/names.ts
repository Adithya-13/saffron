import type { Tier, Token } from '@saffron/engine';

export const GAME_NAME = 'Saffron & Salt';

export const SPICE_INFO: Readonly<
  Record<Token, { readonly label: string; readonly color: string }>
> = {
  saffron: { label: 'Saffron', color: '#e8a33d' },
  cardamom: { label: 'Cardamom', color: '#5f9e5a' },
  sumac: { label: 'Sumac', color: '#b8324a' },
  pepper: { label: 'Pepper', color: '#3b3a40' },
  salt: { label: 'Salt', color: '#ece6da' },
  seal: { label: 'Royal Seal', color: '#2f5d8c' },
};

export const TIER_INFO: Readonly<Record<Tier, { readonly label: string }>> = {
  1: { label: 'Stalls' },
  2: { label: 'Caravans' },
  3: { label: 'Fleets' },
};
