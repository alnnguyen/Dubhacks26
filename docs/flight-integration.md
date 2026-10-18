# Local flight and planetary travel

The default app flow is the simulated cockpit challenge → planetary roulette → Mars travel video → room-scanning hand-off. This worktree has no room scanner, so the app explicitly stops before arena generation or a duel. `/?localRehearsal=1` opts into the previous cockpit → selected-world briefing → camera-training rehearsal; its opponents, challenge replies, damage and results remain simulated.

## Run

From the repository root, start the Voice backend in one terminal:

```sh
node --env-file=server/.env.grok.local server/src/integrations/grok/demo-server.mjs
```

In a second terminal run `cd web` and `npm run dev`. Open the printed localhost URL. Add `/?localRehearsal=1` to use the older Voice and camera-training rehearsal; without that query the app previews planetary travel and stops at the room-scanning hand-off.

Use Radar → choose NOVA-7 → Challenge → wait for the simulated response → Engage. The briefing displays Earth/Mars/Moon gravity and designed window. The copilot automatically generates and plays a spoken briefing for the selected world without using the microphone. If browser autoplay is blocked, tap Play briefing. Ask the copilot is optional for follow-up questions. Selecting a different world remounts/disconnects the previous Voice frame, synchronizes the fixture and prepares a new spoken announcement. Enter camera duel stops the microphone and unmounts the Voice frame. Camera startup is explicit. Lift/throw/cancel/block commands update the rehearsal state; the result unmounts/stops the camera. Return to cockpit resets the flow. Standalone camera route remains /?camera=1.

The Voice frame is now served through the local Vite /copilot proxy. Permanent key stays on the backend; short-lived tokens stay in the same-origin Voice frame. The fixture retains cookie and Origin checks. The proxy rejects non-loopback hostnames; public phone/tunnel Voice is intentionally unavailable until B mounts authenticated routes. Camera testing over HTTPS remains available separately. Vite preview/production hosting does not implement this dev proxy—B’s server/reverse proxy must provide the routes there.

## Integration seams

- `SpaceshipHome` starts planetary travel only after the lobby adapter reaches the accepted/ready → launching state and the player engages.
- Normal flow connects `SpaceshipHome.onTravelComplete("mars")` to the room-scanning phase. The callback fires once on video completion or skip. Mount room scanning there; do not generate the Mars arena or start a duel until scanning completes.
- The current worktree has no room-scanning module. `FlightApp` therefore displays an explicit hand-off notice after the callback rather than pretending to scan. The local rehearsal callback remains available only with `/?localRehearsal=1`; that simulated route intentionally bypasses room scanning.
- The video is a local portrait H.264/AAC asset at `web/public/cinematics/spacetomars.mp4` (464×688, about 6.04 seconds). Browser playback, camera rendering and phone behavior still need hands-on verification.
- CameraDebugPage accepts `mode="duel"` from FlightApp (match HUD, world tint, health bars, no MediaPipe skeleton/debug log) and defaults to the lab harness on `/?camera=1`. Optional onCommands/flightSeconds/duel HUD props. Commands remain proposed C input payloads; B owns frozen schema and validation. Screen-space overlays only — not room scanning or a reconstructed 3D arena.
- app/state.ts is only a local rehearsal reducer. It is not a second server rules implementation to adopt. Damage on release is immediate; rival attacks are manually simulated.
- Voice syncs to the chosen local world via existing fixture adapter. This writes the same single-user voice-state.json as the standalone demo. It is not isolated multi-user state. Photon’s state.json remains separate.
- B must replace mock lobby/health/world selection with authoritative challenge/match snapshots and mount Voice routes behind real session authorization. D’s game-port handoff remains server/src/integrations/HANDOFF.md.
- The embedded voice frame stops on launch and world change; live remote inference never controls combat timing.

## Checks

59 frontend tests and production build passed; 10 provider-integration tests passed. HTTP checks through proxy: world change → state tool returns Moon 1.6 / 1.98, foreign Origin 403, missing session 401, caller-supplied actor ID 400. Browser checks: incoming cockpit invitation → Engage → Moon briefing synced in embedded Voice frame (1.6 m/s² / 1.98 s) → camera duel with the same window → training lift/throw reduced rival health 100→75. Newly combined microphone speech/output and gesture play still need human confirmation; prior standalone provider and CV proofs are documented separately.

Additional browser check: four simulated incoming hits reached result at zero health; Back to bridge returned to fresh cockpit state. No camera or microphone remained mounted in the result screen.

Automatic narration uses the server-owned state to build a short factual script and Grok TTS to speak it. Identical narration is cached in memory; arbitrary user speech text is not accepted by this endpoint. A stale selected-world request is rejected. Entering combat cancels pending narration and stops playback. Browser autoplay restrictions may require one Play briefing tap. Realtime speech/tool interaction remains available as an optional follow-up.

## Planetary travel verification

The roulette runs for 3.6 seconds from Engage to the video: 0.7 seconds of cockpit activation, 1.6 seconds of accelerating/decelerating planet selection, 0.8 seconds locking Mars, 0.38 seconds zooming, and a 0.12-second flash. The flight video is outside that timing. Web Audio synthesizes activation, roulette ticks, lock-on, and engine sounds; audio is unlocked from the Engage gesture, with an in-sequence enable-sound fallback if the browser blocks it. Reduced-motion settings shorten the sequence and disable continuous orbit animation and camera shake.

The local desktop-browser flow was exercised from a simulated accepted challenge through the travel video into the explicit room-scanning hand-off. The production preview loaded the available planetary texture maps and Earth day/night/cloud layers in the existing WebGL canvas. Planet texture attribution is in `web/public/textures/planets/ATTRIBUTION.md`; the Earth maps retain their separate notice in `web/public/textures/earth/ATTRIBUTION.md`. No Uranus surface map or Saturn ring texture was supplied, so Uranus keeps its procedural fallback and Saturn uses a generated transparent ring material. This does not establish real multiplayer integration or mobile Safari/phone performance; those still need owner/device testing.
