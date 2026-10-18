# Sponsor evidence — D maintains, A verifies at submission

Status: Photon PING/PONG and real ACCEPT → saved fixture challenge → delivered confirmation verified. Grok TTS and real Speech-to-Speech with state-reading tool verified against fixtures. Live B game integration, human microphone check and official Grok Bot planning bonus remain open.

- Chef's Choice: record a working cockpit → challenge → camera duel → result.
- SpaceXAI: actual Cursor development; real Grok Voice/Imagine API use; NASA dataset provenance and gameplay effect. Confirm TTS-only eligibility if relying on TTS instead of a live Voice interaction.
- Grok Bot bonus: actual official product planning/collaboration session, decisions and team use. API characters alone do not establish this.
- Photon: Photon 2.0 real channel, linked player identity, genuine send/reply and resulting state change. Mock messages do not qualify.
- Perceptron only if shipped: actual workshop Mk/Isaac inference powering replay analysis. Local MediaPipe is separate. Respect consent for uploaded footage.

Record evidence location, owner, time and observed result. Avoid secrets or personal phone numbers in public material. Verify final organizer requirements and chosen track combinations.

## Photon 2.0 provider proof — inbound and outbound delivery verified

- Checked: 2026-10-17 15:30 Pacific.
- Logged-in beta project inspected; user completed shared iMessage sender assignment.
- Dashboard confirmed a real inbound onboarding message reached the project.
- With explicit approval, created a 30-day project key restricted to project:read + project:write, the scopes the API requires for message reads/sends. These scopes also cover other project settings; no events/platforms permissions were granted.
- Saved the key and test identities only in server/.env.photon.local, mode 0600; git check-ignore confirms it is ignored. No secrets or phone numbers recorded here.
- Added server/src/integrations/photon/proof.mjs: isolated Node 22+ REST polling proof, sender/conversation/freshness filtering, stable reply idempotency key, request timeouts and separate acceptance/delivery reporting. No duel contract changes or dependency installs.
- Verified syntax and six focused message-selection checks, including rejecting a different sender, stale/outbound/group messages and unrelated text.
- Inbound verified by local REST script: fresh PING, message ID pho_msg_0x97swt420h2drfn129wswqzaj, received 2026-10-17 3:30:44 p.m. Pacific.
- Initial threaded reply failed with HTTP 409 SPACE_NOT_SENDABLE: “Replies are not supported for this Space.” Removed parentMessageId and sent a regular direct message in the same Space with a new stable idempotency key. No duel contracts changed.
- Outbound: “PONG — ship communications online. Photon 2.0 proof successful.” Message ID pho_msg_40ce6e45ethgeaz3r6p3zxy078. API accepted/dispatched, then GET message confirmed status delivered at 2026-10-17 3:32:00 p.m. Pacific. This is delivery verification, not merely HTTP acceptance.
- Photon round trip complete. The local proof exits after one exchange; it is not yet a production event listener or challenge integration.
- After a verified round trip: connect Photon ACCEPT/DECLINE/STATUS and challenge ID to B's validated action interface.

## Grok Voice provider proof — TTS verified (Speech-to-Speech still open)

- Checked: 2026-10-17 15:38 Pacific. Owner: Alex (D).
- Created an xAI Console API key with models/endpoints enabled; saved only as shell `XAI_API_KEY` / later `server/.env.grok.local` (gitignored). No key in committed files or browser env.
- Verified `POST https://api.x.ai/v1/tts` with voice `eve`, language `en`, briefing text about Mars gravity / longer block window.
- Observed success: local MPEG Layer III audio written (`welcome.mp3`, ~77 KB, ~4.8 s at 24 kHz mono). Playback confirmed by human owner.
- Reusable script added: `server/src/integrations/grok/proof-tts.mjs` writing `tmp/grok-voice-tts-proof.mp3`. Setup notes in `server/src/integrations/grok/README.md`. Example env: `server/.env.grok.local.example`.
- Label: **TTS-only**. This is not yet Speech-to-Speech realtime (`wss://api.x.ai/v1/realtime?model=grok-voice-latest`) and does not yet read a live match snapshot. Confirm organizer eligibility if relying on TTS for SpaceXAI Voice.
- Next: realtime “What world did we get?” with server-supplied world state; ephemeral tokens for any browser client; then wire narration into the duel flow after B’s contracts exist.

## D command and realtime proof — October 17, 2026

- Branch: alex-dev. Implementation and handoff: server/src/integrations/HANDOFF.md.
- Real inbound iMessage ACCEPT DEMO-42 (pho_msg_6mwpsr7pqegsv8sbfwenvz4vef) changed saved DEMO-42 from pending to accepted for the linked fixture defender. User confirmed sending it. Outbound confirmation pho_msg_5vj88ycjebh7jsx6bjbgr3xsj6 was independently checked through GET message: HTTP 200, status delivered.
- This is a real provider round trip and real persisted **fixture** transition. It does not accept a live B game challenge. DECLINE/STATUS handling exists and is locally tested; no real-phone DECLINE/STATUS exchange is claimed.
- Two actual Grok Realtime Speech-to-Speech calls used synthesized spoken input “What world did we get?”, invoked getMatchState and returned spoken audio. First state: Mars 3.7 m/s², designed window 1.30 s; changed state: Moon 1.6 m/s², window 1.98 s. Returned audio: 1,027,680 and 966,240 PCM bytes respectively. Transcripts explicitly identify fixture state.
- Local outputs, excluded from Git: tmp/d-provider-demo/realtime-response.wav and realtime-proof-moon.json. These are API integration checks with synthesized input, not a human microphone test or a live duel.
- Browser fixture harness loads, switches world and reads changed state. Security checks: missing session 401, wrong Origin 403, tool identity argument 400. Permanent key remains server-only; browser receives a short-lived client secret.
- Node built-in integration suite: 10 passing tests, including sender filtering, defender authorization, durable duplicate handling, retry after send failure and state-reading voice tools.
- Remaining acceptance: B adapter to the shared authenticated command service; live challenge and selected-world flow on two clients; actual phone/microphone voice check; official Grok Bot planning session with truthful evidence. No official Grok Bot session is claimed here.

## Combined cockpit / briefing / camera rehearsal

- October 17: Ally’s cockpit launch now enters a selected-world briefing with embedded real Grok Voice controls, then Alan’s camera harness, local training health/results and return to cockpit.
- Browser verified Moon synchronization into Voice fixture and matching camera window; training command changed displayed rival health 100→75. User reported standalone Voice and CV working before this combined flow. Fresh human speech + gestures in the combined screens remain a check.
- 59 frontend tests, 10 integration tests and build pass. Proxy rejects missing session/foreign origin/client identity overrides. Permanent credentials remain server-only.
- All challenge/rival/health state in this combined flow remains labeled local simulation. Real Photon round trip evidence above applies only to saved DEMO-42; B’s actual challenge/multiplayer acceptance is still open. See docs/flight-integration.md.

## Automatic selected-world narration

- Replaced the required spoken test question with automatic state-derived Grok TTS in the briefing. Microphone is not requested for narration; realtime questions remain optional.
- Real browser/API check: Mars script generated, playable MP3 duration 12.84 s, audio readyState 4, and browser reported “Briefing complete. Ready for the jump.” without a microphone session. Browser autoplay fallback remains Play briefing.
- Three focused narration tests passed: selected-state validation, duplicate generation caching/state changes, and stale-world rejection/provider retry. Existing ten integration tests and production build passed.

## Official Grok Bot planning bonus — READY TO RUN (not claimed yet)

Do **not** treat in-game Voice/TTS or API characters as this bonus. Use the official Grok Bot / team planning product.

**Suggested prompt (paste into the official Bot session):**

> Review our spaceship lobby → Photon challenge → gravity wheel → camera rock duel plan for DubHacks. Assign A UI/cockpit, B authoritative game state and contracts, C camera gestures/overlays, D Photon + Grok Voice integrations. Identify blockers before Saturday 10 p.m. feature freeze. Cut extras that threaten the two-phone duel. Confirm B must ship createGamePort (getChallenge, respondChallenge, getMatchState) before Photon ACCEPT and Voice can leave fixtures.

**After the real session, fill in (Alex / D):**

- Date / time (Pacific):
- Product used (official Grok Bot link / team bot name):
- Participants:
- Decisions recorded:
- Link or export location (no secrets):
- What we cut or prioritized:

Until this block is filled with a real session, **no Grok Bot bonus claim** in submission.
