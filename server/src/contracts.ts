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

export type Weapon = "rock" | "gun" | "saber";

export interface ProjectileInFlight {
  weapon: Weapon;
  landsInMs: number;
}

// Saber duel in a shared 3D arena, in meters. World frame: x to slot 1's
// right, y up, z from slot 1 toward slot 2. A game space: each player is in
// front of their own laptop, wherever that is.
export type Vec3 = [number, number, number];
export type Hand = "left" | "right";

// Streamed by each player's laptop (~20 Hz, no ack): their own body from the
// laptop camera. Input only; the server decides swings, blocks and hits.
export interface BodyPose {
  // Increases with every pose; the server ignores repeats and older ones.
  seq: number;
  tracked: boolean;
  // The 33 MediaPipe pose joints, hip-centered, in the player's body frame:
  // x right, y up, z forward (toward their screen, i.e. toward the opponent).
  joints: Vec3[];
  // The player stood still on their spot during setup.
  calibrated: boolean;
  // The laptop's guided setup, relayed to the player's phone so it can show the same step.
  setup: SetupProgress | null;
}

// One step to a neighboring cell, relative to the way the player faces (forward is toward the rival's side).
export type StepDirection = "forward" | "back" | "left" | "right";

// A board cell: q is the column along x (unbounded), r the row along z
// (slot 1 owns rows -rows..-1, slot 2 rows 1..rows).
export interface GridCell {
  q: number;
  r: number;
}

export type SetupStep =
  | "stand"
  | "phone"
  | "forward"
  | "up"
  | "right"
  | "reach"
  | "done";

export interface SetupProgress {
  step: SetupStep;
  // 0..1 through the current step's hold.
  progress: number;
}

// Streamed by the player's paired phone (~30 Hz, no ack): the raw direction
// of the phone's top edge in the Earth frame (x east, y north, z up; iOS's
// heading zero is arbitrary). The server turns it into a blade direction with
// the player's calibration; the hilt is their wrist from BodyPose.
export interface SaberAim {
  seq: number;
  tracked: boolean;
  top: Vec3;
  // Angular speed in degrees/s, for the laptop's setup checks.
  rate: number;
}

// Set by the laptop's guided setup through the command path.
export interface SaberCalibration {
  // Horizontal Earth-frame heading of "toward the screen" (x east, y north).
  forward: [number, number];
  hand: Hand;
  // The phone reported right as left during setup; mirror its sideways axis.
  mirror: boolean;
  // Every setup step passed. Until then the blade shows but swings don't count.
  done: boolean;
}

export interface SaberState {
  swinging: boolean;
  // Swings aren't detected until this ends.
  cooldownEndsInMs: number | null;
  // A phone is paired as this player's saber.
  paired: boolean;
  // The phone is ignited and its readings are arriving.
  phoneLive: boolean;
  bodyReady: boolean;
  saberReady: boolean;
}

export interface ArenaBlade {
  hilt: Vec3;
  tip: Vec3;
}

export interface ArenaPlayer {
  slot: PlayerSlot;
  // The cell the player stands in (or is stepping to).
  cell: GridCell;
  // Which way they face, a horizontal unit vector (world x, z): straight down the lane, slot 1 +z, slot 2 -z.
  facing: [number, number];
  // World-frame joints; null while the body isn't tracked.
  joints: Vec3[] | null;
  blade: ArenaBlade | null;
  swinging: boolean;
}

// Both players in world coordinates, sent to both laptops on every server tick.
export interface ArenaFrame {
  // Server time of the tick (ms), so laptops can blend between frames smoothly
  // despite network jitter. Only differences matter; clocks aren't synced.
  serverMs: number;
  players: ArenaPlayer[];
  // Both players at the front line within a column of each other: only then do swings count.
  engaged: boolean;
}

export interface SaberResolved {
  attackerSlot: PlayerSlot;
  outcome: "blocked" | "hit";
  damage: number;
}

// What a paired phone shows: who it belongs to and how the duel is going.
export interface SaberStatus {
  callsign: string;
  // null outside a match.
  match: {
    slot: PlayerSlot;
    phase: MatchPhase;
    health: number;
    rivalHealth: number;
    armed: boolean;
    // The laptop's current setup step, so the phone can show it too.
    setup: SetupProgress | null;
  } | null;
}

export type PairReply = { ok: true; status: SaberStatus } | { ok: false; reason: "invalid_code" };

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
  saber: SaberState;
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
  // The lane board, so laptops draw the same one: cell size (center to center, m), rows on
  // each side, and how long a step glides (laptops start your own glide the moment a step is accepted).
  board: { cellSize: number; rows: number; stepMs: number };
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
  // Private to you: a phone opening /?saber=<code> becomes your lightsaber.
  pairCode: string;
}

// Every command carries a unique ID so the server can recognise a retry and
// return the original reply instead of applying it again.
export type MatchCommandType =
  | "ready"
  | "leaveMatch"
  | "rockActive"
  | "gunActive"
  | "saberActive"
  | "throwRock"
  | "fireGun"
  | "slash"
  | "startBlock"
  | "endBlock";

export type Command =
  | { commandId: string; type: MatchCommandType }
  | { commandId: string; type: "challenge"; pilotId: string }
  | { commandId: string; type: "acceptChallenge" | "declineChallenge" | "cancelChallenge"; challengeId: string }
  | { commandId: string; type: "setCallsign"; callsign: string }
  | { commandId: string; type: "calibrateSaber"; calibration: SaberCalibration }
  | { commandId: string; type: "step"; direction: StepDirection };

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
  // A step past the center line or the back of your side.
  | "blocked"
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
  arena: (frame: ArenaFrame) => void;
  saberResolved: (event: SaberResolved) => void;
  // To a paired phone.
  saberStatus: (status: SaberStatus) => void;
  // To the pilot's laptop: their own phone's latest reading, for the setup checks.
  phoneAim: (aim: SaberAim) => void;
  // To both laptops, the moment a step is accepted (ahead of the next arena frame).
  stepped: (event: { slot: PlayerSlot; cell: GridCell }) => void;
}

export interface ClientToServerEvents {
  'copilot:session': (request: Record<string, never>, reply: (result: CopilotSessionReply) => void) => void;
  'copilot:context': (request: Record<string, never>, reply: (result: CopilotContextReply) => void) => void;
  join: (request: JoinRequest, reply: (result: JoinReply) => void) => void;
  command: (command: Command, reply: (result: CommandReply) => void) => void;
  bodyPose: (pose: BodyPose) => void;
  // From a phone: become the saber of the pilot with this pair code.
  pairSaber: (request: { code: string }, reply: (result: PairReply) => void) => void;
  saberAim: (aim: SaberAim) => void;
  // From a paired phone: the thumb swiped. Goes through the same validated, deduplicated step command as the laptop's keys.
  saberStep: (request: { stepId: string; direction: StepDirection }, reply: (result: CommandReply) => void) => void;
}

// Read-only ship copilot. Permanent provider keys never cross this boundary.
export type CopilotFailure = { ok: false; reason: 'not_joined' | 'invalid_request' | 'offline' | 'no_response' | 'unavailable' | 'rate_limited' | 'provider_error' };
export type CopilotSessionReply = CopilotFailure | { ok: true; clientSecret: string; expiresAt?: number; session: Record<string, unknown> };
export type CopilotContextReply = CopilotFailure | { ok: true; context: { source: 'live'; lobby: LobbyView; match: PlayerView | null } };
