# Team assignment and kickoff

- A — Ally (cockpit/UI presentation): cockpit scene, composition help, release adjacent work. Work **on `alex-dev`** (or branch from it). Optional later: fold `cockpit-scene` `dacca30` orientation look if useful. Do not replace the live camera duel with a scanned 3D room (PLAN: screen-space combat).
- B — name to assign: shared contracts, authoritative server, networking and physics. **Critical path:** `createGamePort` + frozen contracts (`server/src/integrations/HANDOFF.md`).
- C — Alan: camera, local hand/pose inference and visual overlays (`web/src/camera`, `web/src/vision`, `web/src/overlay`, `public/models`). Already merged into `alex-dev`; **do not re-merge stale `origin/alan`**. Push new C work to a fresh tip, then merge into `alex-dev`.
- D — Alex: Photon, Grok Voice, actual Grok Bot planning and optional Perceptron (`server/src/integrations`, `web/src/voice`, sponsor evidence). Provider-evidence verifier. Helps Alan on phone QA after D fixtures.

## Decide before splitting

- Name each owner and pick the two actual demo phones/browsers.
- Choose one package manager and compatible Node runtime; A/B coordinate workspace setup.
- Approve command names and state transitions in contracts.md.
- Pick server/frontend hosting and a working HTTPS device-testing path.
- Provision provider keys/channel access without sharing secrets in committed docs.
- Assign release captain A and provider-evidence verifier D.

Each person connects their feature to the deployed main flow. Use short owner/blocker/next-action updates and small merges every 60–90 minutes. Use PLAN.md for detailed scope, checkpoints, rest handoffs and submission schedule.

## Ally / Alan — pull instructions (2026-10-17)

```sh
git fetch origin
git checkout alex-dev
git pull origin alex-dev
```

`origin/alan` tip `e6cd4b7` is already an ancestor of `alex-dev`. Merging `alan` again adds nothing. If Alan has newer commits, push them first, then merge into `alex-dev`.
