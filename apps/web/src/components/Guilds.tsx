import { AnimatePresence, motion } from 'motion/react';
import { SPICES } from '@saffron/engine';
import type { Guild } from '@saffron/engine';
import { anchors } from '../anim/plan.ts';
import { useStore } from '../state/store.ts';
import { CostPip } from './CostPip.tsx';
import { Sheet } from './Sheet.tsx';

export const guildArt = (guild: Pick<Guild, 'id'>): string => `/assets/guilds/${guild.id}.webp`;

const Needs = ({ guild }: { readonly guild: Guild }) => (
  <span className="guild__needs">
    {SPICES.filter((s) => guild.requires[s] > 0).map((s) => (
      <CostPip key={s} spice={s} amount={guild.requires[s]} />
    ))}
  </span>
);

type ChipProps = { readonly guild: Guild; readonly onClick?: () => void };

export const GuildChip = ({ guild, onClick }: ChipProps) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className="guild"
      onClick={onClick}
      aria-label={`${guild.name}, ${guild.points} points`}
    >
      <span className="guild__points">{guild.points}</span>
      <Needs guild={guild} />
    </Tag>
  );
};

export const GuildStrip = ({ onOpen }: { readonly onOpen: (id: string) => void }) => {
  const guilds = useStore((s) => s.view?.guilds ?? []);
  return (
    <section className="guilds" aria-label="Guilds">
      <AnimatePresence>
        {guilds.map((g) => (
          <motion.div
            key={g.id}
            layout
            data-anchor={anchors.guild(g.id)}
            exit={{ opacity: 0 }}
            style={{ flex: 1, minWidth: 0, display: 'flex' }}
          >
            <GuildChip guild={g} onClick={() => onOpen(g.id)} />
          </motion.div>
        ))}
      </AnimatePresence>
    </section>
  );
};

export const GuildDetail = ({ guildId, onClose }: { guildId: string; onClose: () => void }) => {
  const view = useStore((s) => s.view);
  const guild =
    view?.guilds.find((g) => g.id === guildId) ??
    view?.players.flatMap((p) => p.guilds).find((g) => g.id === guildId);
  if (!guild) return null;
  return (
    <Sheet title={guild.name} onClose={onClose}>
      <div className="guild-detail">
        <img className="guild-detail__art" src={guildArt(guild)} alt="" />
        <p className="sheet__lead">
          Worth {guild.points} prestige. Joins the first merchant whose bought cards give at least
          these discounts. It comes to you automatically at the end of your turn.
        </p>
        <div className="guild-detail__needs">
          {SPICES.filter((s) => guild.requires[s] > 0).map((s) => (
            <CostPip key={s} spice={s} amount={guild.requires[s]} />
          ))}
        </div>
      </div>
    </Sheet>
  );
};
