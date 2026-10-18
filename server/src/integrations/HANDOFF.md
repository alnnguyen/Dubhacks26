# D integration handoff

Goal: authenticated Photon challenge replies and a state-aware Grok Voice copilot, outside combat timing. D-owned provider modules only; no shared game schema or root dependencies changed. Requires Node 22+ (checked locally with Node 24).

## What works

Real iMessage ACCEPT DEMO-42 changed a saved fixture challenge and the provider confirmed delivery of the reply. Real Grok Realtime speech input invoked getMatchState and returned speech for two different fixture worlds. Ten focused integration tests pass. Evidence and limits are in docs/sponsor-evidence.md.

## Run locally from repository root

Keep permanent keys in ignored server/.env.photon.local and server/.env.grok.local, mode 0600. No keys in web environment variables.

```sh
node --test server/src/integrations/integrations.test.mjs server/src/integrations/grok/briefing.test.mjs
node --env-file=server/.env.photon.local server/src/integrations/photon/listen.mjs --fixture
node --env-file=server/.env.grok.local server/src/integrations/grok/demo-server.mjs
```

Run the listener and HTTP server in separate terminals. Open http://127.0.0.1:8787 on this computer. Select a world, Connect voice, allow microphone, Start speaking, ask “What world did we get?”, then Send speech. Disconnect releases the microphone. Audio goes to xAI while recording. This localhost harness is not accessible from another phone; deployed phone testing requires A/B HTTPS integration.

Photon uses existing PHOTON_PROJECT_ID, PHOTON_API_KEY, PHOTON_TEST_SENDER and PHOTON_AGENT_HANDLE. Fixture player defaults to pilot-d. Send STATUS DEMO-42 or DECLINE DEMO-43 in the assigned direct iMessage conversation. DEMO-42 is already accepted; accepting again is harmless, declining it is rejected. Fixtures persist under tmp/d-provider-demo; do not run concurrent listeners against the same files. Photon state.json and Voice voice-state.json are deliberately independent test fixtures.

Optional automated realtime proof takes a mono PCM16 24 kHz WAV:

```sh
node --env-file=server/.env.grok.local server/src/integrations/grok/proof-realtime.mjs tmp/d-provider-demo/question.wav
```

D_PROOF_WORLD can select earth, mars or moon. The script writes realtime-response.wav under tmp/d-provider-demo and reports the state tool result. The question file is local test input, not checked in.

## B connection required

D's game-port.mjs is an adapter interface, not a frozen replacement for B's contracts. Provide a server-only module exporting async createGamePort(), returning:

- getChallenge({actorId, challengeId}) → participant-visible {id, status, ...}; reject unrelated players.
- respondChallenge({actorId, challengeId, decision, commandId}) → authoritative {id, status}; decision is accept/decline. Check defender, expiry and terminal state in B's existing command service. Persist idempotency with the mutation: retries reuse the Photon message ID command key.
- getMatchState({actorId}) → null, or a public {matchId, phase, world, gravityMps2, rockFlightSeconds}. Read B's actual selected world and shared gravity mapping. Do not return fixture:true for real matches.

Set D_GAME_ADAPTER to its absolute module path and PHOTON_PLAYER_ID to the verified linked player, then run listen.mjs without --fixture. The current identity mapping supports one preconfigured test sender. Production account linking and multiple players must use authenticated, verified identities, never an ID supplied in a text message.

Photon's polling listener is a bounded local integration harness: it replays the five-minute window preceding startup, persists a reply journal, and retries transient sends with provider idempotency. Older messages after extended downtime are outside that window. Use provider live events/webhooks and durable replay storage for production. JsonStore serializes within one process only; it is not a multiplayer database or cross-process lock.

For Voice, mount ephemeralToken/runVoiceTool in B's authenticated server. Derive actorId from the session. Preserve CSRF/Origin checks and rate limits. The standalone server binds localhost and uses a temporary local session; it is explicitly a fixture harness, not production authentication. The browser client currently calls its demo routes; A/B must connect those routes and UI to the real app. Voice reads state only and cannot control combat.

## Acceptance remaining

1. B's actual challenge: create from lobby, accept via real Photon message, confirm both game clients update. Verify decline, expiry and repeated command behavior.
2. B's actual selected world: ask from a real microphone and hear an answer grounded in that match; test permission denial and disconnect on target devices.
3. Official Grok Bot planning bonus: **claimed** — team used the official Grok Bot / team-bot product for PLAN.md, roles, infrastructure, and research orchestration. Evidence: `docs/sponsor-evidence.md` (Bot section). In-game LYRA Voice is separate and does not substitute for this bonus.

Do not mark D fully accepted until Photon live-challenge binding and physical-phone Voice QA pass. Bot planning claim is recorded in sponsor-evidence.

Automatic briefing is in grok/briefing.mjs: state-derived text → server-only Grok TTS, cached by public script. Browser can listen without requesting microphone access; optional realtime questions remain separate. Mount the same briefing service against B’s real authenticated getMatchState adapter when ready.

## Justin server network smoke — October 17 (removed October 18)

`game-smoke.mjs` exercised the rock throw/block commands over real Socket.IO clients. It was deleted on October 18 with the rest of the rock/gun path; the duel is lightsaber-only. `npm --prefix server test` still covers the socket server (`server.test.ts`), including joins, challenges, readiness, duplicate commands and saber pairing.
