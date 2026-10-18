# Browser client

The default page now renders Ally’s 3D cockpit from cockpit-scene. It currently uses mock lobby players and challenge timers; no real multiplayer connection is implied. Alan’s camera debug harness is preserved at `/?camera=1`. Photon and Voice remain in their existing standalone provider harnesses.

Combat on this page is **rock only** (screen-space overlay). Gun and lightsaber are deferred until the rock loop + phone framing pass. Defense is **Block**, not catch.

## Run (laptop)

```bash
cd web
npm install
npm test
npm run dev
```

Open the printed HTTPS URL (self-signed), usually `https://localhost:5173`. Accept the certificate warning. For camera testing, append `/?camera=1` and click **Start camera**.

- Laptop with no rear lens falls back to the front camera and labels that clearly.
- `localhost` / Vite HTTPS both count as a secure context for `getUserMedia`.

## Phone framing gate (do this now)

Phones need a public **HTTPS** URL (plain LAN `http://192.168.x.x` usually cannot use the camera on iOS).

With the Vite server running:

```bash
# Cloudflare (no account required for a quick tunnel)
npx --yes cloudflared tunnel --url https://localhost:5173

# or ngrok
ngrok http https://localhost:5173
```

Open the `https://…/?camera=1` tunnel URL on the **demo phone**, allow camera, use the **rear** lens when prompted, then check:

1. Own hand (green) and opponent pose health stub together in one frame.
2. Palm hold → rock floats above the hand + `startLift` in the command log.
3. Fist → rock arcs toward the opponent + `releaseRock` (no catch).
4. Cover the lens / leave frame / Cancel → rock vanishes + `cancelLift`, never a throw mid-flight from loss.
5. Touch Lift / Throw / Block / Cancel emit the same command names as gestures.
6. Deny permission once and confirm a clear error (no crash).

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

The default cockpit flow now plays the Mars planetary roulette and travel video, then stops at an explicit room-scanning hand-off. The camera room scanner is not implemented in this worktree. Use the simulated cockpit challenge to preview the sequence; `/?localRehearsal=1` opts into the older local Voice/camera rehearsal instead of the room-scanning boundary. Neither route represents a live multiplayer match.

The cinematic uses the existing cockpit WebGL canvas. Its local video asset is `public/cinematics/spacetomars.mp4`; on completion or skip, `SpaceshipHome` calls `onTravelComplete("mars")` exactly once when that integration callback is provided. See `docs/flight-integration.md` from the repository root for the room-scanning contract and limitations.

The interactive roulette takes 3.6 seconds before the flight video. It uses the supplied 2K planetary maps, Earth day/night/cloud layers, directional sunlight, and lightweight procedural Saturn rings; the available files and attribution are recorded in `public/textures/planets/ATTRIBUTION.md`. No Uranus surface map or Saturn ring texture was supplied, so Uranus keeps its procedural fallback. Sounds are synthesized with the browser Web Audio API and can be enabled from the Engage gesture or the in-sequence sound control.
