# Initial task board

No implementation tasks are marked complete. Move work through Ready → Doing → Integration → Done. Done means merged, deployed where applicable, checked against current main and exercised on the selected devices.

## Doing

- C (Alan): camera debug harness + MediaPipe + screen-space rock (hold/arc/cancel) in `web/`. Gun/saber deferred per PLAN. Run `cd web && npm run dev`, tunnel for phones — framing checklist in `web/README.md`. Human must still mark phone pass/fail on demo devices. Still needs B's frozen command schema and A's lobby mount for multiplayer.

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

## Integrated local rehearsal — October 17

- A/C/D composition now runs on alex-dev: cockpit Engage → world/Voice briefing → camera training → result/back to cockpit. 59 frontend + 10 integration tests and build pass.
- C/D: user confirmed standalone CV and Voice; now verify speech, microphone shutdown and gestures on combined screens and both phones. Voice dev proxy currently allows this computer only.
- B blocker unchanged: replace mock discovery/challenges and local training health with shared authoritative state; wire Photon and Voice to actual challenge/match. Interface notes in docs/flight-integration.md and server/src/integrations/HANDOFF.md.

## Planetary travel roulette — A / `planetary-roulette` worktree

- Implemented in the cockpit's existing WebGL canvas. The local mock challenge can exercise deterministic Mars selection, the Mars travel video, skip/end completion, and the room-scanning hand-off. `onTravelComplete("mars")` is a frontend boundary only; the room scanner and real server-backed accepted-match adapter are not in this worktree. Contract note: `docs/contracts.md`.
- Verified: `cd web && npm run typecheck`; `cd web && npm run build`; `cd web && npm test` (61 tests); production preview loaded the supplied planet/Earth textures, and the desktop mock flow reached the room-scanning hand-off with one WebGL canvas.
- Not verified: real multiplayer synchronization, actual phone/iOS playback, or camera scanning. Do not mark the feature deployed/integrated until those owners test their paths.
- `web/public/cinematics/spacetomars.mp4` was present as an untracked worktree asset before this task and was not modified. Include it in integration/merge deliberately; it is required by the feature.
