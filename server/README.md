# Authoritative game service

B initializes persistent Node/TypeScript and WebSocket tooling. Select deployment and persistence explicitly; do not run the indefinite match loop inside a short-lived serverless handler.

Game/session code validates identities, challenge state, unique command IDs, legal actions, timing and results. D owns provider adapters; they call the same command service as client buttons and never directly invent match outcomes. Keep permanent keys here, outside the browser build.

Before runtime implementation, resolve docs/contracts.md with A/C/D and publish the shared types.

## Current state (step 2)

Node + TypeScript (compiled with `tsc` to `dist/`) + Socket.IO 4.8.4. One in-memory demo match: the first two `join` requests become slots 1 and 2, others get `match_full`. Rock and block commands are implemented in `src/game/match.ts` with server-side timers for landing, block limit, wind-up and reconnect grace; every state change broadcasts a full `snapshot`. See docs/contracts.md for message shapes. Not yet: world wheel, round clock, rematch, gun/sword. Shared types live in `src/contracts.ts` until a root npm workspace is agreed with A.

## Commands (run in `server/`, verified 2026-10-17 on Node 25.6.1 / npm 11.9.0)

- `npm install`
- `npm run build` — compile `src/` to `dist/`
- `npm start` — run `dist/index.js` (loads `.env` if present)
- `npm run dev` — `tsc --watch` + `node --watch` together
- `npm test` — build, then run `dist/**/*.test.js` with `node --test`

## Environment variables

- `PORT` — listen port, default `3001`.
- `ALLOWED_ORIGIN` — comma-separated frontend origins allowed by CORS, default `http://localhost:5173,https://localhost:5173` (Vite serves the camera page over HTTPS).

`GET /health` returns `ok`.
