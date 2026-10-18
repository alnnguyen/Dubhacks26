# Exploration flight repair

## Cause

ExploreScene passed a freshly spread spawn tuple on every render. ShipFlightController's reset effect depended on that array identity. Telemetry updates rerendered the parent about ten times per second and reset position, velocity and orientation. Quality fallback also keyed/remounted the whole Canvas. Keyboard W/S previously pitched instead of applying thrust; automatic cruise, limited mouse look and no keyboard brake made the controls difficult to understand.

## Implementation

All runtime edits are within web/src/ui/components/explore/, web/src/ui/screens/ExploreApp.tsx and web/src/ui/styles/explore.css. New files: flightMotion.ts (persistent simulation), flightMotion.test.ts (8 regressions), ExploreBoundary.tsx (optional-asset and renderer recovery). Existing modules changed: ShipFlightController, ExploreScene, ExploreHud, ExploreStars, SolarSystem, PlanetEarth, MilkyWay, LearnTargets, destinations, bodiesScience and scaleLevels.

Spawn comparison uses coordinate values plus explicit reset token. The controller uses a camera-relative world transform and keeps position through telemetry/quality changes. Keyboard/touch/drag controls feed the same motion update, with bounded delta, damping, pause/blur handling, braking and swept body exclusion spheres. W/S moves forward/reverse; A/D strafes; arrows or dragging steer; Q/E moves vertically; Shift boosts; Space stops; N opens destinations. Cruise and Stop provide click/touch alternatives. Touch sticks reset on release/cancel/lost capture.

Visit destinations face their selected body; same-destination visits can reset a lost flight. Search lists the existing planets plus authored environments and an artistic Milky Way overview. Learning cards retain existing science data and explicitly label fictional worlds/art. Distances remain compressed scene units. No real star catalog, ephemerides or continuous astronomical-scale mapping is claimed.

Shaders now include common/log-depth chunks so custom and built-in materials share depth encoding. Earth lighting follows the exploration frame. Optional assets have fallbacks, first-frame readiness is distinguished from artwork loading, and shader failure has a retry view. Standalone exploration does not generate mock incoming challenges. Existing external lobby integration stays available.

## Validation

- `cd web && npm run typecheck`: passed.
- `cd web && npm test`: 117 passed, 1 live-network test skipped.
- New tests cover repeated equivalent spawn arrays, explicit reset, thrust/reverse/brake, pause/resume delta, drag steering, boost collision prevention, ground clearance, turning while stopped and destination arrival/card consistency.
- Production build completed; Node 22.11.0 emits Vite's supported-version warning (20.19+ or 22.12+).
- Browser: lunar scene rendered with no warning/error logs after shader correction; cruise progressed from z=32 to z=9.5 and Stop preserved position. Keyboard input changed position. Universe/artwork status, search filtering/flight pause and Earth/Jupiter learning cards observed. Jupiter arrival and return to Earth at [98.9, 0.8, 37.0], stopped and facing Earth, were verified. Renderer warning/error logs were empty after the final repair. Browser interaction was interrupted during testing and resumed; checks above reflect only observations actually made.

Actual-phone touch, sustained FPS, missing-file recovery injection and full deployed bridge/duel lifecycle remain unverified. No deployment, new dependencies, environment variables or network contract changes. Preserve other owners' existing uncommitted changes. The exploration directory was already untracked before this repair; stage the intended exploration files deliberately during integration.
