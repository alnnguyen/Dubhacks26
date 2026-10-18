# Perceptron cinematic highlights

Alan authorized resuming the interrupted implementation on October 18. Work is on `codex/perceptron-highlights`, based on `09b5291`. This is a post-match feature for the laptop/iPhone saber flow in FlightApp. No combat rules, exploration modules, manifests or lockfiles were changed. The implementation used Codex; this is not additional Cursor-use evidence.

## Setup and use

1. Add `PERCEPTRON_API_KEY` to ignored `server/.env`. Optional `PERCEPTRON_MODEL` defaults to `perceptron-mk1.5`; see `server/.env.perceptron.example`. Never use a `VITE_` variable for the key.
2. Restart the updated game backend with `cd server && npm run dev` (or build and `npm start`). Those scripts load `server/.env`. The browser must connect to this updated backend; a key on your laptop does not configure a separately hosted shared server.
3. Run the frontend normally. Local Vite dev proxies `/replay` to the same `GAME_PROXY_TARGET` as Socket.IO. A separately deployed frontend uses its `VITE_GAME_SERVER_URL`; production hosting must route `/replay/*` to the updated backend.
4. During saber setup, everyone visible must agree to recording; enable the local replay checkbox. Once both fighters are armed, it records the first uninterrupted eligible segment, capped at 45 seconds, 640×360 at 15 fps, without audio. Losing fight readiness/camera or leaving the arena stops the recording. It does not buffer a full unlimited match.
5. Stay on the result screen. Preview/save/discard the local video. To analyze, confirm everyone visible agrees to send it to Perceptron, then choose **Create AI highlights**.
6. Choose **Play highlight reel** or a timeline card. Model intervals/captions drive the cuts; timestamped player boxes drive restrained crop/pan; playback is 0.65× (normal speed and no crop animation with Reduce motion). No inferred score changes occur.

## Interfaces and limits

- Additive `GameClient.analyzeReplay()` requests `replay:ticket({matchId})` over the joined socket, then uploads a raw Blob to `POST /replay/:matchId`. No private player ID in HTTP, no permanent key in browser responses.
- The current finished match and connected pilot are checked at ticket issuance and upload. Tickets expire in two minutes. Existing demo sessions remain trust-based, as documented in contracts; this does not introduce production account authentication.
- Accepted transport MIME types: WebM or MP4, maximum 8 MiB, declared duration ≤45 seconds. The server bounds the upload and reads it in memory, with a 15-second body deadline. Encoded duration is client-reported rather than independently decoded; provider rejection is explicit.
- Provider endpoint: `https://api.perceptron.inc/v1/chat/completions`, using `video_url` with inline data, `vision_config.annotation_format: clip` then `box`. At most two calls per analysis, with a shared 45-second inference deadline and no automatic retries. Native `<clip>` and `<track>/<point_box>` annotations are parsed, bounded, and normalized.
- Two concurrent uploads/analyses globally, eight analysis attempts per five minutes. Bounded cache: 64 pilot/match jobs with a ten-minute TTL. Concurrent/repeated uploads for the same pilot/match share the original job, including failures, so a retry does not incur new inference until expiry. Leaving the match invalidates access even to cached results.
- Recordings and provider payloads are never saved on the game server's disk. Video is sent inline to Perceptron only after consent; provider retention follows their policies. The game keeps only parsed analysis promises/results in its temporary in-memory cache.
- Captions are rendered as plain React text. Missing framing keeps the original view and is labeled. Missing/invalid moments, a missing key, unsupported browser recording, oversize uploads, provider failure and offline state are explicit; there are no fabricated fallback highlights.

## Checked and remaining

- Server build and 101 tests passed, including real local Socket.IO/HTTP transport tests with **mocked** inference, match authorization, ticket expiry, CORS rejection, upload size/metadata, concurrent deduplication, cached no-moments failure and parser validation.
- Web production build/typecheck and frontend tests passed. Additional recorder tests cover the time cap, disposal and size cap; transport tests cover consent-dependent caller upload/ticket failures and cancellation. Final totals are recorded on the task board.
- In-app-browser synthetic QA: actual MediaRecorder → playable 640×360 WebM; consent disabled/enabled state; mocked two-moment playback with captions/framing; responsive 390-pixel layout with no horizontal overflow; discard; no warning/error browser logs. This is browser component QA, not a completed duel or a physical-phone test.
- Real API smoke test, October 18: authenticated `/models` returned 200 and listed Mk1.5; a ~4.5-second synthetic WebM returned a native event interval (200, 1039 ms) and eight timestamped boxes (200, 2610 ms). Both responses parsed successfully. See `docs/sponsor-evidence.md` for request IDs. No real person or webcam footage was uploaded during these checks.
- Still pending: an actual consenting duel through capture → finished-match upload → real selection/framing → playback; Safari MP4 acceptance/performance; target-device recording cost; deployed backend routing and full multiplayer acceptance. No deployment was performed.

## Scope boundaries

This version creates an in-browser highlight presentation, with an original-video download. It does not export a rendered highlight movie, reconstruct new 3D camera angles, draw a Perceptron saber-tip trail, or align model observations with an authoritative hit-event log. Player framing is not saber tracking; webcam movement is not proof of a scored hit or block. Those remain separate increments after the real duel check.

Provider references checked: [official quickstart](https://docs.perceptron.inc/perceptron-mk1.5/index), [official Python SDK](https://github.com/perceptron-ai-inc/perceptron), [native annotation grammar](https://github.com/perceptron-ai-inc/perceptron/blob/main/src/perceptron/pointing/parser.py). Runtime behavior above is based on the actual smoke test, not solely on documentation.
