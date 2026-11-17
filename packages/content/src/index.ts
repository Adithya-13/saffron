import type { Catalog } from '@saffron/engine';
import { CARDS, REPRINT } from './deck.ts';
import { GUILDS } from './guilds.ts';

export { CARDS, PATTERNS, REPRINT, REPRINT_PATTERNS, buildDeck } from './deck.ts';
export type { CostPattern } from './deck.ts';
export { GUILDS } from './guilds.ts';
export { SPICE_INFO, TIER_INFO, GAME_NAME } from './names.ts';

export const CATALOG: Catalog = { cards: CARDS, reprint: REPRINT, guilds: GUILDS };
