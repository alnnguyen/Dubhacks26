# Interface decisions — owner B

Status: proposed checklist, not implemented or frozen. B coordinates agreement before A/C/D depend on it. Once accepted, add the matching schemas in packages/contracts/src and use those as the runtime source of truth.

## Shared records

Player/session identity; room membership and available ships; Challenge with challenger/defender/expiry; WorldDefinition with source gravity and version; MatchSnapshot with phase, server time, players, health, cooldowns, rock states and result; ordered MatchEvent; Photon identity binding and message IDs.

## Proposed commands

challenge, acceptChallenge, declineChallenge, ready, startLift, releaseRock, cancelLift, block, rematch. Optional later: attack and selectWeapon. Agree exact payloads and names once; do not create competing aliases in different modules.

All mutations carry session authorization, unique command ID and relevant room/challenge/match ID. Server verifies sender/ownership/state. Define acknowledgement/rejection, duplicate handling and reconnect snapshot semantics.

## State transitions

LOBBY → CHALLENGED → ACCEPTED → WORLD_SELECTED → CALIBRATING/READY → COUNTDOWN → ACTIVE → FINISHED. Explicit decline, expiry, cancellation and disconnect/reconnect rules are required. Server selects world once; clients animate that selection.

## Decisions to freeze

- Identifier formats, payload validation/schema version, errors and server timestamps.
- 60-second round/100-health starting design; exact damage, block window, hold limits and cooldowns.
- Gravity data version, timing formula and visual arc mapping.
- Gesture intent versus server-approved rock state; tracking-loss cancellation.
- WebSocket envelopes, snapshot cadence, event ordering and reconnect rule.
- Provider adapters call the same action service; late/duplicate acceptance cannot create a second match.
- Camera confidence is self-reported and not proof of physical distance or contact.

Record decisions below with owner/date and affected modules. No decisions have been frozen by this scaffolding task.

## Decisions

- 2026-10-17, B — Transport is Socket.IO 4.8.4 (not raw `ws`). Affects web/src/networking: the client must use `socket.io-client`. Socket.IO replays buffered emits after reconnect, so command IDs remain required.
- 2026-10-17, B — Join: client emits `join({ playerId })` with an ack. `playerId` is generated once by the phone and stored (8–64 chars of `A-Za-z0-9_-`) so a reconnect reclaims the same slot. Demo-level identity, not authentication. Server replies `{ ok, slot, snapshot }` or `{ ok: false, reason }` and broadcasts `snapshot` on join/disconnect.
- 2026-10-17, B — Timing fields in snapshots are remaining milliseconds (`landsInMs`, `endsInMs`), not timestamps. Current types: `server/src/contracts.ts` (moves to packages/contracts once a root workspace is agreed with A).
