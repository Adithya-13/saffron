import { motion } from 'motion/react';
import { SPICE_INFO } from '@saffron/content';
import { SPICES, TARGET_POINTS, TOKENS, bonusesOf, totalTokens } from '@saffron/engine';
import type { PlayerPublic } from '@saffron/engine';
import { anchors } from '../anim/plan.ts';
import { SpiceIcon, PALETTES } from '../art/SpiceIcon.tsx';
import { useStore } from '../state/store.ts';
import { Avatar } from './Avatar.tsx';
import { Card, CardBack } from './Card.tsx';
import { GuildTile } from './GuildTile.tsx';
import { affordable } from './Market.tsx';

type Props = {
  readonly player: PlayerPublic;
  readonly index: number;
  readonly name: string;
  readonly active: boolean;
  readonly self: boolean;
  readonly connected: boolean;
  readonly interactive?: boolean;
};

const Points = ({ points }: { points: number }) => (
  <motion.span
    key={points}
    className={`points${points >= TARGET_POINTS ? ' points--target' : ''}`}
    initial={{ scale: 1.6 }}
    animate={{ scale: 1 }}
    transition={{ type: 'spring', stiffness: 300, damping: 14 }}
    aria-label={`${points} prestige`}
  >
    {points}
  </motion.span>
);

export const PlayerPanel = ({
  player,
  index,
  name,
  active,
  self,
  connected,
  interactive = false,
}: Props) => {
  const bonuses = bonusesOf(player.cards);
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const held = totalTokens(player.tokens);

  return (
    <section
      className={`player${active ? ' player--active' : ''}${self ? ' player--self' : ''}`}
      data-anchor={anchors.player(player.id)}
      aria-label={`${name}, ${player.points} prestige`}
    >
      <header className="player__head">
        <Avatar index={index} name={name} size={self ? 40 : 32} />
        <span className="player__name">
          {name}
          {!connected && <span className="tag tag--muted">Away</span>}
        </span>
        <Points points={player.points} />
      </header>

      <div className="player__row player__bonuses" aria-label="Card discounts">
        {SPICES.map((s) => (
          <span
            key={s}
            className={`bonus${bonuses[s] === 0 ? ' bonus--zero' : ''}`}
            data-anchor={anchors.bonus(player.id, s)}
            style={{
              background: `linear-gradient(160deg, ${PALETTES[s].light}, ${PALETTES[s].base} 55%, ${PALETTES[s].dark})`,
              color: PALETTES[s].glyph,
            }}
            title={`${SPICE_INFO[s].label} discount`}
          >
            {bonuses[s]}
          </span>
        ))}
      </div>

      <div className="player__row player__tokens" aria-label={`Tokens, ${held} of 10`}>
        {TOKENS.map((t) => (
          <span
            key={t}
            className={`chip${player.tokens[t] === 0 ? ' chip--zero' : ''}`}
            data-anchor={anchors.tokens(player.id, t)}
            title={SPICE_INFO[t].label}
          >
            <SpiceIcon token={t} size={self ? 30 : 22} />
            <span className="chip__count">{player.tokens[t]}</span>
          </span>
        ))}
        <span className={`player__held${held >= 9 ? ' player__held--full' : ''}`}>{held}/10</span>
      </div>

      <div className="player__extras">
        <div
          className="player__reserve"
          data-anchor={anchors.reserve(player.id)}
          aria-label="Reserved cards"
        >
          {player.reserved.length === 0 && self && (
            <span className="muted small">No reserved cards</span>
          )}
          {player.reserved.map((r, i) => (
            <div
              key={`${i}-${r.card?.id ?? r.tier}`}
              className="player__reserved"
              data-anchor={anchors.reserveSlot(player.id, i)}
            >
              {r.card ? (
                <Card
                  card={r.card}
                  state={
                    selection?.kind === 'reserve' && selection.index === i && self
                      ? 'selected'
                      : self && affordable(player, r.card)
                        ? 'affordable'
                        : 'idle'
                  }
                  {...(interactive && self
                    ? {
                        onClick: () =>
                          select(
                            selection?.kind === 'reserve' && selection.index === i
                              ? null
                              : { kind: 'reserve', index: i },
                          ),
                      }
                    : {})}
                />
              ) : (
                <CardBack tier={r.tier} />
              )}
            </div>
          ))}
        </div>
        <div className="player__guilds" data-anchor={anchors.guilds(player.id)}>
          {player.guilds.map((g) => (
            <GuildTile key={g.id} guild={g} compact />
          ))}
        </div>
      </div>
    </section>
  );
};
