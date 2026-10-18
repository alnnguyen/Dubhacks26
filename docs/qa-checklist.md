# Acceptance checks

- [ ] Both chosen phones open the deployed HTTPS app; permissions/denials are handled.
- [ ] Own hand and opponent are detected together in realistic lighting/framing.
- [ ] Debug harness: rock floats on palm hold, arcs on fist throw, vanishes on cancel (no catch; gun/saber not required).
- [ ] Opponent gestures do not repeatedly trigger the wrong player's controls; ambiguity pauses/recalibrates.
- [ ] Selecting a ship challenges the correct session; only that defender can accept.
- [ ] Declined/expired/duplicate acceptance cannot start an unintended match.
- [ ] Both wheels reveal the same world and source gravity.
- [ ] Palm lifts; fist releases; lost tracking does not launch; cooldown is enforced.
- [ ] Block/damage/health/clock/result agree on both clients; duplicates do not multiply damage.
- [ ] Earth/Moon gravity changes the actual defense window; mapping is disclosed.
- [ ] Reconnect resync and the agreed disconnect rule work.
- [ ] Real Photon send/reply changes actual challenge state, with identity binding and deduplication.
- [ ] Real Grok Voice interaction uses actual game state; audio/camera handoff works.
- [ ] Optional Perceptron is a real supplied model inference, or no track claim is made.
- [ ] Full rounds repeat without unacceptable camera/thermal/performance failures.
- [ ] Judge links work; recording/backup accurately labels what is live or replayed.

Record device/browser, observed result and remaining failures during actual tests. These boxes are not test results yet.

## Phone QA — duel HUD on alex-dev (Alan + Alex)

The rock/gun camera duel and its `/?camera=1` / `/?pvp=1` routes were removed October 18. The rows below are kept as a record and no longer apply; test the saber arena instead.

### Setup

```sh
# Terminal 1 — Voice (briefing audio)
node --env-file=server/.env.grok.local server/src/integrations/grok/demo-server.mjs

# Terminal 2 — web
cd web && npm run dev
```

Open the printed HTTPS URL on laptop; for phones tunnel e.g. `npx --yes cloudflared tunnel --url https://localhost:5173` (match the Vite HTTPS port). Accept cert / allow rear camera.

### Combined path checklist

| Step | Pass? | Device / browser | Notes |
|------|-------|------------------|-------|
| Cockpit → Challenge → Engage → pick world → Enter camera duel | | | |
| World tint/chip matches Earth/Mars/Moon + gravity window | | | |
| Start camera; own hand + opponent pose usable in one frame | | | |
| Palm hold → rock floats; fist → arc; cancel/loss → no throw | | | |
| Touch Lift/Throw/Block/Cancel work without gestures | | | |
| Simulate rival → INCOMING → Block | | | |
| Deny camera once → clear error, no crash | | | |
| Return to cockpit; camera stopped | | | |
| Optional: `/?camera=1` still shows full debug log/skeletons | | | |
| `/?pvp=1` with the game server: palm → fist grab → fling throw damages rival after the Mars window; hold Block stops it; Gun: fist hold then index+middle extend (or Fire gun) hits in ~0.8 s | | | Gestures retuned 2026-10-17 evening. Not yet checked on two phones. |

**Testers:** Alan (C), Alex (D help). **Date:** ________ **Result:** ________

Until rows are filled, do not mark the top acceptance boxes for multiplayer/Photon-live as done.
