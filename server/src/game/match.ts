import type {
  CommandReply,
  CommandType,
  MatchPhase,
  MatchResult,
  MatchSnapshot,
  PlayerSlot,
  PlayerState,
  PlayerView,
  ProjectileLanded,
  RejectReason,
  Weapon,
} from "../contracts.js";
import { RULES, WEAPONS } from "./rules.js";

type Timer = ReturnType<typeof setTimeout>;

// Server-side player record. Times are absolute server times (Date.now());
// toSnapshot converts them to remaining milliseconds for the phones.
interface Player {
  slot: PlayerSlot;
  connected: boolean;
  health: number;
  weapon: Weapon;
  windupEndsAt: number | null;
  cooldownEndsAt: Record<Weapon, number | null>;
  blockEndsAt: number | null;
  blockCooldownEndsAt: number | null;
  projectile: { weapon: Weapon; landsAt: number } | null;
  reconnectEndsAt: number | null;
  timers: { windup?: Timer; block?: Timer; projectile?: Timer; reconnect?: Timer };
}

export interface MatchEvents {
  changed: () => void;
  projectileLanded: (event: ProjectileLanded) => void;
}

const COMMAND_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const COMMAND_TYPES: readonly CommandType[] = [
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
  // Reply already sent for each "slot:commandId", so retries repeat it.
  private replies = new Map<string, CommandReply>();

  constructor(readonly matchId: string, private events: MatchEvents) {}

  hasPlayer(slot: PlayerSlot): boolean {
    return this.players.has(slot);
  }

  addPlayer(slot: PlayerSlot): void {
    this.players.set(slot, {
      slot,
      connected: true,
      health: RULES.startingHealth,
      weapon: RULES.startingWeapon,
      windupEndsAt: null,
      cooldownEndsAt: { rock: null, gun: null },
      blockEndsAt: null,
      blockCooldownEndsAt: null,
      projectile: null,
      reconnectEndsAt: null,
      timers: {},
    });
    if (this.players.size === 2) {
      this.phase = "active";
      // A player who left while waiting starts their grace period now.
      for (const p of this.players.values()) if (!p.connected) this.startGrace(p);
    }
    this.events.changed();
  }

  reconnect(slot: PlayerSlot): void {
    const player = this.players.get(slot)!;
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

    if (this.phase === "active") this.startGrace(player);
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

  toSnapshot(): MatchSnapshot {
    const now = Date.now();
    const remaining = (at: number | null) => (at === null || at <= now ? null : at - now);
    const players: PlayerState[] = [...this.players.values()]
      .sort((a, b) => a.slot - b.slot)
      .map((p) => ({
        slot: p.slot,
        connected: p.connected,
        reconnectEndsInMs: remaining(p.reconnectEndsAt),
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
      }));
    return { matchId: this.matchId, phase: this.phase, players, result: this.result };
  }

  toView(slot: PlayerSlot): PlayerView {
    const snapshot = this.toSnapshot();
    return {
      matchId: snapshot.matchId,
      phase: snapshot.phase,
      result: snapshot.result,
      you: snapshot.players.find((p) => p.slot === slot)!,
      rival: snapshot.players.find((p) => p.slot !== slot) ?? null,
    };
  }

  // Stops every pending timer, e.g. when the server shuts down.
  dispose(): void {
    for (const player of this.players.values()) {
      for (const timer of Object.values(player.timers)) clearTimeout(timer);
    }
  }

  private apply(player: Player, type: CommandType): RejectReason | null {
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

    const rules = WEAPONS[weapon];
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
    const damage = blocked ? 0 : Math.min(WEAPONS[weapon].damage, defender.health);
    defender.health -= damage;

    this.events.projectileLanded({ attackerSlot: attacker.slot, weapon, blocked, damage });
    if (defender.health === 0) {
      this.finish({ winner: attacker.slot, reason: "knockout" });
    }
    this.events.changed();
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
    this.result = result;
    for (const player of this.players.values()) {
      this.cancelProjectile(player);
      this.clearBlock(player);
      clearTimeout(player.timers.windup);
      clearTimeout(player.timers.reconnect);
      player.windupEndsAt = null;
      player.reconnectEndsAt = null;
    }
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

function parseCommand(command: unknown): { commandId: string; type: CommandType } | null {
  if (typeof command !== "object" || command === null) return null;
  const { commandId, type } = command as Record<string, unknown>;
  if (typeof commandId !== "string" || !COMMAND_ID_PATTERN.test(commandId)) return null;
  if (!COMMAND_TYPES.includes(type as CommandType)) return null;
  return { commandId, type: type as CommandType };
}
