# LYRA ship copilot — integration handoff

Implemented locally on `alex-dev`, October 17, 2026. Changes are uncommitted and unpushed.

## What players get

An animated cyan hologram portrait below Settings in the cockpit opens LYRA. Players can type questions or use Speak, then Send voice. Presets cover combat, a matchup recommendation, and navigation. Spoken replies can be muted. A local recommendation can locate a pilot in Radar; the player still confirms Challenge.

Live mode uses real Grok Voice and fresh state from the same running game server. Demo mode uses a clearly labeled local guide with simulated pilots. Provider failures expose the local guide rather than labeling canned answers as Grok. Navigation means cockpit/Radar navigation; there is no GPS travel feature.

The portrait now uses the user-selected artwork, with a lightweight Canvas jaw deformation driven by the actual playback RMS volume. It has idle hovering, a hologram scan, listening glow and thinking halo. This is stylized speech animation, not phoneme lip sync or a 3D character. Reduced-motion preferences keep the portrait static. Closing LYRA, leaving the idle cockpit, backgrounding the tab, or switching modes stops the connection/audio/microphone. Microphone capture is explicit and capped at 20 seconds. Voice pauses normally after two idle minutes and reconnects for the next question.

## Run and try

1. Start the game server: `cd server && npm run dev`.
2. The server reads the existing gitignored `server/.env.grok.local` when `XAI_API_KEY` is not already in its environment. Never put the permanent key in a Vite/browser variable.
3. Start the frontend: `cd web && npm run dev`. Both real players must use the same frontend/server (or the same tunnel).
4. Complete onboarding, select Live in the bottom Radar/Console dock, and click LYRA below Settings.
5. Try Find a matchup. Connect another player and ask again to see the recommendation change with the roster.
6. For human voice testing, click Speak, allow microphone access, ask a question, then click Send voice. HTTPS or localhost is required for microphone access. This fresh human microphone/phone test is still outstanding.

The isolated local preview is http://127.0.0.1:5191/ with a separate server on port 3005. It is not Ally's ngrok deployment. Normal development keeps the existing frontend/server ports.

## Shared interfaces — A/B handoff

- `SpaceshipHome` accepts optional `copilotClient?: GameClient`; `FlightApp` supplies its active client. The copilot hides outside the idle cockpit.
- `GameClient` exposes `copilotSession()` and `copilotContext()`.
- Socket.IO adds `copilot:session` and `copilot:context`, each accepting an empty object. Both require the current joined socket and reject client identity overrides.
- Session replies contain only a short-lived xAI client secret plus Voice configuration. The permanent key stays server-side.
- Context replies contain `{ source: 'live', lobby, match }` from the same running lobby instance, scoped to that joined player. They never expose another player's private connection identity.
- Voice's sole tool is read-only `getFlightState`. LYRA cannot challenge, accept, fire, or send Photon messages. Recommendations do not change game state.
- Token minting has a per-player cooldown, concurrency cap, global attempt budget, and provider timeout. This builds on the existing demo identity model; it does not add production account authentication.
- Implementation: `server/src/integrations/copilot.ts`, `server/src/server.ts`, `server/src/contracts.ts`, `web/src/networking/gameClient.ts`, and `web/src/voice/`.
- Preserve `BridgeApp` as the default entry when bringing this into Ally's checkout so onboarding and Demo/Live controls remain available. Restart her backend with the server-only key configured; frontend-only merging is insufficient.

## Verification observed

- Frontend: 110 passing tests; one opt-in live networking test skipped. Production typecheck/build passes, including a separately emitted microphone worklet.
- Server: 59 passing tests. New real Socket.IO tests cover joined-player authorization/context and ephemeral-session delivery; mocked provider tests cover missing keys, credential isolation, generic failures, and rate budgets.
- Real browser + Grok Voice: an empty lobby produced no rival recommendation. After a controlled test player LYNX joined, a new response named LYNX and told the player to select/confirm in Radar. This demonstrates changing live roster input.
- Demo guide located a simulated pilot in Radar without sending an invitation. Phone viewport 390 × 844 visually checked. Reduced motion is supported.
- Browser audio responses completed; a fresh human microphone round trip and physical two-phone test are not claimed.

## Remaining scope

Photon live ACCEPT/DECLINE/STATUS still needs the shared game-command adapter and verified challenge identity binding. The old briefing Voice iframe remains its separate fixture path. This task does not update combat command dispatch, add attacks, or prove a full camera duel. This in-game character is a **Grok Voice** integration. The official **Grok Bot planning bonus** is separate and is recorded as claimed in `docs/sponsor-evidence.md`.


## Selected-artwork animation follow-up

- Replaced the original SVG bust with the supplied PNG, preserved unchanged in `web/src/voice/assets/lyra-hologram.png`. Rendering crops around the character.
- `CopilotVoice.outputLevel()` measures only the played output through a Web Audio analyser; mute/close/silence stop the mouth movement. The portrait reads the level without rerendering the React chat every frame. No server or wire contract changed.
- `HologramPortrait.tsx` and `portrait.css` own the visual behavior. `HologramCopilot.tsx` passes phase and the output meter; `hologram.css` accommodates the larger portrait.
- Development-only preview: `/lyra-preview.html`, backed by `HologramPreview.tsx` and `portrait-preview.css`. Its talking control uses an explicitly labeled simulated envelope for eight seconds, without provider requests or microphone access. It is not included in the default production HTML build.
- Verified: production build/typecheck, 110 frontend tests passing / one opt-in skipped; live Grok spoken combat response reached speaking state with the new portrait; 390 × 844 cockpit layout and standalone animation states visually checked, no browser warning/error observed in that check. Human phone performance and phoneme alignment are not claimed.
- Source artwork is user-supplied; no new Grok Imagine API call is claimed by this implementation. No new environment variables. Changes remain local/uncommitted.
