import { useState } from 'react';
import { SPICE_INFO } from '@saffron/content';
import { TOKENS, tokensFrom, totalTokens } from '@saffron/engine';
import type { PlayerPublic, Token } from '@saffron/engine';
import { SpiceIcon } from '../art/SpiceIcon.tsx';
import { send } from '../net/socket.ts';
import { useStore } from '../state/store.ts';
import { GuildTile } from './GuildTile.tsx';
import { Sheet } from './Sheet.tsx';

const DiscardSheet = ({ me, excess }: { me: PlayerPublic; excess: number }) => {
  const [chosen, setChosen] = useState<Partial<Record<Token, number>>>({});
  const total = totalTokens(tokensFrom(chosen));
  const adjust = (t: Token, delta: number) => {
    const next = Math.min(Math.max((chosen[t] ?? 0) + delta, 0), me.tokens[t]);
    if (delta > 0 && total >= excess) return;
    setChosen({ ...chosen, [t]: next });
  };
  return (
    <Sheet title="Your pack is too heavy">
      <p className="sheet__lead">
        You can carry 10 tokens. Return {excess} to the supply. ({total}/{excess} chosen)
      </p>
      <div className="discard">
        {TOKENS.filter((t) => me.tokens[t] > 0).map((t) => (
          <div key={t} className="discard__row">
            <SpiceIcon token={t} size={36} />
            <span className="discard__label">
              {SPICE_INFO[t].label} <span className="muted">({me.tokens[t]})</span>
            </span>
            <button
              className="icon-btn"
              type="button"
              onClick={() => adjust(t, -1)}
              aria-label={`Keep one ${t}`}
            >
              −
            </button>
            <span className="discard__count">{chosen[t] ?? 0}</span>
            <button
              className="icon-btn"
              type="button"
              onClick={() => adjust(t, 1)}
              aria-label={`Return one ${t}`}
            >
              +
            </button>
          </div>
        ))}
      </div>
      <button
        className="btn btn--primary btn--wide"
        type="button"
        disabled={total !== excess}
        onClick={() => send({ type: 'move', move: { type: 'discard', tokens: chosen } })}
      >
        Return tokens
      </button>
    </Sheet>
  );
};

const GuildSheet = ({ options }: { options: readonly string[] }) => {
  const guilds = useStore((s) => s.view?.guilds ?? []);
  return (
    <Sheet title="Two guilds want you">
      <p className="sheet__lead">Only one can join you this turn. Choose wisely.</p>
      <div className="guild-choice">
        {guilds
          .filter((g) => options.includes(g.id))
          .map((g) => (
            <GuildTile
              key={g.id}
              guild={g}
              highlight
              onClick={() => send({ type: 'move', move: { type: 'chooseGuild', guildId: g.id } })}
            />
          ))}
      </div>
    </Sheet>
  );
};

export const PhaseSheets = ({ me, myTurn }: { me: PlayerPublic | null; myTurn: boolean }) => {
  const phase = useStore((s) => s.view?.phase);
  if (!myTurn || !me || !phase) return null;
  if (phase.kind === 'discard') return <DiscardSheet me={me} excess={phase.excess} />;
  if (phase.kind === 'guild') return <GuildSheet options={phase.options} />;
  return null;
};
