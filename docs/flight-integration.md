# Local flight and planetary travel

The default app flow is the server-backed cockpit challenge → planetary roulette → Mars travel video → Mars briefing/readiness → live Mars arena. Room scanning is not part of this flow. The server creates the match after both players accept, fixes its world to Mars, and starts combat only after both send `ready`.

## Run

From the repository root, start the authoritative game server in one terminal:

```sh
cd server && npm run dev
```

The Voice backend is optional for the duel. To run it locally, start it in another terminal:

```sh
node --env-file=server/.env.grok.local server/src/integrations/grok/demo-server.mjs
```

In another terminal run `cd web` and `npm run dev`. Open the printed localhost URL on both devices/browsers and join the same server room. Challenge and accept the other pilot, then Engage. Each pilot sees the deterministic Mars roulette and flight video before entering the shared match briefing.

Use Radar → choose NOVA-7 → Challenge → wait for the simulated response → Engage. The briefing displays Earth/Mars/Moon gravity and designed window. The copilot automatically generates and plays a spoken briefing for the selected world without using the microphone. If browser autoplay is blocked, tap Play briefing. Ask the copilot is optional for follow-up questions. Selecting a different world remounts/disconnects the previous Voice frame, synchronizes the fixture and prepares a new spoken announcement. Enter camera duel stops the microphone and unmounts the Voice frame. Camera startup is explicit. Lift/throw/cancel/block commands update the rehearsal state; the result unmounts/stops the camera. Return to cockpit resets the flow. Standalone camera route remains /?camera=1.

The Voice frame is now served through the local Vite /copilot proxy. Permanent key stays on the backend; short-lived tokens stay in the same-origin Voice frame. The fixture retains cookie and Origin checks. The proxy rejects non-loopback hostnames; public phone/tunnel Voice is intentionally unavailable until B mounts authenticated routes. Camera testing over HTTPS remains available separately. Vite preview/production hosting does not implement this dev proxy—B’s server/reverse proxy must provide the routes there.

## Integration seams

- `SpaceshipHome` starts planetary travel only after both players accept and the pilot engages. The callback fires once on video completion or skip.
- `FlightApp` connects `onTravelComplete("mars")` to the accepted server match and its Mars briefing. This is a frontend hand-off, not a new server event.
- The duel screen mounts only for the server's `active` phase. One player's Ready action cannot start their camera duel before the opponent is ready.
- The video is a local portrait H.264/AAC asset at `web/public/cinematics/spacetomars.mp4` (464×688, about 6.04 seconds). Browser playback, camera rendering and phone behavior still need hands-on verification.
- CameraDebugPage accepts `mode="duel"` from FlightApp (match HUD, world tint, health bars, no MediaPipe skeleton/debug log) and defaults to the lab harness on `/?camera=1`. The live Mars scene retains MediaPipe opponent segmentation and hand/pose tracking. This remains a screen-space camera duel, not room reconstruction.
- app/state.ts is only a local rehearsal reducer. It is not a second server rules implementation to adopt. Damage on release is immediate; rival attacks are manually simulated.
- Voice syncs to the chosen local world via existing fixture adapter. This writes the same single-user voice-state.json as the standalone demo. It is not isolated multi-user state. Photon’s state.json remains separate.
- The live lobby and match now use `web/src/networking` and `server/src/sessions`; provider-specific Photon/Voice hand-offs remain documented in `server/src/integrations/HANDOFF.md`.
- The embedded voice frame stops on launch and world change; live remote inference never controls combat timing.

## Checks

After roulette integration, `cd web && npm run typecheck`, `npm run build`, and `npm test` passed (90 passed, 1 skipped); `cd server && npm test` passed (53 tests). An isolated two-browser check connected both clients, confirmed both were ready, accepted a challenge, and reached the server-backed Mars briefing on one client. The video element had unmounted before playback state could be checked, so actual video playback and the active-duel handoff were not verified in that browser run.

Additional browser check: four simulated incoming hits reached result at zero health; Back to bridge returned to fresh cockpit state. No camera or microphone remained mounted in the result screen.

Automatic narration uses the server-owned state to build a short factual script and Grok TTS to speak it. Identical narration is cached in memory; arbitrary user speech text is not accepted by this endpoint. A stale selected-world request is rejected. Entering combat cancels pending narration and stops playback. Browser autoplay restrictions may require one Play briefing tap. Realtime speech/tool interaction remains available as an optional follow-up.

## Planetary travel verification

The roulette runs for 3.6 seconds from Engage to the video: 0.7 seconds of cockpit activation, 1.6 seconds of accelerating/decelerating planet selection, 0.8 seconds locking Mars, 0.38 seconds zooming, and a 0.12-second flash. The flight video is outside that timing. Web Audio synthesizes activation, roulette ticks, lock-on, and engine sounds; audio is unlocked from the Engage gesture, with an in-sequence enable-sound fallback if the browser blocks it. Reduced-motion settings shorten the sequence and disable continuous orbit animation and camera shake.

The production preview previously loaded the available planetary texture maps and Earth day/night/cloud layers in the existing WebGL canvas. Planet texture attribution is in `web/public/textures/planets/ATTRIBUTION.md`; the Earth maps retain their separate notice in `web/public/textures/earth/ATTRIBUTION.md`. No Uranus surface map or Saturn ring texture was supplied, so Uranus keeps its procedural fallback and Saturn uses a generated transparent ring material. Video playback, the active-duel handoff, mobile Safari, and phone performance still need manual verification.
