import { SPICES } from '@saffron/engine';
import type { Guild } from '@saffron/engine';
import { CostPip } from './CostPip.tsx';

type Props = {
  readonly guild: Guild;
  readonly compact?: boolean;
  readonly onClick?: () => void;
  readonly highlight?: boolean;
};

export const GuildTile = ({ guild, compact = false, onClick, highlight = false }: Props) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`guild${compact ? ' guild--compact' : ''}${highlight ? ' guild--highlight' : ''}`}
      onClick={onClick}
      title={guild.name}
      aria-label={`${guild.name}, ${guild.points} points`}
    >
      <span
        className="guild__art"
        style={{ backgroundImage: `url(/assets/guilds/${guild.id}.webp)` }}
      />
      <span className="guild__points">{guild.points}</span>
      {!compact && (
        <>
          <span className="guild__needs">
            {SPICES.filter((s) => guild.requires[s] > 0).map((s) => (
              <CostPip key={s} spice={s} amount={guild.requires[s]} />
            ))}
          </span>
          <span className="guild__name">{guild.name}</span>
        </>
      )}
    </Tag>
  );
};
