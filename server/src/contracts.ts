// Temporary home for shared types. Moves to packages/contracts once A and B
// agree on a root npm workspace. The web client must use the same shapes.
// All *InMs fields are remaining time, not timestamps: phone clocks don't
// match the server's. null means "not happening".

export type PlayerSlot = 1 | 2;

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

// Arena coordinates in board.cellSize units; q = x, r = z. Fractional after orbiting.
export interface GridCell {
  q: number;
  r: number;
}

export type SetupStep =
  | "phone"
  | "stand"
  | "upright"
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
  // Horizontal unit vector (world x, z) toward the rival.
  facing: [number, number];
  // World-frame joints; null while the body isn't tracked.
  joints: Vec3[] | null;
  blade: ArenaBlade | null;
  swinging: boolean;
  // Movement stamina, 0..100. Steps cost some; it refills after a short pause.
  stamina: number;
  // Ran dry: no steps until stamina recovers.
  winded: boolean;
  // Guard broken: no swings, steps or guard for a moment.
  stunned: boolean;
}

/** Shared pre-combat countdown. A deadline alone never authorizes a hit. */
export interface SaberStart {
  startsAtMs: number | null;
  unlocked: boolean;
}

// Both players in world coordinates, sent to both laptops on every server tick.
export interface ArenaFrame {
  // Server time of the tick (ms), so laptops can blend between frames smoothly
  // despite network jitter. Only differences matter; clocks aren't synced.
  serverMs: number;
  // Optional for compatibility with older scene recordings/clients.
  saberStart?: SaberStart;
  players: ArenaPlayer[];
  // Both players at the front line within a column of each other: only then do swings count.
  engaged: boolean;
}

export interface SaberResolved {
  attackerSlot: PlayerSlot;
  // "guardBreak": the attack swung along the defender's held guard, which broke; the defender is stunned.
  outcome: "blocked" | "hit" | "guardBreak";
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
    // The round's countdown, as on the laptop's view.
    startsInMs: number | null;
    // The laptop's current setup step, so the phone can show it too.
    setup: SetupProgress | null;
    // null until the match finishes; the phone plays the KO cue from this.
    result: MatchResult | null;
  } | null;
}

export type PairReply = { ok: true; status: SaberStatus } | { ok: false; reason: "invalid_code" };

export type WorldId = "earth" | "mars" | "moon" | "neptune";

// Chosen once by the server when a challenge is accepted. Both phones show this record.
export interface World {
  id: WorldId;
  name: string;
  // Rounded NASA Planetary Fact Sheet surface gravity.
  gravityMps2: number;
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
  // Asked for a rematch on the result screen. A new round starts once both have.
  rematch: boolean;
  health: number;
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
  round?: number; // Starts at 1; increments when both pilots rematch.
  phase: MatchPhase;
  // Counts down once both players are set up, before each round (the first and each rematch);
  // swings and steps don't count until it ends. null before both are set up, and after.
  startsInMs: number | null;
  world: World;
  players: PlayerState[];
  result: MatchResult | null;
}

// What one phone receives: its own player as "you", the opponent as "rival".
export interface PlayerView {
  matchId: string;
  round?: number;
  phase: MatchPhase;
  startsInMs: number | null;
  world: World;
  result: MatchResult | null;
  // Coordinate scale and glide duration. rows is retained for older clients (no row ownership).
  board: { cellSize: number; rows: number; stepMs: number };
  you: PlayerState;
  rival: PlayerState;
}

// "in-duel" pilots are in a match and can't be challenged.
export type PilotStatus = "available" | "in-duel";

export interface Pilot {
  id: string;
  callsign: string;
  status: PilotStatus;
  wins: number;
  losses: number;
  // Where the pilot is flying in exploration, as they reported it. Display only:
  // never used for matchmaking, combat or hit checks. Absent until reported.
  location?: PilotLocation;
}

// A coarse exploration place (a destination or body ID plus its display name), not coordinates.
export interface PilotLocation {
  bodyId: string;
  label: string;
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
// "rematch" is only accepted once the match has finished, with both players still there.
// "forfeit" ends the round but keeps you in the match (for a rematch); "leaveMatch" also detaches you.
export type MatchCommandType = "ready" | "forfeit" | "rematch" | "leaveMatch";

export type Command =
  | { commandId: string; type: MatchCommandType }
  | { commandId: string; type: "challenge"; pilotId: string; destination?: "mars" | "neptune" }
  | { commandId: string; type: "acceptChallenge" | "declineChallenge" | "cancelChallenge"; challengeId: string }
  | { commandId: string; type: "setCallsign"; callsign: string }
  // null clears it, e.g. when the pilot leaves exploration.
  | { commandId: string; type: "setLocation"; location: PilotLocation | null }
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
  | "pilot_unavailable"
  // A step past the center line or the back of your side.
  | "blocked"
  // Not enough stamina for that step, or winded.
  | "exhausted"
  // Guard broken a moment ago.
  | "stunned"
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
  arena: (frame: ArenaFrame) => void;
  saberResolved: (event: SaberResolved) => void;
  // To a paired phone.
  saberStatus: (status: SaberStatus) => void;
  // To the pilot's laptop: their own phone's latest reading, for the setup checks.
  phoneAim: (aim: SaberAim) => void;
  // To both laptops, the moment a step is accepted (ahead of the next arena frame).
  stepped: (event: { slot: PlayerSlot; cell: GridCell; orbitCenter?: [number, number] }) => void;
}

export interface ClientToServerEvents {
  'replay:ticket': (request: { matchId: string }, reply: (result: ReplayTicketReply) => void) => void;
  'copilot:session': (request: Record<string, never>, reply: (result: CopilotSessionReply) => void) => void;
  'copilot:context': (request: Record<string, never>, reply: (result: CopilotContextReply) => void) => void;
  /** Allowlisted LYRA arena lines via server Grok TTS. Cue id only — no free text. */
  'lyra:narrate': (request: { cue: string }, reply: (result: LyraNarrateReply) => void) => void;
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

/** Server-owned LYRA TTS. Permanent xAI key stays on the server. */
export type LyraNarrateReply =
  | CopilotFailure
  | { ok: true; cue: string; contentType: 'audio/mpeg'; audioBase64: string };

export type ReplayFailure = { ok: false; reason: 'not_joined' | 'invalid_request' | 'unavailable' | 'not_finished' | 'unauthorized' | 'too_large' | 'unsupported_media' | 'rate_limited' | 'provider_error' | 'no_moments' | 'offline' | 'no_response' };
export type ReplayTicketReply = ReplayFailure | { ok: true; ticket: string };
export interface ReplayMoment { start: number; end: number; caption: string }
/** Coordinates are normalized to [0,1], in the original, unmirrored video. */
export interface ReplayBox { at: number; x1: number; y1: number; x2: number; y2: number }
export type ReplayReply = ReplayFailure | {
  ok: true; source: 'perceptron'; model: string; moments: ReplayMoment[]; boxes: ReplayBox[];
  requestIds: string[]; framing: 'perceptron' | 'unavailable';
};
