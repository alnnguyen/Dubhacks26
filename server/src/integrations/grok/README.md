# Grok Voice provider proof

Isolated server-only audio proof; it does not depend on duel contracts, a browser build, or root workspace changes. Requires Node 22+. Keep `XAI_API_KEY` in `server/.env.grok.local` (gitignored, owner-only). Never put the key in browser-prefixed variables or committed docs.

## TTS smoke test

```sh
node --env-file=server/.env.grok.local server/src/integrations/grok/proof-tts.mjs
open tmp/grok-voice-tts-proof.mp3
```

This calls `POST https://api.x.ai/v1/tts` with a Mars gravity briefing and writes MP3 under `tmp/`. Label evidence as TTS-only until a Speech-to-Speech realtime call is verified.

## Realtime implementation now available

See ../HANDOFF.md for the localhost microphone demo, automated speech-input proof and B adapter handoff. Real realtime speech/tool/speech calls passed with Mars and Moon fixtures; human microphone and live-match checks remain open.

## Original next steps / live-game acceptance

- Realtime Speech-to-Speech (`wss://api.x.ai/v1/realtime?model=grok-voice-latest`) answering “What world did we get?” from match state.
- Browser clients must use ephemeral client secrets from the server; never ship `XAI_API_KEY` to the web app.
- Confirm with organizers whether TTS alone meets SpaceXAI Voice eligibility.

Official references:
- https://docs.x.ai/developers/model-capabilities/audio/voice
- https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech
- https://docs.x.ai/developers/quickstart
