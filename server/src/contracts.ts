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

export interface PlayerState {
  slot: PlayerSlot;
  connected: boolean;
  // Counts down while disconnected; the match is forfeited at zero.
  reconnectEndsInMs: number | null;
  health: number;
  action: PlayerAction;
  // The active weapon; only it can fire. Switching is instant.
  weapon: Weapon;
  cooldowns: Record<Weapon, number | null>;
  block: BlockState;
  // This player's own shot, flying toward the opponent. At most one at a time.
  projectile: ProjectileInFlight | null;
}

export type MatchPhase = "waiting" | "active" | "finished";

export interface MatchResult {
  // null is a draw.
  winner: PlayerSlot | null;
  reason: "knockout" | "forfeit";
}

export interface MatchSnapshot {
  matchId: string;
  phase: MatchPhase;
  players: PlayerState[];
  result: MatchResult | null;
}

// What one phone receives: its own player as "you", the opponent as "rival".
export interface PlayerView {
  matchId: string;
  phase: MatchPhase;
  result: MatchResult | null;
  you: PlayerState;
  // null until the second player joins.
  rival: PlayerState | null;
}

export interface ProjectileLanded {
  attackerSlot: PlayerSlot;
  weapon: Weapon;
  blocked: boolean;
  damage: number;
}

// Every command carries a unique ID so the server can recognise a retry and
// return the original reply instead of applying it again.
export type CommandType =
  | "rockActive"
  | "gunActive"
  | "throwRock"
  | "fireGun"
  | "startBlock"
  | "endBlock";

export interface Command {
  commandId: string;
  type: CommandType;
}

export type RejectReason =
  | "invalid_command"
  | "not_joined"
  | "match_not_active"
  | "busy"
  | "on_cooldown"
  | "weapon_not_active"
  | "projectile_in_flight"
  | "not_blocking";

export type CommandReply =
  | { commandId: string; status: "accepted" }
  | { commandId: string; status: "rejected"; reason: RejectReason };

export interface JoinRequest {
  // Generated once by the phone and stored, so a reconnect reclaims its slot.
  // A demo-level identity, not authentication.
  playerId: string;
}

export type JoinReply =
  | { ok: true; slot: PlayerSlot; view: PlayerView }
  | { ok: false; reason: "invalid_request" | "match_full" };

export interface ServerToClientEvents {
  view: (view: PlayerView) => void;
  projectileLanded: (event: ProjectileLanded) => void;
}

export interface ClientToServerEvents {
  join: (request: JoinRequest, reply: (result: JoinReply) => void) => void;
  command: (command: Command, reply: (result: CommandReply) => void) => void;
}
