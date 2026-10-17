# Sponsor evidence — D maintains, A verifies at submission

Status: Photon 2.0 PING/PONG delivery verified. Grok Voice TTS (`/v1/tts`) verified locally. Speech-to-Speech realtime and challenge-ID Photon wiring not done yet.

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
