# Navigable universe — implementation plan

Planning snapshot: October 17, 2026. Proposal only; no runtime changes or device verification performed for this plan. PLAN.md remains authoritative for the camera duel and feature freeze.

## Goal and scope

Extend the existing Three.js / React Three Fiber exploration mode into a navigable space map: board the ship, fly around planets, select a named star, jump there, pull back to a galaxy overview, and return home. Capture the sense of discovery and scale of [AstroGrid / Velon Space](https://velonspace.com/). This is a proposed implementation, not a claim about AstroGrid's internal architecture.

Owner: A. Owned paths: web/src/ui/components/explore/, web/src/ui/screens/ExploreApp.tsx, web/src/ui/styles/explore.css, new web/public/data/ assets and their attribution. Coordinate any cockpit entry changes with its current editor. Existing uncommitted files must be preserved. Implementation should use one human-owned bounded branch/worktree.

Interface: frontend-only flight state, destination selection and telemetry. No new network messages. Any later shared schema change requires B's coordination and a docs/contracts.md decision.

Exclusions: server, multiplayer rules, camera/vision/duel, provider integrations, root tooling/dependencies, deployment, live ephemerides, full universe catalogs and a new engine. No exploration renderer mounted during camera combat. New environment variables: none.

## What exists now

Source inspection confirms an app and frontend build/typecheck/test scripts now exist, superseding the original scaffold status in AGENTS.md.

- ExploreScene.tsx already enables logarithmicDepthBuffer and mounts the existing flight controller.
- ShipFlightController.tsx already has distance-scaled speed, floating-origin bookkeeping and flight telemetry. These need runtime validation, not duplicate implementation.
- scaleLevels.ts already provides illustrative scale bands. They are scene-distance mappings, not measured astronomical distances.
- MilkyWay.tsx already contains an artistic spiral disk and a fixed illustrative location marker.
- ExploreStars.tsx produces deterministic procedural points in an outer spherical shell: 30,000 low / 109,401 high. These are not HYG catalog positions. The shell is mostly empty inside, so it cannot by itself supply a convincing volumetric star journey.
- destinations.ts contains authored Sol, lunar, Mars and placeholder deep-field environments. ExploreApp.tsx changes destinations through the existing hyperspace transition and remounts the scene. These are separate authored scenes, not one continuous astronomical map.

## Build a hierarchy of spaces

Use detailed planet meshes nearby, volumetric star points at stellar scale, and a galaxy disk at galactic scale. Do not import one enormous universe mesh. A skybox supplies distant scenery; navigable objects need independent 3D positions, parallax, selection and metadata.

Maintain three frames: solar system, local stars, galaxy overview. Each frame defines an origin, axis convention, units, display scale and parent anchor. A location is a frame ID plus a position; a selected destination is a stable object ID. Keep measured source coordinates separate from exaggerated visual radii and gameplay spacing.

Use JavaScript number coordinates for navigation. Build GPU positions relative to the current render origin before conversion to Float32Array. Rebase object positions and camera together; shifting a parent around huge unchanged GPU coordinates can still lose precision through cancellation. Floating origin addresses position precision; logarithmic depth addresses depth-buffer precision. Neither supplies transitions between AU and light-year scales.

First release: explicit navigation commands move between frames under the existing warp transition. Later: crossfade levels of detail over a short transition while preserving the selected object's projected direction and parent anchor. Add hysteresis so hovering near a scale boundary does not repeatedly change frames. Do not promise seamless continuous scaling until both directions pass visual checks.

## Ordered tasks and acceptance

### 1. Validate and stabilize existing flight

Files: ShipFlightController.tsx, ExploreScene.tsx, ExploreHud.tsx, scaleLevels.ts.

Verify braking, speed ramps, touch release, keyboard blur, modal pause and resetting. Add a nearby-body safety radius so the ship cannot fly through a planet. Use bounded frame deltas after tab resume. Verify rebase with a deliberately low threshold, then restore its normal threshold. Derive the HUD's frame and units from explicit state; retain “illustrative scale” while using compressed coordinates.

Acceptance: fly, brake and reverse near a planet; cross the rebase boundary without visible jumps or changed target distance; open/close Nav without stuck movement; return to bridge. Do not mark these passed from code inspection.

### 2. Make stars into destinations

Files: new catalog.ts and StarTargets.tsx under explore/, ExploreStars.tsx, destinations.ts, ExploreHud.tsx; new public/data/star-targets.json and attribution.

Start with approximately 20–50 named nearby stars from a pinned HYG release. Preserve ID, name, source Cartesian coordinates in parsecs, source distance, source version and attribution. Document the conversion into the application's axes once. Filter invalid/unknown distance records. Render this small set as positioned points with selection proxies; retain procedural background stars with an honest label. Do not attach real names to arbitrary procedural points.

Add search plus a short destination list. Selecting a star shows its name, source distance, direction marker and Jump action. Reuse the hyperspace transition, arrive outside a safe exclusion radius, face the target, and clear velocity/input. Arrival should show the star and its information; do not invent known planets. Keep Home / Sol always available. Missing catalog assets must leave existing flight usable and show a specific loading error.

Acceptance: search Sirius, select it, jump, read sourced metadata and return to Sol. Selection and labels agree with rendered positions, including after a rebase. Failed loading and cancelling navigation recover cleanly.

### 3. Connect solar, stellar and galaxy views

Files: new explorationFrames.ts under explore/, scaleLevels.ts, MilkyWay.tsx, SolarSystem.tsx, ExploreApp.tsx.

Introduce explicit frame state and a Galaxy view command. Reuse the disk as clearly labeled artistic context. Locate the solar-neighborhood anchor consistently in the galaxy frame and derive the ship marker from navigation state; replace the current decorative fixed marker. Preserve a return anchor when entering a star system. Fade out detailed planets at stellar scale, and fade local stars into galaxy context. A later outer-universe layer can use a small authored set of galaxy markers, explicitly labeled illustrative unless sourced; it is outside the first acceptance gate.

Acceptance: Sol → named star → galaxy overview → same star → Sol is reversible and understandable. HUD units, target direction and marker agree with the active frame. The galaxy appearance is identified as an artistic reconstruction.

### 4. Phone performance and integration gate

Files: ExploreScene.tsx, ExploreStars.tsx, ExploreHud.tsx and exploration CSS only.

Start phones on low quality. Keep points batched, limit visible labels to the selected target plus a few important objects, cap pixel ratio and disable costly effects on low quality. Measure before increasing point counts. Avoid geometry rebuilds or React state updates every frame. Throttle telemetry updates. Ensure quality degradation preserves ship position/selection: the current Canvas key includes quality and can remount the controller. Dispose retired GPU resources.

Acceptance target: sustained 30 fps minimum on the two actual demo phones during a representative two-minute flight, without navigation resets or WebGL loss. This is a target, not a measured result. Repeat jumps, background/resume, touch cancellation and bridge → exploration → duel → bridge; confirm exploration resources unmount and camera combat still works. Verify the deployed flow only after an authorized integration/deploy.

## Verification and cuts

For implementation, run `npm run typecheck`, `npm run build` and relevant `npm test` checks from web/. Add focused tests for coordinate conversion, frame round trips, rebase invariance and safe arrival. Actual browser/phone checks remain required. No commands were executed as validation for this planning-only change.

Timebox the first playable enhancement to roughly 3–5 focused hours, contingent on existing flight stability and catalog preparation. Estimate only. Stop feature additions at the PLAN.md 10 p.m. Pacific freeze. If less time remains, ship stable existing flight plus named targets and Home; defer continuous scale transitions, additional galaxies, full HYG rendering, exoplanets, Gaia/2MRS/DESI streaming, gyro and live astronomy APIs. Exploration polish must not displace the working duel.

Demo: board → pass Earth → search Sirius → jump → show its distance → open galaxy view → show solar-neighborhood anchor → return to bridge.

Handoff records changed files, commands actually run, device/browser results, asset provenance, remaining visual limitations and blockers. Update docs/task-board.md with implementation status only when work is assigned or actually completed; this document does not mark anything shipped.

## Sources

- [AstroGrid / Velon Space](https://velonspace.com/): experience reference; assets and implementation are not copied.
- [HYG repository](https://github.com/astronexus/HYG-Database) and [license](https://github.com/astronexus/HYG-Database/blob/main/LICENSE): catalog candidate; retain attribution and the CC BY-SA 4.0 terms for derived catalog data. Pin the actual release before baking.
- [Three.js renderer documentation](https://threejs.org/docs/pages/WebGLRenderer.html): renderer capabilities and diagnostic counters. Check against installed Three.js 0.180 before using newer APIs.
