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

**Integrated on `alex-dev` (Oct 17 merge):** Ally’s 3D cockpit (default), Alan’s latest camera (hand lock, wide rear, first-person rock retune), Alex LiveDuel `/?pvp=1` rehearsal, Justin’s Socket.IO demo match under `server/`, and D Photon/Voice fixtures. **Ally should pull `alex-dev`** after this merge for cockpit + camera together.

**Server (B / Justin):** first runnable slice with demo match + rock events. Verified commands in [server/README.md](server/README.md):

```bash
cd server && npm install && npm test
```

**Web (A cockpit + C camera):** Ally’s spaceship lobby is the default app. Alan’s camera harness: `/?debug=camera` or legacy `/?camera=1`. Live duel rehearsal: `/?pvp=1`.

```bash
# Web (cockpit / camera / pvp rehearsal)
cd web && npm install && npm test && npm run dev

# Authoritative demo match (B)
cd server && npm install && npm test && npm run dev
```

Open the HTTPS URL Vite prints (accept the self-signed cert). For phones, tunnel that HTTPS origin (see `web/README.md`). Server defaults to port `3001` — see [server/README.md](server/README.md).

Target: mobile HTTPS website, two selected demo phones, rear-camera overlays and server-authoritative combat. Native Swift/ARKit, campus GPS, planet ownership and offline armies are outside this MVP.

Deadline: Sunday October 18, 2026, 10:00 a.m. Pacific. Target submission 9:00 a.m.; feature freeze Saturday 10:00 p.m. See PLAN.md for checkpoints. Elapsed checkpoints are not evidence that tasks passed; update the task board with real results.
