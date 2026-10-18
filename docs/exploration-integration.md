# Exploration integrated into alex-dev

Source: Alan's `origin/alan` commit `b637186`. This is a focused feature port; Alan's older server, camera-duel wiring, and combat commands were not merged.

## Goal and owned paths

Bring the free-flight universe, destination catalog, planet inspector/cutaways, and imported datasets into the current cockpit. Owned integration paths: new `web/src/ui/components/explore`, `ExploreApp`, exploration styles, planet/sky textures and their attribution, import/validation scripts, plus small routing, pilot-seat, caption, and cockpit presentation changes. Current server rules, phone swipes, orbital motion, knockback, normal match composition, provider keys, and networking endpoints remain on their existing implementation.

## How to open

Normal flow: open the game → finish onboarding → cockpit → **Seat / Explore** (bottom dock). The camera settles into the pilot seat, then a short hyperspace transition opens exploration. **Bridge** returns to the same cockpit/session.

Direct exploration: `/?explore=1`. Optional destination: `/?explore=1&dest=visit-mars`. This isolated route has no live room connection; enter through the normal Live cockpit to retain connected pilots and challenge actions.

The local built frontend for this session is served at http://127.0.0.1:5195/.

## Integration decisions

- Added Alan's exploration scene, flight/navigation controllers, planet panel/cutaways, search/catalog data and provenance, textures, and reference handoff documents.
- Added a Pilot/Seat entry while retaining Radar, Console, Demo/Live, reset, and SOUND / MIX controls.
- Kept the current `BridgeApp`, `FlightApp`, server/game/networking code, `ArenaDuel`, current planetary roulette/video timing, and all shared audio files.
- Added optional `caption` to the existing hyperspace component. Existing onboarding retains its default caption.
- Added `pilot` to the frontend-only `LobbyView` union and camera pose map. No server wire change.
- Exploration receives the existing lobby view model and actions. Its optional `onBattleLaunch` callback calls the cockpit's existing launch/unlock action. A launching challenge returns from exploration to the current planetary travel/briefing/saber flow. The older `/?pvp=1` camera-duel handoff was removed from the imported exploration screen.
- Exploration uses the shared cockpit music/ambience bed and a jump cue. There is no new audio provider or new API key.
- The Mars surface's scene-only link is labelled **View Jezero terrain**. It does not bypass opponent acceptance to start a battle.
- The new feature keeps its own scene when active; the normal cockpit unmounts during exploration and remounts on return. Its readiness state resets on return before another travel sequence begins.

## Controls and data

Use the on-screen controls and destination search. Existing exploration controls include W/S thrust/reverse, A/D strafe, arrows/drag steering, Q/E vertical movement, Shift boost, Space Stop, N destinations, and touch alternatives. Planet selection opens facts, comparison, and supported interior views.

Alan's bundled snapshots include solar bodies, nearby/named HYG stars, NASA archive exoplanets, a published galaxy atlas, and a small local satellite/asteroid/comet catalog. Source/epoch/license/attribution records are retained in the data and texture attribution files. They are static snapshots; rendering uses compressed/exaggerated visual scales. The application does not fetch new catalog records or live satellite ephemerides while exploring.

## Verification

Combined frontend suite: **223 passed, 1 opt-in live-network test skipped**. This includes Alan's catalog/navigation/inspection/flight tests and the current audio/swipe/arena tests.

Production build/typecheck passed. Vite reports a 6.45 MB exploration chunk (about 1.20 MB gzipped); it is behind the exploration lazy import. Browser checks verified universe readiness/artwork loading, Earth inspection, Mars selection/dissection, and the normal cockpit Seat → hyperspace → exploration entry, with no console warnings/errors observed. The verification tabs closed before a final return-to-cockpit observation, so that UI callback and a live accepted challenge still need end-to-end device QA. Physical-phone gestures, sustained device FPS, and a full live two-player challenge from exploration remain device QA. No deployment or push is implied by this integration.

## Team handoff

This port intentionally does not mark all of `origin/alan` merged in Git ancestry. Later Alan updates should be compared against `b637186` and applied to the exploration feature, preserving the newer combat path. The imported historical handoff documents describe Alan's source branch; this document describes the combined branch.

No new dependencies, environment variables, server contracts, or provider access.


## Alan exploration update integrated — October 18

Source: origin/alan-team-merge at f7e5700. Its two new feature commits dde44fe and f7e5700 were applied onto alex-dev's existing b637186 exploration port, rather than reintroducing the retired camera/rock/gun paths from the older branch history. Adds branded exploration HUD, categorized destination search, SpaceX fleet snapshots and schematic craft, object side views, cosmic zoom, orbit time controls, rival ships/coarse reported locations, peaceful Explore mode and the exploration LYRA guide.

The cockpit still owns accepted-match launch, travel persistence and direct saber setup. ExploreApp retains onBattleLaunch and receives the existing copilotClient; new location commands use the normal authenticated/deduplicated server command path. Current phone saber UI, shared countdown, rematches, early avatar/saber feedback and committed sound changes remain intact. New setLocation and optional Pilot.location are documented above; host must run the updated server for those location reports. No new dependencies or environment variables.

Validation: 100/100 server tests and 177 frontend tests passed (one opt-in live test skipped); frontend typecheck/production build passed with the existing large exploration chunk warning. Browser smoke test verified Universe ready, branded HUD, destination categories, SpaceX fleet records and a state-aware local LYRA answer, with no captured warning/error logs. Grok Voice/provider calls, actual two-player camera/phone launch and sustained mobile performance were not tested during this integration. No deployment or external messages. Sound/LYRA changes were pushed separately as 39500ba; this exploration integration is local pending a later push request.
