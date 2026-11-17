import { useStore } from '../state/store.ts';
import { Sheet } from './Sheet.tsx';

export const RulesSheet = ({ onClose }: { onClose: () => void }) => {
  const target = useStore((s) => s.view?.targetPoints);
  return (
    <Sheet title="How to trade" onClose={onClose}>
      <div className="rules">
        <p>
          Be the first merchant to reach <strong>{target ?? 15} prestige</strong>
          {target === undefined && ' (13 with 5-6 merchants, 12 with 7-8)'}. When someone does, the
          round finishes so everyone gets the same number of turns.
        </p>
        <h3>On your turn, do one thing</h3>
        <ul>
          <li>
            <strong>Take 3 different spices</strong> from the market supply. If that would put you
            over 10, you can take just enough to reach 10.
          </li>
          <li>
            <strong>Take 2 of the same spice</strong>, only if that pile has 4 or more.
          </li>
          <li>
            <strong>Reserve a card</strong> and take a Royal Seal. Seals are wild. You can hold 3
            reserved cards. Tip: tap a deck on the left of the market to reserve its top card blind,
            so others cannot see what you are building.
          </li>
          <li>
            <strong>Buy a card</strong> from the market or your reserve.
          </li>
        </ul>
        <h3>Cards build your engine</h3>
        <p>
          Every card you own gives a permanent discount of 1 of its spice. Stalls are cheap,
          Caravans start scoring, Fleets score big.
        </p>
        <h3>Guilds</h3>
        <p>
          When your cards meet a guild&apos;s requirement at the end of your turn, the guild joins
          you for 3 prestige. One guild per turn.
        </p>
        <h3>Limits</h3>
        <p>You can hold at most 10 tokens. Extra tokens go back at the end of your turn.</p>
        <h3>Bigger tables</h3>
        <p>
          With 5-8 merchants the bazaar uses two copies of every card, more spices and seals, and a
          lower prestige goal so games stay about the same length.
        </p>
      </div>
    </Sheet>
  );
};
