# Continuous local zoom — bounded upgrade

## Goal, ownership and interface

User-authorized follow-up: smoothly zoom Earth → authored solar system → nearby catalog stars, approach a star, and return without a loading reset. Owned paths: exploration components, ExploreApp, exploration CSS, frontend README and status/handoff docs. Interface: local navigation state and optional zoom/telemetry props inside the frontend; FlightMotion accepts an optional proximity speed; other scenes retain their default speed behavior. No server/session/game command contracts, camera/duel code, shared manifests, dependencies, environment variables or deployments changed. Existing human branch `alan` and unrelated uncommitted changes were preserved.

## Behavior

- Scroll over the canvas, use +/− keys, or use Zoom in / Zoom out buttons. System view and Nearby stars view offer shortcuts through the same continuous camera movement.
- Earth and solar bodies remain mounted while the real local star field fades in. One camera-relative world transform changes rendering scale. The canvas remains mounted across local visits and return-to-Earth.
- The local layer contains **3,081 imported HYG stars within 25 pc**, plus an explicit Sun marker. No new catalogs or procedural star identities were added.
- Choose Sirius or another supported nearby star through Destinations / N, or select a rendered point and use Visit in its learning card. Local visits ease toward the star over 2.8 seconds, with a pullback during longer travel. Return to Earth reverses travel into the original Earth pose. Reduced-motion travel uses 0.35 seconds.
- Dialogs pause the transition and input; background-tab time is bounded. Stop cancels a transition in place; zoom and manual steering can interrupt it without a camera reset. Keyboard shortcuts ignore text fields and modifier combinations.
- More distant stars, galaxies, surface/close lunar scenes and exoplanet systems retain the existing destination-jump fallback. Seamless galaxy transitions/interiors are excluded.

## Scale and data honesty

The bridge is a designed visual compression: HYG source positions in the atlas's 10 units/pc are multiplied by 1,000, giving **10,000 authored solar scene units/pc**. This places all local stars in a common frame relative to the Sun while preserving their relative source positions. The pre-existing solar layout, oversized bodies and star approach markers remain illustrative, not ephemerides or true AU-scaled astronomy. The HUD calls this a compressed visual scale; source cards keep original pc/light-year values. Camera coordinates/speeds and zoom ranges are visual units.

## Changed files

New: LocalNavigation model (`localNavigation.ts`), its 8 regression tests, LocalFlightController and LocalUniverseScene. Integrated via ExploreScene, ExploreApp, ExploreHud and exploration CSS. SolarBodies and the existing point texture helper are exported for reuse; FlightTelemetry gains optional local navigation state. Catalog star copy now explains the varying render scales. An inspection-only canvas scene-instance attribute verifies that local transitions preserve the renderer.

## Checks actually run

- Full frontend suite: **132 passed, 1 live-network test skipped**. Eight new navigation tests cover reversible zoom, system/star levels, exact star/Earth round trip, pause/resume, bounded delta and stop, safe close zoom, camera-relative scale invariance and the 25 pc scope boundary.
- Final targeted navigation suite: **8 passed** after interruption/focus handling fixes.
- TypeScript/production build passed. The pre-existing large exploration chunk warning remains (~1.17 MB gzip with bundled catalogs).
- Browser: Earth → system → nearby stars reached 170,000 visual units; source star field faded in. The canvas scene-instance ID stayed identical after zooming, Sirius arrival and Earth return. Sirius learning card displayed 8.6 light-years and source metadata. Return settled at [98.9, 0.8, 37.0], stopped, with “Universe ready” and no loading reset. Warning/error logs were empty in that test tab.

Actual-phone gestures/FPS and deployed multiplayer lifecycle remain unverified. Touch zoom buttons are implemented; phone acceptance is still needed. No external deployment or teammate messages sent.

## Proximity speed and scroll tuning — October 18

User-requested goal: precise flight near the solar system, with faster outward zoom when sustained scrolling shows intent. Owned paths: local exploration navigation/controller/HUD, FlightMotion, regression tests and these frontend docs. No dependencies, server contracts, environment variables, deployment or combat changes.

Manual flight now uses one distance-based speed curve (0.45 × nearest body surface clearance, bounded to 1.5–120,000 visual units/s before Shift boost), replacing the compounded distance/render-scale multiplier. The velocity is capped as clearance shrinks, so approaching a planet sheds incoming momentum instead of retaining a fast drift. These are authored visual distances, not physical spacecraft speeds.

Wheel input uses half the previous sensitivity, bounds individual events, and limits queued travel. Events less than 180 ms apart build outward acceleration; the effort decays while idle and clears on reversal, pause, stop, steering or destination change. Inward scrolling starts from the actual camera position, with no queued outward target. The wheel dolly slows near bodies; explicit System/Nearby stars shortcuts remain brisk. HUD copy explains gentle versus faster scrolling. Touch buttons remain available; hardware phone gestures/FPS remain unverified.

Acceptance: six additional behavioral regressions cover near/far flight, fast incoming momentum, proximity wheel speed, burst/reversal/settling, oversized events/pause/stop, and the same scroll volume delivered rapidly versus spaced apart. Existing navigation and collision checks remain in place.

Final tuning validation: 138 frontend tests passed, 1 live-network test skipped; all 14 local navigation tests passed. Typecheck/production build passed with existing Node 22.11/Vite support and large catalog chunk warnings. Browser observed a gentle outward scroll moving Earth range from 22 to 24 visual units, repeated outward gestures increasing travel, inward scroll, Earth return, cruise at approximately 3 visual units/s near Earth, and Stop at zero. Warning/error browser logs were empty. Screenshot: `/private/tmp/universe-speed-tuning.png`. Actual-phone acceptance remains pending.

## Solar visibility and nearby names — October 18

User goal: easier solar navigation when planets appear dark. Owned paths: LocalBodyLabels (new), LocalUniverseScene, SolarSystem, PlanetEarth and exploration CSS, plus frontend handoff/status docs. Frontend learning-card callbacks only; no new catalogs, server contracts, dependencies, environment variables or deployment. Existing unrelated changes preserved.

Solar navigation lighting now keeps Sun illumination consistent across render scaling, adds soft ambient fill and a small texture-based fill on mapped bodies. Texture colors are no longer multiplied by the body's fallback tint; Earth retains its day/night shading with a gentler dark-side floor. These are illustrative navigation lighting choices, not photometric simulation. The local sky background intensity is reduced to keep objects distinct.

Screen-sized name buttons and small rings appear for the Sun, modeled planets/Moon and a selected nearby catalog star within 5,000 visual units, fading over the outer 2,000 units. Large close bodies keep a name beside their silhouette without a central ring. Names open existing learning cards and Visit actions. Offscreen labels, labels behind other bodies and overlapping labels are hidden; panels/dialogs remain above markers. Only the existing seven solar bodies plus a selected local star get DOM markers, rather than adding thousands of labels.

Checks actually run: TypeScript/production build passed; 138 frontend tests passed, one live-network test skipped. Existing Node-version and catalog-size build warnings remain. Browser checked solar overview labels, Jupiter name → science card → Visit Jupiter, and bright close-up Jupiter with a silhouette-adjacent name. Actual phone label density/touch acceptance remains pending. Screenshot: `/private/tmp/jupiter-navigation-label.png`.

Final overlay verification: nearby-star Sirius name observed; solar labels disappeared at 170,000 visual units. Replaced per-label Drei Html roots with one bounded DOM overlay to avoid a React nested-root cleanup warning. Fresh final Jupiter scene had no warning/error logs and its name button opened the science card. Final build and full frontend suite passed after the replacement.
