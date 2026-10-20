# KO.rbit

[![DubHacks 2026 — SpaceXAI winner](https://img.shields.io/badge/DubHacks%202026-SpaceXAI%20winner-111111)](https://devpost.com/software/space-battles-aei3wz)

A browser game from DubHacks 2026: fly a catalog of real stars, planets, and spacecraft, then fight a rival with your body and a phone. **Winner of the SpaceXAI track.**

Devpost: [https://devpost.com/software/space-battles-aei3wz](https://devpost.com/software/space-battles-aei3wz)

Your laptop shows the world and tracks your pose. A paired phone is the lightsaber. The Node server owns health, stamina, hits, and the winner. Camera detections are commands, not proof of a hit.

| Main hub | Object view |
| --- | --- |
| ![Main hub: the 3D cockpit lobby](docs/images/main-hub.png) | ![Object view: a spacecraft fact card in free flight](docs/images/object-view.png) |
| Fighting | Arena |
| ![Fighting: two pilots dueling with phone sabers](docs/images/fighting.png) | ![Arena: the Mars duel with health and stamina](docs/images/arena.png) |

## What you can do

- **Explore** a local snapshot of 31,266 catalog objects: 24,835 HYG stars, 5,301 NASA exoplanets, 1,034 GALEX-atlas galaxies, the planets and the Moon, satellites (including a Starlink sample), small bodies, and seven SpaceX spacecraft. Search, fly, and open a fact card. Orbits are a dated two-body snapshot, not live tracking.
- **Commission a pilot** and sit in a 3D cockpit. Other players show up as ships you can challenge. Demo mode uses simulated pilots and does not join the server.
- **Fight** after the server accepts a challenge. It picks Mars or Neptune, 50/50, once. A short travel sequence flies you in. MediaPipe Pose on each laptop places that pilot’s body; the phone’s orientation aims the blade. Swipe the phone to step.
- **Rematch** from the result screen. The round resets and the paired devices stay paired. A pilot who drops out forfeits after a 15 second reconnect grace.

Gravity from NASA’s Planetary Fact Sheet is shown for the arena (Mars 3.7 m/s², Neptune 11.2 m/s²). It does not change saber timing. The Mars floor uses a real NASA MOLA heightmap of Jezero Crater. Neptune’s fight floor is a fictional station over procedural clouds.

LYRA, the ship copilot, can answer from live lobby and match state through Grok Voice. She cannot change the match. An opt-in Perceptron replay can recut a finished duel; upload is a second consent. Setup and limits: [`docs/hologram-copilot.md`](docs/hologram-copilot.md), [`docs/perceptron-replay.md`](docs/perceptron-replay.md).

The earlier rock-and-blaster camera duel was removed on October 18. [`PLAN.md`](PLAN.md) is the original hackathon plan and still describes that version.

## Quick start

Node 22 or newer. Two browsers, or a laptop plus a phone, for a real duel. The web dev server is HTTPS (Vite `basic-ssl`).

```bash
# Terminal 1 — game server (port 3001)
cd server && npm install && npm test && npm run dev

# Terminal 2 — web client
cd web && npm install && npm test && npm run dev
```

Open the HTTPS URL Vite prints (usually `https://localhost:5173`) and accept the self-signed certificate. Socket.IO is proxied to `127.0.0.1:3001`. `GET /health` on the server returns `ok`.

Phones need a public HTTPS page for motion sensors. With Vite running:

```bash
npx --yes cloudflared tunnel --url https://localhost:5173
```

Vite also allows ngrok hosts (`.ngrok-free.app`, `.ngrok-free.dev`, `.ngrok.io`). Scan the pair QR on the laptop; it opens `/?saber=CODE`. There is no hosted production deployment in this repo. Quick tunnels change address when restarted. Details: [`web/README.md`](web/README.md), [`docs/deployment.md`](docs/deployment.md).

### Routes

| URL | What you get |
| --- | --- |
| `/` | Onboarding, then the cockpit. Live mode is the real lobby and duel. |
| `/?saber=CODE` | Phone lightsaber controller |
| `/?explore=1` | Free-flight catalog, without the live roster |
| `/?arena=mars` | Mars scene only |
| `/?arena=neptune` | Neptune scene only |
| `/?dev=arena` | Saber arena with synthetic fighters, no camera, phone, or server |
| `/?dev=replay` | Labeled synthetic replay preview |
| `/?dev=initiation` | Setup-overlay preview with synthetic telemetry |
| `/?dev=hud` | Arena HUD preview |
| `/?audio=check` | Sound check |
| `/?journey=mars` | Mars arrival preview |
| `/?journey=neptune` | Neptune arrival preview |

### Environment variables

Public URLs only in the browser. Permanent provider keys stay on the server. Examples are safe to commit; real values are gitignored.

| Name | Where | Purpose |
| --- | --- | --- |
| `PORT` | server | Listen port, default `3001` |
| `ALLOWED_ORIGIN` | server | Comma-separated CORS origins. Default `http://localhost:5173,https://localhost:5173` |
| `XAI_API_KEY` | server | Grok Voice / speech. Loaded from the environment or ignored `server/.env.grok.local` |
| `PERCEPTRON_API_KEY` | server | Optional KO replay. See `server/.env.perceptron.example` |
| `PERCEPTRON_MODEL` | server | Optional. Default `perceptron-mk1.5` |
| `VITE_GAME_SERVER_URL` | web | Public Socket.IO origin. Blank uses this page and the Vite proxy |
| `VITE_SABER_CONTROLLER_URL` | web | Public HTTPS page for phone QR links. Blank uses this page |
| `GAME_PROXY_TARGET` | web dev | Where Vite proxies `/socket.io` and `/replay`. Default `http://127.0.0.1:3001` |

## How it is built

```text
web/       React 19, TypeScript, Vite, React Three Fiber, MediaPipe Pose
server/    Node, Socket.IO. Lobby, match rules, copilot and replay adapters
docs/      Contracts, QA, deployment, sponsor notes
datasets.md  Source and license notes for the catalogs
```

The server ticks the duel about every 33 ms and checks the blade in 10 substeps, so a fast swing cannot pass through a guard between frames. Duplicate command IDs are not applied twice.

## Team

| Name | Focus |
| --- | --- |
| Ally Chen | Cockpit, onboarding, and arena presentation |
| Justin Lee | Authoritative server, lobby, and saber combat |
| Alan Nguyen | Exploration universe and camera/body tracking |
| Alex Nguyen | LYRA voice copilot and live session integration |

The same four people are on the [Devpost submission](https://devpost.com/software/space-battles-aei3wz). Early notes called these roles A–D; those letters are historical. See [`docs/team.md`](docs/team.md).

## More detail

- Dataset licenses and what was actually imported: [`datasets.md`](datasets.md)
- Cursor sessions: [`docs/cursor-usage.md`](docs/cursor-usage.md)
- Provider limits: [`docs/sponsor-evidence.md`](docs/sponsor-evidence.md)
- Phone QA list: [`docs/qa-checklist.md`](docs/qa-checklist.md)
- Original Saturday plan: [`PLAN.md`](PLAN.md)
