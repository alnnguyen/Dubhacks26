# Initial task board

No implementation tasks are marked complete. Move work through Ready → Doing → Integration → Done. Done means merged, deployed where applicable, checked against current main and exercised on the selected devices.

## Doing

- B (Justin): saber setup reworked October 18 (scan → stand → upright → right → thrust; see contracts.md); needs real laptop/iPhone timing QA.
- B (Justin): **laptop + iPhone lightsaber duel in a shared 3D arena** merged via `main`/`saber-duel` into `alex-dev`. Server 3D collision/pairing, laptop arena (`web/src/arena3d`), phone saber (`web/src/saber`, `/?saber=CODE`). Scripted socket proof done; real laptop/iPhone QA still open — check `/?dev=arena` first.
- C (Alan): rock/gun CV, `/?camera=1`, `/?dev=mars` and `/?pvp=1` were removed October 18 (lightsaber-only; see below). Saber arena phone QA in `docs/qa-checklist.md`.
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

## Audio presentation — Alex, October 18

Shared music/effects mixer and supplied audio pack integrated into alex-dev working tree: onboarding, bridge jump, cockpit bed/hum, accepted-match impact, preserved map-wheel synth, travel engine/jump/arrival, and low Mars arena music/wind. LYRA panel ducks background while listening/speaking. SOUND / MIX controls and `/?audio=check` listening room added; no new dependencies, keys, server contracts, or endpoints. Build passes; full frontend suite 165 passed / one opt-in skipped; nine mixer lifecycle tests pass. Local browser buffers/scene beds verified. Physical iPhone, two-laptop speaker mix, and full live flow remain QA. Not deployed or pushed by this task. Handoff: `docs/audio-integration.md`.

## Mars intro and arena rendering recovery — October 18

- Goal/owned paths: user-authorized frontend cinematic, Mars loading, arena composition and the socket factory type needed to build; no server rules or shared contracts changed.
- Fixed missing `saberControllerUrl` import in ArenaDuel (render-time ReferenceError). Timed roulette waits for cockpit readiness and preloaded planet textures, with a 10-second texture wait limit. Mars heightmap preloads during travel; failed HTTP responses report errors.
- Arena render error boundary offers a simple floor/fighters mode without Mars assets or postprocessing, plus return to cockpit.
- Checks: frontend tests passed 169, one opt-in live test skipped. Production build/typecheck passed; focused socket/cinematic tests also passed (9 tests). No new environment variables. Actual two-device playback/graphics QA remains required; preloading does not guarantee GPU compilation has finished.

## Cinematic fast-forward correction — October 18

- Goal/owned paths: user-authorized cinematic scheduler, cockpit frame callback and tests; no game interfaces, server rules, manifests or deployment changed.
- Cause: wall-clock phase timers kept advancing while camera/planet motion capped frame deltas at 50 ms. Render stalls therefore moved phase selection ahead of visible motion. Orbit trails also used uncapped deltas.
- Change: phase scheduler now ticks from the cockpit useFrame callback, caps progress to the same 50 ms, advances at most one phase per rendered frame, discards excess stall time and stops ticking in hidden tabs. Orbit trails use the same cap.
- Checks: production build passed; five cinematic tests passed including long stalls, short-stop boundaries and normal 60 fps duration. No new environment variables. Two-device visual QA remains open; this fixes catch-up behavior, not hardware frame-rate limits.

## Cockpit/roulette startup synchronization — October 18

- Goal/owned paths: user-authorized cockpit/cinematic preparation and timing tests; no shared manifests, contracts, server or deployment changes.
- Roulette now mounts hidden in the lobby after bounded texture preloading (including Sun and Earth layers), creates materials with cached maps immediately, uploads textures, compiles shaders, and draws an offscreen preview before reporting ready. The same mounted objects are revealed for playback. Failed/slow maps retain plain-material fallbacks.
- Launch camera/mood stays in cockpit until the prepared sequence starts; hidden idle roulette resets focus/zoom/scale for subsequent travel. Normal activation increased from 700 to 1100 ms, roulette stops from 1600 to 2400 ms total (4.8-second overall intro). Reduced-motion timings unchanged.
- Validation: frontend suite 172 passed, one opt-in live test skipped; production build/typecheck passed. No new environment variables. Actual two-device GPU/playback QA remains open.

## Visible planet-by-planet roulette — October 18

- User-reported skipped-looking highlights: fixed updates to an unattached `marker` material ref by updating the actual ring material; raised selected-ring opacity and planet emissive strength. Shared reticle now tracks the selected planet directly, scales around its radius and sits in front of its surface. Planet transforms update before the reticle and camera.
- Each normal roulette stop now lasts 450–1000 ms (5.35 seconds for all eight; 7.75 seconds including activation/lock/zoom/flash). Mars destination remains scripted; reduced-motion timings unchanged.
- Owned paths: cinematic renderer, sequence, regression checks and board. No server selection/rules/contracts or environment changes. Five cinematic tests passed, including minimum readable stop duration and stall behavior. Production build/typecheck passed. Actual browser/device highlight verification remains open.

## Reduced-motion selection parity — October 18

- Investigation found OS/saved Reduce motion selected a separate Earth→Mars-only sequence under 900 ms, matching the reported skip despite normal-mode timing fixes. User's actual browser setting and served URL remain unconfirmed (Chrome inspection not approved; requested frontend URL/start command).
- Reduced motion now retains all eight normal readable planet stops while keeping its shorter transition stages and existing motion reductions. Normal-mode timings unchanged.
- Owned paths: sequence, sequence tests and board; no backend, deployment or environment changes. Production build/typecheck and five cinematic tests passed; the reduced-motion regression verifies content/duration parity for all planet stops. Live visual QA remains open.

## Restore original intro pacing — October 18

- User requested reverting timing increases: normal activation restored to 700 ms; original eight roulette stops total 1600 ms (65–475 ms each), for a 3.6-second normal intro. Preserved preloading/readiness, rendered-frame clock, highlight/reticle fixes and all-eight-stop reduced-motion content.
- Owned paths: sequence, timing tests and board. No contracts, backend or environment changes. Five cinematic tests passed; production build/typecheck passed. Device visual playback remains unverified.

## Opponent-relative orbital movement — October 18

- Goal: replace the square lane with unlimited left/right circling, as requested by Justin. Owned scope: server movement/range/facing, shared stepped-event metadata, arena prediction/presentation and movement help; excludes camera inference, setup, providers, manifests and deployment.
- Left/right steps follow true arcs around the rival's accepted position. Forward/back change separation within 1.3–3.9 m. Fighters and shoulder camera turn toward the opponent. Engagement follows current separation; round foot markers replace the chessboard. One buffered step and the existing authorized/deduplicated command path remain.
- Interface handoff to A/C: fractional q/r coordinates; optional world-space orbitCenter on stepped; board.rows retained only for compatibility. See docs/contracts.md. Server and web must update together. No new environment variables.
- Validation: all 92 server tests passed, including socket integration, repeated circles, simultaneous commands, radial limits and held-blade movement. Frontend production build/typecheck passed; 173 frontend tests passed, one opt-in live test skipped. Actual two-laptop/iPhone camera/orbit visual checks and deployment remain open, so status is Integration, not Done.
- Git: clean starting checkout was saber-duel. Creating the required codex/orbital-duel-movement branch was blocked by sandbox Git-ref permissions and the escalation was declined; changes remain uncommitted on the existing branch. No external messages or deployment performed.

## Damage knockback — October 18

- Goal: force an avatar backward when damaged. Owned paths: server game/rules/tests and coordination docs, explicitly authorized by the user; interface: existing stepped event and arena frames. Excludes camera, provider integrations, shared manifests, frontend redesign and deployment.
- Positive saber/projectile damage pushes the defender 0.65 m away from the attacker, capped at 3.9 m separation. Interrupts voluntary glides and clears buffered movement; blocks do not push. Rule tuning: SABER.knockbackMeters.
- Validation: server build and all 61 game tests passed; frontend production build/typecheck passed. Updated cooldown/knockout tests to close distance after hits; hit and block regressions assert displacement/no displacement. Full server suite attempted but socket tests failed and the process did not finish in the restricted environment; stopped it. No claim of full-suite or actual-device verification.
- Status: Integration; actual two-player visual/device check remains open. Branch: codex/damage-knockback. No new environment variables, external messages or deployment.

## Rock/gun path removal — October 18

- Goal: lightsaber-only combat, as requested by Justin. Removed rock/gun server commands, state, events and rules; matching web client API; the old phone-camera duel (LiveDuel, CameraDebugPage, DevMars, vision, overlay, gun model) and its routes. See docs/contracts.md. Excludes D's Grok briefing fixtures, shared manifests/dependencies and deployment.
- Validation: server build plus 70 game/session/socket tests passed; web typecheck, 94 tests (one opt-in live test skipped) and production build passed. No device check yet.
- Status: Integration; staged on saber-duel for Justin to commit. No new environment variables, external messages or deployment.
## Neptune destination — `feature/neptune-arena` (not merged)

- Goal: Neptune as a second arena beside Mars. The server rolls Mars/Neptune 50/50 per accepted challenge; `?world=mars|neptune` on the challenger's page is a testing override.
- Flow: roulette locks the chosen planet → Neptune cinematic (`web/public/assets/neptune/neptune-arrival.mp4`, which ends in blue cloud with no arena) → the live 3D scene, already compiled behind the video and parked in matching fog → the video fades to a cutout of its own final cockpit frame plus a matched blue veil → the camera flies out of the cloud, the fog clears, and the camera settles at the slot-1 shoulder pose → server-backed briefing and arena.
- Mars flow is unchanged.
- Data and sources: `docs/neptune-sources.md`. The platform is fictional; the clouds are procedural and Voyager-informed.
- Interface: the `challenge` command gains an optional `destination` (see `docs/contracts.md`), and `WorldId` gains `neptune`. Affects B (server/contracts) and A (cockpit/cinematics).
- Review routes:
  - `/?arena=neptune`: orbit the station.
  - `/?journey=neptune`: cinematic → live handoff.
  - `/?journey=neptune&skip`: reveal only.
  - `/?dev=arena&destination=neptune`: synthetic fighters.
- Not yet checked in a real browser playing the video, on phones, or in a live two-client match.
- 2026-10-18 check (saber-duel): server tests 98/98, integration tests 13/13, web typecheck + 99 tests pass, production build OK, all Neptune assets serve (arrival MP4 is H.264 + faststart). Fixed: the voice briefing iframe ignored `?world=neptune` and announced the Mars fixture (D's `client.mjs`, `demo-state.mjs`, `briefing.mjs`, `demo.html`), the copilot text said matches are always Mars, and the arena's basic-graphics recovery re-rendered the full Neptune scene. Live two-client match, phones and voice server still unverified.
- Deploy server and client together before using Neptune in real matches. Not deployed or pushed.
