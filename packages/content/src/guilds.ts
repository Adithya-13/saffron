import { SPICES, emptySpices } from '@saffron/engine';
import type { Guild, Spice } from '@saffron/engine';

const GUILD_POINTS = 3;
const PAIR_REQUIREMENT = 4;
const TRIO_REQUIREMENT = 3;

const PAIR_NAMES = [
  'Order of the Ember Thread',
  'Brotherhood of the Black Pod',
  'Wardens of the Salt Road',
  'House of the Golden Mill',
  'Company of the Green Tide',
] as const;

const TRIO_NAMES = [
  "Caravan Masters' Hall",
  'Lantern Keepers',
  'Moonlit Exchange',
  "Mapmakers' Circle",
  'Harbour Council',
] as const;

const spiceAt = (index: number): Spice => {
  const spice = SPICES[index % SPICES.length];
  if (!spice) throw new Error('Invalid spice index');
  return spice;
};

const pairGuilds: Guild[] = PAIR_NAMES.map((name, i) => ({
  id: `pair-${spiceAt(i)}-${spiceAt(i + 2)}`,
  name,
  points: GUILD_POINTS,
  requires: {
    ...emptySpices(),
    [spiceAt(i)]: PAIR_REQUIREMENT,
    [spiceAt(i + 2)]: PAIR_REQUIREMENT,
  },
}));

const trioGuilds: Guild[] = TRIO_NAMES.map((name, i) => {
  const spices = [spiceAt(i), spiceAt(i + 1), spiceAt(i + 2)];
  return {
    id: `trio-${spices.join('-')}`,
    name,
    points: GUILD_POINTS,
    requires: {
      ...emptySpices(),
      ...Object.fromEntries(spices.map((s) => [s, TRIO_REQUIREMENT])),
    },
  };
});

export const GUILDS: readonly Guild[] = [...pairGuilds, ...trioGuilds];
