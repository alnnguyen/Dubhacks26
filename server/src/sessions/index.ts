import { randomBytes } from "node:crypto";
import type {
  ChallengeStatus,
  ChallengeView,
  CommandReply,
  LobbyView,
  Pilot,
  PilotLocation,
  PlayerSlot,
  PlayerView,
  RejectReason,
  ArenaFrame,
  GridCell,
  SaberAim,
  SaberResolved,
  SaberStatus,
  WorldId,
} from "../contracts.js";
import { COMMAND_ID_PATTERN, IN_MATCH_COMMAND_TYPES, Match, type InMatchCommandType } from "../game/match.js";
import { RULES } from "../game/rules.js";

const PLAYER_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
// Pair codes avoid look-alike characters (0/O, 1/I) since people type them on a phone.
const PAIR_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PAIR_CODE_LENGTH = 6;
const CALLSIGN_PATTERN = /^[A-Z0-9][A-Z0-9 _-]{0,13}$/;
const LOCATION_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
const LOCATION_LABEL_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}\p{Pd} .,'()+/·*]{0,47}$/u;

type Timer = ReturnType<typeof setTimeout>;

// Keyed by the phone's private playerId; other phones only ever see `id`.
interface PilotRecord {
  playerId: string;
  id: string;
  callsign: string;
  connected: boolean;
  wins: number;
  losses: number;
  match: { match: Match; slot: PlayerSlot } | null;
  // The most recent challenge involving this pilot, in any status.
  challengeId: string | null;
  // Reply already sent for each lobby commandId, so retries repeat it.
  replies: Map<string, CommandReply>;
  // A phone opening /?saber=<pairCode> becomes this pilot's lightsaber.
  pairCode: string;
  saberPaired: boolean;
  location: PilotLocation | null;
}

interface ChallengeRecord {
  destination?: "mars" | "neptune";
  id: string;
  challenger: PilotRecord;
  defender: PilotRecord;
  status: ChallengeStatus;
  expiresAt: number;
  timer?: Timer;
}

export interface LobbyEvents {
  // Any lobby or match change; the server re-sends views to connected players.
  changed: () => void;
  saberResolved: (playerIds: string[], event: SaberResolved) => void;
  // Both players in the arena, every server tick, to both laptops.
  arenaFrame: (playerIds: string[], frame: ArenaFrame) => void;
  // A step was accepted, to both laptops at once.
  stepped: (playerIds: string[], event: { slot: PlayerSlot; cell: GridCell }) => void;
}

export interface LobbyOptions {
  // The server picks each match's world once. Injectable for tests.
  pickWorld?: () => WorldId;
}

export type JoinResult = { ok: true } | { ok: false; reason: "invalid_request" };

// One shared demo room: pilots, challenges between them, and the matches accepted challenges start.
// Every player action, from the app or a provider adapter, goes through handleCommand.
/** The two built arenas, equally likely. */
export function pickArenaWorld(random: () => number = Math.random): WorldId {
  return random() < 0.5 ? "mars" : "neptune";
}

export class Lobby {
  private pilots = new Map<string, PilotRecord>();
  private challenges = new Map<string, ChallengeRecord>();
  private matches = new Set<Match>();
  private nextMatch = 1;
  private nextChallenge = 1;
  private pickWorld: () => WorldId;

  constructor(private events: LobbyEvents, options: LobbyOptions = {}) {
    // Each accepted challenge lands on Mars or Neptune, 50/50, chosen once here. Tests can still inject a world.
    this.pickWorld = options.pickWorld ?? (() => pickArenaWorld());
  }

  join(playerId: unknown, callsign?: unknown): JoinResult {
    if (typeof playerId !== "string" || !PLAYER_ID_PATTERN.test(playerId)) {
      return { ok: false, reason: "invalid_request" };
    }

    let pilot = this.pilots.get(playerId);
    if (!pilot) {
      const id = `p${randomBytes(4).toString("hex")}`;
      pilot = {
        playerId,
        id,
        callsign: `PILOT-${id.slice(1, 5).toUpperCase()}`,
        connected: true,
        wins: 0,
        losses: 0,
        match: null,
        challengeId: null,
        replies: new Map(),
        pairCode: this.newPairCode(),
        saberPaired: false,
        location: null,
      };
      this.pilots.set(playerId, pilot);
    }
    pilot.connected = true;
    const requested = normalizeCallsign(callsign);
    if (requested) pilot.callsign = requested;
    if (pilot.match) pilot.match.match.reconnect(pilot.match.slot);

    this.events.changed();
    return { ok: true };
  }

  disconnect(playerId: string): void {
    const pilot = this.pilots.get(playerId);
    if (!pilot) return;
    pilot.connected = false;
    // A pilot who isn't here can't answer or wait for an answer.
    const challenge = this.pendingChallengeOf(pilot);
    if (challenge) this.close(challenge, "cancelled");
    if (pilot.match) pilot.match.match.disconnect(pilot.match.slot);
    this.events.changed();
  }

  // Streamed inputs have no reply; input from a pilot outside a match is dropped.
  handleBodyPose(playerId: string, pose: unknown): void {
    const pilot = this.pilots.get(playerId);
    if (pilot?.match) pilot.match.match.handleBodyPose(pilot.match.slot, pose);
  }

  // Returns the accepted reading so the server can relay it to the pilot's laptop.
  handleSaberAim(playerId: string, aim: unknown): SaberAim | null {
    const pilot = this.pilots.get(playerId);
    return pilot?.match ? pilot.match.match.handleSaberAim(pilot.match.slot, aim) : null;
  }

  // A phone presents a pair code; returns the pilot's private playerId it now controls.
  pairSaber(code: unknown): string | null {
    if (typeof code !== "string") return null;
    const normalized = code.trim().toUpperCase();
    const pilot = [...this.pilots.values()].find((p) => p.pairCode === normalized);
    if (!pilot) return null;
    this.setSaberPaired(pilot, true);
    return pilot.playerId;
  }

  // The pilot's phone disconnected (or was replaced and the new one is already paired).
  unpairSaber(playerId: string): void {
    const pilot = this.pilots.get(playerId);
    if (pilot) this.setSaberPaired(pilot, false);
  }

  saberStatus(playerId: string): SaberStatus | null {
    const pilot = this.pilots.get(playerId);
    if (!pilot) return null;
    if (!pilot.match) return { callsign: pilot.callsign, match: null };
    const view = pilot.match.match.toView(pilot.match.slot);
    return {
      callsign: pilot.callsign,
      match: {
        slot: pilot.match.slot,
        phase: view.phase,
        health: view.you.health,
        rivalHealth: view.rival.health,
        armed: pilot.match.match.saberCombatReady && view.you.saber.bodyReady && view.you.saber.saberReady && view.rival.saber.bodyReady && view.rival.saber.saberReady,
        startsInMs: pilot.match.match.saberStartsInMs,
        setup: pilot.match.match.setupProgress(pilot.match.slot),
        result: view.result,
      },
    };
  }

  private setSaberPaired(pilot: PilotRecord, paired: boolean): void {
    pilot.saberPaired = paired;
    if (pilot.match) pilot.match.match.setSaberPaired(pilot.match.slot, paired);
    this.events.changed();
  }

  private newPairCode(): string {
    for (;;) {
      const bytes = randomBytes(PAIR_CODE_LENGTH);
      const code = [...bytes].map((b) => PAIR_ALPHABET[b % PAIR_ALPHABET.length]).join("");
      if (![...this.pilots.values()].some((p) => p.pairCode === code)) return code;
    }
  }

  handleCommand(playerId: string, command: unknown): CommandReply {
    const pilot = this.pilots.get(playerId);
    const raw = (typeof command === "object" && command !== null ? command : {}) as Record<string, unknown>;
    const commandId = typeof raw.commandId === "string" ? raw.commandId : "";
    if (!pilot) return { commandId, status: "rejected", reason: "not_joined" };
    if (!COMMAND_ID_PATTERN.test(commandId)) return { commandId, status: "rejected", reason: "invalid_command" };

    // Combat and ready belong to the match, which keeps its own retry replies.
    if (IN_MATCH_COMMAND_TYPES.includes(raw.type as InMatchCommandType)) {
      if (!pilot.match) return { commandId, status: "rejected", reason: "not_in_match" };
      return pilot.match.match.handleCommand(pilot.match.slot, command);
    }

    const previous = pilot.replies.get(commandId);
    if (previous) return previous;

    const reason = this.apply(pilot, raw);
    const reply: CommandReply = reason
      ? { commandId, status: "rejected", reason }
      : { commandId, status: "accepted" };
    if (reason !== "invalid_command") pilot.replies.set(commandId, reply);
    if (!reason) this.events.changed();
    return reply;
  }

  lobbyView(playerId: string): LobbyView {
    const pilot = this.pilots.get(playerId)!;
    const pilots = [...this.pilots.values()].filter((p) => p !== pilot && p.connected).map(publicPilot);
    const challenge = pilot.challengeId === null ? undefined : this.challenges.get(pilot.challengeId);
    return {
      you: publicPilot(pilot),
      pilots,
      challenge: challenge ? challengeView(challenge, pilot) : null,
      pairCode: pilot.pairCode,
    };
  }

  matchView(playerId: string): PlayerView | null {
    const seat = this.pilots.get(playerId)?.match;
    return seat ? seat.match.toView(seat.slot) : null;
  }

  // Stops every pending timer, e.g. when the server shuts down.
  dispose(): void {
    for (const challenge of this.challenges.values()) clearTimeout(challenge.timer);
    for (const match of this.matches) match.dispose();
  }

  private apply(pilot: PilotRecord, command: Record<string, unknown>): RejectReason | null {
    switch (command.type) {
      // From the laptop's guided setup; retries repeat the first reply like other lobby commands.
      case "calibrateSaber": {
        if (!pilot.match) return "not_in_match";
        return pilot.match.match.setSaberCalibration(pilot.match.slot, command.calibration);
      }
      case "step": {
        if (!pilot.match) return "not_in_match";
        return pilot.match.match.step(pilot.match.slot, command.direction);
      }
      case "setCallsign": {
        const callsign = normalizeCallsign(command.callsign);
        if (!callsign) return "invalid_command";
        pilot.callsign = callsign;
        return null;
      }
      case "setLocation": {
        if (command.location === null) {
          pilot.location = null;
          return null;
        }
        const location = normalizeLocation(command.location);
        if (!location) return "invalid_command";
        pilot.location = location;
        return null;
      }

      case "challenge": {
        if (typeof command.pilotId !== "string") return "invalid_command";
        if (command.destination !== undefined && command.destination !== "mars" && command.destination !== "neptune") return "invalid_command";
        if (pilot.match) return "in_match";
        if (this.pendingChallengeOf(pilot)) return "busy";
        const defender = [...this.pilots.values()].find((p) => p.id === command.pilotId);
        if (!defender || defender === pilot || !defender.connected || defender.match || this.pendingChallengeOf(defender)) {
          return "pilot_unavailable";
        }
        this.open(pilot, defender, command.destination);
        return null;
      }

      case "acceptChallenge":
      case "declineChallenge":
      case "cancelChallenge": {
        if (typeof command.challengeId !== "string") return "invalid_command";
        const challenge = this.challenges.get(command.challengeId);
        const role = command.type === "cancelChallenge" ? "challenger" : "defender";
        if (!challenge || challenge.status !== "pending" || challenge[role] !== pilot) return "challenge_unavailable";

        if (command.type === "acceptChallenge") {
          this.close(challenge, "accepted");
          this.startMatch(challenge.challenger, challenge.defender, challenge.destination);
        } else {
          this.close(challenge, command.type === "declineChallenge" ? "declined" : "cancelled");
        }
        return null;
      }

      case "leaveMatch": {
        if (!pilot.match) return "not_in_match";
        const { match, slot } = pilot.match;
        match.leave(slot);
        pilot.match = null;
        if (![...this.pilots.values()].some((p) => p.match?.match === match)) {
          match.dispose();
          this.matches.delete(match);
        }
        return null;
      }

      default:
        return "invalid_command";
    }
  }

  private open(challenger: PilotRecord, defender: PilotRecord, destination?: "mars" | "neptune"): void {
    const challenge: ChallengeRecord = {
      id: `ch${this.nextChallenge++}`,
      challenger,
      defender,
      destination,
      status: "pending",
      expiresAt: Date.now() + RULES.challengeExpiryMs,
    };
    challenge.timer = setTimeout(() => {
      this.close(challenge, "expired");
      this.events.changed();
    }, RULES.challengeExpiryMs);
    this.challenges.set(challenge.id, challenge);
    challenger.challengeId = challenge.id;
    defender.challengeId = challenge.id;
  }

  private close(challenge: ChallengeRecord, status: ChallengeStatus): void {
    clearTimeout(challenge.timer);
    challenge.status = status;
  }

  private pendingChallengeOf(pilot: PilotRecord): ChallengeRecord | undefined {
    const challenge = pilot.challengeId === null ? undefined : this.challenges.get(pilot.challengeId);
    return challenge?.status === "pending" ? challenge : undefined;
  }

  private startMatch(challenger: PilotRecord, defender: PilotRecord, destination?: "mars" | "neptune"): void {
    const seats = { 1: challenger, 2: defender } as const;
    const match = new Match(
      `m${this.nextMatch++}`,
      destination ?? this.pickWorld(),
      {
        1: { pilotId: challenger.id, callsign: challenger.callsign },
        2: { pilotId: defender.id, callsign: defender.callsign },
      },
      {
        changed: () => this.events.changed(),
        saberResolved: (event) => this.events.saberResolved([challenger.playerId, defender.playerId], event),
        arenaFrame: (frame) => this.events.arenaFrame([challenger.playerId, defender.playerId], frame),
        stepped: (event) => this.events.stepped([challenger.playerId, defender.playerId], event),
        finished: (result) => {
          if (result.winner === null) return;
          seats[result.winner].wins += 1;
          seats[result.winner === 1 ? 2 : 1].losses += 1;
        },
      },
    );
    this.matches.add(match);
    challenger.match = { match, slot: 1 };
    defender.match = { match, slot: 2 };
    // A phone paired in the lobby is already this pilot's saber.
    match.setSaberPaired(1, challenger.saberPaired);
    match.setSaberPaired(2, defender.saberPaired);
  }
}

function normalizeCallsign(callsign: unknown): string | null {
  if (typeof callsign !== "string") return null;
  const normalized = callsign.trim().replace(/\s+/g, " ").toUpperCase();
  return CALLSIGN_PATTERN.test(normalized) ? normalized : null;
}

// Location labels come from catalog names (e.g. "TRAPPIST-1 e", "67P/Churyumov–Gerasimenko").
function normalizeLocation(location: unknown): PilotLocation | null {
  if (typeof location !== "object" || location === null) return null;
  const { bodyId, label } = location as Record<string, unknown>;
  if (typeof bodyId !== "string" || typeof label !== "string") return null;
  if (!LOCATION_ID_PATTERN.test(bodyId)) return null;
  const normalized = label.trim().replace(/\s+/g, " ");
  return LOCATION_LABEL_PATTERN.test(normalized) ? { bodyId, label: normalized } : null;
}

function publicPilot(pilot: PilotRecord): Pilot {
  return {
    id: pilot.id,
    callsign: pilot.callsign,
    status: pilot.match ? "in-duel" : "available",
    wins: pilot.wins,
    losses: pilot.losses,
    ...(pilot.location ? { location: pilot.location } : {}),
  };
}

function challengeView(challenge: ChallengeRecord, pilot: PilotRecord): ChallengeView {
  const role = challenge.challenger === pilot ? "challenger" : "defender";
  return {
    id: challenge.id,
    role,
    opponent: publicPilot(role === "challenger" ? challenge.defender : challenge.challenger),
    status: challenge.status,
    expiresInMs: challenge.status === "pending" ? Math.max(0, challenge.expiresAt - Date.now()) : null,
  };
}
