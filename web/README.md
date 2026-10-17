# Browser client

Role C currently ships a **camera debug harness** so phones can pass the framing gate before A’s lobby exists. A still owns full app composition; this page is temporary and should be mounted under a debug route later.

Combat on this page is **rock only** (screen-space overlay). Gun and lightsaber are deferred until the rock loop + phone framing pass. Defense is **Block**, not catch.

## Run (laptop)

```bash
cd web
npm install
npm test
npm run dev
```

Open the printed HTTPS URL (self-signed), usually `https://localhost:5173`. Accept the certificate warning. Click **Start camera**.

- Laptop with no rear lens falls back to the front camera and labels that clearly.
- `localhost` / Vite HTTPS both count as a secure context for `getUserMedia`.

## Phone framing gate (do this now)

Phones need a public **HTTPS** URL (plain LAN `http://192.168.x.x` usually cannot use the camera on iOS).

With the Vite server running:

```bash
# Cloudflare (no account required for a quick tunnel)
npx --yes cloudflared tunnel --url https://localhost:5173

# or ngrok
ngrok http https://localhost:5173
```

Open the `https://…` tunnel URL on the **demo phone**, allow camera, use the **rear** lens when prompted, then check:

1. Own hand (green) and opponent pose health stub together in one frame.
2. Palm hold → rock floats above the hand + `startLift` in the command log.
3. Fist → rock arcs toward the opponent + `releaseRock` (no catch).
4. Cover the lens / leave frame / Cancel → rock vanishes + `cancelLift`, never a throw mid-flight from loss.
5. Touch Lift / Throw / Block / Cancel emit the same command names as gestures.
6. Deny permission once and confirm a clear error (no crash).

Record pass/fail in `docs/task-board.md` or `docs/qa-checklist.md` with device/browser. This harness does not need A’s lobby or B’s WebSocket for the framing gate.

## Ownership notes

- C: `src/camera`, `src/vision`, `src/overlay`, `public/models`
- B owns WebSocket + frozen command schemas; this harness logs commands locally only
- D’s voice should release the mic during combat; not wired here
- Keep secrets out of client config
- No gun/saber on this harness by design (PLAN cut order)
