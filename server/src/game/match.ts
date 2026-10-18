import type {
  ArenaBlade,
  ArenaFrame,
  BodyPose,
  CommandReply,
  Hand,
  MatchCommandType,
  MatchPhase,
  MatchResult,
  MatchSnapshot,
  PlayerSlot,
  PlayerState,
  PlayerView,
  RejectReason,
  SaberStart,
  SaberAim,
  SaberCalibration,
  SaberResolved,
  SetupProgress,
  SetupStep,
  StepDirection,
  Vec3,
  WorldId,
} from "../contracts.js";
import { RULES, SABER, world } from "./rules.js";
import {
  add,
  bodyShape,
  bodyToWorld,
  directionToWorld,
  JOINT_COUNT,
  LEFT_WRIST,
  length,
  resolveSweep,
  RIGHT_WRIST,
  scale,
  sub,
  worldToDirection,
  type Facing,
} from "./saber3d.js";
import { CELL_SIZE, cellToWorld, inReach, orbitStep, interpolateStep, ROWS_PER_SIDE, type Cell } from "./grid.js";

import { advanceSaberStart } from "./saberStart.js";

type Timer = ReturnType<typeof setTimeout>;

// Server-side player record. Times are absolute server times (Date.now());
// toSnapshot converts them to remaining milliseconds for the phones.
interface Player {
  slot: PlayerSlot;
  pilotId: string;
  callsign: string;
  connected: boolean;
  ready: boolean;
  rematch: boolean;
  health: number;
  reconnectEndsAt: number | null;
  saber: Saber;
  timers: { reconnect?: Timer; step?: Timer };
}

// One player's saber inputs and swing. Times are server receive times.
interface Saber {
  body: { seq: number; at: number | null; pose: BodyPose | null };
  aim: { seq: number; at: number | null; aim: SaberAim | null };
  paired: boolean;
  // From the laptop's guided setup; no blade without it.
  calibration: SaberCalibration | null;
  // The blade at the previous tick, to sweep from, and its tip in the player's
  // own body frame, to tell a swing from stepping or turning to face the rival.
  lastBlade: ArenaBlade | null;
  lastBodyTip: Vec3 | null;
  // The cell the player stands in (or is stepping to), and the glide there from the last one.
  cell: Cell;
  glide: { from: [number, number]; startedAt: number; orbitCenter?: [number, number] };
  // No new step until this time: the glide plus a short pause.
  stepReadyAt: number;
  // One step asked for mid-glide, taken the moment the current one lands.
  queuedStep: StepDirection | null;
  // Stamina as of `at`; it refills from regenFrom on (see stamina()).
  stamina: { value: number; at: number; regenFrom: number; winded: boolean };
  swinging: boolean;
  // While swinging: the tip where the swing started (own body frame), and the
  // farthest it has got from there.
  swing: { from: Vec3; reach: number } | null;
  cooldownEndsAt: number | null;
  // Guard broken: no swings, steps or guard until this time.
  stunnedUntil: number;
  // Readiness last announced, so a change re-sends the views.
  announced: string;
}

const HANDS: readonly Hand[] = ["left", "right"];
const STEP_DIRECTIONS: readonly StepDirection[] = ["forward", "back", "left", "right"];
// How far a swing must have moved across the space between the players (not toward them) to have a line.
const ATTACK_LINE_MIN = 0.15;
// Below this you can't afford any step.
const CHEAPEST_STEP = Math.min(...Object.values(SABER.stepStamina));
// Start in the middle row of each side, straight across from each other: one step each to engage.
const START_CELLS: Record<PlayerSlot, Cell> = { 1: { q: 0, r: -2 }, 2: { q: 0, r: 2 } };
// Each player faces down the lane toward the other side, whatever column either is in.
const FACING: Record<PlayerSlot, Facing> = { 1: [0, 1], 2: [0, -1] };

const SETUP_STEPS: readonly SetupStep[] = ["phone", "stand", "upright", "right", "reach", "done"];

export interface MatchEvents {
  changed: () => void;
  saberResolved: (event: SaberResolved) => void;
  // A step was accepted: sent at once, ahead of the next arena frame.
  stepped: (event: { slot: PlayerSlot; cell: Cell; orbitCenter?: [number, number] }) => void;
  // Both players in the arena, every tick.
  arenaFrame: (frame: ArenaFrame) => void;
  finished: (result: MatchResult) => void;
}

export interface MatchPilot {
  pilotId: string;
  callsign: string;
}

export const COMMAND_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
// leaveMatch is handled by the lobby, which detaches the player after leave().
export type InMatchCommandType = Exclude<MatchCommandType, "leaveMatch">;
export const IN_MATCH_COMMAND_TYPES: readonly InMatchCommandType[] = ["ready", "forfeit", "rematch"];

export class Match {
  private players = new Map<PlayerSlot, Player>();
  private phase: MatchPhase = "waiting";
  private result: MatchResult | null = null;
  private round = 1;
  private saberStart: SaberStart = { startsAtMs: null, unlocked: false };
  get saberCombatReady(): boolean { return this.phase === "active" && this.saberStart.unlocked; }
  get saberStartsInMs(): number | null {
    return this.saberStart.startsAtMs === null || this.saberStart.unlocked
      ? null : Math.max(0, this.saberStart.startsAtMs - Date.now());
  }
  // Reply already sent for each "slot:commandId", so retries repeat it.
  private replies = new Map<string, CommandReply>();
  // The saber tick runs from the briefing (so laptops show both avatars during
  // setup) until the match ends. Unref'd so it never keeps the process alive.
  private ticker: ReturnType<typeof setInterval>;
  private lastTickAt: number | null = null;

  // Both players are in the match from the start; it begins once both are ready.
  constructor(
    readonly matchId: string,
    readonly worldId: WorldId,
    pilots: Record<PlayerSlot, MatchPilot>,
    private events: MatchEvents,
  ) {
    for (const slot of [1, 2] as const) this.addPlayer(slot, pilots[slot]);
    this.ticker = this.startTicker();
  }

  private startTicker(): ReturnType<typeof setInterval> {
    const ticker = setInterval(() => this.tick(), SABER.tickMs);
    (ticker as { unref?: () => void }).unref?.();
    return ticker;
  }

  get isFinished(): boolean {
    return this.phase === "finished";
  }

  private addPlayer(slot: PlayerSlot, pilot: MatchPilot): void {
    this.players.set(slot, {
      slot,
      pilotId: pilot.pilotId,
      callsign: pilot.callsign,
      connected: true,
      ready: false,
      rematch: false,
      health: RULES.startingHealth,
      reconnectEndsAt: null,
      saber: newSaber(START_CELLS[slot]),
      timers: {},
    });
  }

  reconnect(slot: PlayerSlot): void {
    const player = this.players.get(slot)!;
    if (player.connected) return;
    player.connected = true;
    player.reconnectEndsAt = null;
    clearTimeout(player.timers.reconnect);
    this.events.changed();
  }

  disconnect(slot: PlayerSlot): void {
    const player = this.players.get(slot)!;
    player.connected = false;
    player.saber.swinging = false;

    if (this.phase !== "finished") this.startGrace(player);
    this.events.changed();
  }

  // Leaving before the end gives the match to the other player. Either way the
  // player is gone, so the rival can't get a rematch with them.
  leave(slot: PlayerSlot): void {
    const player = this.players.get(slot)!;
    player.connected = false;
    player.rematch = false;
    if (this.phase !== "finished") this.finish({ winner: slot === 1 ? 2 : 1, reason: "forfeit" });
    this.events.changed();
  }

  handleCommand(slot: PlayerSlot, command: unknown): CommandReply {
    const parsed = parseCommand(command);
    if (!parsed) {
      const commandId = typeof (command as { commandId?: unknown })?.commandId === "string"
        ? (command as { commandId: string }).commandId
        : "";
      return { commandId, status: "rejected", reason: "invalid_command" };
    }

    const key = `${slot}:${parsed.commandId}`;
    const previous = this.replies.get(key);
    if (previous) return previous;

    const reason = this.apply(this.players.get(slot)!, parsed.type);
    const reply: CommandReply = reason
      ? { commandId: parsed.commandId, status: "rejected", reason }
      : { commandId: parsed.commandId, status: "accepted" };
    this.replies.set(key, reply);
    if (!reason) this.events.changed();
    return reply;
  }

  // Streamed from the player's laptop, ~20 Hz with no reply. Invalid, repeated,
  // older or too-frequent poses are dropped.
  // Still taken after the end, so a rematch starts with both players armed.
  handleBodyPose(slot: PlayerSlot, raw: unknown): void {
    const pose = parseBodyPose(raw);
    const body = this.players.get(slot)!.saber.body;
    const now = Date.now();
    if (!pose || pose.seq <= body.seq) return;
    if (body.at !== null && now - body.at < SABER.minInputIntervalMs) return;
    Object.assign(body, { seq: pose.seq, at: now, pose });
  }

  // Streamed from the player's paired phone, ~30 Hz with no reply. Returns the
  // accepted reading, which the server relays to the player's laptop for setup.
  handleSaberAim(slot: PlayerSlot, raw: unknown): SaberAim | null {
    const aim = parseSaberAim(raw);
    const state = this.players.get(slot)!.saber.aim;
    const now = Date.now();
    if (!aim || aim.seq <= state.seq) return null;
    if (state.at !== null && now - state.at < SABER.minInputIntervalMs) return null;
    Object.assign(state, { seq: aim.seq, at: now, aim });
    return aim;
  }

  // The laptop's guided setup measured how this player holds their phone.
  setSaberCalibration(slot: PlayerSlot, raw: unknown): RejectReason | null {
    if (this.phase === "finished") return "match_not_active";
    const calibration = parseCalibration(raw);
    if (!calibration) return "invalid_command";
    this.players.get(slot)!.saber.calibration = calibration;
    this.announceReadiness();
    return null;
  }

  // Opponent-relative movement: forward/back change distance, left/right orbit.
  // Allowed from the briefing on so players can practise during setup.
  step(slot: PlayerSlot, direction: unknown): RejectReason | null {
    if (this.phase === "finished" || (!this.saberStart.unlocked && this.saberStart.startsAtMs !== null)) return "match_not_active";
    if (!STEP_DIRECTIONS.includes(direction as StepDirection)) return "invalid_command";
    const player = this.players.get(slot)!;
    const now = Date.now();
    if (now < player.saber.stunnedUntil) return "stunned";
    // Refused up front, so a step you can't afford isn't buffered either.
    if (!this.canAfford(player, direction as StepDirection, now)) return "exhausted";
    // Mid-glide: remember one step and take it the moment this one lands, so quick swipes aren't lost.
    if (now < player.saber.stepReadyAt) {
      if (player.saber.queuedStep) return "busy";
      player.saber.queuedStep = direction as StepDirection;
      player.timers.step = setTimeout(() => {
        const queued = player.saber.queuedStep;
        player.saber.queuedStep = null;
        if (queued && this.phase !== "finished") this.stepTo(player, queued, Date.now());
      }, player.saber.stepReadyAt - now);
      return null;
    }
    return this.stepTo(player, direction as StepDirection, now);
  }

  // The one way a player changes cell.
  private stepTo(player: Player, direction: StepDirection, now: number): RejectReason | null {
    if (now < player.saber.stepReadyAt) return "busy";

    const rival = this.players.get(player.slot === 1 ? 2 : 1)!;
    const target = orbitStep(player.saber.cell, rival.saber.cell, direction);
    if (!target) return "blocked";
    if (!this.canAfford(player, direction, now)) return "exhausted";
    this.spendStamina(player, SABER.stepStamina[direction], now);

    const orbitCenter = direction === "left" || direction === "right" ? cellToWorld(rival.saber.cell) : undefined;
    player.saber.glide = { from: this.rootXZ(player, now), startedAt: now, orbitCenter };
    player.saber.cell = target;
    player.saber.stepReadyAt = now + SABER.stepMs + SABER.stepCooldownMs;
    // Laptops start your glide on this instead of waiting for the next tick and smooth playback.
    this.events.stepped({ slot: player.slot, cell: target, ...(orbitCenter ? { orbitCenter } : {}) });
    return null;
  }

  // Stamina now: the last value plus what refilled since the later of then and the end of the pause after a step.
  private stamina(p: Player, now: number): number {
    const { value, at, regenFrom } = p.saber.stamina;
    const refillMs = Math.max(0, now - Math.max(at, regenFrom));
    return Math.min(SABER.staminaMax, value + (SABER.staminaRegenPerSec * refillMs) / 1000);
  }

  private winded(p: Player, now: number): boolean {
    const state = p.saber.stamina;
    if (state.winded && this.stamina(p, now) >= SABER.windedRecoverAt) state.winded = false;
    return state.winded;
  }

  private canAfford(p: Player, direction: StepDirection, now: number): boolean {
    return !this.winded(p, now) && this.stamina(p, now) >= SABER.stepStamina[direction];
  }

  // Spending restarts the pause before refilling; too little left for any step leaves you winded.
  private spendStamina(p: Player, cost: number, now: number): void {
    const value = this.stamina(p, now) - cost;
    p.saber.stamina = { value, at: now, regenFrom: now + SABER.staminaRegenDelayMs, winded: value < CHEAPEST_STEP };
  }

  // Damage interrupts voluntary movement; both laptops receive the normal glide event.
  private knockBack(defender: Player, attacker: Player, now: number): void {
    clearTimeout(defender.timers.step);
    defender.saber.queuedStep = null;
    const from = this.rootXZ(defender, now);
    const origin = this.rootXZ(attacker, now);
    const dx = from[0] - origin[0], dz = from[1] - origin[1];
    const distance = Math.hypot(dx, dz);
    if (distance < 1e-9) return;
    const next = Math.max(distance, Math.min(6 * CELL_SIZE, distance + SABER.knockbackMeters));
    const target = {
      q: (origin[0] + dx * next / distance) / CELL_SIZE,
      r: (origin[1] + dz * next / distance) / CELL_SIZE,
    };
    defender.saber.glide = { from, startedAt: now };
    defender.saber.cell = target;
    defender.saber.stepReadyAt = now + SABER.stepMs + SABER.stepCooldownMs;
    this.events.stepped({ slot: defender.slot, cell: target });
  }

  // Engagement uses current gliding positions, rather than destination coordinates.
  get engaged(): boolean {
    const now = Date.now();
    const a = this.rootXZ(this.players.get(1)!, now), b = this.rootXZ(this.players.get(2)!, now);
    return inReach({ q: a[0] / CELL_SIZE, r: a[1] / CELL_SIZE }, { q: b[0] / CELL_SIZE, r: b[1] / CELL_SIZE });
  }

  // The player's current setup step, for their phone.
  setupProgress(slot: PlayerSlot): SetupProgress | null {
    return this.players.get(slot)!.saber.body.pose?.setup ?? null;
  }

  // A phone paired as this player's saber, or went away.
  setSaberPaired(slot: PlayerSlot, paired: boolean): void {
    const saber = this.players.get(slot)!.saber;
    saber.paired = paired;
    if (!paired) {
      saber.aim = { seq: saber.aim.seq, at: null, aim: null };
      saber.swinging = false;
    }
    this.announceReadiness();
  }

  toSnapshot(): MatchSnapshot {
    const now = Date.now();
    const remaining = (at: number | null) => (at === null || at <= now ? null : at - now);
    const players: PlayerState[] = [...this.players.values()]
      .sort((a, b) => a.slot - b.slot)
      .map((p) => ({
        slot: p.slot,
        pilotId: p.pilotId,
        callsign: p.callsign,
        connected: p.connected,
        reconnectEndsInMs: remaining(p.reconnectEndsAt),
        ready: p.ready,
        rematch: p.rematch,
        health: p.health,
        saber: {
          swinging: p.saber.swinging,
          cooldownEndsInMs: remaining(p.saber.cooldownEndsAt),
          paired: p.saber.paired,
          phoneLive: this.freshAim(p, now) !== null,
          bodyReady: this.bodyReady(p, now),
          saberReady: this.saberReady(p, now),
        },
      }));
    return {
      matchId: this.matchId,
      round: this.round,
      phase: this.phase,
      startsInMs: this.saberStartsInMs,
      world: world(this.worldId),
      players,
      result: this.result,
    };
  }

  toView(slot: PlayerSlot): PlayerView {
    const snapshot = this.toSnapshot();
    return {
      matchId: snapshot.matchId,
      round: snapshot.round,
      phase: snapshot.phase,
      startsInMs: snapshot.startsInMs,
      world: snapshot.world,
      result: snapshot.result,
      board: { cellSize: CELL_SIZE, rows: ROWS_PER_SIDE, stepMs: SABER.stepMs },
      you: snapshot.players.find((p) => p.slot === slot)!,
      rival: snapshot.players.find((p) => p.slot !== slot)!,
    };
  }

  // Stops every pending timer, e.g. when the server shuts down.
  dispose(): void {
    clearInterval(this.ticker);
    for (const player of this.players.values()) {
      for (const timer of Object.values(player.timers)) clearTimeout(timer);
    }
  }

  // The only in-match commands; combat comes from the saber streams.
  private apply(player: Player, type: InMatchCommandType): RejectReason | null {
    // Gives the round to the rival, but both stay on the result screen and can rematch.
    if (type === "forfeit") {
      if (this.phase === "finished") return "match_not_active";
      this.finish({ winner: player.slot === 1 ? 2 : 1, reason: "forfeit" });
      return null;
    }
    if (type === "rematch") {
      if (this.phase !== "finished") return "match_not_active";
      if (!this.players.get(player.slot === 1 ? 2 : 1)!.connected) return "pilot_unavailable";
      player.rematch = true;
      if ([...this.players.values()].every((p) => p.rematch)) this.startRematch();
      return null;
    }
    if (this.phase !== "waiting") return "match_not_active";
    player.ready = true;
    if ([...this.players.values()].every((p) => p.ready)) this.phase = "active";
    return null;
  }

  // A fresh round in the same match: health, positions, stamina and swings reset, while
  // pairing, calibration and the live body and phone streams carry over, so the countdown
  // usually starts on the next tick.
  private startRematch(): void {
    this.round++;
    for (const p of this.players.values()) {
      const { body, aim, paired, calibration } = p.saber;
      p.saber = { ...newSaber(START_CELLS[p.slot]), body, aim, paired, calibration };
      p.health = RULES.startingHealth;
      p.rematch = false;
      this.events.stepped({ slot: p.slot, cell: p.saber.cell });
    }
    this.result = null;
    this.phase = "active";
    this.saberStart = { startsAtMs: null, unlocked: false };
    this.lastTickAt = null;
    this.ticker = this.startTicker();
  }

  // One server tick: fuse each blade from the latest body and aim, detect
  // swings, resolve them against the other player, and send the arena.
  private tick(): void {
    const now = Date.now();
    const elapsedMs = this.lastTickAt === null ? SABER.tickMs : Math.max(1, now - this.lastTickAt);
    this.lastTickAt = now;
    const players = [...this.players.values()].sort((a, b) => a.slot - b.slot);
    // Both clients and phone share this gate. Loss before GO restarts the full countdown.
    const start = advanceSaberStart(this.saberStart, this.phase === "active" && players.every(p => p.connected && this.armed(p, now)), now);
    if (start !== this.saberStart) { this.saberStart = start; this.events.changed(); }
    const fighting = this.phase === "active" && this.saberStart.unlocked && this.engaged && players.every(p => this.armed(p, now));
    const blades = new Map(players.map((p) => [p.slot, this.blade(p, now)]));
    const previous = new Map(players.map((p) => [p.slot, p.saber.lastBlade]));

    // Every player's swing first, so contact is judged on both players' state for this tick.
    for (const p of players) {
      const saber = p.saber;
      const from = previous.get(p.slot) ?? null;
      const to = blades.get(p.slot) ?? null;
      // Tracking loss or a missing phone drops the swing rather than finishing it.
      if (!fighting || !from || !to) {
        saber.swinging = false;
        continue;
      }
      // Measured in the player's own body frame, so stepping or turning with the blade held still isn't a swing.
      const tipNow = this.bodyTip(p, to, now);
      const tipThen = saber.lastBodyTip ?? tipNow;
      const speed = length(sub(tipNow, tipThen)) / (elapsedMs / 1000);
      const coolingDown = saber.cooldownEndsAt !== null && now < saber.cooldownEndsAt;
      if (!saber.swinging) {
        saber.swinging = speed >= SABER.swingStartSpeed && !coolingDown;
        if (saber.swinging) saber.swing = { from: tipThen, reach: 0 };
      } else if (speed < SABER.swingEndSpeed) saber.swinging = false;
      if (saber.swinging && saber.swing) saber.swing.reach = Math.max(saber.swing.reach, length(sub(tipNow, saber.swing.from)));
    }

    for (const attacker of players) {
      if (this.phase !== "active" || !this.committed(attacker)) continue;
      const from = previous.get(attacker.slot)!;
      const to = blades.get(attacker.slot)!;
      const defender = players.find((p) => p.slot !== attacker.slot)!;
      const defenderTo = blades.get(defender.slot) ?? null;
      const defenderFrom = previous.get(defender.slot) ?? defenderTo;
      const joints = this.worldJoints(defender, now);
      // A stunned player's guard is down: their blade blocks nothing.
      const guard = defenderTo && defenderFrom && !this.stunned(defender, now) ? defenderTo : null;
      const outcome = resolveSweep(
        { from, to },
        guard ? { from: defenderFrom!, to: guard } : null,
        joints ? bodyShape(joints) : null,
        SABER,
      );
      if (outcome === "blocked" && this.guardMatches(attacker, to, defender, guard!, now)) {
        this.guardBreak(attacker, defender, now);
      } else if (outcome === "blocked") {
        this.endSwing(attacker, now);
        defender.saber.swinging = false;
        defender.saber.cooldownEndsAt = Math.max(defender.saber.cooldownEndsAt ?? 0, now + SABER.recoilMs);
        this.events.saberResolved({ attackerSlot: attacker.slot, outcome: "blocked", damage: 0 });
        this.events.changed();
      } else if (outcome === "hit") {
        this.endSwing(attacker, now);
        const damage = Math.min(SABER.damage, defender.health);
        defender.health -= damage;
        if (damage > 0) this.knockBack(defender, attacker, now);
        this.events.saberResolved({ attackerSlot: attacker.slot, outcome: "hit", damage });
        if (defender.health === 0) this.finish({ winner: attacker.slot, reason: "knockout" });
        this.events.changed();
      }
    }

    for (const p of players) {
      p.saber.lastBlade = blades.get(p.slot) ?? null;
      const blade = blades.get(p.slot) ?? null;
      p.saber.lastBodyTip = blade ? this.bodyTip(p, blade, now) : null;
    }
    this.announceReadiness();
    this.events.arenaFrame({
      saberStart: { ...this.saberStart },
      serverMs: now,
      engaged: this.engaged,
      players: players.map((p) => ({
        slot: p.slot,
        cell: p.saber.cell,
        facing: this.facing(p, now),
        joints: this.worldJoints(p, now),
        blade: blades.get(p.slot) ?? null,
        swinging: p.saber.swinging,
        stamina: Math.round((100 * this.stamina(p, now)) / SABER.staminaMax),
        winded: this.winded(p, now),
        stunned: this.stunned(p, now),
      })),
    });
  }

  // A swing that has really travelled, rather than a blade held out or shaking.
  private committed(p: Player): boolean {
    return p.saber.swinging && p.saber.swing !== null && p.saber.swing.reach >= SABER.minSwingTravel;
  }

  private stunned(p: Player, now: number): boolean {
    return now < p.saber.stunnedUntil;
  }

  // A guard held still (not itself a swing) along the line of the attack, as both players see it:
  // both projected onto the upright plane between them, and compared as lines.
  private guardMatches(attacker: Player, blade: ArenaBlade, defender: Player, guard: ArenaBlade, now: number): boolean {
    if (this.committed(defender)) return false;
    const facing = this.facing(attacker, now);
    const motion = directionToWorld(sub(this.bodyTip(attacker, blade, now), attacker.saber.swing!.from), facing);
    // A thrust mostly toward the rival, or a guard pointed at them, has no line to match.
    const a = lineAngle(motion, facing, ATTACK_LINE_MIN);
    const g = lineAngle(sub(guard.tip, guard.hilt), facing, SABER.bladeLength / 2);
    if (a === null || g === null) return false;
    const diff = Math.abs(a - g);
    return Math.min(diff, 180 - diff) <= SABER.guardMatchDeg;
  }

  // The defender's guard breaks: no swings, steps or guard for a moment. The attacker's swing ends
  // here, but with no cooldown, so a fresh swing can follow up for a free hit.
  private guardBreak(attacker: Player, defender: Player, now: number): void {
    attacker.saber.swinging = false;
    defender.saber.swinging = false;
    defender.saber.stunnedUntil = now + SABER.stunMs;
    defender.saber.cooldownEndsAt = Math.max(defender.saber.cooldownEndsAt ?? 0, now + SABER.stunMs);
    clearTimeout(defender.timers.step);
    defender.saber.queuedStep = null;
    this.events.saberResolved({ attackerSlot: attacker.slot, outcome: "guardBreak", damage: 0 });
    this.events.changed();
  }

  // Each swing resolves at most once: it ends here and can't restart until the cooldown passes.
  private endSwing(player: Player, now: number): void {
    player.saber.swinging = false;
    player.saber.cooldownEndsAt = now + SABER.swingCooldownMs;
  }

  private freshBody(p: Player, now: number): BodyPose | null {
    const { at, pose } = p.saber.body;
    return pose && pose.tracked && at !== null && now - at <= SABER.staleMs ? pose : null;
  }

  private freshAim(p: Player, now: number): SaberAim | null {
    const { at, aim } = p.saber.aim;
    return p.saber.paired && aim && aim.tracked && at !== null && now - at <= SABER.staleMs ? aim : null;
  }

  private bodyReady(p: Player, now: number): boolean {
    return Boolean(this.freshBody(p, now)?.calibrated);
  }

  private saberReady(p: Player, now: number): boolean {
    return this.freshAim(p, now) !== null && Boolean(p.saber.calibration?.done);
  }

  // Swings count only while both players are fully set up: body calibrated, phone paired and centered.
  private armed(p: Player, now: number): boolean {
    return this.bodyReady(p, now) && this.saberReady(p, now);
  }

  // Where the player's hips are over the board (x, z), gliding from the last cell into the current one.
  private rootXZ(p: Player, now: number): [number, number] {
    const to = cellToWorld(p.saber.cell);
    const { from, startedAt, orbitCenter } = p.saber.glide;
    const t = Math.max(0, Math.min(1, (now - startedAt) / SABER.stepMs));
    // Ease-out cubic: most of the move happens in the first few frames, so a step feels instant.
    const eased = 1 - (1 - t) ** 3;
    return interpolateStep(from, to, eased, orbitCenter);
  }

  private root(p: Player, now: number): Vec3 {
    const [x, z] = this.rootXZ(p, now);
    return [x, SABER.hipHeight, z];
  }

  private bodyTip(p: Player, blade: ArenaBlade, now: number): Vec3 {
    return worldToDirection(sub(blade.tip, this.root(p, now)), this.facing(p, now));
  }

  // Both bodies and blades turn to face the rival at the current glide position.
  private facing(p: Player, now: number): Facing {
    const rival = this.players.get(p.slot === 1 ? 2 : 1)!;
    const a = this.rootXZ(p, now), b = this.rootXZ(rival, now);
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const distance = Math.hypot(dx, dz);
    return distance > 1e-9 ? [dx / distance, dz / distance] : FACING[p.slot];
  }

  private worldJoints(p: Player, now: number): Vec3[] | null {
    const pose = this.freshBody(p, now);
    if (!pose) return null;
    const root = this.root(p, now);
    const facing = this.facing(p, now);
    return pose.joints.map((j) => bodyToWorld(j, facing, root));
  }

  // Hilt at the saber hand's wrist; blade along the phone's direction.
  private blade(p: Player, now: number): ArenaBlade | null {
    const aim = this.freshAim(p, now);
    const calibration = p.saber.calibration;
    const joints = aim && calibration ? this.worldJoints(p, now) : null;
    if (!aim || !calibration || !joints) return null;
    const hilt = joints[calibration.hand === "left" ? LEFT_WRIST : RIGHT_WRIST];
    const dir = directionToWorld(bodyDirection(aim.top, calibration), this.facing(p, now));
    return { hilt, tip: add(hilt, scale(dir, SABER.bladeLength / length(dir))) };
  }

  private announceReadiness(): void {
    const now = Date.now();
    let changed = false;
    for (const p of this.players.values()) {
      const live = this.freshAim(p, now) !== null;
      const step = p.saber.body.pose?.setup?.step ?? "";
      const remaining = this.saberStartsInMs;
      const beat = remaining === null ? "" : Math.ceil(remaining / 1000);
      const state = `${p.saber.paired}:${live}:${this.bodyReady(p, now)}:${this.saberReady(p, now)}:${p.saber.swinging}:${step}:${beat}`;
      if (state !== p.saber.announced) {
        p.saber.announced = state;
        changed = true;
      }
    }
    if (changed) this.events.changed();
  }

  private startGrace(player: Player): void {
    player.reconnectEndsAt = Date.now() + RULES.reconnectGraceMs;
    player.timers.reconnect = setTimeout(() => this.forfeit(player), RULES.reconnectGraceMs);
  }

  private forfeit(player: Player): void {
    const other = this.players.get(player.slot === 1 ? 2 : 1)!;
    // If both players are gone, nobody remained to win.
    this.finish({ winner: other.connected ? other.slot : null, reason: "forfeit" });
    this.events.changed();
  }

  private finish(result: MatchResult): void {
    this.phase = "finished";
    clearInterval(this.ticker);
    this.saberStart = { startsAtMs: null, unlocked: false };
    this.result = result;
    for (const player of this.players.values()) {
      player.saber.swinging = false;
      player.saber.queuedStep = null;
      clearTimeout(player.timers.step);
      player.saber.lastBlade = null;
      player.saber.lastBodyTip = null;
      clearTimeout(player.timers.reconnect);
      player.reconnectEndsAt = null;
    }
    this.events.finished(result);
  }
}

function parseCommand(command: unknown): { commandId: string; type: InMatchCommandType } | null {
  if (typeof command !== "object" || command === null) return null;
  const { commandId, type } = command as Record<string, unknown>;
  if (typeof commandId !== "string" || !COMMAND_ID_PATTERN.test(commandId)) return null;
  if (!IN_MATCH_COMMAND_TYPES.includes(type as InMatchCommandType)) return null;
  return { commandId, type: type as InMatchCommandType };
}

function newSaber(cell: Cell): Saber {
  return {
    body: { seq: -1, at: null, pose: null },
    aim: { seq: -1, at: null, aim: null },
    paired: false,
    calibration: null,
    lastBlade: null,
    lastBodyTip: null,
    cell,
    glide: { from: cellToWorld(cell), startedAt: 0 },
    stepReadyAt: 0,
    queuedStep: null,
    stamina: { value: SABER.staminaMax, at: 0, regenFrom: 0, winded: false },
    swinging: false,
    swing: null,
    cooldownEndsAt: null,
    stunnedUntil: 0,
    announced: "",
  };
}

// The angle (0..180°) of v as a line in the upright plane facing along `facing`, or null if v
// has less than `min` in that plane.
function lineAngle(v: Vec3, facing: Facing, min: number): number | null {
  const side = v[0] * facing[1] - v[2] * facing[0];
  if (Math.hypot(side, v[1]) < min) return null;
  const angle = (Math.atan2(v[1], side) * 180) / Math.PI;
  return angle < 0 ? angle + 180 : angle;
}

const isNumberIn = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;

function parseVec3(v: unknown, limit: number): Vec3 | null {
  if (!Array.isArray(v) || v.length !== 3 || !v.every((n) => isNumberIn(n, -limit, limit))) return null;
  return [v[0], v[1], v[2]];
}

const isSeq = (seq: unknown): seq is number => typeof seq === "number" && Number.isSafeInteger(seq) && seq >= 0;

// Joints are hip-centered, so a few meters covers any real body.
function parseBodyPose(raw: unknown): BodyPose | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { seq, tracked, joints, calibrated } = raw as Record<string, unknown>;
  if (!isSeq(seq) || typeof tracked !== "boolean" || typeof calibrated !== "boolean") return null;
  const setup = parseSetup((raw as Record<string, unknown>).setup);
  if (setup === undefined) return null;
  if (!tracked) return { seq, tracked, joints: [], calibrated, setup };
  if (!Array.isArray(joints) || joints.length !== JOINT_COUNT) return null;
  const parsed = joints.map((j) => parseVec3(j, 3));
  if (parsed.some((j) => j === null)) return null;
  return { seq, tracked, joints: parsed as Vec3[], calibrated, setup };
}

// undefined is malformed; null is no setup running.
function parseSetup(raw: unknown): SetupProgress | null | undefined {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object") return undefined;
  const { step, progress } = raw as Record<string, unknown>;
  if (!SETUP_STEPS.includes(step as SetupStep) || !isNumberIn(progress, 0, 1)) return undefined;
  return { step: step as SetupStep, progress };
}

// The phone's top edge in the player's body frame (x right, y up, z toward
// their screen), using the heading they pointed at the screen during setup.
export function bodyDirection(top: Vec3, calibration: SaberCalibration): Vec3 {
  const [fx, fy] = calibration.forward;
  // forward × up: someone facing north has east on their right.
  const sideways = top[0] * fy - top[1] * fx;
  return [calibration.mirror ? -sideways : sideways, top[2], top[0] * fx + top[1] * fy];
}

// The direction must be roughly unit length; untracked readings carry none.
function parseSaberAim(raw: unknown): SaberAim | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { seq, tracked, top, rate } = raw as Record<string, unknown>;
  if (!isSeq(seq) || typeof tracked !== "boolean" || !isNumberIn(rate, 0, 100_000)) return null;
  const t = parseVec3(top, 1.5);
  if (!t || (tracked && (length(t) < 0.5 || length(t) > 1.5))) return null;
  return { seq, tracked, top: t, rate };
}

function parseCalibration(raw: unknown): SaberCalibration | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { forward, hand, mirror, done } = raw as Record<string, unknown>;
  if (!Array.isArray(forward) || forward.length !== 2 || !forward.every((n) => isNumberIn(n, -1.5, 1.5))) return null;
  const norm = Math.hypot(forward[0], forward[1]);
  if (norm < 0.5 || !HANDS.includes(hand as Hand) || typeof mirror !== "boolean" || typeof done !== "boolean") return null;
  return { forward: [forward[0] / norm, forward[1] / norm], hand: hand as Hand, mirror, done };
}
