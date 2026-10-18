# Actual development-tool usage

Record real substantive Cursor use for the sponsor, and Codex/Claude assistance accurately. Do not invent historical entries or treat generated plans as implemented features.

Entry format: time (Pacific), human owner, tool, concrete task, changed files/commit, observed verification. Official Grok Bot planning evidence belongs in sponsor-evidence.md.

- 2026-10-17 3:22 p.m. Pacific, Alan, Cursor: role C gesture pipeline, rear-camera opener, and screen-space rock arc under web/src. Not committed. Verification: `cd web && npm test` — 6 files, 42 tests passed. No phone camera run.
- 2026-10-17 3:30 p.m. Pacific, Alan, Cursor: Vite HTTPS camera debug harness with MediaPipe Hand+Pose → battle commands; laptop rear→user fallback; tunnel notes in web/README.md. Verification: `cd web && npm test` (after harness). Live camera not claimed until a human runs Start camera.
- 2026-10-17 3:35 p.m. Pacific, Alan, Cursor: screen-space rock visual (held/flying/cancel) on CameraDebugPage; gun/saber explicitly deferred; phone framing checklist updated in web/README.md. Verification: `cd web && npm test`.
- 2026-10-17 4:16 p.m. Pacific, Alan, Cursor: AR POC — ground rocks, palm pickup, hand-velocity throw with perspective scale/shadow (screen-space, not ARKit). Verification: `cd web && npm test` 56 passed.
- 2026-10-17 4:27 p.m. Pacific, Alan, Cursor: WebXR immersive-ar hit-test rock session with MediaPipe hand offsets; overlay remains the fallback. Verification: `cd web && npm test` after the change. Live WebXR device pass not claimed.
- 2026-10-17 4:39 p.m. Pacific, Alan, Cursor: Removed WebXR/Three.js plane session; iPhone path is screen-overlay rocks only. Verification: `cd web && npm test`.
- 2026-10-17 ~15:39 Pacific — Alex (D) — Cursor Agent — Recorded Grok Voice TTS proof after human-confirmed `/v1/tts` success; added `server/src/integrations/grok/proof-tts.mjs`, grok README, `.env.grok.local.example`; updated `docs/sponsor-evidence.md`. Verification: existing local `welcome.mp3` (~4.8s Mars briefing) plus script for repeatable runs. Photon proof already present from earlier D work.
- 2026-10-17 ~15:57 Pacific — Alex (D) — Cursor Agent — Committed Photon challenge-agent + Grok realtime harness; merged `origin/alan` camera harness into `alex-dev`. Verification: resolve docs then run D + web tests.
- 2026-10-17 ~5:25 p.m. Pacific, Alan, Cursor: hand calibration lock, ~0.5× rear zoom preference + fallback banner, first-person rock retune (lower-third spawn, larger held, upper-center aim). No gun/saber. Files under `web/src/{vision,camera,overlay}`. Verification: `cd web && npm test`.
