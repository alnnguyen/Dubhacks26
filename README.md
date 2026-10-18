# Jedi Space Battle — DubHacks 26

A spaceship lobby leads into a two-player browser camera duel. Select a rival ship, accept a challenge, spin a shared world wheel, and throw a gesture-controlled rock with a defense window derived from NASA gravity data.

## Start here

1. Read [PLAN.md](PLAN.md): agreed experience, MVP, roles, deadline and cut order.
2. Read [AGENTS.md](AGENTS.md): ownership and AI coding rules.
3. Assign names in [docs/team.md](docs/team.md).
4. Member B coordinates [docs/contracts.md](docs/contracts.md) before parallel feature implementation.
5. Move the first tasks through [docs/task-board.md](docs/task-board.md).

## Repository structure

```text
web/                       React/TypeScript client — A owns app setup
  public/assets/           Original/permitted visual and audio assets
  public/models/           Downloaded on-device vision models; C owns
  src/
    lobby/                 Cockpit, selectable rival ships, challenges — A
    ui/                    Wheel, briefing, HUD, results, shared styling — A
    networking/            WebSocket transport and command adapter — B
    camera/                Rear-camera lifecycle and calibration — C
    vision/                Local hand/pose recognition — C
    overlay/               Three.js camera effects and rock visuals — C
    voice/                 Grok Voice client UI/session integration — D
server/                    Persistent Node/TypeScript service — B owns setup
  src/
    game/                  Authoritative match rules and simulation — B
    sessions/              Players, rooms, identities and challenges — B
    integrations/
      photon/              Message linking, replies and delivery — D
      grok/                Voice tools and bounded copilot actions — D
      perceptron/          Optional replay analysis — D
packages/
  contracts/src/           Shared command/event schemas — B
  physics/src/             Shared rules and gravity mapping — B
  physics/data/            Source-backed gravity dataset — B
docs/                      Team, interface, QA, deployment and evidence notes
```

## Current status

**Integrated on `alex-dev` (Oct 17):** Ally’s 3D cockpit + immersive Mars arena (NASA MOLA Jezero; opponent cutout), Justin’s lobby/challenges/networking client (rock + gun), Alan’s camera (hand lock / wide rear), Alex Motion onboarding, LiveDuel rehearsal `/?pvp=1`, D Photon/Voice fixtures.

**Server (B / Justin):** authoritative match + lobby (mars-arena tip pins every match to Mars). Verified commands in [server/README.md](server/README.md):

```bash
cd server && npm install && npm test
```

**Web:** default `/` is onboarding → cockpit (`BridgeApp`; next glue is FlightApp’s real lobby). Other routes: `/?explore=1` (free-flight solar system + hyperspace + challenge→duel handoff), `/?camera=1` / `/?debug=camera` (Alan harness), `/?dev=mars` (camera + Mars, no match), `/?arena=mars` (scene only), `/?pvp=1` (LiveDuel rehearsal). Real challenge → briefing → duel lives in `FlightApp`.

```bash
# Web
cd web && npm install && npm test && npm run dev

# Authoritative server (B)
cd server && npm install && npm test && npm run dev
```

Open the HTTPS URL Vite prints (accept the self-signed cert). For phones, tunnel that HTTPS origin (see `web/README.md`). Server defaults to port `3001` — see [server/README.md](server/README.md).

Target: mobile HTTPS website, two selected demo phones, rear-camera overlays and server-authoritative combat. Native Swift/ARKit, campus GPS, planet ownership and offline armies are outside this MVP.

Deadline: Sunday October 18, 2026, 10:00 a.m. Pacific. Target submission 9:00 a.m.; feature freeze Saturday 10:00 p.m. See PLAN.md for checkpoints. Elapsed checkpoints are not evidence that tasks passed; update the task board with real results.
