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

The server has a first runnable slice (two players join one demo match and share a snapshot; no combat yet). Its verified commands are in [server/README.md](server/README.md): `cd server && npm install && npm test`. The web client is still a planning scaffold.

Original scaffold note: this is a planning scaffold, not a runnable application. No dependencies, app entry points or build scripts have been installed. A and B should agree on one package manager and initialize the client/server workspaces together. Record the actual run/check commands here once they exist; do not invent commands before setup.

Target: mobile HTTPS website, two selected demo phones, rear-camera overlays and server-authoritative combat. Native Swift/ARKit, campus GPS, planet ownership and offline armies are outside this MVP.

Deadline: Sunday October 18, 2026, 10:00 a.m. Pacific. Target submission 9:00 a.m.; feature freeze Saturday 10:00 p.m. See PLAN.md for checkpoints. Elapsed checkpoints are not evidence that tasks passed; update the task board with real results.
