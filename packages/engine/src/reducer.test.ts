import { describe, expect, it } from 'vitest';
import { emptySpices, emptyTokens, tokensFrom, totalTokens } from './counts.ts';
import { legalMoves } from './legal.ts';
import { applyMove } from './reducer.ts';
import { createGame } from './setup.ts';
import { SPICES, TIERS } from './types.ts';
import type { Card, Catalog, GameState, Guild, Move, PlayerState, Spice, Tier } from './types.ts';
import { eventFor, viewFor } from './view.ts';

const card = (
  tier: Tier,
  bonus: Spice,
  index: number,
  cost: Partial<Record<Spice, number>>,
  points = 0,
): Card => ({
  id: `${tier}-${bonus}-${index}`,
  tier,
  bonus,
  points,
  cost: { ...emptySpices(), ...cost },
});

const guild = (id: string, requires: Partial<Record<Spice, number>>): Guild => ({
  id,
  name: id,
  points: 3,
  requires: { ...emptySpices(), ...requires },
});

const catalog: Catalog = {
  cards: TIERS.flatMap((tier) =>
    SPICES.flatMap((bonus) => [0, 1].map((i) => card(tier, bonus, i, { saffron: tier }, tier))),
  ),
  reprint: TIERS.flatMap((tier) =>
    SPICES.flatMap((bonus) => [2, 3].map((i) => card(tier, bonus, i, { cardamom: tier }, tier))),
  ),
  guilds: [
    guild('g1', { saffron: 1 }),
    guild('g2', { cardamom: 1 }),
    guild('g3', { sumac: 9 }),
    guild('g4', { salt: 9 }),
    guild('g5', { pepper: 9 }),
  ],
};

const start = (players = 2): GameState =>
  createGame(catalog, ['a', 'b', 'c', 'd'].slice(0, players), 1);

const patchPlayer = (state: GameState, index: number, patch: Partial<PlayerState>): GameState => ({
  ...state,
  players: state.players.map((p, i) => (i === index ? { ...p, ...patch } : p)),
});

const play = (state: GameState, playerId: string, move: Move): GameState => {
  const result = applyMove(state, playerId, move);
  if (!result.ok) throw new Error(result.error);
  return result.state;
};

describe('setup', () => {
  it('deals 4 per tier and sizes supply and guilds by player count', () => {
    const state = start(3);
    for (const tier of TIERS) expect(state.market[tier]).toHaveLength(4);
    expect(state.supply.saffron).toBe(5);
    expect(state.supply.seal).toBe(5);
    expect(state.guilds).toHaveLength(4);
  });

  it('scales the table for eight players', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const state = createGame(catalog, ids, 1);
    const dealt = TIERS.reduce((sum, t) => sum + state.decks[t].length + state.market[t].length, 0);
    expect(dealt).toBe(catalog.cards.length * 2);
    expect(new Set(TIERS.flatMap((t) => state.decks[t].map((c) => c.id))).size).toBe(
      TIERS.reduce((sum, t) => sum + state.decks[t].length, 0),
    );
    expect(state.supply.saffron).toBe(11);
    expect(state.supply.seal).toBe(8);
    expect(state.targetPoints).toBe(12);
  });

  it('keeps classic targets up to four players', () => {
    expect(start(4).targetPoints).toBe(15);
  });

  it('rejects bad player counts', () => {
    expect(() => createGame(catalog, ['a'], 1)).toThrow();
    expect(() => createGame(catalog, ['a', 'a'], 1)).toThrow();
    expect(() => createGame(catalog, 'abcdefghi'.split(''), 1)).toThrow();
  });
});

describe('taking tokens', () => {
  it('takes three distinct and passes the turn', () => {
    const next = play(start(), 'a', {
      type: 'takeDistinct',
      spices: ['saffron', 'cardamom', 'sumac'],
    });
    expect(next.players[0]?.tokens.saffron).toBe(1);
    expect(next.supply.saffron).toBe(3);
    expect(next.currentPlayer).toBe(1);
  });

  it('rejects duplicates, wrong counts and out-of-turn moves', () => {
    const state = start();
    expect(
      applyMove(state, 'a', { type: 'takeDistinct', spices: ['saffron', 'saffron', 'sumac'] }),
    ).toEqual({ ok: false, error: 'invalidTokens' });
    expect(applyMove(state, 'a', { type: 'takeDistinct', spices: ['saffron'] })).toEqual({
      ok: false,
      error: 'invalidTokens',
    });
    expect(applyMove(state, 'b', { type: 'takeDouble', spice: 'salt' })).toEqual({
      ok: false,
      error: 'notYourTurn',
    });
  });

  it('allows fewer distinct only when fewer spices remain', () => {
    const state = { ...start(), supply: tokensFrom({ saffron: 2, seal: 5 }) };
    expect(applyMove(state, 'a', { type: 'takeDistinct', spices: ['saffron'] }).ok).toBe(true);
  });

  it('allows taking just enough to reach 10 tokens', () => {
    const base = start();
    const nearFull = (held: number): GameState =>
      patchPlayer(base, 0, { tokens: tokensFrom({ pepper: held }) });
    expect(applyMove(nearFull(9), 'a', { type: 'takeDistinct', spices: ['saffron'] }).ok).toBe(
      true,
    );
    expect(
      applyMove(nearFull(8), 'a', { type: 'takeDistinct', spices: ['saffron', 'sumac'] }).ok,
    ).toBe(true);
    expect(applyMove(nearFull(8), 'a', { type: 'takeDistinct', spices: ['saffron'] })).toEqual({
      ok: false,
      error: 'invalidTokens',
    });
    expect(
      applyMove(nearFull(9), 'a', {
        type: 'takeDistinct',
        spices: ['saffron', 'cardamom', 'sumac'],
      }).ok,
    ).toBe(true);
    expect(applyMove(nearFull(10), 'a', { type: 'takeDistinct', spices: ['saffron'] }).ok).toBe(
      false,
    );
  });

  it('takes a double only from a pile of 4 or more', () => {
    const state = start();
    expect(
      play(state, 'a', { type: 'takeDouble', spice: 'pepper' }).players[0]?.tokens.pepper,
    ).toBe(2);
    const low = { ...state, supply: { ...state.supply, pepper: 3 } };
    expect(applyMove(low, 'a', { type: 'takeDouble', spice: 'pepper' })).toEqual({
      ok: false,
      error: 'pileTooSmall',
    });
  });

  it('forces a discard above 10 tokens and returns them to supply', () => {
    const state = patchPlayer(start(), 0, { tokens: tokensFrom({ salt: 4, pepper: 5 }) });
    const over = play(state, 'a', {
      type: 'takeDistinct',
      spices: ['saffron', 'cardamom', 'sumac'],
    });
    expect(over.phase).toEqual({ kind: 'discard', excess: 2 });
    expect(applyMove(over, 'a', { type: 'takeDouble', spice: 'salt' })).toEqual({
      ok: false,
      error: 'wrongPhase',
    });
    expect(applyMove(over, 'a', { type: 'discard', tokens: { salt: 1 } })).toEqual({
      ok: false,
      error: 'invalidDiscard',
    });
    const done = play(over, 'a', { type: 'discard', tokens: { pepper: 2 } });
    expect(totalTokens(done.players[0]?.tokens ?? emptyTokens())).toBe(10);
    expect(done.supply.pepper).toBe(6);
    expect(done.currentPlayer).toBe(1);
  });
});

describe('reserving', () => {
  it('reserves from market, takes a seal and refills', () => {
    const state = start();
    const target = state.market[2][1];
    const next = play(state, 'a', {
      type: 'reserve',
      source: { kind: 'market', tier: 2, slot: 1 },
    });
    expect(next.players[0]?.reserved[0]?.card).toEqual(target);
    expect(next.players[0]?.tokens.seal).toBe(1);
    expect(next.market[2][1]).toEqual(state.decks[2][0]);
    expect(next.decks[2]).toHaveLength(state.decks[2].length - 1);
  });

  it('reserves blind from a deck and hides it from others', () => {
    const state = start();
    const result = applyMove(state, 'a', { type: 'reserve', source: { kind: 'deck', tier: 3 } });
    if (!result.ok) throw new Error(result.error);
    expect(result.state.players[0]?.reserved[0]?.hidden).toBe(true);
    expect(viewFor(result.state, 'b').players[0]?.reserved[0]?.card).toBeNull();
    expect(viewFor(result.state, 'a').players[0]?.reserved[0]?.card).not.toBeNull();
    const reservedEvent = result.events.find((e) => e.type === 'cardReserved');
    if (!reservedEvent) throw new Error('missing event');
    expect(eventFor(reservedEvent, 'b')).toMatchObject({ card: null, tier: 3 });
  });

  it('caps reserves at 3 and still reserves without seals', () => {
    const full = patchPlayer(start(), 0, {
      reserved: [0, 1, 2].map(() => ({ card: catalog.cards[0] as Card, hidden: false })),
    });
    expect(applyMove(full, 'a', { type: 'reserve', source: { kind: 'deck', tier: 1 } })).toEqual({
      ok: false,
      error: 'reserveFull',
    });
    const noSeals = { ...start(), supply: { ...start().supply, seal: 0 } };
    expect(
      play(noSeals, 'a', { type: 'reserve', source: { kind: 'deck', tier: 1 } }).players[0]?.tokens
        .seal,
    ).toBe(0);
  });
});

describe('buying', () => {
  it('applies bonuses, then spices, then seals as wild', () => {
    const base = start();
    const target = base.market[3][0] as Card;
    const state = patchPlayer(base, 0, {
      cards: [card(1, 'saffron', 9, {})],
      tokens: tokensFrom({ saffron: 1, seal: 1 }),
    });
    const next = play(state, 'a', { type: 'buy', source: { kind: 'market', tier: 3, slot: 0 } });
    expect(target.cost.saffron).toBe(3);
    expect(next.players[0]?.tokens).toEqual(emptyTokens());
    expect(next.supply.saffron).toBe(base.supply.saffron + 1);
    expect(next.supply.seal).toBe(base.supply.seal + 1);
    expect(next.players[0]?.cards).toContainEqual(target);
  });

  it('rejects unaffordable cards and buys from reserve', () => {
    const base = start();
    expect(
      applyMove(base, 'a', { type: 'buy', source: { kind: 'market', tier: 1, slot: 0 } }),
    ).toEqual({ ok: false, error: 'cannotAfford' });
    const reservedCard = catalog.cards[0] as Card;
    const state = patchPlayer(base, 0, {
      reserved: [{ card: reservedCard, hidden: true }],
      tokens: tokensFrom({ saffron: 1 }),
    });
    const next = play(state, 'a', { type: 'buy', source: { kind: 'reserve', index: 0 } });
    expect(next.players[0]?.reserved).toHaveLength(0);
    expect(next.players[0]?.cards).toContainEqual(reservedCard);
  });
});

describe('guilds', () => {
  const withBonuses = (state: GameState, bonuses: Spice[]): GameState =>
    patchPlayer(state, 0, { cards: bonuses.map((b, i) => card(1, b, 100 + i, {})) });

  it('auto-claims a single eligible guild', () => {
    const base = { ...start(), guilds: [guild('g1', { saffron: 1 }), guild('g3', { sumac: 9 })] };
    const next = play(withBonuses(base, ['saffron']), 'a', { type: 'takeDouble', spice: 'salt' });
    expect(next.players[0]?.guilds.map((g) => g.id)).toEqual(['g1']);
    expect(next.guilds.map((g) => g.id)).toEqual(['g3']);
  });

  it('asks the player to choose between several and claims only one', () => {
    const base = {
      ...start(),
      guilds: [guild('g1', { saffron: 1 }), guild('g2', { cardamom: 1 })],
    };
    const pending = play(withBonuses(base, ['saffron', 'cardamom']), 'a', {
      type: 'takeDouble',
      spice: 'salt',
    });
    expect(pending.phase).toEqual({ kind: 'guild', options: ['g1', 'g2'] });
    expect(legalMoves(pending, 'a')).toHaveLength(2);
    expect(applyMove(pending, 'a', { type: 'chooseGuild', guildId: 'g9' })).toEqual({
      ok: false,
      error: 'invalidGuild',
    });
    const next = play(pending, 'a', { type: 'chooseGuild', guildId: 'g2' });
    expect(next.players[0]?.guilds.map((g) => g.id)).toEqual(['g2']);
    expect(next.currentPlayer).toBe(1);
  });
});

describe('end of game', () => {
  it('finishes the round after someone reaches 15 and ranks by points then fewest cards', () => {
    const tall = Array.from({ length: 5 }, (_, i) => card(3, 'salt', 200 + i, {}, 3));
    const base = patchPlayer(start(3), 1, { cards: tall });
    const afterA = play(base, 'a', { type: 'takeDouble', spice: 'salt' });
    expect(afterA.finalRound).toBe(false);
    const afterB = applyMove(afterA, 'b', { type: 'takeDouble', spice: 'pepper' });
    if (!afterB.ok) throw new Error(afterB.error);
    expect(afterB.state.finalRound).toBe(true);
    expect(afterB.state.finished).toBe(false);
    const leveled = patchPlayer(afterB.state, 2, {
      cards: Array.from({ length: 3 }, (_, i) => card(3, 'salt', 300 + i, {}, 5)),
    });
    const end = applyMove(leveled, 'c', { type: 'takeDouble', spice: 'sumac' });
    if (!end.ok) throw new Error(end.error);
    expect(end.state.finished).toBe(true);
    expect(end.events.at(-1)).toEqual({ type: 'gameEnded', winners: ['c'] });
    expect(applyMove(end.state, 'a', { type: 'pass' })).toEqual({
      ok: false,
      error: 'gameFinished',
    });
  });
});

describe('pass', () => {
  it('is only legal when nothing else is', () => {
    expect(applyMove(start(), 'a', { type: 'pass' })).toEqual({
      ok: false,
      error: 'passNotAllowed',
    });
    const stuck: GameState = patchPlayer(
      {
        ...start(),
        supply: emptyTokens(),
        decks: { 1: [], 2: [], 3: [] },
        market: {
          1: [null, null, null, null],
          2: [null, null, null, null],
          3: [null, null, null, null],
        },
      },
      0,
      {},
    );
    expect(legalMoves(stuck, 'a')).toEqual([{ type: 'pass' }]);
    expect(play(stuck, 'a', { type: 'pass' }).currentPlayer).toBe(1);
  });
});
