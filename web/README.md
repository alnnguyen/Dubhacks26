# Browser client

The default page renders Ally’s 3D cockpit (`SpaceshipHome`) connected to the shared game server. The server owns challenges, Mars matches, readiness, combat, and results. Alan’s camera debug harness: `/?debug=camera` or legacy `/?camera=1`. Mars arena preview: `/?arena=mars`. Photon and Voice remain in their existing provider harnesses.

Combat on this page is **rock only** (screen-space overlay). Gun and lightsaber are deferred until the rock loop + phone framing pass. Defense is **Block**, not catch.

## Run (laptop)

```bash
cd server
npm run dev
```

In a second terminal:

```bash
cd web
npm run dev
```

Open the printed HTTPS URL (self-signed), usually `https://localhost:5173`, on both devices/browsers. Accept the certificate warning. For camera testing, append `/?debug=camera` (or `/?camera=1`) and click **Start camera**.

- Prefers rear ~0.5× / min zoom when the phone exposes it; otherwise shows “Wide lens unavailable — default rear.”
- Laptop with no rear lens falls back to the front camera and labels that clearly.
- `localhost` / Vite HTTPS both count as a secure context for `getUserMedia`.

## Phone framing gate (do this now)

Phones need a public **HTTPS** URL (plain LAN `http://192.168.x.x` usually cannot use the camera on iOS).

With the Vite server running:

```bash
# Cloudflare (no account required for a quick tunnel)
npx --yes cloudflared tunnel --url https://localhost:5173

# or ngrok (Vite allows .ngrok-free.app and .ngrok-free.dev)
ngrok http https://localhost:5173
```

Open the tunnel URL **with the camera harness** on the **demo phone** (either query works):

`https://YOUR-SUBDOMAIN.ngrok-free.dev/?debug=camera`  
(or `…/?camera=1`)

(Tap through ngrok’s interstitial if shown.) Allow camera, use the **rear / 0.5×** lens when the phone offers it, then check:

1. **Hand lock**: hold your hand low for ~2s; opponent’s hand must not fire lift/throw. Lost lock → Recalibrate (touch still works).
2. Own locked hand (green) and opponent pose health stub together in one frame.
3. **Ground rocks** in the lower third as soon as the camera starts.
4. Open palm near a rock (or hold **Lift**) → rock rises to the hand (`lifting` → `held`, larger while held).
5. Swipe + fist / **Throw** → rock arcs toward upper-center / shoulders + `releaseRock`.
6. Cover the lens / Cancel → rock drops; never accidental mid-flight launch from tracking loss.
7. Touch Lift / Throw / Block / Cancel emit the same command names as gestures.
8. Deny permission once and confirm a clear error (no crash).

This is a **screen-space overlay POC** (fake ground band + MediaPipe hand tracking). It works on iPhone Safari over HTTPS. Floor-mesh WebXR was removed (needs Android Chrome or a commercial WebAR SDK such as 8th Wall for real plane AR on iPhone).

Record pass/fail in `docs/task-board.md` or `docs/qa-checklist.md` with device/browser. This harness does not need A’s lobby or B’s WebSocket for the framing gate.

## Ownership notes

- C: `src/camera`, `src/vision`, `src/overlay`, `public/models`
- B owns WebSocket + frozen command schemas; this harness logs commands locally only
- D’s voice should release the mic during combat; not wired here
- Keep secrets out of client config
- No gun/saber on this harness by design (PLAN cut order)

## Cockpit integration check

Merged origin/cockpit-scene at 20124de into alex-dev. Combined React/Three/MediaPipe dependencies; retained camera HTTPS development support with a Vite 7-compatible SSL plugin. Tests: 53 frontend and 10 integration tests passed; production build passed. Browser cockpit renders without observed console errors; camera debug remains a separate route. Ally’s onEnterBattle/lobby props are the next game integration points. The existing demo-state branch remains separate.

## Connected local flow

Default cockpit launch now continues into Voice briefing and camera training instead of a handoff placeholder. See docs/flight-integration.md from the repository root for startup, limits and test steps. Start the local Voice server on port 8787 before using the briefing. Real multiplayer/Photon challenge wiring remains B’s integration gate.

### Real catalog exploration

Open `/?explore=1`. Destinations / N searches 24,835 HYG stars, 5,301 NASA Exoplanet Archive planets and 1,034 galaxies from the NASA/IPAC-hosted GALEX Atlas. Try **Sirius**, **TRAPPIST-1 e**, or **Andromeda**. Visit, fly locally, click the object or navigation focus to learn, and use Return to Earth to recover. Star and galaxy frames use separate linear units; system sizes/spacing/appearances are illustrative, not live orbital solutions.

Snapshots and credits: `src/ui/components/explore/data/ATTRIBUTION.md` and `manifest.json`. Runtime travel needs no external API calls or new keys. To validate source integrity from the repository root, run `python3 web/scripts/validate-universe.py`. Regeneration takes downloaded source files via `web/scripts/import-universe.py`; exact URLs and the NASA TAP query are in the manifest. Catalog regression tests run with the normal `npm test` command.

### Continuous local zoom

From Earth, scroll over the flight view or use +/− and the Zoom buttons to move out through the solar system to the nearby-star field. System view and Nearby stars view are smooth shortcuts. Choose Sirius in Destinations to approach it, then Return to Earth to fly back without reloading the renderer. The continuous layer uses 3,081 HYG stars within 25 pc; other catalog destinations retain jump navigation. Its bridge between the authored solar layout and stellar positions is visually compressed, not true AU scaling. See `docs/local-zoom-handoff.md` at the repository root for acceptance checks and limitations.

Flight automatically slows near planets and accelerates across open space. Scroll gently for precise zoom; repeated faster outward scrolling builds acceleration. Reverse the scroll to regain close control, or press Space / Stop to cancel movement. Shift remains a manual flight boost.

Nearby solar bodies now show small navigation rings and clickable names; large close planets keep the name beside their silhouette. Names fade out when leaving the system and hide behind nearer bodies or overlapping labels. Click a name for its science card, then Visit to approach. Solar lighting and a subdued star background improve visibility.

### Solar objects and spacecraft

All eight major planets are included, plus the Moon, ISS/Hubble, an 18-record Starlink sample, 42 asteroids and 18 comets. Try **Saturn**, **ISS**, **Starlink**, **Halley**, **Ceres** or **Bennu** in Destinations. New Satellites / Asteroids / Comets tabs filter the catalog. Learn cards include source links, record epochs, orbital elements and available physical facts. Visit displays a schematic object and its orbit; return to Earth remains available.

These are frozen orbital-element illustrations at each record's epoch, **not live tracking**. Satellite altitude ×5, object sizes and comet tails are exaggerated; planetary layout and rings are illustrative. Starlink is a bounded community-mirror sample, not the complete operational fleet. No new runtime keys/network requests or dependencies. Regenerate via `python3 web/scripts/import-local-objects.py` from the repo root (downloads cached for two hours); details/limits in `docs/local-solar-catalog-handoff.md`.

### Animated planet inspection

In the continuous local view, click a planet's name or its navigation-focus card. The ship approaches a framed view and opens an animated archive sheet. Switch between Overview / Dissection / Facts / vs Earth / Duel, or between planets using the small header buttons. Dissection clips the actual textured globe and shows approximate sourced layers; click a layer row to highlight it. Earth/Mars layers and giant interior models carry confidence labels. Close, Escape, background click or Resume flight returns to the original view; Visit keeps normal destination navigation. Sun retains its existing card and Moon has no dissection. Nonlocal scene cards remain supported.

Uses the installed Motion package and one existing R3F canvas. No added dependencies/keys. Source facts and the supplied showcase integration, tests and limitations: `docs/planet-inspector-handoff.md`. Phone performance is not yet verified.

Both pilots accept the server challenge, then each engages from the cockpit. The planetary roulette always selects Mars, plays `public/cinematics/spacetomars.mp4`, and calls `onTravelComplete("mars")` on video completion or skip. `FlightApp` opens the server-backed Mars briefing; the arena and camera duel begin only after the server reports both pilots ready. No room scan is used.

The live arena preserves the existing MediaPipe opponent segmentation, hand/pose tracking, and touch controls. The server remains authoritative for health, attacks, cooldowns, and results. See `docs/flight-integration.md` from the repository root for local connection details and device-test limitations.

The interactive roulette takes 3.6 seconds before the flight video. It uses the supplied 2K planetary maps, Earth day/night/cloud layers, directional sunlight, and lightweight procedural Saturn rings; the available files and attribution are recorded in `public/textures/planets/ATTRIBUTION.md`. No Uranus surface map or Saturn ring texture was supplied, so Uranus keeps its procedural fallback. Sounds are synthesized with the browser Web Audio API and can be enabled from the Engage gesture or the in-sequence sound control.


## Shared Live backend (Alex integration, October 18)

The default root now uses BridgeApp for onboarding and the compact Demo/Live switch. To connect this UI to a teammate’s working shared game, copy `.env.example` to `.env.local`, set `VITE_GAME_SERVER_URL` to the shared HTTPS Socket.IO site, and `VITE_SABER_CONTROLLER_URL` to the public frontend serving the paired phone page. Restart Vite. The game and phone clients share the configured backend; Demo stays local. See `../docs/shared-live-server.md` for current setup and verified limitations. The earlier rock-only instructions above describe the older camera harness; the current Live FlightApp uses the laptop + paired-phone lightsaber arena.
