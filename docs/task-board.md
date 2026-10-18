# Initial task board

## KO.rbit rebrand and exploration entry — October 18 (Alan / Codex)

- Doing on `codex/ko-rbit-brand-exploration`. Goal: change visible title/corner branding to KO.rbit, add a branded exploration intro, and make the top-left destination card collapsible.
- User-authorized owned paths: onboarding, exploration/cockpit UI, shared frontend brand styling, HTML title and docs. Preserve unrelated `.vscode/` files. No server/game/provider contracts, manifests, dependencies or deployment changes.
- Interface: existing exploration props stay compatible; an internal entry choice selects Explore/Flight before the scene mounts. The destination card uses native button disclosure semantics, with keyboard support and a stable details region.
- Acceptance: frontend build/typecheck and existing tests, browser checks for title casing, intro entry/mode selection and repeated mouse/keyboard destination toggling; phone-width visual check. No new tests are needed for copy/CSS alone.

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

- B (Justin): **laptop + iPhone lightsaber duel in a shared 3D arena** merged via `main`/`saber-duel` into `alex-dev`. Server 3D collision/pairing, laptop arena (`web/src/arena3d`), phone saber (`web/src/saber`, `/?saber=CODE`). Scripted socket proof done; real laptop/iPhone QA still open — check `/?dev=arena` first.
- C (Alan): live duel gestures — rock palm→fist→fling; gun fist-hold then index+middle fire; saber fist-hold + lateral slash (Wii timing window). Still on `createGameClient`. Phone QA in `docs/qa-checklist.md`. Lobby / Photon deferred. Saber arena (B) is now the FlightApp duel path; rock/gun CV remains on `/?camera=1` and `/?pvp=1`.
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


## Exploration flight repair — October 17 (Alan / Codex)

- Goal: reliable free flight, explicit scene readiness and visit/learn navigation. Owned paths: existing exploration components, ExploreApp and exploration CSS. Frontend-only interface; no server/duel contracts or environment variables changed.
- Implemented: value-based spawn reset (fixes the 10 Hz teleport loop), W/S thrust and reverse, arrows/drag steering, strafe/lift, brake/cruise, blur/modal input reset, body safety spheres, direct body visits, searchable navigation, artistic galaxy destination, learning cards and source links.
- Rendering: custom shaders now participate in logarithmic depth; missing optional textures fall back, shader failure has retry UI, and quality reduction no longer remounts the flight controller. Procedural stars occupy a volume; scale labels no longer imply measured light-year travel.
- Checks actually run: frontend typecheck; production build; 117 frontend tests passed, 1 live-network test skipped (includes 8 new flight/destination regressions). Build warns that installed Node 22.11.0 is below Vite's supported 22.12+ range, but completes.
- Browser evidence: lunar cruise moved from z=32 to z=9.5 and Stop held the new position; clean graphics logs in the repaired lunar scene; readiness/artwork feedback, destination search pausing flight, and Earth/Jupiter learning cards observed. Jupiter arrival and return to Earth at [98.9, 0.8, 37.0], stopped and facing Earth, were verified. Renderer warning/error logs were empty after the final repair. Keyboard input changed position. No actual phone performance or end-to-end duel claim; those remain human integration checks. No deployment performed.
- Handoff: docs/exploration-flight-handoff.md. Status: implemented and locally checked; phone acceptance pending.

## Real universe catalog expansion — user-authorized follow-up

- Goal/owner: Alan / Codex, exploration UI and local catalog import. User explicitly requested this scope expansion beyond the original feature freeze; no deployment or combat changes.
- Imported local snapshots: 24,835 HYG stars, 5,301 NASA archive planet records across 3,894 hosts (<1,000 pc), 1,034 published GALEX Atlas galaxies hosted by NASA/IPAC NED.
- Implemented catalog categories/search, star and galaxy coordinate frames, selectable batched points, illustrative host systems, sourced learning facts/siblings, data credits and reproducible import/integrity scripts. No server contract/dependency/environment-variable changes.
- Handoff/source limitations and acceptance evidence: docs/universe-catalog-handoff.md. Phone performance and deployed end-to-end flow remain pending.
- Final local validation for catalog expansion: SHA-256/source integrity script passed; 124 frontend tests passed, 1 live-network test skipped; production typecheck/build passed with an exploration-chunk size warning. Browser verified TRAPPIST-1 facts/siblings, Andromeda archival facts, cross-layer Sirius travel and moving cruise; fresh renderer logs clean. Implemented/local checks complete; phone acceptance pending.

## Continuous local zoom — user-authorized bounded follow-up

- Goal/owned paths: exploration UI and local camera only; Earth → solar system → nearby stars → Earth without renderer reset. Interface is frontend zoom/telemetry; no server or combat changes.
- Implemented scroll/+−/touch-button zoom, persistent local canvas, 25 pc HYG layer (3,081 source stars), smooth approach/return, camera-relative render scaling, source-data labels and existing jump fallback outside the local scope.
- Validation: 132 frontend tests passed, 1 live-network test skipped; 8 targeted navigation regressions passed after final fixes; typecheck/build passed with existing catalog chunk warning. Browser canvas-instance ID stayed identical through zoom, Sirius visit and Earth return; source card and clean renderer logs observed. Actual-phone/deployed acceptance pending.
- Handoff: docs/local-zoom-handoff.md. New environment variables: none. No deployment or external messaging.

## Proximity flight and intent-aware zoom — October 18

- Goal/owner: Alan / Codex, user-authorized precision near bodies and faster sustained outward zoom. Paths: exploration navigation/controller/HUD/motion/tests plus frontend docs. Optional local proximity-speed interface only; combat, server, dependencies, environment variables and deployments excluded.
- Implemented: single proximity speed curve with immediate incoming-velocity limit; gentler bounded wheel input; decaying outward acceleration for rapid successive gestures; immediate reversal discards pending outward travel; stop/pause/steering reset scroll effort.
- Acceptance/checks: 138 frontend tests passed, 1 live-network test skipped, including six new behavior regressions; typecheck/production build passed with existing Node/catalog-size warnings. Browser verified wheel zoom, Earth return, slow close cruise and Stop with clean warning/error logs. Actual phone gestures/performance remain unverified.
- Handoff and changed paths: docs/local-zoom-handoff.md, latest tuning section. No new environment variables or blockers for local implementation.

## Solar visibility and body labels — October 18

- Goal/owned paths: Alan / Codex; user-authorized brighter solar navigation and nearby names. Exploration lighting, local body labels and CSS/docs only. Interface: existing onLearn callback; no server/combat/dependency/environment changes.
- Implemented: scale-stable Sun/fill lighting, original texture colors, gentler Earth dark side, subdued local sky, clickable screen-sized names/rings with distance fade and occlusion/overlap/offscreen suppression. Existing learn/Visit flow retained.
- Checks: 138 frontend tests passed, one live-network test skipped; typecheck/production build passed with existing warnings. Browser verified overview labels and Jupiter label/card/visit/close lighting. Phone acceptance pending. No deployment or external messages.
- Handoff: docs/local-zoom-handoff.md, latest section; changed files listed there. No new environment variables.

## Local solar catalog expansion — October 18

- Goal/owner: Alan / Codex, explicit user request to complete planets and add ISS/Starlink/asteroid/comet catalog detail. Owned paths: exploration UI/data/importer/docs only. Frontend destination/science kinds extended; server/combat/shared dependencies/deployment excluded.
- Implemented all eight major planets (Saturn rings); ISS/Hubble + 18 recent mirrored Starlink records; 42 asteroids/18 comets from NASA/JPL, including Halley, 67P, Ceres, Bennu/Ryugu. Search/categories/source/epoch/facts, schematic selected objects/orbits and anti-solar illustrative tails. Earth's Moon remains the only natural moon in this bounded set.
- Snapshots are static at individual record epochs, not live tracking/current ephemerides. Satellite altitude and craft/small-body sizes exaggerated; Starlink is a sample. Final importer caches each successful response for two hours and uses a NASA-listed independent TLE mirror for Starlink after the initial full-feed download/import failure.
- Checks actually run: 144 frontend tests passed, one live-network test skipped; typecheck/build passed with existing Node/catalog chunk warnings; all ten raw source hashes verified against cached downloads; existing catalog integrity checks passed. Browser verified Saturn, ISS card/visit, Halley card/visit and 18 Starlink search results/source card. Phone/deployed acceptance pending.
- Changed paths, sources, limitations and screenshots: docs/local-solar-catalog-handoff.md. New environment variables: none. No deployment/external messaging.

## Planet-view reference integration and repair — October 18

- Goal/owner: Alan / Codex; user-authorized import/repair of supplied showcase animations, archive UI and planet dissections. Existing exploration UI/camera model/shaders/styles/docs only. Frontend inspect props; no server/combat/dependency/manifests/deployment changes.
- Repaired duplicate covering sphere, mismatched clipping/world coordinates, stale render scale and close-triggered destination reset. Actual textured Earth/cloud/atmosphere support clipping. Material state and overlays clean up.
- Added refined Motion springs/tab exits/shared underline/cards/counters, planet switcher, comparison circles, educational gravity arc, numbered highlighted layers and desktop leader lines; responsive sheet and reduced-motion handling. Exact supplied facts retained with provenance/confidence/snapshot labels.
- Checks: 150 frontend tests passed, one live-network test skipped; typecheck/build passed with catalog chunk warning. Five added tests cover framing/return/scale/cancellation/layer-data invariants. Browser Mars/Earth cutaways and source UI observed. Phone performance pending.
- Handoff: docs/planet-inspector-handoff.md. New environment variables: none. No deployment or external messages.


## Planetary travel roulette — merged from `mars-arena`

- Accepted match → cockpit roulette (Mars) → travel video → server-backed briefing → arena when both ready. Room scanning skipped.
- Roulette assets (textures, Sun map, flight video, attribution) committed. Mobile Safari / two-device QA still open.

## Cockpit Demo / Live + LYRA — on alex-dev

- Demo/Live switch, dock controls, hologram Voice: see `docs/hologram-copilot.md` and BridgeApp. Grok Bot planning bonus claimed in `docs/sponsor-evidence.md`.


## Live connected to Justin shared server — October 18

Alex: configured the merged frontend to Justin’s public Cloudflare multiplayer server; phone QR and saber client routing now use that same backend. Real test join + controller pairing passed; the shared roster saw the merged preview pilot. Build and 156 frontend tests pass (one opt-in skipped). No game/server rules changed. Justin’s running server lacks copilot RPC replies, so shared Voice still needs his backend updated. Physical two-player saber testing remains. Changes prepared on alex-dev for team integration; `.env.local` stays ignored. Handoff: `docs/shared-live-server.md`.

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
