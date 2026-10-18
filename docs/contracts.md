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

## Planetary travel hand-off — A, October 17, 2026

`SpaceshipHome` begins planetary travel only when its lobby adapter reports `challenge.kind === "launching"` after the accepted/ready state and the pilot chooses Engage. The cinematic always selects Mars and calls `onTravelComplete("mars")` once when the video ends or is skipped. The parent then mounts room scanning; arena generation and duel start remain downstream of scanning.

This is a frontend callback boundary, not a new multiplayer event or shared wire contract. A real adapter must derive the launch state from the authoritative accepted match. The current mock lobby is preview-only; the room scanner is not present in this worktree. C can replace the `FlightApp` hand-off screen with the scanner when that module is integrated. B's server-owned match contract remains unchanged.
