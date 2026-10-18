// Temporary home for shared types. Moves to packages/contracts once A and B
// agree on a root npm workspace. The web client must use the same shapes.
// All *InMs fields are remaining time, not timestamps: phone clocks don't
// match the server's. null means "not happening".

export type PlayerSlot = 1 | 2;

// "attacking" covers a weapon's wind-up after firing (rock only, for now).
export type PlayerAction = "idle" | "attacking" | "blocking";

export interface BlockState {
  active: boolean;
  endsInMs: number | null;
  cooldownEndsInMs: number | null;
}

export type Weapon = "rock" | "gun";

export interface ProjectileInFlight {
  weapon: Weapon;
  landsInMs: number;
}

export type WorldId = "earth" | "mars" | "moon";

// Chosen once by the server when a challenge is accepted. Both phones show this record.
export interface World {
  id: WorldId;
  name: string;
  // Rounded NASA Planetary Fact Sheet surface gravity.
  gravityMps2: number;
  // Gameplay mapping 0.8 × √(9.8 / gravity) s, not projectile physics.
  rockFlightMs: number;
}

export interface PlayerState {
  slot: PlayerSlot;
  // The public pilot ID from the lobby, not the phone's private playerId.
  pilotId: string;
  callsign: string;
  connected: boolean;
  // Counts down while disconnected; the match is forfeited at zero.
  reconnectEndsInMs: number | null;
  // Pressed Ready after the briefing. The match starts when both are ready.
  ready: boolean;
  health: number;
  action: PlayerAction;
  // The active weapon; only it can fire. Switching is instant.
  weapon: Weapon;
  cooldowns: Record<Weapon, number | null>;
  block: BlockState;
  // This player's own shot, flying toward the opponent. At most one at a time.
  projectile: ProjectileInFlight | null;
}

// "waiting" is the briefing: the world is chosen and the match starts once both players are ready.
export type MatchPhase = "waiting" | "active" | "finished";

export interface MatchResult {
  // null is a draw.
  winner: PlayerSlot | null;
  reason: "knockout" | "forfeit";
}

export interface MatchSnapshot {
  matchId: string;
  phase: MatchPhase;
  world: World;
  players: PlayerState[];
  result: MatchResult | null;
}

// What one phone receives: its own player as "you", the opponent as "rival".
export interface PlayerView {
  matchId: string;
  phase: MatchPhase;
  world: World;
  result: MatchResult | null;
  you: PlayerState;
  rival: PlayerState;
}

export interface ProjectileLanded {
  attackerSlot: PlayerSlot;
  weapon: Weapon;
  blocked: boolean;
  damage: number;
}

// "in-duel" pilots are in a match and can't be challenged.
export type PilotStatus = "available" | "in-duel";

export interface Pilot {
  id: string;
  callsign: string;
  status: PilotStatus;
  wins: number;
  losses: number;
}

export type ChallengeStatus = "pending" | "accepted" | "declined" | "cancelled" | "expired";

// A challenge as one of its two pilots sees it.
export interface ChallengeView {
  id: string;
  role: "challenger" | "defender";
  opponent: Pilot;
  status: ChallengeStatus;
  expiresInMs: number | null;
}

export interface LobbyView {
  you: Pilot;
  // Other connected pilots.
  pilots: Pilot[];
  // The most recent challenge involving you, in any status, until a newer one replaces it.
  challenge: ChallengeView | null;
}

// Every command carries a unique ID so the server can recognise a retry and
// return the original reply instead of applying it again.
export type MatchCommandType =
  | "ready"
  | "leaveMatch"
  | "rockActive"
  | "gunActive"
  | "throwRock"
  | "fireGun"
  | "startBlock"
  | "endBlock";

export type Command =
  | { commandId: string; type: MatchCommandType }
  | { commandId: string; type: "challenge"; pilotId: string }
  | { commandId: string; type: "acceptChallenge" | "declineChallenge" | "cancelChallenge"; challengeId: string }
  | { commandId: string; type: "setCallsign"; callsign: string };

export type CommandType = Command["type"];

export type RejectReason =
  | "invalid_command"
  | "not_joined"
  | "match_not_active"
  | "not_in_match"
  | "in_match"
  | "busy"
  | "on_cooldown"
  | "weapon_not_active"
  | "projectile_in_flight"
  | "not_blocking"
  | "pilot_unavailable"
  | "challenge_unavailable";

export type CommandReply =
  | { commandId: string; status: "accepted" }
  | { commandId: string; status: "rejected"; reason: RejectReason };

export interface JoinRequest {
  // Generated once by the phone and stored, so a reconnect reclaims its pilot
  // and match. A demo-level identity, not authentication. Never shown to others.
  playerId: string;
  // Optional; invalid callsigns fall back to the current or a generated one.
  callsign?: string;
}

export type JoinReply =
  | { ok: true; lobby: LobbyView; view: PlayerView | null }
  | { ok: false; reason: "invalid_request" };

export interface ServerToClientEvents {
  lobby: (lobby: LobbyView) => void;
  // null while the player is not in a match.
  view: (view: PlayerView | null) => void;
  projectileLanded: (event: ProjectileLanded) => void;
}

export interface ClientToServerEvents {
  'copilot:session': (request: Record<string, never>, reply: (result: CopilotSessionReply) => void) => void;
  'copilot:context': (request: Record<string, never>, reply: (result: CopilotContextReply) => void) => void;
  join: (request: JoinRequest, reply: (result: JoinReply) => void) => void;
  command: (command: Command, reply: (result: CommandReply) => void) => void;
}

// Read-only ship copilot. Permanent provider keys never cross this boundary.
export type CopilotFailure = { ok: false; reason: 'not_joined' | 'invalid_request' | 'offline' | 'no_response' | 'unavailable' | 'rate_limited' | 'provider_error' };
export type CopilotSessionReply = CopilotFailure | { ok: true; clientSecret: string; expiresAt?: number; session: Record<string, unknown> };
export type CopilotContextReply = CopilotFailure | { ok: true; context: { source: 'live'; lobby: LobbyView; match: PlayerView | null } };
