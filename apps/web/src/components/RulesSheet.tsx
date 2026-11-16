import { TARGET_POINTS } from '@saffron/engine';
import { Sheet } from './Sheet.tsx';

export const RulesSheet = ({ onClose }: { onClose: () => void }) => (
  <Sheet title="How to trade" onClose={onClose}>
    <div className="rules">
      <p>
        Be the first merchant to reach <strong>{TARGET_POINTS} prestige</strong>. When someone does,
        the round finishes so everyone gets the same number of turns.
      </p>
      <h3>On your turn, do one thing</h3>
      <ul>
        <li>
          <strong>Take 3 different spices</strong> from the market supply.
        </li>
        <li>
          <strong>Take 2 of the same spice</strong>, only if that pile has 4 or more.
        </li>
        <li>
          <strong>Reserve a card</strong> (face up, or blind from a deck) and take a Royal Seal.
          Seals are wild. You can hold 3 reserved cards.
        </li>
        <li>
          <strong>Buy a card</strong> from the market or your reserve.
        </li>
      </ul>
      <h3>Cards build your engine</h3>
      <p>
        Every card you own gives a permanent discount of 1 of its spice. Stalls are cheap, Caravans
        start scoring, Fleets score big.
      </p>
      <h3>Guilds</h3>
      <p>
        When your cards meet a guild&apos;s requirement at the end of your turn, the guild joins you
        for 3 prestige. One guild per turn.
      </p>
      <h3>Limits</h3>
      <p>You can hold at most 10 tokens. Extra tokens go back at the end of your turn.</p>
    </div>
  </Sheet>
);
