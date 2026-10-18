# Initial task board

No implementation tasks are marked complete. Move work through Ready → Doing → Integration → Done. Done means merged, deployed where applicable, checked against current main and exercised on the selected devices.

## Doing

- C (Alan): hand lock (2s calibrate) + ~0.5× rear preference + first-person rock retune on camera harness. Unit tests green (`cd web && npm test` 67). Human phone pass/fail via `/?debug=camera` + ngrok still open. Gun/saber deferred. Still needs B command map (`throwRock`/`startBlock`) and A lobby mount.

## Ready — unblock first

- All: assign A–D and approve PLAN.md; list actual demo phones. C = Alan, D = Alex assigned; A/B still open.
- A/B: agree tooling, initialize web/server/shared workspaces, publish real run/check commands in README.
- B: freeze shared contracts with A/C/D, then implement schemas and a seeded two-player room.
- A: cockpit shell with selectable rival ship and challenge panels connected to the agreed adapter.
- B: two-client command/acknowledgement/snapshot, then touch-driven rock/block/health/result.
- C (Alan): real-phone rear-camera test with own hand plus opponent pose in one frame; log failures and calibration behavior.
- D (Alex): Photon PING/PONG + ACCEPT DEMO-42 fixture verified; Grok TTS + Speech-to-Speech fixtures verified. Remaining: B `createGamePort()` adapter, live challenge/world on two clients, human mic check, Grok Bot bonus. Helping Alan on C after that.
- B: NASA gravity record with provenance and timing helper/comparison check.
- C (Alan): local palm/fist states and tracked overlay connected to B's commands; tracking loss cancels.
- A/B: shared wheel, ready/countdown and result/rematch.
- D (Alex): Photon challenge acceptance/status/result and state-aware voice command; actual Grok Bot planning session.
- All: full two-phone loop; only then consider gun, sword, gyro or replay coach.

## Integration gates

Use the absolute deadline and times in PLAN.md. If a checkpoint has passed, record observed evidence and cuts now; do not move it to Done automatically. Freeze features at Saturday 10 p.m.; target submission Sunday 9 a.m., hard deadline 10 a.m. Pacific.

## Blockers and decisions

Record owner, specific blocker, next action and effect on scope. Never paste credentials here.
