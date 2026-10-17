// Temporary home for shared types. Moves to packages/contracts once A and B
// agree on a root npm workspace. The web client must use the same shapes.

export type PlayerSlot = 1 | 2;

export type PlayerAction = "idle" | "throwing" | "blocking";

export interface BlockState {
  active: boolean;
  // Remaining time, not a timestamp: phone clocks don't match the server's.
  endsInMs: number | null;
}

export interface PlayerState {
  slot: PlayerSlot;
  connected: boolean;
  health: number;
  action: PlayerAction;
  weapon: "rock";
  block: BlockState;
}

export interface RockInFlight {
  attackerSlot: PlayerSlot;
  landsInMs: number;
}

export interface MatchSnapshot {
  matchId: string;
  phase: "waiting" | "ready";
  players: PlayerState[];
  rock: RockInFlight | null;
}

// Commands are handled in step 2. Every command carries a unique ID so the
// server can recognise a retry and return the original result.
export type CommandType = "throwRock" | "startBlock" | "endBlock";

export interface Command {
  commandId: string;
  type: CommandType;
}

export interface CommandReply {
  commandId: string;
  status: "accepted" | "rejected";
  reason?: string;
}

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
}

export interface ClientToServerEvents {
  join: (request: JoinRequest, reply: (result: JoinReply) => void) => void;
}
