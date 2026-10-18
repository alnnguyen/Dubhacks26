# Initial task board

No implementation tasks are marked complete. Move work through Ready → Doing → Integration → Done. Done means merged, deployed where applicable, checked against current main and exercised on the selected devices.

## Doing

- B (Justin), branch `saber-duel`, 2026-10-17 ~23:50: **laptop + iPhone lightsaber duel in a shared 3D arena** (PLAN.md, docs/contracts.md). Server 3D collision/pairing, laptop arena (`web/src/arena3d`), phone saber (`web/src/saber`, route `/?saber=CODE`) implemented. Verified: server tests, web tests/typecheck/build, scripted 2-laptop + 2-phone socket duel against the real server (block then hit). **Not yet run on real laptops/iPhones or viewed in a browser** — first check axis directions (raise right arm / point phone up) and `/?dev=arena`. The earlier phone-camera version is saved as `git stash@{0}`.

- C (Alan) + Alex QA: phone framing + gestures on **duel HUD** (FlightApp / LiveDuel) and full harness at `/?debug=camera` or `/?camera=1`. Hand lock + wide rear merged into alex-dev Oct 17. Checklist in `docs/qa-checklist.md`. Gun/saber deferred.
- D (Alex): Grok Bot bonus session (template in `docs/sponsor-evidence.md`). Live Photon/Voice on real challenges **blocked on B**.
- A (Ally): **pull `alex-dev`** — Alan’s latest camera is merged; cockpit default + turn-to-look remain on ally paths. Keep live camera as duel surface (PLAN); arena polish = overlays/cockpit, not room scan.

## Ready — unblock first

- All: assign A–D and approve PLAN.md; list actual demo phones. C = Alan, D = Alex assigned; A ≈ Ally on cockpit; **B still open / critical**.
- A/B: agree tooling, initialize web/server/shared workspaces, publish real run/check commands in README.
- **B (BLOCKER):** freeze contracts + implement `createGamePort()` — see Blockers below and `server/src/integrations/HANDOFF.md`.
- A: cockpit shell with selectable rival ship and challenge panels connected to the agreed adapter (local rehearsal exists; needs B for real challenges).
- B: two-client command/acknowledgement/snapshot, then touch-driven rock/block/health/result.
- C (Alan): real-phone rear-camera test with own hand plus opponent pose in one frame; log failures and calibration behavior.
- D (Alex): Photon + Grok fixtures verified on alex-dev. Remaining after B: live ACCEPT ↔ challenge ID, Voice on real match state.
- B: NASA gravity record with provenance and timing helper/comparison check (client rehearsal mapping exists; server record still B).
- C (Alan): local palm/fist states and tracked overlay connected to B's commands; tracking loss cancels.
- A/B: shared wheel, ready/countdown and result/rematch.
- D (Alex): Photon challenge acceptance/status/result on **live** challenges; official Grok Bot planning session.
- All: full two-phone loop; only then consider gun, sword, gyro or replay coach.

## Integration gates

Use the absolute deadline and times in PLAN.md. If a checkpoint has passed, record observed evidence and cuts now; do not move it to Done automatically. Freeze features at Saturday 10 p.m.; target submission Sunday 9 a.m., hard deadline 10 a.m. Pacific.

## Blockers and decisions

### B — node-server merged into alex-dev (2026-10-17 ~17:05 Pacific)

**Landed from `origin/node-server`:** Socket.IO demo match (`join` / `command` with `throwRock|startBlock|endBlock`), Mars flight timing, snapshots, reconnect grace. Run `cd server && npm test`.  
**Still missing for D:** `createGamePort()` / challenge accept-decline path / world wheel — Photon ACCEPT and Voice still use fixtures until B exposes the HANDOFF adapter on top of this match service.

### B — createGamePort (Alex ping, 2026-10-17 ~17:00 Pacific)

**Owner:** B (Justin) · **Blocker:** D Photon/Voice and cockpit flow cannot leave fixtures until this lands.  
**Next action for B:** ship a server-only module exporting `createGamePort()` that returns:

- `getChallenge({ actorId, challengeId })` → participant-visible challenge; reject unrelated players
- `respondChallenge({ actorId, challengeId, decision, commandId })` → accept/decline through the **same** path as UI buttons; idempotent on `commandId`
- `getMatchState({ actorId })` → `{ matchId, phase, world, gravityMps2, rockFlightSeconds }` or null; **no** `fixture:true` on real matches

Also freeze `acceptChallenge` / `declineChallenge` / IDs in `docs/contracts.md` + `packages/contracts`. Mount Voice ephemeral-token routes on authenticated sessions (see HANDOFF).

**Effect on scope:** without this, demo must keep saying “simulated challenge/health”; Photon DEMO-42 stays a separate fixture proof.

Full text: `server/src/integrations/HANDOFF.md`.

### Git coordination

- **Oct 17:** Alan’s newer camera (hand lock, wide rear, rock retune) merged into **`alex-dev`**. Ally should pull alex-dev before more cockpit work.
- Shared integration branch: **`alex-dev`**. Alan pushes new camera work to `origin/alan` first; Alex merges when ready.

## Integrated local rehearsal — October 17

- A/C/D composition on alex-dev: cockpit → server-backed world/Voice briefing → **duel HUD** camera → result → cockpit. Duel mode hides lab chrome; `/?camera=1` remains the full MediaPipe harness.
- Provider proofs (Photon fixtures, Grok TTS/S2S/narration) are recorded in `docs/sponsor-evidence.md`.
- The server-backed lobby, accepted match, Mars selection, readiness, and combat are integrated. Provider-specific Photon/Voice flows and full two-phone/device validation remain separate follow-up checks.

## Planetary travel roulette — integrated on `mars-arena`

- The accepted server match enters the cockpit roulette when a pilot engages. Mars is selected deterministically; the travel video then hands off to the existing server-backed Mars briefing. The arena starts when the server reports both players ready. Room scanning is intentionally skipped.
- The existing MediaPipe opponent segmentation, hand/pose tracking, touch controls, server-authoritative combat, and Mars arena remain the live duel path.
- The 3.6-second roulette, locally supplied planet textures, Sun map, flight video, and texture attribution are committed with the feature. Mobile Safari and real two-device behavior still require manual verification.
