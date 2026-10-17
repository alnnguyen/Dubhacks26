// Temporary home for shared types. Moves to packages/contracts once A and B
// agree on a root npm workspace. The web client must use the same shapes.
// All *InMs fields are remaining time, not timestamps: phone clocks don't
// match the server's. null means "not happening".

export type PlayerSlot = 1 | 2;

export type PlayerAction = "idle" | "throwing" | "blocking";

export interface BlockState {
  active: boolean;
  endsInMs: number | null;
  cooldownEndsInMs: number | null;
}

export interface RockInFlight {
  landsInMs: number;
}

export interface PlayerState {
  slot: PlayerSlot;
  connected: boolean;
  // Counts down while disconnected; the match is forfeited at zero.
  reconnectEndsInMs: number | null;
  health: number;
  action: PlayerAction;
  weapon: "rock";
  throwCooldownEndsInMs: number | null;
  block: BlockState;
  // This player's own rock, flying toward the opponent.
  rock: RockInFlight | null;
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

export interface RockLanded {
  attackerSlot: PlayerSlot;
  blocked: boolean;
  damage: number;
}

// Every command carries a unique ID so the server can recognise a retry and
// return the original reply instead of applying it again.
export type CommandType = "throwRock" | "startBlock" | "endBlock";

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
  | "rock_in_flight"
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
  | { ok: true; slot: PlayerSlot; snapshot: MatchSnapshot }
  | { ok: false; reason: "invalid_request" | "match_full" };

export interface ServerToClientEvents {
  snapshot: (snapshot: MatchSnapshot) => void;
  rockLanded: (event: RockLanded) => void;
}

export interface ClientToServerEvents {
  join: (request: JoinRequest, reply: (result: JoinReply) => void) => void;
  command: (command: Command, reply: (result: CommandReply) => void) => void;
}
