import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import type { CommandType, PlayerSlot, ProjectileLanded } from "../contracts.js";
import { Match } from "./match.js";
import { MARS_GRAVITY, RULES, WEAPONS, rockFlightMs } from "./rules.js";

const ROCK = WEAPONS.rock;
const GUN = WEAPONS.gun;

let match: Match;
let landings: ProjectileLanded[];
let nextId: number;

beforeEach(() => {
  // Fake setTimeout and Date so tests can fast-forward time with mock.timers.tick().
  mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1_000_000 });
  landings = [];
  nextId = 0;
  match = new Match("test", { changed: () => {}, projectileLanded: (e) => landings.push(e) });
  match.addPlayer(1);
  match.addPlayer(2);
});

afterEach(() => {
  match.dispose();
  mock.timers.reset();
});

function send(slot: PlayerSlot, type: CommandType, commandId = `cmd-${nextId++}`) {
  return match.handleCommand(slot, { commandId, type });
}

const player = (slot: PlayerSlot) => match.toSnapshot().players[slot - 1];

describe("weapons", () => {
  test("players start with the gun active", () => {
    assert.equal(player(1).weapon, "gun");
  });

  test("switching is instant, and only the active weapon can fire", () => {
    assert.deepEqual(send(1, "throwRock", "r"), { commandId: "r", status: "rejected", reason: "weapon_not_active" });
    assert.equal(send(1, "rockActive").status, "accepted");
    assert.equal(player(1).weapon, "rock");
    assert.equal(send(1, "throwRock").status, "accepted");
    assert.equal(send(1, "fireGun", "g").status, "rejected");
  });

  test("switching weapons is allowed while blocking", () => {
    send(1, "startBlock");
    assert.equal(send(1, "rockActive").status, "accepted");
    assert.equal(player(1).weapon, "rock");
  });

  test("a shot in flight from one weapon stops firing the other", () => {
    send(1, "rockActive");
    send(1, "throwRock");
    mock.timers.tick(ROCK.windupMs);
    send(1, "gunActive");
    assert.deepEqual(send(1, "fireGun", "g"), { commandId: "g", status: "rejected", reason: "projectile_in_flight" });
  });
});

describe("gun", () => {
  test("an unblocked bolt lands after its travel time and deals damage", () => {
    assert.equal(send(1, "fireGun").status, "accepted");
    assert.deepEqual(player(1).projectile, { weapon: "gun", landsInMs: GUN.flightMs });
    assert.equal(player(1).action, "idle");

    mock.timers.tick(GUN.flightMs - 1);
    assert.equal(player(2).health, 100);
    mock.timers.tick(1);
    assert.equal(player(2).health, 100 - GUN.damage);
    assert.deepEqual(landings, [{ attackerSlot: 1, weapon: "gun", blocked: false, damage: GUN.damage }]);
  });

  test("a block raised while the bolt is in flight stops it", () => {
    send(1, "fireGun");
    mock.timers.tick(GUN.flightMs / 2);
    send(2, "startBlock");
    mock.timers.tick(GUN.flightMs / 2);
    assert.equal(player(2).health, 100);
    assert.deepEqual(landings, [{ attackerSlot: 1, weapon: "gun", blocked: true, damage: 0 }]);
  });

  test("the gun has a cooldown after firing", () => {
    send(1, "fireGun");
    mock.timers.tick(GUN.flightMs);
    assert.deepEqual(send(1, "fireGun", "early"), { commandId: "early", status: "rejected", reason: "on_cooldown" });
    mock.timers.tick(GUN.cooldownMs - GUN.flightMs);
    assert.equal(send(1, "fireGun").status, "accepted");
  });

  test("the gun and rock cooldowns are separate", () => {
    send(1, "fireGun");
    mock.timers.tick(GUN.flightMs);
    send(1, "rockActive");
    assert.equal(send(1, "throwRock").status, "accepted");
    assert.equal(player(1).cooldowns.gun, GUN.cooldownMs - GUN.flightMs);
  });

  test("a repeated fireGun ID does not fire twice", () => {
    const first = send(1, "fireGun", "bang");
    assert.deepEqual(send(1, "fireGun", "bang"), first);
    mock.timers.tick(GUN.flightMs);
    assert.equal(landings.length, 1);
  });
});

describe("rock", () => {
  beforeEach(() => {
    send(1, "rockActive");
    send(2, "rockActive");
  });

  test("Mars flight time follows the gameplay mapping", () => {
    assert.equal(rockFlightMs(MARS_GRAVITY), 1302);
    assert.equal(ROCK.flightMs, 1302);
  });

  test("an unblocked rock lands after the flight time and deals damage", () => {
    assert.equal(send(1, "throwRock").status, "accepted");
    assert.deepEqual(player(1).projectile, { weapon: "rock", landsInMs: ROCK.flightMs });

    mock.timers.tick(ROCK.flightMs - 1);
    assert.equal(player(2).health, 100);
    mock.timers.tick(1);
    assert.equal(player(2).health, 100 - ROCK.damage);
    assert.equal(player(1).projectile, null);
    assert.deepEqual(landings, [{ attackerSlot: 1, weapon: "rock", blocked: false, damage: ROCK.damage }]);
  });

  test("a block active at landing prevents damage", () => {
    send(1, "throwRock");
    mock.timers.tick(ROCK.flightMs - 500);
    assert.equal(send(2, "startBlock").status, "accepted");
    mock.timers.tick(500);
    assert.equal(player(2).health, 100);
  });

  test("a block released before landing does not protect", () => {
    send(1, "throwRock");
    send(2, "startBlock");
    mock.timers.tick(100);
    assert.equal(send(2, "endBlock").status, "accepted");
    mock.timers.tick(ROCK.flightMs);
    assert.equal(player(2).health, 100 - ROCK.damage);
  });

  test("the throw wind-up keeps the attacker busy, then frees them while the rock flies", () => {
    send(1, "throwRock");
    assert.equal(player(1).action, "attacking");
    assert.equal(send(1, "startBlock", "early").status, "rejected");
    mock.timers.tick(ROCK.windupMs);
    assert.equal(player(1).action, "idle");
    assert.equal(send(1, "startBlock").status, "accepted");
    assert.notEqual(player(1).projectile, null);
  });

  test("one shot in flight per player, then the throw cooldown applies", () => {
    send(1, "throwRock");
    mock.timers.tick(ROCK.windupMs);
    assert.deepEqual(send(1, "throwRock", "second"), {
      commandId: "second",
      status: "rejected",
      reason: "projectile_in_flight",
    });
    mock.timers.tick(ROCK.flightMs);
    assert.deepEqual(send(1, "throwRock", "third"), { commandId: "third", status: "rejected", reason: "on_cooldown" });
    mock.timers.tick(ROCK.cooldownMs);
    assert.equal(send(1, "throwRock").status, "accepted");
  });

  test("both players can have rocks in flight at once", () => {
    send(1, "throwRock");
    send(2, "throwRock");
    mock.timers.tick(ROCK.flightMs);
    assert.equal(player(1).health, 100 - ROCK.damage);
    assert.equal(player(2).health, 100 - ROCK.damage);
  });

  test("a repeated command ID returns the original reply and does not throw twice", () => {
    const first = send(1, "throwRock", "retry-me");
    assert.deepEqual(send(1, "throwRock", "retry-me"), first);
    mock.timers.tick(ROCK.flightMs);
    assert.equal(landings.length, 1);
  });

  test("the thrower disconnecting cancels their rock", () => {
    send(1, "throwRock");
    match.disconnect(1);
    mock.timers.tick(ROCK.flightMs);
    assert.equal(player(2).health, 100);
    assert.equal(landings.length, 0);
  });

  test("the defender disconnecting does not stop an incoming rock", () => {
    send(1, "throwRock");
    match.disconnect(2);
    mock.timers.tick(ROCK.flightMs);
    assert.equal(player(2).health, 100 - ROCK.damage);
  });

  test("health reaching zero finishes the match with the attacker as winner", () => {
    const hitsToWin = Math.ceil(RULES.startingHealth / ROCK.damage);
    for (let i = 0; i < hitsToWin; i++) {
      assert.equal(send(1, "throwRock").status, "accepted");
      mock.timers.tick(Math.max(ROCK.flightMs, ROCK.cooldownMs));
    }
    const snapshot = match.toSnapshot();
    assert.equal(snapshot.players[1].health, 0);
    assert.equal(snapshot.phase, "finished");
    assert.deepEqual(snapshot.result, { winner: 1, reason: "knockout" });
  });
});

describe("block", () => {
  test("a block ends by itself at its time limit, then cools down", () => {
    send(2, "startBlock");
    mock.timers.tick(RULES.blockLimitMs);
    assert.equal(player(2).block.active, false);
    assert.equal(player(2).block.cooldownEndsInMs, RULES.blockCooldownMs);
    assert.deepEqual(send(2, "startBlock", "again"), { commandId: "again", status: "rejected", reason: "on_cooldown" });
    mock.timers.tick(RULES.blockCooldownMs);
    assert.equal(send(2, "startBlock").status, "accepted");
  });
});

describe("commands and match lifecycle", () => {
  test("the same command ID from different players is not a duplicate", () => {
    assert.equal(send(1, "fireGun", "same").status, "accepted");
    assert.equal(send(2, "fireGun", "same").status, "accepted");
  });

  test("malformed commands are rejected", () => {
    assert.deepEqual(match.handleCommand(1, { commandId: "x", type: "fly" }), {
      commandId: "x",
      status: "rejected",
      reason: "invalid_command",
    });
    assert.equal(match.handleCommand(1, null).status, "rejected");
  });

  test("commands are rejected until both players join", () => {
    const waiting = new Match("waiting", { changed: () => {}, projectileLanded: () => {} });
    waiting.addPlayer(1);
    assert.deepEqual(waiting.handleCommand(1, { commandId: "a", type: "fireGun" }), {
      commandId: "a",
      status: "rejected",
      reason: "match_not_active",
    });
  });

  test("reconnecting within the grace period keeps the match going", () => {
    match.disconnect(2);
    assert.equal(player(2).reconnectEndsInMs, RULES.reconnectGraceMs);
    mock.timers.tick(RULES.reconnectGraceMs - 1);
    match.reconnect(2);
    mock.timers.tick(10);
    assert.equal(match.toSnapshot().phase, "active");
    assert.equal(player(2).reconnectEndsInMs, null);
  });

  test("an expired grace period forfeits to the remaining player", () => {
    match.disconnect(2);
    mock.timers.tick(RULES.reconnectGraceMs);
    const snapshot = match.toSnapshot();
    assert.equal(snapshot.phase, "finished");
    assert.deepEqual(snapshot.result, { winner: 1, reason: "forfeit" });
    assert.equal(send(1, "fireGun").status, "rejected");
  });

  test("an expired grace period with both players gone is a draw", () => {
    match.disconnect(1);
    match.disconnect(2);
    mock.timers.tick(RULES.reconnectGraceMs);
    assert.deepEqual(match.toSnapshot().result, { winner: null, reason: "forfeit" });
  });

  test("each player's view puts them as you and the opponent as rival", () => {
    send(1, "fireGun");
    mock.timers.tick(GUN.flightMs);
    const view1 = match.toView(1);
    const view2 = match.toView(2);
    assert.deepEqual([view1.you.slot, view1.rival?.slot], [1, 2]);
    assert.equal(view1.rival?.health, 100 - GUN.damage);
    assert.deepEqual(view2.you, view1.rival);
    assert.deepEqual(view2.rival, view1.you);
  });
});
