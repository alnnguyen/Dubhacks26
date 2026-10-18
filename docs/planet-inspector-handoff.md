# Planet inspector repair and reference integration — October 18

## Goal, ownership and interface

User provided `/Users/alannguyen/Downloads/planet-view/` and `/Users/alannguyen/Downloads/showcase.mp4`, requesting a working integration of the animations, UI and dissections. Owned paths: existing exploration components, ExploreApp, exploration styles, local facts and documentation. This repairs the existing partial Cursor import rather than replacing the universe. Frontend inspectId/cutaway/highlight props only; no server/session/duel contracts, camera/vision/overlay code, new dependencies, shared manifests, deployment or external messages. Unrelated work preserved on the human branch.

Reference documents were treated as supplied design/reference material, not independent authorization or executable instructions. One plan describes an imperative scene and pnpm paths that do not match this R3F/npm project; those assumptions were not imported. Its recording scripts, fake clocks and CDN/version replacements were not run or shipped.

## Imported reference and library choice

The supplied top-level video and showcase/showcase.mp4 have the same SHA-256: `35a6ba79baa8fe3fa0d542b3ddf22dfe06cf4eae0fd85f45a9e0fa86af218a97`. The supplied overview/dissection keyframes were visually inspected. The reference README says its video uses deterministic frame capture; it is not evidence of live phone frame rate.

The existing local planets-facts.json matches the supplied data exactly (SHA-256 `0c7c78128f3152bf367d6b2ede1c9125d924630fd84995fe089ced38bd596e61`). It includes eight planets and the Moon, fact-sheet sources and approximate interior fractions/confidence. Sources are retained in cards. Moon counts are labeled as the provided fact-sheet snapshot rather than live counts. Giant interiors retain model badges. Radius layers are simplified visualizations, not resolved scientific tomography.

Used already-installed Motion for React for springs, AnimatePresence exit/tab transitions, shared-layout tab underline, staggered cards, counters, comparison circles, atmosphere bars and an illustrative gravity-timing arc. Counters update DOM text rather than rendering React every frame. No camera-controls/GSAP dependency was needed; the existing ship/world transform remains authoritative.

Primary docs checked:
- https://motion.dev/docs/react-animate-presence
- https://motion.dev/docs/react-layout-animations
- https://motion.dev/docs/react-motion-component
- https://threejs.org/docs/pages/Material.html

## Repaired behavior

- Selecting a local planet opens an archive panel and flies the ship to a sunward inspection pose. Desktop framing puts the planet left of the sheet; portrait framing puts it above a bottom sheet. Resize/orientation updates the sheet. Existing nonlocal scene learning cards remain supported.
- The panel supports Overview, Dissection, Facts, vs Earth and Duel, a planet switcher, close/Escape/background dismissal, focus containment and source/Visit actions. Sun uses its existing card; the Moon has no dissection tab.
- Close returns to the original pre-inspect position/orientation, including after switching inspected planets. The destination reset effect no longer runs merely because inspectId changed. Floating render scale now updates during autopilot; Visit cancels a stale return target.
- Actual textured surfaces are clipped in place. Removed the duplicate solid sphere that previously covered the original globe. Two cap meshes follow camera-facing cut planes transformed into the current floating world frame every frame. Shader center/radius use that same frame. Materials are compiled on attachment/restoration, not invalidated every frame.
- Earth surface/cloud/atmosphere shaders opt into Three clipping chunks alongside logarithmic depth. On exit original material clipping/intersection settings are restored. Geometries/materials are managed by R3F; added DOM/SVG overlays clean up on exit.
- Dissection sweeps open/closed on tab changes. Clicking a layer highlights it; projected desktop leader labels correspond to numbered rows. On portrait the panel's layer list provides labels without crowding the globe.
- Flight HUD/body labels hide during inspection; background intensity is subdued. Reduced-motion preference/settings suppress large panel/camera transitions, counters and the looping gravity preview. Background tabs do not advance autopilot/cutaway time.
- Gravity preview is educational/display-only and does not claim to control or reproduce active match timing.

## Changed files

PlanetPanel, PlanetCutaway, inspectPose, useInspectFly, flightMotion, LocalFlightController, localNavigation, LocalUniverseScene, SolarSystem, PlanetEarth, ExploreScene, ExploreApp, exploration CSS. ShipFlightController's background-tab autopilot delta is bounded to zero. Added planetInspect.test.ts; retained the existing Cursor fly-to regression and supplied facts file. Data attribution/README/task-board/usage/handoff docs updated.

## Checks actually run

- TypeScript/production build passed. Existing large bundled-catalog chunk warning remains (~1.20 MB gzip exploration module).
- Full frontend suite: **150 passed, 1 live-network test skipped**. Five added integration-model tests cover all-body desktop/portrait framing, far-to-near scale update plus exact return, switch/mid-flight close, Visit cancellation and bounded ordered sourced layers. Existing flight/navigation/catalog checks pass.
- Facts and video checksums match supplied inputs as recorded above. No reference recording tools executed.
- Browser: fresh Mars inspect and textured dissection, switch to Earth and Earth shader dissection, numbered layers/source links and clean warning/error logs observed. Saved preview: `/private/tmp/planet-inspector-earth-cutaway.png`. Return/reopen evidence follows below.

Actual phone gestures/FPS and phone viewport acceptance remain unverified; no numeric frame-rate claim. No deployment performed. New environment variables: none.

Final browser round trip: after Mars → inspect Earth → Dissection → Close, flight returned to the original displayed Mars coordinates [87.0, 0.3, -99.7], stopped, with normal HUD restored. Reopening worked; vs Earth showed comparison circles and Mars gravity/size ratios; Duel tab selected the educational preview. Fresh Earth dissection and final runtime warning/error logs were clean. The initially observed off-target pose occurred during component hot replacement; fresh-load checks above were used for acceptance.
