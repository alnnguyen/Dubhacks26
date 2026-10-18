# Shared Live server connection — October 18

Goal: keep Alex's onboarding/cockpit/LYRA UI and local Demo pilots while Live connects to the actual multiplayer server behind Justin's working Cloudflare link. Implemented on alex-dev for team integration. Local endpoint settings stay gitignored.

## Current configuration

`web/.env.local` (gitignored) now contains public URLs only:

```
VITE_GAME_SERVER_URL=https://store-additions-rover-newer.trycloudflare.com
VITE_SABER_CONTROLLER_URL=https://store-additions-rover-newer.trycloudflare.com
```

Demo remains local with four simulated pilots and no game socket. Live joins this shared game server while rendering our merged UI. The endpoint is now resolved centrally by `web/src/networking/gameEndpoint.ts`; the normal shared client, BridgeApp client, legacy rehearsal client and our saber client all use it unless an explicit client URL overrides it.

The arena QR opens Justin's public HTTPS frontend with `?saber=CODE`. His phone page uses its own origin, so it pairs on the same server as our laptop. Pair codes remain in their intended private UI; no real code is recorded here. Our own saber page also honors the shared server setting if opened on our frontend.

## Running / sharing

- Start or keep running the merged frontend with `cd web && npm run dev`. Reload it after changing settings; restart Vite if the environment change has not been picked up.
- Open the default root page, finish onboarding and choose Live. Use the same shared backend for all laptops. Open each phone's QR from its own laptop.
- The task's browser verification used http://127.0.0.1:5192/ serving this same merged source and configuration. It is a local preview, not a public share link.
- A teammate pulling code must copy `web/.env.example` to `.env.local` and set both values. Ignored local settings do not travel in Git. These are public endpoint settings, never API keys.
- Cloudflare quick tunnel addresses can change. When Justin starts a replacement link, update BOTH values and restart Vite. Rebuild any production bundle because Vite injects these values at build time.
- Clear both values to restore same-origin local development and local QR links. The existing Vite Socket.IO proxy remains unchanged.
- `?pvp=1` (the older rock/gun rehearsal screen) was removed October 18. Demo's post-travel placeholder is unchanged.

## Verification performed

- HTTP Engine.IO handshake accepted the frontend origins tested (HTTPS localhost and the isolated HTTP localhost preview); no server CORS settings were modified.
- A temporary test pilot joined Justin's actual server. A second Socket.IO connection paired as that pilot's saber, and the returned callsign matched the test pilot. No challenges, attacks or external messages were sent by the proof. Both test connections were closed afterward.
- The real shared server's roster included the merged preview's BRANCH-CHECK pilot, proving our frontend was in the same room. The browser showed online Live status naming the Cloudflare host and real nearby pilots.
- A second bounded shared-server observer recorded the merged pilot as present in Live, absent after switching to Demo, and present again after switching back to Live. The browser showed Demo’s four simulated pilots between those transitions.
- Build/typecheck passed. Frontend tests: 156 pass, one opt-in live networking test skipped. Added routing regression checks cover explicit URL overrides, common laptop/phone targets and public QR URLs.
- Actual phone motion, camera calibration and a complete physical duel were not tested in this task.

## Remaining provider limitation

Justin's running server did not answer `copilot:context` within the bounded test timeout. It is serving the older backend without Alex's copilot handlers. LYRA's portrait/UI stays in our cockpit, but real Grok Voice over this shared connection needs Justin to run the merged backend with `copilot:session`, `copilot:context` and a server-only XAI_API_KEY. The existing local guide fallback remains available. We did not silently route Voice to a separate simulated lobby or claim live Voice was proven on this server.

Owners A/B: use the merged frontend and matching backend to make the shared presentation complete. This task changes frontend connection configuration only; no game commands, server authorization or combat rules changed. No new permanent credentials and no changes to Justin's running server.
