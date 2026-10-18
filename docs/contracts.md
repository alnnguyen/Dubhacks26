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
- 2026-10-17, B — Combat commands (rock + block only): client emits `command({ commandId, type })` with ack; `type` is `throwRock | startBlock | endBlock`. Reply `{ commandId, status: "accepted" }` or `{ commandId, status: "rejected", reason }` with reason `invalid_command | not_joined | match_not_active | busy | on_cooldown | rock_in_flight | not_blocking`. A repeated `commandId` from the same player returns the original reply without re-applying.
- 2026-10-17, B — Match phases `waiting → active → finished` (replaces the earlier `ready`). `result: { winner: 1 | 2 | null, reason: "knockout" | "forfeit" }`; null winner is a draw. Server also emits `rockLanded({ attackerSlot, blocked, damage })`. Disconnect gives a 15 s reconnect grace; expiry forfeits to the connected player (draw if both gone).
- 2026-10-17, B — Placeholder rules in `server/src/game/rules.ts` (to tune with C): 20 damage, 300 ms throw wind-up, 3 s throw cooldown, 1.5 s block limit, 2 s block cooldown. Flight fixed to Mars, 0.8 × √(9.8 / 3.7) ≈ 1302 ms, until the world wheel exists.
- 2026-10-17, B — Per-player views replace the shared `snapshot` broadcast. Server emits `view(PlayerView)` to each phone: `{ matchId, phase, result, you, rival }` (`rival` null while waiting). `join` reply is now `{ ok: true, slot, view }`. Affects A's HUD and C's duel props: read `view.you` / `view.rival`, not slot-indexed players.
- 2026-10-17, B — Web networking API in `web/src/networking` (`createGameClient`): connects to the page's own origin (Vite proxies `/socket.io` to `127.0.0.1:3001`), stores `playerId` in localStorage, joins on every (re)connect, exposes `status()` (`connecting | online | offline`), `joinError()`, `view()`, `onStatus/onView/onRockLanded` (return unsubscribe), and `throwRock()/startBlock()/endBlock()` → Promise of the server reply, or `{ status: "rejected", reason: "offline" | "no_response" }` decided on the phone (3 s timeout). The module generates command IDs (`c<page-load ms + n>`); callers never pass IDs. Gun command not defined yet. B decision, not yet confirmed by C (Alan): C's block should adopt held `startBlock`/`endBlock`, and C should call these functions instead of generating its own command IDs (C's `session:match:n` IDs contain `:`, which the server rejects).
- 2026-10-17, C (Alan) — Demo server default `ALLOWED_ORIGIN` includes `https://localhost:5173` so the Vite HTTPS page can join. Override with the env var for tunnels.
- 2026-10-17, C (Alan) — Live duel (`/?pvp=1`) calls `createGameClient` only. Rock CV: palm charge → fist grab (`startLift` local) → fling-open with speed (or touch Throw) → `rockActive()` + `throwRock()`. Gun CV (weapon=Gun): **fist** holds/cocks → `gunActive`; **index+middle extend** (ring/pinky curled) → `fireGun` once per cock. Touch **Rock / Gun** switch weapons; **Fire gun** is a touch backup. Touch Block is a hold: `startBlock` / `endBlock`. Rock arc uses `rockFlightMs(3.7)`; bolt 800 ms. Callers do not send command IDs.
- 2026-10-17, B — Weapons: `gun` (starting weapon) and `rock`. Commands `gunActive` / `rockActive` switch instantly (allowed mid-block); `fireGun` / `throwRock` fire only the active weapon, else `weapon_not_active`. One shot in flight per player (`projectile_in_flight`). Gun bolt: 800 ms travel, 20 damage, 1 s cooldown, no wind-up, auto-locks on the opponent; a block active on arrival stops it. `PlayerState` now has `weapon`, `cooldowns: { rock, gun }`, `projectile: { weapon, landsInMs } | null`, and `action` is `idle | attacking | blocking`; `rockLanded` is replaced by `projectileLanded({ attackerSlot, weapon, blocked, damage })`. Client: `gunActive()`, `rockActive()`, `fireGun()`, `onProjectileLanded()`. Numbers are placeholders.
- 2026-10-17, B — Lobby, challenges and server-picked world replace the single fixed demo match. Affects A (cockpit/FlightApp), C (duel props), D (game-port adapter).
  - Join: `join({ playerId, callsign? })` → `{ ok: true, lobby, view }` (`view` null outside a match) or `{ ok: false, reason: "invalid_request" }`. No `slot`/`match_full`. Each pilot gets a public `id` (`p` + 8 hex); the private `playerId` is never sent to other phones.
  - Server emits `lobby(LobbyView)` — `{ you, pilots, challenge }`, where `challenge` is your latest one as `{ id, role, opponent, status: pending|accepted|declined|cancelled|expired, expiresInMs }` — and `view(PlayerView | null)`.
  - New commands on the same `command` path and ID dedupe: `setCallsign{callsign}`, `challenge{pilotId}`, `acceptChallenge|declineChallenge|cancelChallenge{challengeId}`, `ready`, `leaveMatch`. New reject reasons `not_in_match | in_match | pilot_unavailable | challenge_unavailable`. One pending challenge per pilot; 30 s expiry; a disconnect cancels it.
  - Accepting creates a match with the challenger as slot 1. The server picks the world once (`PlayerView.world: { id, name, gravityMps2, rockFlightMs }`); rock flight follows that world (Earth 800, Mars 1302, Moon 1980 ms). Phase `waiting` is now the briefing; it turns `active` when both players send `ready`. `PlayerState` adds `pilotId`, `callsign`, `ready`; `rival` is never null. Disconnecting during the briefing also starts the 15 s grace. `leaveMatch` before the end forfeits; wins/losses are in-memory only.
  - Web: `web/src/lobby/useServerLobby.ts` implements `LobbyViewModel` from the server; FlightApp shows server health/world/result and maps C's commands: `startLift` → `rockActive` (if needed), `releaseRock` → `throwRock`, `block` → `startBlock` (ends at the 1.5 s limit; C's machine has no release edge yet), `cancelLift` → nothing sent. The local reducer `app/state.ts` is removed. `VITE_GAME_SERVER_URL` (public URL, not a secret) points a separately hosted frontend at the server.

## Cockpit Demo / Live composition — Alex

`BridgeApp` now owns onboarding plus a persisted `sd.lobby.mode.v1` selection (default Live). Demo mounts the existing simulated cockpit without a game connection. Live owns a `createGameClient` connection, synchronizes the onboarding callsign, and passes that client to `FlightApp`. Switching away closes that connection. The mode controls lock while a live challenge is pending or a match exists and only render in the cockpit.

`FlightApp` accepts optional UI composition props `{ client?: GameClient; cockpitControls?: ReactNode }`; standalone callers retain the existing shared-client default. No networking protocol, combat rules, provider identity, or server contract changed. Both demo devices must use the same frontend/server for real discovery. Keep `BridgeApp` as the default entry when merging into Ally's checkout; her current default `FlightApp` bypasses these onboarding/mode controls.

Cockpit controls placement: `SpaceshipHome.cockpitControls?: ReactNode` forwards the controls to `CockpitShortcuts.controls?: ReactNode`. `FlightApp` passes its optional controls into that slot. Radar, Console, the mode switch and reset share one bottom dock, hidden together outside the idle cockpit. The previous separate fixed bar is removed. No wire contract changes.


## LYRA read-only copilot — Alex, October 17

Added joined-socket RPCs `copilot:session({})` and `copilot:context({})`, typed in `server/src/contracts.ts` and wrapped by GameClient. Context reads the same running lobby/match for the current player; identity arguments are rejected. Session mints a short-lived xAI Voice client secret; the permanent key stays server-only. The Voice tool `getFlightState` is read-only. No existing combat/challenge commands changed. A UI entry point passes `SpaceshipHome.copilotClient?: GameClient` from FlightApp. See `docs/hologram-copilot.md` for lifecycle, limits, verification, and merge instructions.
