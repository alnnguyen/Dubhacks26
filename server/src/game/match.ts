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
  ProjectileLanded,
  RejectReason,
  SaberAim,
  SaberCalibration,
  SaberResolved,
  SetupProgress,
  SetupStep,
  StepDirection,
  Vec3,
  Weapon,
  WorldId,
} from "../contracts.js";
import { RULES, SABER, weaponsFor, world, type WeaponRules } from "./rules.js";
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

type Timer = ReturnType<typeof setTimeout>;

// Server-side player record. Times are absolute server times (Date.now());
// toSnapshot converts them to remaining milliseconds for the phones.
interface Player {
  slot: PlayerSlot;
  pilotId: string;
  callsign: string;
  connected: boolean;
  ready: boolean;
  health: number;
  weapon: Weapon;
  windupEndsAt: number | null;
  cooldownEndsAt: Record<Weapon, number | null>;
  blockEndsAt: number | null;
  blockCooldownEndsAt: number | null;
  projectile: { weapon: Weapon; landsAt: number } | null;
  reconnectEndsAt: number | null;
  saber: Saber;
  timers: { windup?: Timer; block?: Timer; projectile?: Timer; reconnect?: Timer; step?: Timer };
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
  swinging: boolean;
  cooldownEndsAt: number | null;
  // Readiness last announced, so a change re-sends the views.
  announced: string;
}

const HANDS: readonly Hand[] = ["left", "right"];
const STEP_DIRECTIONS: readonly StepDirection[] = ["forward", "back", "left", "right"];
// Start in the middle row of each side, straight across from each other: one step each to engage.
const START_CELLS: Record<PlayerSlot, Cell> = { 1: { q: 0, r: -2 }, 2: { q: 0, r: 2 } };
// Each player faces down the lane toward the other side, whatever column either is in.
const FACING: Record<PlayerSlot, Facing> = { 1: [0, 1], 2: [0, -1] };

const SETUP_STEPS: readonly SetupStep[] = ["stand", "phone", "forward", "up", "right", "reach", "done"];

export interface MatchEvents {
  changed: () => void;
  projectileLanded: (event: ProjectileLanded) => void;
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
export const IN_MATCH_COMMAND_TYPES: readonly InMatchCommandType[] = [
  "ready",
  "rockActive",
  "gunActive",
  "throwRock",
  "fireGun",
  "startBlock",
  "endBlock",
];

export class Match {
  private players = new Map<PlayerSlot, Player>();
  private phase: MatchPhase = "waiting";
  private result: MatchResult | null = null;
  private weapons: Record<Weapon, WeaponRules>;
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
    this.weapons = weaponsFor(worldId);
    for (const slot of [1, 2] as const) this.addPlayer(slot, pilots[slot]);
    this.ticker = setInterval(() => this.tick(), SABER.tickMs);
    (this.ticker as { unref?: () => void }).unref?.();
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
      health: RULES.startingHealth,
      weapon: RULES.startingWeapon,
      windupEndsAt: null,
      cooldownEndsAt: { rock: null, gun: null },
      blockEndsAt: null,
      blockCooldownEndsAt: null,
      projectile: null,
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
    // The player's own shot and block are tied to them and end with them.
    this.cancelProjectile(player);
    this.clearBlock(player);
    player.saber.swinging = false;

    if (this.phase !== "finished") this.startGrace(player);
    this.events.changed();
  }

  // Leaving before the end gives the match to the other player.
  leave(slot: PlayerSlot): void {
    if (this.phase === "finished") return;
    this.finish({ winner: slot === 1 ? 2 : 1, reason: "forfeit" });
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
  handleBodyPose(slot: PlayerSlot, raw: unknown): void {
    if (this.phase === "finished") return;
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
    if (this.phase === "finished") return null;
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
    if (this.phase === "finished") return "match_not_active";
    if (!STEP_DIRECTIONS.includes(direction as StepDirection)) return "invalid_command";
    const player = this.players.get(slot)!;
    const now = Date.now();
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

    const orbitCenter = direction === "left" || direction === "right" ? cellToWorld(rival.saber.cell) : undefined;
    player.saber.glide = { from: this.rootXZ(player, now), startedAt: now, orbitCenter };
    player.saber.cell = target;
    player.saber.stepReadyAt = now + SABER.stepMs + SABER.stepCooldownMs;
    // Laptops start your glide on this instead of waiting for the next tick and smooth playback.
    this.events.stepped({ slot: player.slot, cell: target, ...(orbitCenter ? { orbitCenter } : {}) });
    return null;
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
        health: p.health,
        action: p.blockEndsAt !== null ? "blocking" : p.windupEndsAt !== null ? "attacking" : "idle",
        weapon: p.weapon,
        cooldowns: { rock: remaining(p.cooldownEndsAt.rock), gun: remaining(p.cooldownEndsAt.gun) },
        block: {
          active: p.blockEndsAt !== null,
          endsInMs: remaining(p.blockEndsAt),
          cooldownEndsInMs: remaining(p.blockCooldownEndsAt),
        },
        projectile:
          p.projectile === null
            ? null
            : { weapon: p.projectile.weapon, landsInMs: Math.max(0, p.projectile.landsAt - now) },
        saber: {
          swinging: p.saber.swinging,
          cooldownEndsInMs: remaining(p.saber.cooldownEndsAt),
          paired: p.saber.paired,
          phoneLive: this.freshAim(p, now) !== null,
          bodyReady: this.bodyReady(p, now),
          saberReady: this.saberReady(p, now),
        },
      }));
    return { matchId: this.matchId, phase: this.phase, world: world(this.worldId), players, result: this.result };
  }

  toView(slot: PlayerSlot): PlayerView {
    const snapshot = this.toSnapshot();
    return {
      matchId: snapshot.matchId,
      phase: snapshot.phase,
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

  private apply(player: Player, type: InMatchCommandType): RejectReason | null {
    if (type === "ready") {
      if (this.phase !== "waiting") return "match_not_active";
      player.ready = true;
      if ([...this.players.values()].every((p) => p.ready)) this.phase = "active";
      return null;
    }
    if (this.phase !== "active") return "match_not_active";
    const now = Date.now();

    switch (type) {
      // Switching is instant and allowed even mid-block.
      case "rockActive":
      case "gunActive":
        player.weapon = type === "rockActive" ? "rock" : "gun";
        return null;

      case "throwRock":
        return this.fire(player, "rock", now);
      case "fireGun":
        return this.fire(player, "gun", now);

      case "startBlock": {
        if (player.windupEndsAt !== null || player.blockEndsAt !== null) return "busy";
        if (player.blockCooldownEndsAt !== null && now < player.blockCooldownEndsAt) return "on_cooldown";

        player.blockEndsAt = now + RULES.blockLimitMs;
        player.timers.block = setTimeout(() => {
          this.clearBlock(player);
          this.events.changed();
        }, RULES.blockLimitMs);
        return null;
      }

      case "endBlock": {
        if (player.blockEndsAt === null) return "not_blocking";
        this.clearBlock(player);
        return null;
      }
    }
  }

  private fire(player: Player, weapon: Weapon, now: number): RejectReason | null {
    if (player.weapon !== weapon) return "weapon_not_active";
    if (player.windupEndsAt !== null || player.blockEndsAt !== null) return "busy";
    if (player.projectile !== null) return "projectile_in_flight";
    const cooldownEndsAt = player.cooldownEndsAt[weapon];
    if (cooldownEndsAt !== null && now < cooldownEndsAt) return "on_cooldown";

    const rules = this.weapons[weapon];
    player.cooldownEndsAt[weapon] = now + rules.cooldownMs;
    player.projectile = { weapon, landsAt: now + rules.flightMs };
    player.timers.projectile = setTimeout(() => this.land(player), rules.flightMs);
    if (rules.windupMs > 0) {
      player.windupEndsAt = now + rules.windupMs;
      player.timers.windup = setTimeout(() => {
        player.windupEndsAt = null;
        this.events.changed();
      }, rules.windupMs);
    }
    return null;
  }

  // Shots auto-lock onto the opponent; only a block active on arrival stops them.
  private land(attacker: Player): void {
    const weapon = attacker.projectile!.weapon;
    attacker.projectile = null;
    const defender = this.players.get(attacker.slot === 1 ? 2 : 1)!;
    const blocked = defender.blockEndsAt !== null;
    const damage = blocked ? 0 : Math.min(this.weapons[weapon].damage, defender.health);
    defender.health -= damage;
    if (damage > 0) this.knockBack(defender, attacker, Date.now());

    this.events.projectileLanded({ attackerSlot: attacker.slot, weapon, blocked, damage });
    if (defender.health === 0) {
      this.finish({ winner: attacker.slot, reason: "knockout" });
    }
    this.events.changed();
  }

  // One server tick: fuse each blade from the latest body and aim, detect
  // swings, resolve them against the other player, and send the arena.
  private tick(): void {
    const now = Date.now();
    const elapsedMs = this.lastTickAt === null ? SABER.tickMs : Math.max(1, now - this.lastTickAt);
    this.lastTickAt = now;
    const players = [...this.players.values()].sort((a, b) => a.slot - b.slot);
    // Swings count only between fully set-up players within reach on the board.
    const fighting = this.phase === "active" && this.engaged && players.every((p) => this.armed(p, now));
    const blades = new Map(players.map((p) => [p.slot, this.blade(p, now)]));
    const previous = new Map(players.map((p) => [p.slot, p.saber.lastBlade]));

    for (const attacker of players) {
      const saber = attacker.saber;
      const from = previous.get(attacker.slot) ?? null;
      const to = blades.get(attacker.slot) ?? null;
      // Tracking loss or a missing phone drops the swing rather than finishing it.
      if (!fighting || !from || !to) {
        saber.swinging = false;
        continue;
      }
      // Measured in the player's own body frame, so stepping or turning with the blade held still isn't a swing.
      const tipNow = this.bodyTip(attacker, to, now);
      const tipThen = saber.lastBodyTip ?? tipNow;
      const speed = length(sub(tipNow, tipThen)) / (elapsedMs / 1000);
      const coolingDown = saber.cooldownEndsAt !== null && now < saber.cooldownEndsAt;
      if (!saber.swinging) saber.swinging = speed >= SABER.swingStartSpeed && !coolingDown;
      else if (speed < SABER.swingEndSpeed) saber.swinging = false;
      if (!saber.swinging || this.phase !== "active") continue;

      const defender = players.find((p) => p.slot !== attacker.slot)!;
      const defenderTo = blades.get(defender.slot) ?? null;
      const defenderFrom = previous.get(defender.slot) ?? defenderTo;
      const joints = this.worldJoints(defender, now);
      const outcome = resolveSweep(
        { from, to },
        defenderTo && defenderFrom ? { from: defenderFrom, to: defenderTo } : null,
        joints ? bodyShape(joints) : null,
        SABER,
      );
      if (outcome === "blocked") {
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
      serverMs: now,
      engaged: this.engaged,
      players: players.map((p) => ({
        slot: p.slot,
        cell: p.saber.cell,
        facing: this.facing(p, now),
        joints: this.worldJoints(p, now),
        blade: blades.get(p.slot) ?? null,
        swinging: p.saber.swinging,
      })),
    });
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
      const state = `${p.saber.paired}:${live}:${this.bodyReady(p, now)}:${this.saberReady(p, now)}:${p.saber.swinging}:${step}`;
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
    this.result = result;
    for (const player of this.players.values()) {
      this.cancelProjectile(player);
      this.clearBlock(player);
      player.saber.swinging = false;
      player.saber.queuedStep = null;
      clearTimeout(player.timers.step);
      player.saber.lastBlade = null;
      player.saber.lastBodyTip = null;
      clearTimeout(player.timers.windup);
      clearTimeout(player.timers.reconnect);
      player.windupEndsAt = null;
      player.reconnectEndsAt = null;
    }
    this.events.finished(result);
  }

  private cancelProjectile(player: Player): void {
    clearTimeout(player.timers.projectile);
    player.projectile = null;
  }

  // Ending a block, early or at its limit, starts the block cooldown.
  private clearBlock(player: Player): void {
    if (player.blockEndsAt === null) return;
    clearTimeout(player.timers.block);
    player.blockEndsAt = null;
    player.blockCooldownEndsAt = Date.now() + RULES.blockCooldownMs;
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
    swinging: false,
    cooldownEndsAt: null,
    announced: "",
  };
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
