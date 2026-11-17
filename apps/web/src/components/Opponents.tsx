import { motion } from 'motion/react';
import { SPICE_INFO } from '@saffron/content';
import { SPICES, TOKENS, bonusesOf, totalTokens } from '@saffron/engine';
import type { RoomSnapshot } from '@saffron/protocol';
import { anchors } from '../anim/plan.ts';
import { send } from '../net/socket.ts';
import { SpiceIcon } from '../art/SpiceIcon.tsx';
import { currentOf, nameOf, seatIndex } from '../state/selectors.ts';
import { useStore } from '../state/store.ts';
import { Avatar } from './Avatar.tsx';
import { Card, CardBack } from './Card.tsx';
import { ConfirmAction } from './ConfirmAction.tsx';
import { GuildChip } from './Guilds.tsx';
import { Sheet } from './Sheet.tsx';

export const Points = ({ points, className }: { points: number; className: string }) => (
  <motion.span
    key={points}
    className={className}
    initial={{ opacity: 0.4, y: -3 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    aria-label={`${points} prestige`}
  >
    {points}
  </motion.span>
);

type StripProps = { readonly onOpen: (id: string) => void };

const MANY_PLAYERS = 4;
const BONUS_ROW_MAX_PLAYERS = 2;

const statusOf = (room: RoomSnapshot | null, id: string): 'away' | 'bot' | null => {
  if (room?.autopilot.includes(id)) return 'bot';
  return room?.seats.find((s) => s.id === id)?.connected === false ? 'away' : null;
};

export const Players = ({ onOpen }: StripProps) => {
  const view = useStore((s) => s.view);
  const room = useStore((s) => s.room);
  const seatId = useStore((s) => s.seatId);
  if (!view) return null;
  const players = view.players;
  const current = currentOf(view);
  const many = players.length >= MANY_PLAYERS;

  return (
    <section className={`opponents${many ? ' opponents--many' : ''}`} aria-label="Merchants">
      {players.map((p) => {
        const bonuses = bonusesOf(p.cards);
        const mine = p.id === seatId;
        const name = mine ? 'You' : nameOf(room, p.id);
        const active = current?.id === p.id && !view.finished;
        const status = statusOf(room, p.id);
        return (
          <button
            key={p.id}
            type="button"
            className={`opp${active ? ' opp--active' : ''}${mine ? ' opp--me' : ''}`}
            data-anchor={mine ? undefined : anchors.player(p.id)}
            onClick={() => onOpen(p.id)}
            aria-label={`${name}, ${p.points} prestige${active ? ', playing now' : ''}`}
          >
            <span className="opp__head">
              <Avatar
                index={seatIndex(room, p.id)}
                name={nameOf(room, p.id)}
                size={many ? 20 : 22}
              />
              <span className="opp__name">
                {name}
                {status && <span className="opp__away"> · {status}</span>}
              </span>
              <Points points={p.points} className="opp__points" />
            </span>
            <span className="opp__meta">
              {players.length <= BONUS_ROW_MAX_PLAYERS &&
                SPICES.map((s) => (
                  <span
                    key={s}
                    className={`mini-bonus spice--${s}${bonuses[s] === 0 ? ' mini-bonus--zero' : ''}`}
                  >
                    {bonuses[s]}
                  </span>
                ))}
              <span className="opp__extra">
                <span className="opp__tok" title="Tokens held">
                  {totalTokens(p.tokens)}
                </span>
                {p.reserved.length > 0 && (
                  <span className="opp__res" title="Reserved cards">
                    {p.reserved.length}
                  </span>
                )}
              </span>
            </span>
          </button>
        );
      })}
    </section>
  );
};

type DetailProps = { readonly playerId: string; readonly onClose: () => void };

export const PlayerDetail = ({ playerId, onClose }: DetailProps) => {
  const view = useStore((s) => s.view);
  const room = useStore((s) => s.room);
  const seatId = useStore((s) => s.seatId);
  const select = useStore((s) => s.select);
  const player = view?.players.find((p) => p.id === playerId);
  if (!player) return null;
  const canRemove =
    room?.status === 'playing' &&
    seatId !== null &&
    room.hostSeatId === seatId &&
    player.id !== seatId &&
    room.seats.find((s) => s.id === player.id)?.kind === 'human';
  const name = nameOf(room, player.id);
  const bonuses = bonusesOf(player.cards);

  return (
    <Sheet title={name} onClose={onClose}>
      <div className="pd">
        <div className="pd__head">
          <Avatar index={seatIndex(room, player.id)} name={name} size={40} />
          <span className="muted">
            {player.cards.length} cards · {totalTokens(player.tokens)}/10 tokens
          </span>
          <span className="pd__points">{player.points}</span>
        </div>
        <div>
          <p className="pd__section-title">Discounts and tokens</p>
          <div className="holdings">
            {TOKENS.map((t) => (
              <span key={t} className={`holding${player.tokens[t] === 0 ? ' holding--zero' : ''}`}>
                <span
                  className={`holding__bonus spice--${t}${t === 'seal' ? ' holding__bonus--none' : bonuses[t] === 0 ? ' holding__bonus--zero' : ''}`}
                  title={`${SPICE_INFO[t].label} discount`}
                >
                  {t === 'seal' ? '' : bonuses[t]}
                </span>
                <span className="holding__tokens">
                  <SpiceIcon token={t} size={18} className="spice-disc" />
                  {player.tokens[t]}
                </span>
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="pd__section-title">Reserved</p>
          {player.reserved.length === 0 ? (
            <p className="muted small">None</p>
          ) : (
            <div className="pd__reserve">
              {player.reserved.map((r, i) => (
                <button
                  key={`${i}-${r.card?.id ?? r.tier}`}
                  type="button"
                  className="pd__reserve-item fit"
                  onClick={() => {
                    onClose();
                    select({ kind: 'reserve', playerId: player.id, index: i });
                  }}
                  aria-label={r.card ? `View reserved card ${i + 1}` : 'Hidden reserved card'}
                >
                  {r.card ? <Card card={r.card} /> : <CardBack tier={r.tier} />}
                </button>
              ))}
            </div>
          )}
        </div>
        {player.guilds.length > 0 && (
          <div>
            <p className="pd__section-title">Guilds</p>
            <div className="pd__guilds">
              {player.guilds.map((g) => (
                <GuildChip key={g.id} guild={g} />
              ))}
            </div>
          </div>
        )}
        {canRemove && (
          <ConfirmAction
            label="Remove from game"
            prompt={`Remove ${name}? A bot takes over their stall and they can't rejoin this game.`}
            confirmLabel="Remove"
            triggerClassName="btn btn--ghost btn--small"
            onConfirm={() => {
              send({ type: 'removeSeat', seatId: player.id });
              onClose();
            }}
          />
        )}
      </div>
    </Sheet>
  );
};
