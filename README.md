# KO.rbit

**DubHacks 2026** · Two phones. One cockpit. A camera duel shaped by real planetary gravity.

You’re a pilot in a 3D spaceship lobby. Other players appear as ships outside the windshield. Challenge a rival, accept the alert, jump through hyperspace, and fight on a Mars arena with hand-tracked rocks and blasters — while **LYRA**, your Grok-powered ship AI, briefs you from live match state.

Built for mobile HTTPS browsers. Server-authoritative combat. No native app, no ARKit room scan, no GPS conquest.

---

## Tracks we’re aiming for

| Track | Why it fits |
| --- | --- |
| **SpaceXAI (primary)** | Heavy **Cursor** development (logged in [`docs/cursor-usage.md`](docs/cursor-usage.md)); **Grok Voice / API** powering **LYRA** and world briefings; **NASA / planetary datasets** driving arena timing and presentation; **Grok Bot** used as a planning collaborator for roles, infrastructure cut order, and the living [`PLAN.md`](PLAN.md). |
| **Chef’s Choice** | End-to-end creative loop: cinematic onboarding → cockpit → challenge → gravity-aware camera duel → result. |
| **Photon 2.0** | Real channel send/reply proofs and challenge-agent fixtures ([`docs/sponsor-evidence.md`](docs/sponsor-evidence.md)); live ACCEPT path wired toward the same server commands as the UI. |

Detailed proofs, limits, and what is / isn’t claimed live in [`docs/sponsor-evidence.md`](docs/sponsor-evidence.md). Cursor sessions: [`docs/cursor-usage.md`](docs/cursor-usage.md). Dataset provenance: [`datasets.md`](datasets.md).

---

## Features

### Pilot onboarding
- Motion-driven intro with Orbitron title cards, laser transitions, and a Three.js hyperspace jump into the cockpit
- Callsign + ship name + hull accent stored locally for HUD cosmetics

### Spaceship cockpit lobby
- Ally’s 3D bridge with selectable rival ships and holographic panels
- Phone orientation “turn to look” through the windshield
- Server-backed lobby when running **FlightApp** (challenge / accept / decline / ready)

### LYRA — ship AI (Grok)
- In-cockpit hologram copilot with typed questions and optional mic
- **Grok Voice** session; permanent keys stay on the server; browser gets short-lived secrets
- Read-only `getFlightState` tool — LYRA can recommend pilots from the **live lobby/match**, not invent combat results
- Demo mode clearly labeled when falling back to a local guide

### Authoritative multiplayer
- Justin’s Socket.IO match + lobby: join, callsign, challenge, accept, server-picked world, ready → active → finished
- Rock + gun weapons, block windows, cooldowns, reconnect grace, projectile landing events
- Clients use `createGameClient` — command IDs and validation stay server-side

### Perceptron replay highlights
- Opt in during saber setup to record up to 45 seconds of silent webcam footage locally; upload consent is separate on the result screen.
- Perceptron selects intervals/captions and tracks player boxes; browser playback adds cuts, slow motion and reframing. Original video can be saved locally.
- Cinematic arena replay adds orbit/low/overhead shots, continuous recorded movement, speed ramps, sparks and impact holds. The captured server knockout is always the final scene, separately credited from Perceptron's earlier selections. `/?dev=replay` is a labeled synthetic preview.
- Real synthetic-WebM clip/track API proof passed; a complete recorded duel and phone-browser QA remain pending. Setup and limits: [`docs/perceptron-replay.md`](docs/perceptron-replay.md).

### Camera duel (Alan)
- Rear-camera MediaPipe hand + pose; hand lock so rival hands don’t steal your gestures
- Rock: palm charge → fist grab → fling / release → server `throwRock`
- Gun: fist cock → index+middle fire → `fireGun`, with 3D blaster GLB + tracers
- Touch backups for throw / fire / block

### Mars arena (Ally)
- Immersive Jezero-style terrain from **NASA MOLA**-derived height data
- Opponent cutout / multi-person detection for an “across the dust” duel feel
- Phone tilt look-around; dust, rocks, sky treatment
- Dev route for tuning without a full match (`/?arena=mars`)

### Real space data in gameplay
- **NASA Planetary Fact Sheet** gravity (e.g. Mars **3.7 m/s²**) is shown for each world; it does not yet change saber combat
- Arena and briefing copy grounded in provenance docs (`datasets.md`, arena attributions under `web/public/arena/mars/`)
- Research backlog for windshield ephemeris, star maps, and space weather chips when we have bandwidth

---

## Player journey

1. **Onboard** — commission callsign / ship, hyperspace into the bridge  
2. **Lobby** — see other pilots; challenge from the cockpit  
3. **Accept** — defender gets the alert; both share one match  
4. **World** — server picks conditions (Mars-focused build); LYRA / briefing explains gravity impact  
5. **Duel** — rear camera, rock & gun, block on incoming projectiles  
6. **Result** — server winner; return to cockpit / rematch path as available  

---

## Quick start

**Requirements:** Node 22+ recommended, two phones or laptop + phone for PvP, HTTPS (Vite basic-ssl).

```bash
# Terminal 1 — authoritative game server (port 3001)
cd server && npm install && npm test && npm run dev

# Terminal 2 — web client
cd web && npm install && npm test && npm run dev
```

Open the HTTPS URL Vite prints (accept the self-signed cert). For phones, tunnel that origin (see [`web/README.md`](web/README.md)). Socket.IO is proxied through Vite to `127.0.0.1:3001`.

### Useful routes

| Route | What you get |
| --- | --- |
| `/` | Onboarding → cockpit shell (`BridgeApp`) |
| FlightApp path | Real lobby → challenge → briefing → saber arena duel (composition target for the full demo) |
| `/?saber=CODE` | Phone lightsaber controller (opened from the laptop's pair QR) |
| `/?dev=arena` | Saber arena with synthetic fighters, no camera/phone/server |
| `/?arena=mars` | Mars scene only |

Provider demos (Photon / Grok) use gitignored env files — see [`server/src/integrations/`](server/src/integrations/) READMEs. **Never commit API keys.**

---

## Architecture (short)

```text
web/          React + Vite + R3F cockpit/arena + MediaPipe + Motion onboarding
server/       Node + Socket.IO lobby, match rules, gravity mapping
  integrations/  Photon + Grok (keys server-side only)
docs/         contracts, QA, cursor usage, sponsor evidence
datasets.md   NASA / JPL / imagery research for SpaceXAI provenance
```

**Invariant:** the server owns health, cooldowns, attack timing, and winner. Camera detections are inputs, not proof of a hit.

---

## Team

| Role | Owner | Focus |
| --- | --- | --- |
| A | Ally | Cockpit, Mars arena, presentation |
| B | Justin | Server, lobby/match contracts, networking |
| C | Alan | Camera, gestures, overlays, gun/rock CV |
| D | Alex | Photon, Grok Voice / LYRA, Cursor + sponsor evidence |

**Web:** default `/` is onboarding → cockpit (`BridgeApp`; next glue is FlightApp’s real lobby). Other routes: `/?explore=1` (free-flight solar system + hyperspace + challenge→duel handoff), `/?camera=1` / `/?debug=camera` (Alan harness), `/?dev=mars` (camera + Mars, no match), `/?arena=mars` (scene only), `/?pvp=1` (LiveDuel rehearsal). Real challenge → briefing → duel lives in `FlightApp`.

Rules of engagement: [`AGENTS.md`](AGENTS.md) · Living plan: [`PLAN.md`](PLAN.md) · Board: [`docs/task-board.md`](docs/task-board.md)

---

## Evidence for judges

- **Cursor:** [`docs/cursor-usage.md`](docs/cursor-usage.md)  
- **Providers (Photon, Grok Voice, LYRA):** [`docs/sponsor-evidence.md`](docs/sponsor-evidence.md)  
- **LYRA details:** [`docs/hologram-copilot.md`](docs/hologram-copilot.md)  
- **Datasets:** [`datasets.md`](datasets.md)  
- **QA phones:** [`docs/qa-checklist.md`](docs/qa-checklist.md)  

---

## Outside scope (intentionally)

Native iOS / ARKit shared rooms, campus GPS, planet ownership economies, offline armies, and treating MediaPipe as Perceptron.

---

*Deadline context: DubHacks Sunday Oct 18, 2026 · Feature freeze Saturday 10 p.m. Pacific — see PLAN.md.*
