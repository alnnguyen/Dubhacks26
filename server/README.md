# Authoritative game service

Node + TypeScript, compiled with `tsc` to `dist/`, and Socket.IO 4.8.4. One in-memory lobby: pilots join a shared demo room, challenge each other, and an accepted challenge starts a match. Nothing here is written to a database. Restarting the process clears the room.

The server picks the arena once, when the challenge is accepted: Mars or Neptune, equally likely (`pickArenaWorld` in `src/sessions/index.ts`). It owns health, stamina, attack timing, the countdown, and the winner. Camera and phone samples are inputs, not proof of a hit. Duplicate command IDs are not applied twice.

Combat on `main` is the lightsaber duel (`src/game/saber3d.ts`, `src/game/match.ts`). Rock, gun, and sword commands are gone; `src/game/match.test.ts` checks that `throwRock`, `fireGun`, and `startBlock` are rejected. Rematch is implemented: both pilots request it, the round resets, and paired devices stay paired. Each round counts down for 3 seconds once both pilots are set up. There is no separate shrinking round clock and no Earth/Moon world wheel. A disconnected pilot forfeits after a 15 second reconnect grace.

Shared message types live in `src/contracts.ts`. Provider adapters under `src/integrations/` use the same command path and do not invent match results. Permanent provider keys stay in ignored server env files, outside the browser build.

## Commands (run in `server/`)

- `npm install`
- `npm run build` — compile `src/` to `dist/`
- `npm start` — run `dist/index.js` (loads `.env` if present)
- `npm run dev` — `tsc --watch` and `node --watch` together
- `npm test` — build, then run `dist/**/*.test.js` with `node --test`

Requires Node 22 or newer (`engines` in `package.json`).

## Environment variables

- `PORT` — listen port, default `3001`.
- `ALLOWED_ORIGIN` — comma-separated frontend origins allowed by CORS, default `http://localhost:5173,https://localhost:5173`.
- `XAI_API_KEY` — optional Grok Voice / speech key. If it is unset, `src/index.ts` loads ignored `server/.env.grok.local` when that file exists. Template: `.env.grok.local.example`.
- `PERCEPTRON_API_KEY` — optional KO-replay key, in ignored `server/.env`. Template: `.env.perceptron.example`.
- `PERCEPTRON_MODEL` — optional, default `perceptron-mk1.5`.

`GET /health` returns `ok`.

Local run and phone sharing are described in the root `README.md` and `docs/deployment.md`. This package does not deploy itself.
