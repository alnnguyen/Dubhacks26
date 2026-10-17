# Photon 2.0 provider proof

Isolated server-only PING/PONG test; it does not depend on duel contracts, a webhook deployment, an SDK install, or root workspace changes. Requires Node 22+ and the beta REST API.

## Local setup

Keep PHOTON_PROJECT_ID, PHOTON_API_KEY, PHOTON_TEST_SENDER, and PHOTON_AGENT_HANDLE in `server/.env.photon.local`. That file is gitignored; keep owner-only permissions. Do not use browser-prefixed environment variables. Never put actual keys or phone identities in committed examples.

From the repository root:

```sh
node --env-file=server/.env.photon.local server/src/integrations/photon/proof.mjs
```

After READY, send a fresh plain PING from the assigned test sender to its assigned iMessage line. The script waits up to two minutes, restricts the sender/agent/direct conversation and freshness, and sends one PONG reply. It uses a stable idempotency key derived from the inbound message ID, so retrying that reply does not intentionally create a duplicate. Network timeouts and bounded transient retries are included. It polls delivery for 30 seconds and distinguishes accepted from delivered. Raw messages, handles and keys are not logged.

If it times out, run again and send another fresh PING after READY. The first inbound text must be sent after shared-line assignment; check the actual iMessage Send & Receive identity. Group messages and unrelated content are ignored. A 403 may indicate missing project:read/project:write permissions; inspect provider logs without pasting secrets.

This is a short-lived proof, not the production inbound listener. Next step after real delivery is verified: use beta live events/webhooks with durable deduplication and bind ACCEPT/DECLINE/STATUS plus challenge ID to B's validated command service. Do not modify B's contracts in this module.

Official references:
- https://photon.codes/docs/beta/get-started/imessage.md
- https://photon.codes/docs/beta/api-reference
- https://api.photon.codes/openapi.json

Observed provider constraint: this shared iMessage Space rejected parentMessageId with HTTP 409 SPACE_NOT_SENDABLE (threaded replies unsupported). The proof sends a normal direct message in the same Space instead, using a distinct stable idempotency-key namespace.

Challenge reply implementation: see ../HANDOFF.md. Real ACCEPT DEMO-42 changed saved fixture state and its confirmation was delivered; B live-game wiring remains open.
