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

- Prefers rear ~0.5× / min zoom when the phone exposes it; otherwise shows “Wide lens unavailable — default rear.”
- Laptop with no rear lens falls back to the front camera and labels that clearly.
- `localhost` / Vite HTTPS both count as a secure context for `getUserMedia`.

## Phone framing gate (do this now)

Phones need a public **HTTPS** URL (plain LAN `http://192.168.x.x` usually cannot use the camera on iOS).

With the Vite server running:

```bash
# Cloudflare (no account required for a quick tunnel)
npx --yes cloudflared tunnel --url https://localhost:5173

# or ngrok (Vite allows .ngrok-free.app and .ngrok-free.dev)
ngrok http https://localhost:5173
```

Open the tunnel URL **with the camera harness**:

`https://YOUR-SUBDOMAIN.ngrok-free.dev/?debug=camera`

(Tap through ngrok’s interstitial if shown.) Allow camera, use the **rear / 0.5×** lens when the phone offers it, then check:

1. **Hand lock**: hold your hand low for ~2s; opponent’s hand must not fire lift/throw. Lost lock → Recalibrate (touch still works).
2. Own locked hand (green) and opponent pose health stub together in one frame.
3. **Ground rocks** in the lower third as soon as the camera starts.
4. Open palm near a rock (or hold **Lift**) → rock rises to the hand (`lifting` → `held`, larger while held).
5. Swipe + fist / **Throw** → rock arcs toward upper-center / shoulders + `releaseRock`.
6. Cover the lens / Cancel → rock drops; never accidental mid-flight launch from tracking loss.
7. Touch Lift / Throw / Block / Cancel emit the same command names as gestures.
8. Deny permission once and confirm a clear error (no crash).

This is a **screen-space overlay POC** (fake ground band + MediaPipe hand tracking). It works on iPhone Safari over HTTPS. Floor-mesh WebXR was removed (needs Android Chrome or a commercial WebAR SDK such as 8th Wall for real plane AR on iPhone).

Record pass/fail in `docs/task-board.md` or `docs/qa-checklist.md` with device/browser. This harness does not need A’s lobby or B’s WebSocket for the framing gate.

## Ownership notes

- C: `src/camera`, `src/vision`, `src/overlay`, `public/models`
- B owns WebSocket + frozen command schemas; this harness logs commands locally only
- D’s voice should release the mic during combat; not wired here
- Keep secrets out of client config
- No gun/saber on this harness by design (PLAN cut order)
