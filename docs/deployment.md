# Running and sharing

There is no hosted frontend or game server in this repo. Nothing here creates a Cloudflare, ngrok, or other account, and no production URL is checked in. Sharing for phones is a local process plus a temporary HTTPS tunnel.

## Local game

From the repository root, with Node 22 or newer:

```bash
# Terminal 1 — authoritative server, port 3001
cd server && npm install && npm run dev

# Terminal 2 — HTTPS web client, usually https://localhost:5173
cd web && npm install && npm run dev
```

Accept Vite's self-signed certificate. The dev server proxies Socket.IO and replay uploads to `http://127.0.0.1:3001` unless `GAME_PROXY_TARGET` is set. `GET /health` on the game server returns `ok`.

The lobby is in memory. Restarting the server drops pilots, challenges, and matches. There is no seeded cloud demo to reset.

## Phones

iOS only exposes device orientation on a secure page, so a LAN address such as `http://192.168.x.x` is not enough for the saber controller. With Vite already running:

```bash
npx --yes cloudflared tunnel --url https://localhost:5173
```

`npx` downloads `cloudflared` for that command. A quick tunnel does not need a Cloudflare account. The printed `https://*.trycloudflare.com` hostname is temporary and changes the next time the tunnel starts. Vite allows that host, plus `.ngrok-free.app`, `.ngrok-free.dev`, and `.ngrok.io`:

```bash
ngrok http https://localhost:5173
```

Open the laptop on the tunneled HTTPS origin (or keep the laptop on `https://localhost:5173` and point phone QR links at the tunnel). The pair QR uses `VITE_SABER_CONTROLLER_URL` when that public page is not this Vite origin. Leave both `VITE_GAME_SERVER_URL` and `VITE_SABER_CONTROLLER_URL` blank to stay on the local proxy. Copy `web/.env.example` to `web/.env.local` only when a laptop and a phone must share a different HTTPS origin. Restart Vite after changing it. Those values are public URLs, not API keys.

`ALLOWED_ORIGIN` defaults to `http://localhost:5173,https://localhost:5173`. The Vite proxy keeps the socket on the page's origin, and it forwards the browser `Origin` header. If a tunneled page is rejected on the socket handshake, add that `https://….trycloudflare.com` origin to `ALLOWED_ORIGIN` and restart the server.

## Keys

`XAI_API_KEY` and `PERCEPTRON_API_KEY` stay on the server. Templates: `server/.env.grok.local.example` and `server/.env.perceptron.example`. Do not put them in `VITE_` variables.

## What is not set up

No container, process manager, persistent volume, or custom domain is configured. Photon inbound URLs, origin lockdown beyond `ALLOWED_ORIGIN`, and a known-good hosted build are not part of this tree. See `web/README.md` for the dev routes and `docs/qa-checklist.md` for device checks that still need a person and a phone.
