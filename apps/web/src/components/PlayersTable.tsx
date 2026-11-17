import { SPICE_INFO } from '@saffron/content';
import { SPICES, bonusesOf } from '@saffron/engine';
import { SpiceIcon } from '../art/SpiceIcon.tsx';
import { currentOf, nameOf, seatIndex } from '../state/selectors.ts';
import { useStore } from '../state/store.ts';
import { Avatar } from './Avatar.tsx';
import { Sheet } from './Sheet.tsx';

export const PlayersTable = ({ onClose }: { readonly onClose: () => void }) => {
  const view = useStore((s) => s.view);
  const room = useStore((s) => s.room);
  const seatId = useStore((s) => s.seatId);
  if (!view) return null;
  const currentId = view.finished ? null : currentOf(view)?.id;

  return (
    <Sheet title="All merchants" onClose={onClose}>
      <p className="sheet__lead small">
        Big number: discount from bought cards. Small +number: tokens in hand.
      </p>
      <div className="compare">
        <table className="compare__table">
          <thead>
            <tr>
              <th scope="col">
                <span className="visually-hidden">Merchant</span>
              </th>
              {SPICES.map((s) => (
                <th key={s} scope="col">
                  <SpiceIcon token={s} size={20} />
                  <span className="visually-hidden">{SPICE_INFO[s].label}</span>
                </th>
              ))}
              <th scope="col">
                <SpiceIcon token="seal" size={20} />
                <span className="visually-hidden">{SPICE_INFO.seal.label}</span>
              </th>
              <th scope="col">Pts</th>
            </tr>
          </thead>
          <tbody>
            {view.players.map((p) => {
              const bonuses = bonusesOf(p.cards);
              const name = p.id === seatId ? 'You' : nameOf(room, p.id);
              return (
                <tr
                  key={p.id}
                  className={`${p.id === currentId ? 'compare__row--active' : ''}${p.id === seatId ? ' compare__row--me' : ''}`}
                >
                  <th scope="row">
                    <span className="compare__who">
                      <Avatar index={seatIndex(room, p.id)} name={nameOf(room, p.id)} size={18} />
                      <span className="compare__name">{name}</span>
                    </span>
                    {p.reserved.length > 0 && (
                      <span className="compare__res">{p.reserved.length} held</span>
                    )}
                  </th>
                  {SPICES.map((s) => (
                    <td key={s} className={bonuses[s] + p.tokens[s] === 0 ? 'compare__zero' : ''}>
                      <span className="compare__disc">{bonuses[s]}</span>
                      {p.tokens[s] > 0 && <span className="compare__tok">+{p.tokens[s]}</span>}
                    </td>
                  ))}
                  <td className={p.tokens.seal === 0 ? 'compare__zero' : ''}>
                    <span className="compare__tok">{p.tokens.seal}</span>
                  </td>
                  <td className="compare__pts">{p.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Sheet>
  );
};
