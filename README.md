# Saffron & Salt

An original spice-trading engine-builder for 2-4 players, playable online with friends in the browser. Collect spices, buy Stalls, Caravans and Fleets that give permanent discounts, win the favour of the guilds, and race to 15 prestige.

## Stack

| Path                | What                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `packages/engine`   | Pure TypeScript rules: setup, reducer (`applyMove`), legal moves, per-player hidden-info views          |
| `packages/content`  | Original deck (cost patterns rotated per spice), guilds, names                                          |
| `packages/bot`      | Heuristic bot (`chooseMove`), balance simulator, invariant property tests                               |
| `packages/protocol` | Client/server message types; zod schemas on the `./schema` entry (server only)                          |
| `apps/server`       | Cloudflare Worker + one Durable Object per room (WebSocket hibernation, alarms for bots and undo votes) |
| `apps/web`          | React + Vite client, Motion animations, Howler audio                                                    |

## Requirements

Node 22.12+ (repo pins 26 in `.node-version`; Wrangler needs 22+) and pnpm 10.

## Commands

```bash
pnpm install
pnpm dev            # build web + run worker locally at http://localhost:8787
pnpm dev:web        # Vite dev server on :5173 (proxies /api to :8787, run `pnpm dev` too)
pnpm test           # engine, content, bot and room logic tests
pnpm e2e            # Playwright: two players, undo, chat, reconnect, full game vs bot
pnpm sim 500        # bot-vs-bot balance report
pnpm typecheck && pnpm lint
pnpm deploy         # build web, deploy worker + assets to Cloudflare (needs `wrangler login`)
```

## How a room works

1. `POST /api/rooms` allocates a 5-letter code and initialises the room's Durable Object.
2. Clients open `GET /api/rooms/:code/ws`, send `join` with a name (and a stored seat token to reconnect).
3. The Durable Object holds the authoritative game state, validates every move with the engine, and broadcasts a per-player view (deck order and blind reserves stay hidden) plus the events that drive client animations.
4. Bots and undo-vote timeouts run on Durable Object alarms.

## Assets

Optimised art and audio live in `apps/web/public/assets`. Raw generations go in `assets/source/` (gitignored, large) and are processed by `pnpm assets` (cwebp + ffmpeg loudness normalisation). See `ASSETS.md` for provenance.
