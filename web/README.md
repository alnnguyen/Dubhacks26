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

Both pilots accept the server challenge, then each engages from the cockpit. The planetary roulette always selects Mars, plays `public/cinematics/spacetomars.mp4`, and calls `onTravelComplete("mars")` on video completion or skip. `FlightApp` opens the server-backed Mars briefing; the arena and camera duel begin only after the server reports both pilots ready. No room scan is used.

The live arena preserves the existing MediaPipe opponent segmentation, hand/pose tracking, and touch controls. The server remains authoritative for health, attacks, cooldowns, and results. See `docs/flight-integration.md` from the repository root for local connection details and device-test limitations.

The interactive roulette takes 3.6 seconds before the flight video. It uses the supplied 2K planetary maps, Earth day/night/cloud layers, directional sunlight, and lightweight procedural Saturn rings; the available files and attribution are recorded in `public/textures/planets/ATTRIBUTION.md`. No Uranus surface map or Saturn ring texture was supplied, so Uranus keeps its procedural fallback. Sounds are synthesized with the browser Web Audio API and can be enabled from the Engage gesture or the in-sequence sound control.
