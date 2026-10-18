# Initial task board

No implementation tasks are marked complete. Move work through Ready → Doing → Integration → Done. Done means merged, deployed where applicable, checked against current main and exercised on the selected devices.

## Doing

- B (Justin): **laptop + iPhone lightsaber duel in a shared 3D arena** merged via `main`/`saber-duel` into `alex-dev`. Server 3D collision/pairing, laptop arena (`web/src/arena3d`), phone saber (`web/src/saber`, `/?saber=CODE`). Scripted socket proof done; real laptop/iPhone QA still open — check `/?dev=arena` first.
- C (Alan): rock/gun CV still on harness (`/?camera=1`); FlightApp live duel path is now saber arena. Phone QA in `docs/qa-checklist.md`.
- D (Alex): Grok Bot planning bonus **claimed** (`docs/sponsor-evidence.md`). Remaining: Photon live-challenge binding + physical-phone LYRA mic QA.
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

- A/C/D composition on alex-dev: cockpit → planetary travel → world/Voice briefing → **saber arena duel** (Justin) → result → cockpit. `/?camera=1` remains full MediaPipe harness; rock/gun CV still Alan’s path.
- Provider proofs (Photon fixtures, Grok TTS/S2S/narration) recorded in `docs/sponsor-evidence.md`.
- Server-backed lobby, accepted match, Mars selection, readiness, and saber combat are merged. Photon live binding + physical LYRA mic remain follow-up.

## Planetary travel roulette — merged from `mars-arena`

- Accepted match → cockpit roulette (Mars) → travel video → server-backed briefing → arena when both ready. Room scanning skipped.
- Roulette assets (textures, Sun map, flight video, attribution) committed. Mobile Safari / two-device QA still open.

## Cockpit Demo / Live + LYRA — on alex-dev

- Demo/Live switch, dock controls, hologram Voice: see `docs/hologram-copilot.md` and BridgeApp. Grok Bot planning bonus claimed in `docs/sponsor-evidence.md`.


## Live connected to Justin shared server — October 18

Alex: configured the merged frontend to Justin’s public Cloudflare multiplayer server; phone QR and saber client routing now use that same backend. Real test join + controller pairing passed; the shared roster saw the merged preview pilot. Build and 156 frontend tests pass (one opt-in skipped). No game/server rules changed. Justin’s running server lacks copilot RPC replies, so shared Voice still needs his backend updated. Physical two-player saber testing remains. Changes prepared on alex-dev for team integration; `.env.local` stays ignored. Handoff: `docs/shared-live-server.md`.

## Joint-driven avatar implementation — October 18, 2026

- Goal: preserve onboarding/customization, dress main's working skeleton in a slimmer suit, show the actual opponent appearance and retain main's Mars framing.
- Branch/worktree: `feature/joint-driven-avatars`, `../Dubhacks26-joint-avatars`. Based on character branch b9f3378 with the four existing uncommitted playground/UI edits copied intact before implementation. Original worktrees remain untouched.
- Owned scope authorized by user: web arena3d/avatar presentation and networking; server appearance contract, session validation and match-view transport; docs and relevant tests. A/B/C handoff recorded in docs/contracts.md.
- Exclusions: combat rules, camera inference, onboarding model/animations, shared dependencies, deployment, external messages.
- Acceptance: typecheck/build, segment endpoint/facing tests, appearance validation/dedup/reconnect and real-socket tests; inspect synthetic preview on Mars from both slots. Actual two-laptop/phone play remains a human device check.
- Status: implemented and locally verified. `web: npm run build` passed; `web: npm test` passed 166 tests (opt-in live test skipped there), then `GAME_SERVER_URL=http://127.0.0.1:3107 npm test -- src/networking/gameClient.live.test.ts` passed against the updated local server, including two distinct opponent profiles. `server: npm test` passed 87 tests. Browser inspected the original creator and saved purple suit/cape/patch/jetpack in the slimmer Mars preview from both slots; these are synthetic fighters, not a device match. Main's camera settings restored exactly. No new environment variables. Both frontend/backend require integration; not deployed. Actual two-device camera/phone flow remains unverified.

### Battle suit visual refinement

User requested closer onboarding styling without obscuring combat. Replaced box torso and straight rods with tapered rounded padding, chest inset/seams, shoulder/knee trim, dark gloves and rounded boots. Seated helmet at the collar using a cosmetic head offset, keeping pose data and combat hit geometry unchanged. Own suit opacity reduced from 0.4 to 0.22; main camera and Mars environment unchanged. Original onboarding model remains unchanged. Visually checked the synthetic Mars preview; production build and targeted avatar/joint checks run for this refinement.

### User-supplied Quaternius astronaut structure

Replaced the procedural battle suit with the actual user-supplied `Astronaut by Quaternius - OgeSH89Nmx.glb`, copied unchanged to `web/public/models/avatars/battle-astronaut.glb`. `astronautPieces.ts` bakes its suit surface and remaps skin weights onto the same 11 pose segments; connected seams blend between their endpoint transforms, with bounded thickness and no source animations controlling combat. Existing custom helmet/face, saved colors/accessories, own-avatar transparency and main's Mars camera remain. No new dependencies, environment variables, wire contracts or deployments. Tests load the real asset and check weight normalization, all segment groups, finite posed vertices and endpoint alignment (5 tests passed including the existing joint checks). Production frontend build passed. Browser inspected the source suit on synthetic fighters from both slots; actual device play remains unverified.

### Landscape Mars transition video

Replaced `web/public/cinematics/spacetomars.mp4` with the user-provided `space to mars-hort.mp4` (736×400 H.264, 6.04 seconds), retaining the existing transition URL and playback handling. Updated the video container from the former 464:688 portrait ratio to 736:400 landscape in both vh/dvh rules so the clip stays uncropped. Scope: cinematic media/presentation only; no avatar/game/network changes. Acceptance: inspect encoded dimensions, verify copied file matches source, and confirm existing landscape presentation. Main currently has no PlanetaryTransition; this replacement lives in the joint-driven avatar worktree alongside that transition.

### Live arena entry fix

Investigated user report of sticking at the prepare-for-duel screen. The legacy briefing iframe at `/copilot/?world=mars` resolved to the entire SPA on the Cloudflare test frontend (confirmed by HTTP response). In Live mode a nested app can rejoin with the same locally stored player ID and replace the parent socket. Removed the obsolete iframe/message/timer dependency from FlightApp; Ready now uses the normal deduplicated `client.ready()` command directly, retains rejection feedback and prevents repeated clicks while pending. Briefing copy describes camera/phone setup and current movement controls. The cockpit's existing copilot is unchanged. Scope: FlightApp entry flow; no combat/server/wire changes. Verification: frontend typecheck and production build passed; browser traversed Live challenge → Engage → full cinematic → briefing → Ready → rendered Mars arena with Start camera and setup controls over the Cloudflare URL using a controlled ARENA-TEST pilot. Cleaned up the test match and disconnected that pilot. Camera/phone setup and actual fighting were not performed. Main remains untouched.
