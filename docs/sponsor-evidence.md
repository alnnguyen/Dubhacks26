# Sponsor evidence — D maintains, A verifies at submission

Status: Photon PING/PONG and real ACCEPT → saved fixture challenge → delivered confirmation verified. Grok TTS, Speech-to-Speech, automatic briefing narration, and live LYRA Voice + lobby state verified. **Official Grok Bot planning bonus claimed** (team used the official Grok Bot / team-bot product extensively for PLAN.md, roles, infrastructure, and research orchestration). Human mic on physical phones and Photon→live-challenge binding remain polish/QA.

- Chef's Choice: record a working cockpit → challenge → camera duel → result.
- SpaceXAI: actual Cursor development; real Grok Voice/API use (LYRA + briefing); NASA dataset provenance and gameplay effect; **official Grok Bot** planning collaboration.
- Grok Bot bonus: **claimed** — official product sessions drove planning (not the in-game LYRA Voice character).
- Photon: Photon 2.0 real channel, linked player identity, genuine send/reply and resulting state change. Mock messages do not qualify.
- Perceptron only if shipped: actual workshop Mk/Isaac inference powering replay analysis. Local MediaPipe is separate. Respect consent for uploaded footage.

Record evidence location, owner, time and observed result. Avoid secrets or personal phone numbers in public material. Verify final organizer requirements and chosen track combinations.

## Perceptron Mk1.5 — synthetic video proof, October 18

- Cinematic extension: model-selected video intervals now select earlier scenes in a locally recorded 3D arena replay; the server-confirmed knockout is always a separate, labeled finale. Game code renders camera angles, slow motion, sparks, transitions and impact holds. `/?dev=replay` is a clearly labeled synthetic presentation fixture, not an additional model run. No new inference or provider claims were made during this extension. Real consenting-duel/provider-to-3D acceptance remains open; earlier API request IDs below are unchanged.

- Alan / Codex resumed the interrupted highlights task. Key configured in Git-ignored `server/.env`, server-only; no key value logged or committed. User explicitly requested testing it.
- Official `GET /v1/models`: authenticated 200; `perceptron-mk1.5` listed.
- Actual laptop-browser MediaRecorder generated a silent ~4.5-second 640×360 WebM of an animated mint rectangle. **Synthetic QA footage, no real person.** This was sent inline to the official `POST https://api.perceptron.inc/v1/chat/completions` endpoint.
- Event query (`vision_config.annotation_format: clip`): HTTP 200, 1039 ms, finish_reason `stop`; returned horizontal movement interval 0–3.2 seconds. Request ID `chatcmpl-eb6e42b223ba45d7bf26ebc62fa99563`.
- Tracking query (`annotation_format: box`): HTTP 200, 2610 ms, finish_reason `stop`; returned one `<track>` containing eight timestamped `<point_box>` waypoints (0–4.4 seconds). Request ID `chatcmpl-daf1117e142748b4b425ba7c1100caee`.
- Application parsers accepted one moment and all eight boxes. This proves the configured key, model, inline WebM input, temporal annotations and tracking response formats. It does **not** prove saber recognition or highlight quality on an actual duel.
- Implemented: opt-in recording, finished-match upload authorization, bounded/deduplicated analysis, caption cards, slow-motion playback and model-directed player framing. Browser playback QA used labeled mocked analysis separately from the real API proof. No deployment, actual-duel upload, rendered-reel export or physical-phone acceptance claim. Handoff: `docs/perceptron-replay.md`.

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
- Remaining acceptance (non-Bot): live Photon binding on Justin’s lobby challenges; physical-phone mic check for LYRA. Official Grok Bot planning is claimed below — separate from Voice/TTS.

## Combined cockpit / briefing / camera rehearsal

- October 17: Ally’s cockpit launch now enters a selected-world briefing with embedded real Grok Voice controls, then Alan’s camera harness, local training health/results and return to cockpit.
- Browser verified Moon synchronization into Voice fixture and matching camera window; training command changed displayed rival health 100→75. User reported standalone Voice and CV working before this combined flow. Fresh human speech + gestures in the combined screens remain a check.
- 59 frontend tests, 10 integration tests and build pass. Proxy rejects missing session/foreign origin/client identity overrides. Permanent credentials remain server-only.
- All challenge/rival/health state in this combined flow remains labeled local simulation. Real Photon round trip evidence above applies only to saved DEMO-42; B’s actual challenge/multiplayer acceptance is still open. See docs/flight-integration.md.

## Automatic selected-world narration

- Replaced the required spoken test question with automatic state-derived Grok TTS in the briefing. Microphone is not requested for narration; realtime questions remain optional.
- Real browser/API check: Mars script generated, playable MP3 duration 12.84 s, audio readyState 4, and browser reported “Briefing complete. Ready for the jump.” without a microphone session. Browser autoplay fallback remains Play briefing.
- Three focused narration tests passed: selected-state validation, duplicate generation caching/state changes, and stale-world rejection/provider retry. Existing ten integration tests and production build passed.

## Official Grok Bot planning bonus — CLAIMED

In-game Voice/TTS and the LYRA hologram are **Grok Voice / API** integrations. This bonus is the **official Grok Bot / team-bot planning product** ([docs](https://docs.x.ai/grok-bot/team-bots)), used as a collaborator — not an API character inside the duel.

**Session record (Alex / D, team planning):**

- Date / time (Pacific): throughout hack day Saturday Oct 17, 2026 (repeated planning / orchestration sessions, not a one-shot chat).
- Product used: official **Grok Bot** (team / planning product — distinct from Voice realtime and from LYRA).
- Participants: Alex (D, sponsor evidence owner) with team input for A/B/C/D roles; Bot used to pressure-test architecture and research cuts.
- Decisions recorded (landed in repo):
  - Living plan and cut order → [`PLAN.md`](../PLAN.md)
  - Role split A Ally / B Justin / C Alan / D Alex → [`docs/team.md`](team.md), [`AGENTS.md`](../AGENTS.md)
  - Server-authoritative match + shared command path; Photon/Voice must not invent combat rules → [`docs/contracts.md`](contracts.md), [`server/src/integrations/HANDOFF.md`](../server/src/integrations/HANDOFF.md)
  - Freeze extras that threaten the two-phone duel; Mars gravity as gameplay mapping from NASA Fact Sheet values
  - Orchestrated research for datasets / infrastructure → [`datasets.md`](../datasets.md)
- Evidence location: planning outputs committed as `PLAN.md`, `AGENTS.md`, `datasets.md`, and this evidence file (no secrets). Full Bot chat export is **not** required — decisions that landed in-repo are the proof. Optional: a short redacted summary if organizers ask; do not paste entire private planning threads.
- What we cut or prioritized: cut ARKit room scan, campus GPS, planet ownership / armies; prioritize lobby → challenge → gravity-aware camera duel, Cursor evidence, and real Grok Voice + NASA provenance for SpaceXAI.

**Claim:** SpaceXAI **Grok Bot planning bonus** — yes. Separately claimed: Cursor development log + Grok Voice (LYRA / briefing) + NASA/MOLA gravity & arena data.


## LYRA live cockpit Grok Voice integration — October 17

- Added an in-cockpit animated character with typed questions and optional microphone input through Grok Voice. The read-only `getFlightState` tool fetches the joined player's real lobby/match from the running Socket.IO game server. Permanent credentials remain server-only; browser access uses expiring client secrets.
- Real browser/provider evidence: an empty live lobby returned no recommendation; after controlled test player LYNX connected, a fresh response identified LYNX and instructed the player to select/confirm in Radar. These were live state reads, not the old DEMO-42 fixture. Browser streamed audio completed; fresh human microphone/physical-phone testing is still outstanding.
- Demo is explicitly labeled local guide; its canned replies are not counted as Grok API calls. No Photon message was sent in this task. **LYRA is Voice evidence, not the Grok Bot planning bonus** (Bot claimed in the section above).
- Validation: frontend 110 passing / 1 opt-in test skipped, server 59 passing, production build passing. See `docs/hologram-copilot.md`. This does not prove Photon live challenge acceptance or the old briefing's migration from fixtures.
