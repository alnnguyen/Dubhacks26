# Initial task board

## KO.rbit launch and exploration reference motion — October 18 (Alan / Codex)

- Goal: adapt Alan’s `korbit-launch.html` and `korbit-explore-entry.html` into the live UI, preserving the simpler blue Explore/red Flight selector and existing hyperspeed animation. Owned paths: onboarding confirmation, shared launch presentation, exploration intro/departure/arrival CSS and this record. Existing human-owned UI branch; preserve unrelated `.vscode/` files.
- Interface: unchanged entry/finish callbacks and actual pilot identity. No server/contracts, combat, networking, manifests, new dependencies, provider calls or deployments. Reference ships are decorative launch artwork, never live multiplayer contacts. Do not import the reference’s standalone flight simulation, artificial telemetry, fake readiness checks or scripted player actions.
- Implementation: folding, staggered mode-card departure; actual pilot/ship/accent confirmation glass; lead-ship lift-off, bank sweep, decorative wing craft, engine trails and accelerating stars; crossfade into the existing hyperspeed tunnel; readiness-gated arrival title and staggered HUD edges. No taglines, new typefaces or fullscreen flashes. Skip and OS reduced-motion paths remain, with finite 30fps/DPR ≤1.5 drawing and hidden-tab pause/cleanup.
- Validation: production build/typecheck passed; 193 frontend tests passed, one opt-in live-network test skipped. Browser verified ship launch → existing tunnel → live Flight scene, quiet Explore entry, Skip completion and reduced-motion completion. Actual 390px viewport/document width matched without horizontal overflow; checked the onboarding confirmation manifest and ship departure. Fresh app warning/error logs were empty. Existing large-bundle warnings remain. Screenshots: `/private/tmp/korbit-launch-manifest.png`, `/private/tmp/korbit-ship-launch-mobile.png`. New environment variables: none. Physical-phone and deployed acceptance remain open.

## KO.rbit animated intro — October 18 (Alan / Codex)

- Goal: integrate Alan’s `korbit-intro.html` animation into welcome, with a simpler exploration mode entry, following `design/korbit-ui/BRAND-GUIDELINES.md`; remove slogans, use blue Explore and red Flight.
- Owned paths: shared intro artwork/runtime/styles, onboarding welcome composition, exploration intro and this handoff. Existing entry callbacks and gameplay/provider interfaces stay unchanged. No dependencies, server changes, deployment or external messaging. Work continues on the existing human-owned UI branch; unrelated merge work is preserved.
- Delivered: scoped four-second K/O impact → orbiting planet → KO.rbit plate sequence; Orbitron/JetBrains Mono, −12° blue plate, diagonal translucent glass, readable mode cards and ice action. No tagline. Exploration uses a quiet “Choose a mode” screen without repeating the KO.rbit reveal. Enter fades into the existing hyperspace tunnel, then dissolves into the rendered universe only after both the animation and scene are ready; flight input waits for that gate. Slow loads and scene errors retain their recovery controls. Skip, Replay and a visible reduced-motion control; native keyboard buttons, finite 30fps Canvas at DPR ≤1.5, pause when hidden and cleanup on unmount. No fullscreen flashes or extra WebGL renderer.
- Validation: production build/typecheck passed; 193 frontend tests passed, one opt-in live-network test skipped on the current merged tree. Browser verified desktop/390×844 layout, replay impact animation, Skip, reduced motion, red Flight/blue Explore selection, scene entry with Explore active and welcome → callsign. The simplified exploration screen was verified on desktop and 390px widths after Alan’s follow-up; the retained hyperspeed tunnel was captured after the selector faded, then verified to release into the ready Earth scene with no warning/error logs. Entry warp does not repeat on subsequent destination changes. Fresh warning/error logs were empty in both intro and scene. Existing large-bundle warnings remain. Screenshots: `/private/tmp/korbit-intro-desktop.png`, `/private/tmp/korbit-intro-mobile.png`. Physical-device and deployed-flow checks remain open. New environment variables: none.


## KO.rbit rebrand and exploration entry — October 18 (Alan / Codex)

- Implemented locally on `codex/ko-rbit-brand-exploration`. Goal: change visible title/corner branding to KO.rbit, add a branded exploration intro, and make the top-left destination card collapsible.
- User-authorized owned paths: onboarding, exploration/cockpit UI, shared frontend brand styling, HTML title and docs. Preserve unrelated `.vscode/` files. No server/game/provider contracts, manifests, dependencies or deployment changes.
- Interface: existing exploration props stay compatible; an internal entry choice selects Explore/Flight before the scene mounts. The destination card uses native button disclosure semantics, with keyboard support and a stable details region.
- Acceptance: frontend build/typecheck and existing tests, browser checks for title casing, intro entry/mode selection and repeated mouse/keyboard destination toggling; phone-width visual check. No new tests are needed for copy/CSS alone.
- Validation: frontend typecheck and production build passed; 259 tests passed, one opt-in network test skipped. Browser verified exact KO.rbit casing on welcome/cockpit/exploration, intro mode selection and scene entry, mouse/Enter/Space toggling and Escape dismissal. Checked intro and expanded destination at 390×844; moved phone zoom controls clear of the disclosure and suppressed overlapping panels while it is open. Fresh warning/error logs were empty. Existing large-bundle warnings remain. Screenshots: `/private/tmp/ko-rbit-title.png`, `/private/tmp/ko-rbit-explore-intro.png`, `/private/tmp/ko-rbit-destination.png`.
- Handoff: no new environment variables, contracts, provider calls or deployments. Local preview remains at `http://localhost:5180/?explore=1`. Physical-phone and deployed-flow checks remain open.

## Cinematic arena replay — October 18 (Alan / Codex)

- Implemented locally on `codex/cinematic-arena-replay`: user explicitly requested cinematic replay to make Perceptron's contribution visible, then required the knockout as the last highlight. Owned paths: `web/src/replay`, minimal `ArenaScene`/`FlightApp`/dev-route composition, recorder lifecycle and docs. No combat/server/provider contracts, dependencies, manifests, deployment or external messaging.
- Goal/interface: record bounded local copies of existing `arena` frames and `saberResolved` events on the webcam recorder's monotonic start time. Replay Perceptron's actual chosen intervals with a new camera director, slow motion and effects from recorded server outcomes. Keep webcam evidence accessible; label server-only fallback selections.
- Acceptance: meaningful capture/timeline/director tests, full frontend suite/build/typecheck, browser QA with explicitly synthetic fixtures and graphics fallback. Real consenting-duel capture and physical-phone performance remain human checks. No new paid inference is needed for camera presentation.
- Delivered: bounded opening/closing motion capture, continuously replayed joints/blades/cells, Perceptron-directed earlier scenes, server-confirmed finishing blow always last (including after the webcam's 45-second cap), orbit/low/overhead cameras, speed ramps, impact freeze, sparks/shock ring/camera kick, wipes, captions, seeking, simple graphics and Reduce motion support. Forfeits/missing terminal events never produce fake knockout scenes; projectile outcomes cannot be mistaken for an earlier saber hit.
- Validation: frontend production build/typecheck passed; 259 tests passed, one opt-in live-network test skipped. Nine new capture/director checks include a three-minute match's retained kill shot. Browser verified Mars rendering, full reel reaching the final knockout hold, distinct camera views, simple graphics, seeking and 390/390-pixel mobile layout. Fresh warning/error logs after fixing an initial duplicate-key warning were empty. The preview now includes a sidestep. Existing Node/Vite support and large-chunk warnings remain.
- Handoff: `docs/perceptron-replay.md`. New environment variables: none. Preview `/?dev=replay` is synthetic throughout. No new inference, deployment, commit, movie export or physical-device/full-duel claim. Local preview server is intentionally left running for Alan's review. Actual consenting-duel/provider-to-3D QA remains open, so not moved to Done under the team's deployed/device acceptance rule.

## Perceptron highlights — October 18 (Alan / Codex)

- Doing on `codex/perceptron-highlights`, explicitly resumed by Alan from the interrupted cinematic replay session. Goal: opt-in local webcam recording and post-duel Perceptron-directed highlight playback.
- Owned scope for this task: new replay modules, minimal ArenaDuel/FlightApp composition, server integration/route, networking RPC and shared contracts, Vite replay proxy, documentation. Existing exploration work is excluded; no manifests, lockfiles, combat rules, deployment or paid inference.
- Interface: additive `replay:ticket` on the joined socket and bounded `POST /replay/:matchId` authenticated with a short-lived ticket. See contracts decision. Coordination handoff for B (transport) and D (provider) is recorded here and in `docs/contracts.md`; no external team messaging is authorized.
- Acceptance: builds/typechecks, authorization/deduplication/parser tests, local recording/playback checks. Actual Perceptron key, accepted video format and physical-device inference remain open; Alan confirmed the key is not configured.
- Update: Alan configured the key and explicitly requested testing. Real authenticated Mk1.5 clip + track requests passed on a 4.5-second synthetic WebM (1039/2610 ms); the app parsed one interval and eight boxes. No real-person footage was uploaded. Evidence/request IDs: `docs/sponsor-evidence.md`.
- Implementation/local validation complete: server build + 101 tests; web typecheck/production build + 250 tests passed, one opt-in live-network test skipped. Synthetic in-app-browser capture/consent/playback/framing/discard verified, including 390-pixel layout and clean warning/error logs. Existing build warnings: Node 22.11 is below Vite's 22.12+ supported range; large exploration chunk.
- Handoff: `docs/perceptron-replay.md`. New server-only env: `PERCEPTRON_API_KEY`, optional `PERCEPTRON_MODEL`. No deployment/commits or new dependencies. Actual consenting duel end-to-end, Safari/physical-device QA and deployed backend integration remain open, so this is not marked Done under the team's deployment/device definition.

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

## Alan exploration integrated into current alex-dev — October 18

Feature port from `origin/alan` `b637186`: free flight, destination search/catalogs, planet inspector/cutaways, textures and provenance. Cockpit Seat → hyperspace → exploration added; Bridge returns to the same session. Imported exploration challenges delegate to the current cockpit launch action and current Mars travel/saber flow; the older camera-duel handoff was removed. Existing swipe/orbit/knockback server and audio implementation preserved. Production build passes (lazy exploration catalog chunk-size warning); frontend 223 passed / one opt-in skipped. Browser universe, Earth/Mars inspector and cockpit entry verified; return/live challenge and physical phone/performance QA remain. No new dependencies, keys, server contracts, deployment or push. Handoff: `docs/exploration-integration.md`.

## Shared button feedback — Alex branch

Applied the supplied button handoff visual treatment globally: hover grow/glow/icon nudge, press/focus/reduced-motion. Actual onboarding hover/focus checked in browser; build passed. Concurrent audio revisions are preserved separately and are not part of this visual commit. No server/contract/env changes. See `docs/button-feedback.md` for scope and verification.

## Result preview VS alignment

Adjusted only the standalone `web/duel-result-preview.html`: removed VS rotation, reduced skew to -6 degrees, and centered it on both pilot name plates. Browser verified shared vertical center and Victory/Defeat toggles; diff whitespace check passed. Production result wiring is still pending. No audio/server changes.

## Live Mars initiation overlay + shared countdown

Implemented on alex-dev: translucent one-task slides follow the existing real setup wizard, live hold/sensor feedback, wider right-side avatar framing, existing bottom-right self-camera, per-step confirmations, waiting/readiness and recovery states. Server publishes and enforces shared 3–2–1; phone status follows the same gate. Backend 95 passed, frontend targeted 32 passed, production build passed. Labelled synthetic UI review verified over Mars; physical two-player camera/phone QA pending (Alex will test). Host must run the updated backend as well as frontend. No deployment/push. Handoff: `docs/saber-initiation-overlay.md`.

## Saber initiation heading refinement

User-requested presentation adjustment: task wording moved to one straight horizontal heading at the top center, with the supporting sentence beneath it. Feedback remains left; avatars and bottom-right camera remain visible. Owned paths: SaberInitiation component/CSS and handoff notes. No calibration, countdown, combat, or interface changes. Production build passed; browser review confirmed the straight centered heading and visible avatar/camera areas in the labelled synthetic preview.


## Approved avatar-square initiation in the real game

Goal: integrate Alex's approved cinematic preview into the production saber setup. Owned paths: ArenaDuel wrapper, ArenaScene setup-only rendering/camera, SaberInitiation component/styles, matching labelled preview, and handoff notes. Interfaces unchanged; no server, phone input, camera calibration thresholds, combat rules, or provider changes. During setup the existing canvas fills a square with the player's real tracked avatar; rival and Mars combat view return at authoritative GO. Copy uses animated blue plates, laser transitions, sensor/hold feedback and LYRA's portrait. Four-arrow quick-swipe instructions appear while waiting for the other pilot and are available from Movement controls. No extra local readiness gate. Validation: production build/typecheck passed; 32 focused frontend regressions passed; labelled production-component preview verified avatar/window bounds match, pairing card, waiting/swipe help and Back button, shared countdown transition to full Mars, and phone-loss recovery. Browser console had no warnings/errors. Actual two-device QA remains user-operated. No push/deployment.


## Top progress + LYRA-guided setup

Alex approved proceeding from the concept. Owned paths: SaberInitiation component/styles and handoff notes. Six rectangular progress segments move to the top; active fill comes from the real calibration hold, completed segments remain filled, and the duplicate left progress bar is removed. LYRA's portrait and per-task written cue now lead the instructions, with a brief halo/waveform animation and replay control. This is silent visual guidance, with no voice API requests, cost, new keys or dependencies. No calibration/countdown/phone/server contract changes. Production build/typecheck and 32 focused tests passed. Browser review of the labelled production-component preview verified segment fill and advancement, matching LYRA cues, and all six completed segments remaining visible during movement help; no console warnings/errors. Physical two-device QA remains pending. No push/deployment.


## Swipe guide size and placement

Small presentation adjustment authorized by Alex: moved the instructional swipe phone out of the left text column into the space between SWIPE TO MOVE and the avatar, with a larger four-arrow/finger animation. Narrow screens stack it below the avatar. Owned paths: SaberInitiation component/CSS and this note; no gameplay/input/API changes. Production build/typecheck passed; browser review confirmed larger four-arrow guide sits between the text and avatar without overlap in the labelled preview.


## Simplify initiation to match the approved reference

Alex requested less text, short LYRA cues, swipe help replacing the avatar inside its square, and prominent QR pairing over the avatar. Owned paths: SaberInitiation component/styles and handoff notes. Removed the sensor cards, extra hold caption and next-step label; secondary controls/notes live under Setup options. Pairing and swipe illustrations occupy the existing square only while needed; real avatar returns otherwise. Top measured progress, errors, calibration, countdown and phone command path are preserved. No APIs/spending. Production build/typecheck and 32 focused tests passed. Browser review confirmed short cues, reduced text, the swipe phone replacing the avatar in the square, and prominent QR pairing; no console warnings/errors. Physical device QA remains pending.


## Arrival goes directly into saber setup

Alex requested removing the obsolete Flight Systems briefing page. Owned paths: FlightApp, its exceptional-entry-error style, one stale ArenaDuel waiting string, and handoff notes. Travel arrival renders ArenaDuel directly and sends the existing server ready command once per arrived match/client. Removed the embedded briefing Voice iframe, duplicate Ready action and voice-stop wait. Server readiness, measured calibration and authoritative saber countdown remain intact; camera still requires Start camera. A failed ready acknowledgement offers an explicit retry without auto-looping; leaving invalidates its outstanding UI result. No server/contracts/API/dependency changes. Production build/typecheck passed and 58 focused client/travel/setup/countdown/swipe tests passed. Full physical two-player arrival test remains pending; no push/deployment.


## Early setup avatar feedback

Alex reported the avatar appearing only near the end of training. The old local fighter replacement required an echoed server body/blade and calibrated phone; early setup could fall back to delayed server rendering. Owned paths: ArenaDuel, localFighter helper/tests and handoff notes. Setup now draws fresh stabilized local camera joints immediately, including before any arena frame or phone data; it keeps the existing server/phone blade when available and hides a lost/stale local body. Combat rendering, readiness and server damage remain unchanged. Pairing/swipe panels intentionally cover the avatar. Production build/typecheck and 31 focused tests passed, including four regressions for first-frame body feedback without phone/server data, slot-2 placement, tracking loss and preservation of server metadata/blade. Physical camera validation remains pending.


## Intermittent travel reset + immediate setup saber

Alex reports occasional return to cockpit during travel and wants the saber with the initial avatar. Owned paths: FlightApp, per-tab arena journey helper/tests, useServerLobby, only the travel-lifecycle hunk in SpaceshipHome (preserve concurrent sound edits), localFighter/ArenaDuel/setup label and tests, handoff notes. Latch travel until arrival instead of resetting it on lobby snapshots; restore launch/arrival across frontend remounts using the authoritative match and both pilot IDs; show finished matches rather than auto-leaving them unseen. A display-only upright saber follows the initial tracked wrist, then measured phone aim; combat still requires real calibration and server GO. No server/contracts/provider changes. Production build/typecheck and 72 focused tests passed, including journey restoration/identity/reset/storage cases and early saber direction/hand/authority regressions. The exact intermittent failure has not yet been reproduced on Alex's devices; fresh two-player travel testing remains pending. No push/deployment.

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


## saber-duel merged into alex-dev — October 18

Source: origin/saber-duel at 7e8d387. Preserves the current cockpit/exploration, direct travel-to-setup flow, persisted journey, early camera avatar/display-only saber, compact LYRA slides, prominent QR and in-square swipe help. Integrates stamina, guard breaks/stun, rematch/forfeit, saved callsign, and the bundled travel-video fix. Removed legacy rock/gun commands and unused old camera-duel routes per Justin's lightsaber-only branch.

Calibration now uses five measured tasks: phone → stand → upright → right → reach, then done. Both phone and laptop follow that same order. One authoritative startup gate drives ArenaFrame.saberStart and view/phone startsInMs; pre-GO tracking loss cancels and restarts three seconds, local timer expiry cannot enable combat. Rematch resets the gate while keeping camera and measured calibration mounted. The phone clears a cancelled countdown and waits for actual server readiness before FIGHT.

Validation: 98/98 server tests passed (including sockets, rematch, stale-input countdown cancellation and recovery); 149 frontend tests passed, one opt-in live test skipped; frontend typecheck/production build passed. Existing large exploration chunk warning remains. Physical two-player camera/phone/travel and rematch QA remains necessary. No new dependencies, environment variables, provider calls, deployment or push. Uncommitted audio/LYRA work in the main checkout is preserved separately.

## Multiplayer exploration + LYRA guide — October 18 ~03:00 (Alan / Claude, on `alan-team-merge`)

- Goal: start fights from free flight; see other pilots in the universe; LYRA guides exploration. Paths: `web/src/ui/screens/ExploreApp.tsx`, `SpaceshipHome.tsx` (drive handoff props only), `web/src/ui/components/explore/{RivalShips,pilotLocation}.ts(x)`, `ExploreScene`/`LocalUniverseScene`/`ExploreHud`/`destinations` (props/helpers), `web/src/voice/{ExploreCopilot.tsx,exploreLyra.ts,exploreLyra.css}`, `CopilotVoice.ts` (optional extension), server `contracts.ts` + `sessions/index.ts` (`setLocation`, see docs/contracts.md).
- Challenge from free flight (Pilot contacts, a rival's ship label, or LYRA) → accept → Engage leaves free flight → cockpit Mars travel → briefing → arena.
- LYRA in free flight: unprompted, deduplicated thoughts from bundled NASA/JPL/HYG/Exoplanet Archive/GALEX data (arrivals, scale changes, inspector, rivals nearby, incoming challenges, idle facts/tips); chat with action buttons (jump / learn / challenge — the player always confirms). Grok Voice when the server has `XAI_API_KEY` (adds a read-only `getExploreState` tool); otherwise a labeled local guide with on-device browser speech recognition/synthesis (Voice toggle, off by default).
- Checks actually run: server build + 95 tests; web typecheck, 229 tests (11 new), production build. Headless Chromium, two Live pilots on the local server: location shown in contacts and LYRA, LYRA "Fly to Jupiter", rival ship + label at Jupiter, challenge prompt → incoming (B's LYRA announced it) → accept → Engage from free flight → cockpit → "Continue to Mars arena".
- Not verified: Grok Voice in exploration (no server key on this machine), microphone/on-device speech in a real browser, phone layout/performance, deployed shared server.
- HUD v2 (laptop focus): large "Return to bridge" button top-left; Flight / Explore tabs top-center (remembered per browser). Explore = peaceful: shows zoom / System view / Nearby stars controls, hides Pilot contacts and rival ships, and clears your reported location (you stay in the roster and can still receive challenges — server-owned). Telemetry card absorbs the scale box; status is one line; Pilot contacts moved bottom-right; LYRA moved bottom-left, clear of the planet inspector. Checks: typecheck, 229 web tests, build; headless two-pilot run (flight → challenge → Mars) and a peaceful-mode run (ships/location hidden both ways, restored on Flight, cleared on Return to bridge).

## SpaceX-track exploration: spacecraft models, time-lapse, Destinations v2 — October 18 (Alan / Claude)

- Spacecraft: schematic ISS (truss, 8 gold wings, radiators, module stack), Hubble, and Starlink v1.0 (single array) models from published layouts; arrays track the Sun; all 20 snapshot satellites drawn as models (no longer points), larger with distance-aware sizing and a far-range beacon. Starlink sample is 18 early v1.0 satellites (258–421 km, being lowered) — labeled as such.
- Orbit time-lapse: shared clock (pause / 1× / 60× / 600× / reset, T+ readout) propagates each record with the same two-body model; labels, click targets and visit travel follow live positions; holds while parked at a spacecraft. Starlink orbits drawn as a faint shell. Not live tracking.
- Destinations v2 (Motion): category rail incl. "SpaceX & ISS", search across all catalogs, animated list, keyboard (↑↓ Enter Esc), live preview with sourced metrics and an orbit sketch (satellites) or log distance bar (planets/small bodies/stars/exoplanets/galaxies). World panel name/blurb transitions; orbit-time control in world panel and Explore panel.
- Checks: typecheck; 235 web tests (6 new: ISS/Starlink/planet/star values, log axis, one-period return, clock hold/pause); production build; headless screenshots of Earth shell, ISS, Starlink, Destinations (desktop + phone). Not checked: real phone GPU performance with 20 models.

## Hover, cosmic zoom and object side views — October 18 (Alan / Claude)

- Hover reticle + name tag for spacecraft, nearby stars and galaxies (screen-space picker; wins clicks over meshes behind it). Earth shows ISS, Hubble and 6 of 18 Starlinks as models; all 20 remain searchable/visitable and modeled when selected.
- Continuous zoom extended: Earth → system → nearby stars → Milky Way (disk at the real galactic center/plane, artistic art) → GALEX galaxy atlas at catalog positions. Past the nearby stars the zoom pivot blends smoothly to the galactic center and back (no jump); presets for Milky Way / Galaxy view. Distances read in ly / thousand ly / million ly.
- Clicking any object opens the planet-archive side view (ObjectPanel: orbit sketch or log distance bar, sourced metrics, catalog-data tab) and flies the camera to frame it on the left when it's in the local view; spacecraft hold still while inspected. Planets keep PlanetPanel.
- Checks: typecheck; 240 web tests (incl. smooth stars→Milky Way zoom and return-home tests); build; headless click-through of Starlink, nearby star and galaxy panels. Not checked: real phone performance.

## SpaceX additions — October 18 (Alan / Claude)

- New importer `web/scripts/import-spacex.py` → `explore/data/spacex.json` (dated, SHA-256 per source, raw responses cached in ignored `.catalog-cache/spacex/`, never overwrites on failure). Sources: CelesTrak GP + SATCAT (Crew Dragon 13, Dragon CRS-35, TESS), NASA/JPL Horizons osculating heliocentric elements (Tesla Roadster −143205, Europa Clipper −159, Psyche −255, Hera −91), Launch Library 2 (13 SpaceX vehicle configs, 20 boosters, 26 Dragon capsules, 27 Starship launches, 25 NRO launches; dev mirror fallback if rate-limited).
- Both Dragons have the ISS's orbital elements → shown docked on the ISS model (Harmony forward/zenith ports), searchable, framed with the station. TESS on its high orbit (log-compressed beyond 630 km altitude; LEO display unchanged). Roadster + probes as schematic models on their heliocentric orbits, cyan points from afar, hover/inspect/visit. Full Starlink fleet intentionally not shown.
- Destinations: "SpaceX & ISS" now includes Dragons, Roadster and Falcon-launched craft; new "Deep-space craft" category; new "SpaceX fleet" view (vehicle launch/landing cards, booster reuse chart, Starship flight timeline by outcome, NRO launch-by-year chart, Dragon capsule list). Starshield: no public orbits — NRO launch records only, labeled as such.
- Checks: typecheck; 245 web tests (5 new SpaceX snapshot/orbit/docking/TESS/fleet tests); build; headless screenshots of fleet view, Roadster preview + flight, ISS with Dragons. Not checked: phone performance.


## Alan exploration update integrated — October 18

Source: origin/alan-team-merge at f7e5700. Its two new feature commits dde44fe and f7e5700 were applied onto alex-dev's existing b637186 exploration port, rather than reintroducing the retired camera/rock/gun paths from the older branch history. Adds branded exploration HUD, categorized destination search, SpaceX fleet snapshots and schematic craft, object side views, cosmic zoom, orbit time controls, rival ships/coarse reported locations, peaceful Explore mode and the exploration LYRA guide.

The cockpit still owns accepted-match launch, travel persistence and direct saber setup. ExploreApp retains onBattleLaunch and receives the existing copilotClient; new location commands use the normal authenticated/deduplicated server command path. Current phone saber UI, shared countdown, rematches, early avatar/saber feedback and committed sound changes remain intact. New setLocation and optional Pilot.location are documented above; host must run the updated server for those location reports. No new dependencies or environment variables.

Validation: 100/100 server tests and 177 frontend tests passed (one opt-in live test skipped); frontend typecheck/production build passed with the existing large exploration chunk warning. Browser smoke test verified Universe ready, branded HUD, destination categories, SpaceX fleet records and a state-aware local LYRA answer, with no captured warning/error logs. Grok Voice/provider calls, actual two-player camera/phone launch and sustained mobile performance were not tested during this integration. No deployment or external messages. Sound/LYRA changes were pushed separately as 39500ba; this exploration integration is local pending a later push request.


## Replay integrated on alex-dev — October 18

Applied replay-only source commits 4caf1d3 and 283f824 from origin/codex/cinematic-arena-replay. The preceding 09b5291 changes cockpit/exploration mode presentation and was excluded from this replay integration. Alan's exploration feature commits were already integrated; no second exploration merge was performed.

Adaptation preserves direct travel-to-setup, compact LYRA initiation, fresh local avatar/saber preview, authoritative countdown, guard breaks/stamina, mounted camera/calibration and rematch controls. Enable recording under Setup options; webcam capture starts only at actual combat readiness. Finished results contain the local video and cinematic panel. Removed the retired live projectile event subscription; historical replay weapon labels remain local to replay code. Optional MatchSnapshot.round / PlayerView.round starts at 1 and increments on rematch; capture, result UI, upload tickets and cached analysis are isolated by round. A regression verifies an old round's ticket cannot access a later round and that later analysis does not reuse old output.

The replay HTTP route honors the configured ALLOWED_ORIGIN list; use the public frontend origin there for a separately hosted frontend. PERCEPTRON_API_KEY (optional PERCEPTRON_MODEL) belongs only in ignored server/.env on the actual host. This integration made no provider calls or uploads and did not deploy or change running-host configuration.

Necessary checks only: frontend build/typecheck passed; 50 focused replay/recorder/networking/local-fighter/buffer/countdown-display tests passed; server build plus 33 replay HTTP/parser/match/rematch/countdown tests passed. Inference is mocked in transport tests. No broad full-suite rerun or browser/device walkthrough was performed. Physical capture-to-real-provider playback remains an acceptance check for the team. Existing exploration chunk-size warning remains. Not pushed.

## alex-dev merged into saber-duel — October 18

- Resolved six conflicted files (see docs/contracts.md for the decisions) and threaded the arena world into the cinematic replay and exploration copy.
- Checks actually run after resolution: web `tsc --noEmit` clean; web vitest 193 passed, 1 opt-in live test skipped; `vite build` OK (existing large ExploreApp chunk warning); server `tsc` clean; server tests 111/111.
- Not verified: a live two-client match on Mars and on Neptune through the new direct-to-setup flow, phone hold-to-ignite on a real iPhone, replay capture on Neptune, exploration → challenge → Neptune travel. Not deployed or pushed.

## Mars arena platform and dust handoff — `feature/mars-arena-saber-duel` (not merged)

- Goal: embedded bronze/steel combat platform in the Jezero terrain, layered canyon walls, wind dust, and a seamless `spacetomars.mp4` → live-scene handoff through the video's final dust (mirrors the Neptune arrival). Video unchanged.
- Platform: walkable floor at the sampler's `floorY` (fighters and `heightAt(0,0)` unchanged in use); terrain mesh dips under it via `groundAt`; rocks kept off the deck.
- Review: `/?journey=mars` (add `&skip` for the reveal only), `/?dev=arena` (Mars synthetic fighters).
- Checks run: web typecheck, vitest (99 passed / 1 skipped), vite build; server tests (98). Headless-browser screenshots of the handoff and arena. Not yet exercised in a live two-player match or on phones.

## Arena battle HUD — `feature/arena-health-ui` (merged into main October 18)

- Brand-kit HUD over the arena (`web/src/arena3d/BattleHud.tsx`, `battle-hud.css`): name plates, segmented health with damage trail, stamina with the recover-at-40 mark, hit/knockback/guard-break/stun call-outs, combat log, LYRA line, K.O. → winner card (rematch controls kept). Display only; avatars, combat rules and networking unchanged.
- No round timer exists on the server, so the centre clock shows elapsed duel time and the winner card shows DUEL TIME (mockup "time left" needs a backend timer first).
- Preview: `/?dev=hud` (scripted duel over the synthetic arena). Checks: web typecheck, vitest, build; headless screenshots at 1440×900. Not yet seen in a live two-player match.
