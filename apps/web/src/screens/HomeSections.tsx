import type { ReactNode } from 'react';
import { CATALOG } from '@saffron/content';
import { SPICES } from '@saffron/engine';
import type { Card as CardData, Guild, Spice, Tier } from '@saffron/engine';
import { SpiceIcon } from '../art/SpiceIcon.tsx';
import { Card } from '../components/Card.tsx';
import { CostPip } from '../components/CostPip.tsx';
import { guildArt } from '../components/Guilds.tsx';

const sampleCard = (tier: Tier, bonus: Spice): CardData | undefined =>
  CATALOG.cards
    .filter((c) => c.tier === tier && c.bonus === bonus)
    .sort((a, b) => b.points - a.points)[0];

const isCard = (card: CardData | undefined): card is CardData => card !== undefined;

const TIER_SAMPLES: readonly CardData[] = [
  sampleCard(1, 'saffron'),
  sampleCard(2, 'cardamom'),
  sampleCard(3, 'sumac'),
].filter(isCard);

const BUY_SAMPLE = sampleCard(1, 'salt');

const FEATURED_GUILD_IDS: readonly string[] = [
  'pair-saffron-sumac',
  'trio-pepper-salt-saffron',
  'pair-salt-cardamom',
];

const GUILD_PLATE_NUMERALS: readonly string[] = ['III', 'IV', 'V'];

const FEATURED_GUILDS: readonly Guild[] = FEATURED_GUILD_IDS.map((id) =>
  CATALOG.guilds.find((g) => g.id === id),
).filter((g): g is Guild => g !== undefined);

type PlateProps = {
  readonly numeral: string;
  readonly caption: string;
  readonly className?: string;
  readonly children: ReactNode;
};

export const Plate = ({ numeral, caption, className, children }: PlateProps) => (
  <figure className={`plate ${className ?? ''}`}>
    {children}
    <figcaption className="plate__caption">
      <span className="plate__numeral">Plate {numeral}.</span> {caption}
    </figcaption>
  </figure>
);

type Action = {
  readonly title: string;
  readonly text: string;
  readonly art: ReactNode;
};

const spiceRow = (spices: readonly Spice[]) =>
  spices.map((s, i) => <SpiceIcon key={`${s}-${i}`} token={s} size={30} className="spice-disc" />);

const ACTIONS: readonly Action[] = [
  {
    title: 'Take three different spices',
    text: 'One each from three piles in the market.',
    art: spiceRow(['saffron', 'cardamom', 'sumac']),
  },
  {
    title: 'Take two of the same',
    text: 'Only from a pile that still has four or more.',
    art: spiceRow(['pepper', 'pepper']),
  },
  {
    title: 'Reserve a card',
    text: 'Hold it for later and take a Royal Seal. Seals count as any spice.',
    art: <SpiceIcon token="seal" size={30} className="spice-disc" />,
  },
  {
    title: 'Buy a card',
    text: 'Pay its cost. From then on, its spice is a discount on every card you buy.',
    art: BUY_SAMPLE ? <Card card={BUY_SAMPLE} /> : null,
  },
];

export const TurnSection = () => (
  <section className="landing__section turn" aria-labelledby="turn-title">
    <h2 id="turn-title" className="landing__heading">
      On your turn, do one thing
    </h2>
    <ul className="turn__list">
      {ACTIONS.map((a) => (
        <li key={a.title} className="turn__item">
          <span className="turn__art" aria-hidden>
            {a.art}
          </span>
          <div>
            <h3 className="turn__title">{a.title}</h3>
            <p className="turn__text">{a.text}</p>
          </div>
        </li>
      ))}
    </ul>
  </section>
);

export const TierSection = () => (
  <section className="landing__section tiers" aria-labelledby="tiers-title">
    <div className="tiers__copy">
      <h2 id="tiers-title" className="landing__heading">
        Stalls, then caravans, then fleets
      </h2>
      <p className="landing__lead">
        Every card you buy is a discount that never runs out. Cheap stalls make caravans cheaper,
        caravans bring the fleets within reach, and fleets carry the big prestige.
      </p>
    </div>
    <Plate numeral="II" caption="A stall, a caravan and a fleet." className="tiers__plate">
      <span className="tiers__fan">
        {TIER_SAMPLES.map((card) => (
          <span key={card.id} className="tiers__card">
            <Card card={card} />
          </span>
        ))}
      </span>
    </Plate>
  </section>
);

const GuildNeeds = ({ guild }: { readonly guild: Guild }) => (
  <span className="guild-plate__needs">
    {SPICES.filter((s) => guild.requires[s] > 0).map((s) => (
      <CostPip key={s} spice={s} amount={guild.requires[s]} />
    ))}
  </span>
);

export const GuildSection = () => (
  <section className="landing__section guild-section" aria-labelledby="guild-title">
    <div className="guild-section__copy">
      <h2 id="guild-title" className="landing__heading">
        The guilds come to you
      </h2>
      <p className="landing__lead">
        Each guild wants a set of cards, like four saffron and four sumac. Own them at the end of
        your turn and the guild joins you for 3 prestige. One guild per turn.
      </p>
    </div>
    <ul className="guild-section__list">
      {FEATURED_GUILDS.map((g, i) => (
        <li key={g.id}>
          <Plate numeral={GUILD_PLATE_NUMERALS[i] ?? ''} caption={g.name} className="guild-plate">
            <img className="guild-plate__art" src={guildArt(g)} alt="" loading="lazy" />
            <GuildNeeds guild={g} />
          </Plate>
        </li>
      ))}
    </ul>
  </section>
);

export const GoalSection = ({ onRules }: { readonly onRules: () => void }) => (
  <section className="landing__section goal" aria-labelledby="goal-title">
    <p className="goal__number" aria-hidden>
      15
    </p>
    <div>
      <h2 id="goal-title" className="landing__heading">
        First to 15 prestige
      </h2>
      <p className="landing__lead">
        With 5 or 6 merchants the goal is 13, with 7 or 8 it is 12. The round always finishes, so
        everyone gets the same number of turns.
      </p>
      <span className="goal__links">
        <button className="link-btn" type="button" onClick={onRules}>
          Read the full rules
        </button>
        <a className="link-btn" href="#play">
          Take a seat
        </a>
      </span>
    </div>
  </section>
);
