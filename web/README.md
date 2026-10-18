# Browser client

The default page renders Ally’s 3D cockpit (`SpaceshipHome`) connected to the shared game server. The server owns challenges, Mars matches, readiness, combat, and results. Mars arena preview: `/?arena=mars`. Saber arena with synthetic fighters: `/?dev=arena`. Photon and Voice remain in their existing provider harnesses.

Combat is the **lightsaber duel**: each laptop camera tracks its player's body and a paired phone is the saber. The older rock/gun camera duel was removed on October 18.

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

Open the printed HTTPS URL (self-signed), usually `https://localhost:5173`, on both devices/browsers. Accept the certificate warning. `localhost` / Vite HTTPS both count as a secure context for `getUserMedia`.

## Phones (saber controller)

The paired phone needs a public **HTTPS** URL for device orientation (plain LAN `http://192.168.x.x` does not work on iOS). With the Vite server running:

```bash
# Cloudflare (no account required for a quick tunnel)
npx --yes cloudflared tunnel --url https://localhost:5173

# or ngrok (Vite allows .ngrok-free.app and .ngrok-free.dev)
ngrok http https://localhost:5173
```

Scan the laptop's pair QR code (it opens `/?saber=CODE`) and follow the guided setup on both screens.

## Ownership notes

- C: `src/camera`, `src/vision`, `src/overlay`, `public/models`
- B owns WebSocket + frozen command schemas
- D’s voice should release the mic during combat
- Keep secrets out of client config

## Cockpit integration check

Merged origin/cockpit-scene at 20124de into alex-dev. Combined React/Three/MediaPipe dependencies; retained camera HTTPS development support with a Vite 7-compatible SSL plugin. Tests: 53 frontend and 10 integration tests passed; production build passed. Browser cockpit renders without observed console errors; camera debug remains a separate route. Ally’s onEnterBattle/lobby props are the next game integration points. The existing demo-state branch remains separate.

## Connected local flow

Both pilots accept the server challenge, then each engages from the cockpit. The planetary roulette always selects Mars, plays `public/cinematics/spacetomars.mp4`, and calls `onTravelComplete("mars")` on video completion or skip. `FlightApp` opens the server-backed Mars briefing; the saber arena begins only after the server reports both pilots ready. No room scan is used.

The arena tracks each player's body with MediaPipe Pose on their own laptop. The server remains authoritative for health, swings, blocks, cooldowns, and results. See `docs/flight-integration.md` from the repository root for local connection details and device-test limitations.

The interactive roulette takes 3.6 seconds before the flight video. It uses the supplied 2K planetary maps, Earth day/night/cloud layers, directional sunlight, and lightweight procedural Saturn rings; the available files and attribution are recorded in `public/textures/planets/ATTRIBUTION.md`. No Uranus surface map or Saturn ring texture was supplied, so Uranus keeps its procedural fallback. Sounds are synthesized with the browser Web Audio API and can be enabled from the Engage gesture or the in-sequence sound control.


## Shared Live backend (Alex integration, October 18)

The default root now uses BridgeApp for onboarding and the compact Demo/Live switch. To connect this UI to a teammate’s working shared game, copy `.env.example` to `.env.local`, set `VITE_GAME_SERVER_URL` to the shared HTTPS Socket.IO site, and `VITE_SABER_CONTROLLER_URL` to the public frontend serving the paired phone page. Restart Vite. The game and phone clients share the configured backend; Demo stays local. See `../docs/shared-live-server.md` for current setup and verified limitations.

## Integrated exploration

From the normal cockpit, choose **Seat / Explore** in the bottom dock. A short seat/hyperspace transition opens free flight; **Bridge** returns to the cockpit. The same lobby/session stays connected. Accepted challenges return through the current planetary travel and saber arena. For isolated exploration without a live roster, open `/?explore=1` (optional `&dest=visit-mars`).

Use destination search, W/S or Cruise, drag/arrows to steer, Space or Stop to brake, and the planet inspector for facts/cutaways. SOUND / MIX uses the shared game audio. Catalog snapshots have source/epoch information in the Data UI; they are not live satellite tracking. Integration and verification: `../docs/exploration-integration.md`.

### Mars saber initiation

The real arena now guides one measured setup task at a time over the live Mars scene. Keep watching your avatar on the right and self-camera at bottom-right. The matched server enforces the shared three-second countdown once both pilots finish; run the updated backend too. `/?dev=initiation` is a labelled visual review using synthetic telemetry, no real camera/phone/server. Details and device checks: `docs/saber-initiation-overlay.md`.
