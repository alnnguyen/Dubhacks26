import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import type { ArenaFrame, Hand, PlayerSlot, SaberResolved, Vec3 } from "../contracts.js";
import { bodyDirection, Match } from "./match.js";
import { RULES, SABER } from "./rules.js";
import { bodyToWorld, resolveSweep, segmentDistance, worldToDirection } from "./saber3d.js";
import { CELL_SIZE, cellToWorld, inReach, orbitStep, interpolateStep } from "./grid.js";

const PILOTS = { 1: { pilotId: "p1", callsign: "ONE" }, 2: { pilotId: "p2", callsign: "TWO" } };
const close = (a: number[], b: number[], eps = 1e-9) =>
  a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < eps, `${a} vs ${b}`));
const deg = (d: number) => (d * Math.PI) / 180;

describe("saber3d geometry", () => {
  test("segment distance: crossing, parallel, and endpoint cases", () => {
    assert.equal(segmentDistance([-1, 0, 0], [1, 0, 0], [0, -1, 1], [0, 1, 1]), 1);
    assert.equal(segmentDistance([0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]), 1);
    assert.equal(segmentDistance([0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0]), 1);
    assert.equal(segmentDistance([0, 0, 0], [0, 0, 0], [0, 3, 0], [0, 3, 0]), 3);
  });

  test("a player facing -z is turned around: their right is -x", () => {
    // A point a little to the player's right and in front of them.
    close(bodyToWorld([0.2, 0, 0.3], [0, -1], [0, 1, 1.3]), [-0.2, 1, 1]);
    // And back again.
    close(worldToDirection([-0.2, 0, -0.3], [0, -1]), [0.2, 0, 0.3]);
  });

  test("orbital steps preserve separation and close a complete circle for either player", () => {
    for (const side of [-1, 1]) {
      const rival = { q: 0, r: side };
      const start = { q: 0, r: -side };
      for (const direction of ["left", "right"] as const) {
        let current = start;
        for (let i = 0; i < 240; i++) {
          current = orbitStep(current, rival, direction)!;
          assert.ok(Math.abs(Math.hypot(current.q - rival.q, current.r - rival.r) - 2) < 1e-9);
        }
        close([current.q, current.r], [start.q, start.r]);
      }
    }
    const target = orbitStep({ q: 0, r: -1 }, { q: 0, r: 1 }, "right")!;
    assert.ok(target.q > 0, "right is the fighter's right");
    const mid = interpolateStep([0, -CELL_SIZE], cellToWorld(target), 0.5, [0, CELL_SIZE]);
    assert.ok(Math.abs(Math.hypot(mid[0], mid[1] - CELL_SIZE) - 1.3) < 1e-9, "glide follows an arc");
    assert.equal(inReach({ q: 0, r: 0 }, { q: 2, r: 0 }), true);
    assert.equal(inReach({ q: 0, r: 0 }, { q: 3, r: 0 }), false);
  });

  test("forward/back from a fractional gap stop at the limit instead of being refused", () => {
    const rival = { q: 0, r: 0 };
    // Knockback can leave players 2.4 apart: out of reach, so a refused step would strand them.
    const closer = orbitStep({ q: 0, r: -2.4 }, rival, "forward")!;
    close([closer.q, closer.r], [0, -2]);
    assert.ok(inReach(closer, rival));
    assert.equal(orbitStep(closer, rival, "forward"), null, "already at the minimum");
    const farther = orbitStep({ q: 0, r: -5.5 }, rival, "back")!;
    close([farther.q, farther.r], [0, -6]);
    assert.equal(orbitStep(farther, rival, "back"), null, "already at the maximum");
    // A gap already inside the minimum is never pushed out by a forward step.
    assert.equal(orbitStep({ q: 0, r: -1.5 }, rival, "forward"), null);
  });

  test("a blade touching the defender's blade blocks before the body behind it", () => {
    const rules = { bladeRadius: 0.03, torsoRadius: 0.17, headRadius: 0.12, substeps: 10 };
    const body = { torso: [[0, 1.5, 1] as Vec3, [0, 1, 1] as Vec3] as [Vec3, Vec3], head: [0, 1.75, 1] as Vec3 };
    const attacker = {
      from: { hilt: [1, 1.2, 1] as Vec3, tip: [1, 1.2, 1.9] as Vec3 },
      to: { hilt: [-1, 1.2, 1] as Vec3, tip: [-1, 1.2, 1.9] as Vec3 },
    };
    assert.equal(resolveSweep(attacker, null, body, rules), "hit");
    const guard = { hilt: [0.6, 0.8, 1.3] as Vec3, tip: [0.6, 1.7, 1.3] as Vec3 };
    assert.equal(resolveSweep(attacker, { from: guard, to: guard }, body, rules), "blocked");
  });
});

// A standing body in its own frame: hips at the origin, wrists out in front at chest height.
function joints(overrides: Record<number, Vec3> = {}): Vec3[] {
  const j: Vec3[] = Array.from({ length: 33 }, () => [0, 0, 0] as Vec3);
  j[0] = [0, 0.75, 0.1];
  j[11] = [-0.2, 0.5, 0];
  j[12] = [0.2, 0.5, 0];
  j[15] = [-0.25, 0.25, 0.4];
  j[16] = [0.25, 0.25, 0.4];
  j[23] = [-0.12, 0, 0];
  j[24] = [0.12, 0, 0];
  for (const [i, v] of Object.entries(overrides)) j[Number(i)] = v;
  return j;
}

describe("saber duel in the arena", () => {
  let match: Match;
  let resolved: SaberResolved[];
  let frames: ArenaFrame[];
  let stepped: { slot: PlayerSlot; cell: { q: number; r: number } }[];
  let seq: number;

  beforeEach(() => {
    mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"], now: 1_000_000 });
    resolved = [];
    frames = [];
    stepped = [];
    seq = 0;
    match = new Match("arena", "mars", PILOTS, {
      changed: () => {},
      saberResolved: (e) => resolved.push(e),
      arenaFrame: (f) => frames.push(f),
      stepped: (e) => stepped.push(e),
      finished: () => {},
    });
    match.setSaberPaired(1, true);
    match.setSaberPaired(2, true);
    match.handleCommand(1, { commandId: "r1", type: "ready" });
    match.handleCommand(2, { commandId: "r2", type: "ready" });
    // Players start in their middle rows; both step up to the front line so they're
    // engaged, 1.3 m apart along z, facing each other.
    assert.equal(match.step(1, "forward"), null);
    assert.equal(match.step(2, "forward"), null);
    mock.timers.tick(SABER.stepMs + SABER.stepCooldownMs);
    for (let t = 0; t < 3100; t += SABER.tickMs) step();
    resolved.length = 0;
    // Start each geometry case with no previous blade path; its first pose is not a swing.
    mock.timers.tick(SABER.staleMs + SABER.tickMs);
  });

  afterEach(() => {
    match.dispose();
    mock.timers.reset();
  });

  interface Input {
    body?: Vec3[];
    tracked?: boolean;
    // Wanted blade direction in the body frame.
    dir?: Vec3;
    hand?: Hand;
    aimTracked?: boolean;
    setupDone?: boolean;
  }

  // Players calibrated facing north: body right is east, forward is north, so
  // the phone's Earth-frame top edge is [right, forward, up].
  const toTop = (d: Vec3): Vec3 => [d[0], d[2], d[1]];

  function send(slot: PlayerSlot, input: Input = {}) {
    match.handleBodyPose(slot, {
      seq: ++seq,
      tracked: input.tracked ?? true,
      joints: input.body ?? joints(),
      calibrated: true,
      setup: null,
    });
    match.setSaberCalibration(slot, { forward: [0, 1], hand: input.hand ?? "right", mirror: false, done: input.setupDone ?? true });
    match.handleSaberAim(slot, {
      seq: ++seq,
      tracked: input.aimTracked ?? true,
      top: toTop(input.dir ?? [0, -1, 0]),
      rate: 0,
    });
  }

  // Slot 1's right hand sweeping horizontally from out to the right, across slot 2's torso.
  const slash = (angleDeg: number): Input => ({ dir: [Math.sin(deg(angleDeg)), 0, Math.cos(deg(angleDeg))] });

  // Both players send, then one server tick runs.
  function step(attacker: Input = {}, defender: Input = {}) {
    send(1, attacker);
    send(2, defender);
    mock.timers.tick(SABER.tickMs);
  }

  function swingAcross(defender: Input = {}) {
    for (const angle of [60, 35, 10, -15]) step(slash(angle), defender);
  }

  // Slot 2's left hand holding a blade straight up, in the path of the slash.
  const guard: Input = { hand: "left", dir: [0, 1, 0], body: joints({ 15: [-0.455, -0.05, 0.336] }) };

  const health = (slot: PlayerSlot) => match.toSnapshot().players[slot - 1].health;

  test("a fast slash into the body hits once", () => {
    swingAcross();
    assert.deepEqual(resolved, [{ attackerSlot: 1, outcome: "hit", damage: SABER.damage }]);
    assert.equal(health(2), 100 - SABER.damage);
    assert.equal(stepped.at(-1)!.slot, 2);
    assert.ok(Math.abs(stepped.at(-1)!.cell.r - 2) < 1e-9);
    assert.equal(stepped.at(-1)!.cell.q, 0);
    mock.timers.tick(SABER.stepMs);
    assert.equal(match.engaged, false, "a hit pushes the defender out of reach");
    step(slash(-40));
    assert.equal(resolved.length, 1, "carrying on through doesn't hit again");
  });

  test("the defender's blade in the path blocks, and the body behind it is safe", () => {
    const moves = stepped.length;
    swingAcross(guard);
    assert.equal(stepped.length, moves, "blocked hits do not push");
    assert.deepEqual(resolved, [{ attackerSlot: 1, outcome: "blocked", damage: 0 }]);
    assert.equal(health(2), 100);
  });

  test("a blade held out at someone stepping in doesn't hurt them, even shaking", () => {
    // Slot 1 points straight at slot 2 and wobbles a few degrees each tick: fast, but going nowhere.
    for (let i = 0; i < 20; i++) step(slash(i % 2 ? 4 : -4));
    assert.ok(frames.at(-1)!.players[0].swinging, "the wobble is fast enough to be a swing");
    assert.equal(resolved.length, 0);
    // A real thrust from the same spot does land.
    step(slash(40));
    step(slash(10));
    step(slash(-20));
    assert.equal(resolved.at(-1)?.outcome, "hit");
  });

  // Slot 1's right hand chopping straight down in front of them, from overhead.
  const chop = (angleDeg: number): Input => ({ dir: [0, Math.sin(deg(angleDeg)), Math.cos(deg(angleDeg))] });
  function chopDown(defender: Input) {
    for (const angle of [80, 65, 50, 35, 20, 5]) step(chop(angle), defender);
  }
  // Slot 2's left hand, at rest in front of them, holding the blade upright or flat (pointing to their right).
  const uprightGuard: Input = { hand: "left", dir: [0, 1, 0] };
  const flatGuard: Input = { hand: "left", dir: [1, 0, 0] };

  test("a vertical chop onto an upright guard breaks it and stuns the defender", () => {
    chopDown(uprightGuard);
    assert.deepEqual(resolved, [{ attackerSlot: 1, outcome: "guardBreak", damage: 0 }]);
    assert.equal(health(2), 100);
    assert.equal(frames.at(-1)!.players[1].stunned, true);
    assert.equal(frames.at(-1)!.players[0].stunned, false);
    assert.equal(match.step(2, "back"), "stunned");
    assert.equal(match.step(1, "back"), null, "the attacker is free to move");
    mock.timers.tick(SABER.stunMs);
    assert.equal(frames.at(-1)!.players[1].stunned, false);
    assert.equal(match.step(2, "back"), null);
  });

  test("a sideways slash onto a flat guard breaks it too", () => {
    swingAcross(flatGuard);
    assert.deepEqual(resolved, [{ attackerSlot: 1, outcome: "guardBreak", damage: 0 }]);
  });

  test("an attack across the guard's line just blocks", () => {
    chopDown(flatGuard);
    assert.deepEqual(resolved, [{ attackerSlot: 1, outcome: "blocked", damage: 0 }]);
    assert.equal(frames.at(-1)!.players[1].stunned, false);
  });

  test("a broken guard is down: the attacker follows up for a free hit", () => {
    chopDown(uprightGuard);
    assert.equal(resolved.at(-1)?.outcome, "guardBreak");
    // Slot 2 holds a guard that blocks this slash (see the blocking test)...
    step(slash(60), guard);
    step(slash(60), guard);
    swingAcross(guard);
    // ...but it's down while stunned, and the attacker has no cooldown after a break.
    assert.deepEqual(resolved.at(-1), { attackerSlot: 1, outcome: "hit", damage: SABER.damage });
    assert.equal(health(2), 100 - SABER.damage);
  });

  test("a slow movement into the body is not a swing", () => {
    for (let a = 60; a >= -15; a -= 1) step(slash(a));
    assert.equal(resolved.length, 0);
  });

  test("a new swing waits for the cooldown", () => {
    swingAcross();
    for (const angle of [60, 35, 10, -15]) step(slash(angle));
    assert.equal(resolved.length, 1, "the back-swing came during the cooldown");
    match.step(2, "forward");
    for (let i = 0; i < SABER.swingCooldownMs / SABER.tickMs; i++) step(slash(60));
    swingAcross();
    assert.equal(resolved.length, 2);
  });

  test("losing hand or phone tracking cancels the swing", () => {
    step(slash(60));
    step(slash(35));
    step({ ...slash(10), aimTracked: false });
    step(slash(-15));
    assert.equal(resolved.length, 0);
  });

  test("no swings until both players are fully set up", () => {
    match.setSaberPaired(2, false);
    swingAcross();
    assert.equal(resolved.length, 0);
    match.setSaberPaired(2, true);
    for (const angle of [60, 35, 10, -15]) step(slash(angle), { setupDone: false });
    assert.equal(resolved.length, 0, "the defender hasn't finished setup");
  });

  test("stale input means no blade", () => {
    send(1, slash(60));
    send(2);
    mock.timers.tick(SABER.staleMs + SABER.tickMs);
    assert.equal(frames.at(-1)!.players[0].blade, null);
  });

  test("repeated or older input is ignored", () => {
    match.setSaberCalibration(1, { forward: [0, 1], hand: "right", mirror: false, done: true });
    match.handleSaberAim(1, { seq: 500, tracked: true, top: [1, 0, 0], rate: 0 });
    match.handleSaberAim(1, { seq: 400, tracked: true, top: [0, 0, 1], rate: 0 });
    send(2);
    match.handleBodyPose(1, { seq: 501, tracked: true, joints: joints(), calibrated: true, setup: null });
    mock.timers.tick(SABER.tickMs);
    const blade = frames.at(-1)!.players[0].blade!;
    assert.ok(blade.tip[0] > blade.hilt[0], "still the seq-500 blade pointing right");
  });

  test("malformed input is dropped", () => {
    // Let the valid startup streams expire; malformed newer input must not restore them.
    mock.timers.tick(SABER.staleMs + 1);
    match.handleBodyPose(1, { seq: ++seq, tracked: true, joints: [[0, 0, 0]], calibrated: true, setup: null });
    match.handleSaberAim(1, { seq: ++seq, tracked: true, top: [0, 0, 0], rate: 0 });
    assert.equal(match.setSaberCalibration(1, { forward: [0, 1], hand: "middle", mirror: false, done: true }), "invalid_command");
    mock.timers.tick(SABER.tickMs);
    assert.equal(frames.at(-1)!.players[0].joints, null);
    assert.equal(frames.at(-1)!.players[0].blade, null);
  });

  test("the arena frame places slot 2 across from slot 1, facing them", () => {
    step({}, {});
    const [one, two] = frames.at(-1)!.players;
    close(one.joints![24], [0.12, SABER.hipHeight, -CELL_SIZE]);
    close(two.joints![24], [-0.12, SABER.hipHeight, CELL_SIZE]);
    assert.ok(two.blade!.hilt[2] < CELL_SIZE, "slot 2's hands are in front of them, toward slot 1");
    assert.deepEqual([one.cell, two.cell], [{ q: 0, r: -1 }, { q: 0, r: 1 }]);
    assert.equal(frames.at(-1)!.engaged, true);
  });

  const hips = (slot: PlayerSlot) => frames.at(-1)!.players[slot - 1].joints![24];

  // Long enough to land a step and refill the stamina it cost, so movement tests never run dry.
  const settle = () =>
    mock.timers.tick(SABER.staminaRegenDelayMs + (1000 * SABER.stepStamina.left) / SABER.staminaRegenPerSec);
  const stamina = (slot: PlayerSlot) => frames.at(-1)!.players[slot - 1];

  test("dodging spends stamina until winded; a winded player can't step until it recovers", () => {
    settle();
    step();
    assert.equal(stamina(1).stamina, 100);
    const dodges = Math.floor(SABER.staminaMax / SABER.stepStamina.right);
    for (let i = 0; i < dodges; i++) {
      assert.equal(match.step(1, i % 2 ? "left" : "right"), null, `dodge ${i + 1}`);
      mock.timers.tick(SABER.stepMs + SABER.stepCooldownMs);
    }
    assert.equal(stamina(1).winded, true);
    assert.equal(match.step(1, "back"), "exhausted", "winded: not even a cheap step");
    // The refill pause has passed but stamina is still under the recovery mark.
    mock.timers.tick(SABER.staminaRegenDelayMs);
    assert.ok(stamina(1).stamina < SABER.windedRecoverAt);
    assert.equal(match.step(1, "back"), "exhausted");
    mock.timers.tick((1000 * SABER.windedRecoverAt) / SABER.staminaRegenPerSec);
    assert.equal(stamina(1).winded, false);
    assert.equal(match.step(1, "back"), null);
    assert.equal(stamina(2).stamina, 100, "the rival's stamina is untouched");
  });

  test("a refused step costs nothing and doesn't delay the refill", () => {
    settle();
    assert.equal(match.step(1, "forward"), "blocked");
    step();
    assert.equal(stamina(1).stamina, 100);
    assert.equal(match.step(1, "back"), null);
    step();
    assert.equal(stamina(1).stamina, 100 - SABER.stepStamina.back);
  });

  test("stamina refills only after a pause, and an unaffordable step isn't buffered", () => {
    settle();
    for (let i = 0; i < 3; i++) {
      assert.equal(match.step(1, "right"), null);
      mock.timers.tick(SABER.stepMs + SABER.stepCooldownMs);
    }
    const left = SABER.staminaMax - 3 * SABER.stepStamina.right;
    assert.equal(stamina(1).stamina, left, "no refill between quick steps");
    assert.equal(match.step(1, "back"), null);
    // Now below a dodge's cost: refused at once, not queued behind the glide.
    assert.equal(match.step(1, "right"), "exhausted");
    mock.timers.tick(SABER.stepMs + SABER.stepCooldownMs);
    assert.equal(stepped.at(-1)!.slot, 1);
    mock.timers.tick(SABER.staminaRegenDelayMs + (1000 * SABER.staminaMax) / SABER.staminaRegenPerSec);
    assert.equal(stamina(1).stamina, 100);
  });

  test("knockback is free", () => {
    settle();
    stepped = [];
    step();
    const before = stamina(2).stamina;
    swingAcross();
    assert.equal(resolved.at(-1)?.outcome, "hit");
    assert.ok(stepped.some((e) => e.slot === 2), "the defender was pushed back");
    assert.equal(stamina(2).stamina, before);
  });

  test("players start a row back from the front line, not engaged, and swings there don't count", () => {
    const fresh = new Match("start", "mars", PILOTS, {
      changed: () => {},
      saberResolved: (e) => resolved.push(e),
      arenaFrame: (f) => frames.push(f),
      stepped: (e) => stepped.push(e),
      finished: () => {},
    });
    fresh.setSaberPaired(1, true);
    fresh.setSaberPaired(2, true);
    fresh.handleCommand(1, { commandId: "r1", type: "ready" });
    fresh.handleCommand(2, { commandId: "r2", type: "ready" });
    assert.equal(fresh.engaged, false);
    mock.timers.tick(SABER.tickMs);
    const [one, two] = frames.at(-1)!.players;
    assert.deepEqual([one.cell, two.cell], [{ q: 0, r: -2 }, { q: 0, r: 2 }]);
    assert.equal(frames.at(-1)!.engaged, false);
    fresh.dispose();
  });

  test("forward/back change separation and stop at the minimum and maximum gap", () => {
    assert.equal(match.step(1, "forward"), "blocked");
    for (let i = 0; i < 4; i++) {
      assert.equal(match.step(1, "back"), null);
      settle();
    }
    assert.equal(match.step(1, "back"), "blocked");
    step();
    assert.equal(frames.at(-1)!.engaged, false);
    for (let i = 0; i < 4; i++) {
      assert.equal(match.step(2, "forward"), null);
      settle();
    }
    assert.equal(match.step(2, "forward"), "blocked");
    step();
    assert.equal(frames.at(-1)!.engaged, true);
  });

  test("both players can circle repeatedly and keep facing each other", () => {
    for (let i = 0; i < 96; i++) {
      for (const slot of [1, 2] as const) {
        assert.equal(match.step(slot, "right"), null);
        settle();
      }
      step();
      const [a, b] = frames.at(-1)!.players;
      const dx = b.cell.q - a.cell.q, dz = b.cell.r - a.cell.r;
      const gap = Math.hypot(dx, dz);
      close([gap], [2]);
      close(a.facing, [dx / gap, dz / gap]);
      close(b.facing, [-dx / gap, -dz / gap]);
      assert.equal(frames.at(-1)!.engaged, true);
    }
  });

  test("orbiting keeps engagement at the same distance", () => {
    for (let i = 0; i < 48; i++) {
      assert.equal(match.step(1, "left"), null);
      settle();
      step();
      assert.equal(frames.at(-1)!.engaged, true);
    }
  });

  test("simultaneous orbit commands remain finite and preserve destination separation", () => {
    for (let i = 0; i < 96; i++) {
      assert.equal(match.step(1, "right"), null);
      assert.equal(match.step(2, i % 2 ? "left" : "right"), null);
      settle();
      step();
      const [a, b] = frames.at(-1)!.players;
      close([Math.hypot(a.cell.q - b.cell.q, a.cell.r - b.cell.r)], [2]);
      assert.ok([...a.facing, ...b.facing].every(Number.isFinite));
    }
  });

  test("a swipe mid-glide is buffered and taken the moment the step lands; a third waits", () => {
    stepped = [];
    assert.equal(match.step(1, "back"), null);
    assert.equal(match.step(1, "left"), null, "buffered");
    assert.equal(match.step(1, "left"), "busy", "only one buffered step");
    assert.equal(stepped.length, 1);
    mock.timers.tick(SABER.stepMs + SABER.stepCooldownMs);
    assert.equal(stepped.length, 2, "taken as soon as the first landed");
    assert.notDeepEqual(stepped[1].cell, stepped[0].cell);
  });

  test("a step glides, and the next waits until it lands", () => {
    assert.equal(match.step(1, "back"), null);
    assert.equal(match.step(1, "back"), null, "buffered");
    // Two ticks into the 110 ms glide.
    mock.timers.tick(SABER.tickMs);
    step();
    const midway = hips(1)[2];
    assert.ok(midway < -CELL_SIZE && midway > -2 * CELL_SIZE, `gliding: ${midway}`);
    settle();
    assert.equal(match.step(1, "forward"), null);
    assert.equal(match.step(1, "sideways"), "invalid_command");
  });

  test("swings only count while engaged", () => {
    match.step(1, "back");
    settle();
    swingAcross();
    assert.equal(resolved.length, 0, "a row back from the front line");
    // Rest the blade where the next swing starts, so stepping in doesn't jump it mid-air.
    step(slash(60));
    match.step(1, "forward");
    settle();
    for (let i = 0; i < SABER.swingCooldownMs / SABER.tickMs; i++) step(slash(60));
    swingAcross();
    assert.deepEqual(resolved.map((r) => r.outcome), ["hit"]);
  });

  test("idle players stay where they are: closing the distance is up to them", () => {
    match.step(1, "back");
    for (let t = 0; t < 3000; t += SABER.tickMs) step();
    assert.equal(frames.at(-1)!.engaged, false);
    assert.deepEqual(frames.at(-1)!.players.map((p) => p.cell), [{ q: 0, r: -2 }, { q: 0, r: 1 }]);
  });

  test("an accepted step is announced at once; a refused one isn't", () => {
    stepped = [];
    assert.equal(match.step(1, "forward"), "blocked");
    assert.equal(match.step(1, "back"), null);
    assert.deepEqual(stepped, [{ slot: 1, cell: { q: 0, r: -2 } }]);
  });

  test("sidestepping with the blade held still isn't a swing", () => {
    step(slash(30));
    step(slash(30));
    match.step(1, "right");
    for (let i = 0; i < 10; i++) step(slash(30));
    assert.equal(resolved.length, 0);
    assert.equal(frames.at(-1)!.players[0].swinging, false);
  });

  test("arena frames carry the server time of each tick", () => {
    step();
    const t1 = frames.at(-1)!.serverMs;
    step();
    assert.equal(frames.at(-1)!.serverMs - t1, SABER.tickMs);
  });

  test("no blade before the laptop sends a calibration", () => {
    const fresh = new Match("c", "mars", PILOTS, {
      changed: () => {},
      saberResolved: () => {},
      arenaFrame: (f) => frames.push(f),
      stepped: (e) => stepped.push(e),
      finished: () => {},
    });
    fresh.setSaberPaired(1, true);
    fresh.handleBodyPose(1, { seq: 1, tracked: true, joints: joints(), calibrated: true, setup: null });
    fresh.handleSaberAim(1, { seq: 2, tracked: true, top: [0, 0, 1], rate: 0 });
    mock.timers.tick(SABER.tickMs);
    assert.equal(frames.at(-1)!.players[0].blade, null);
    assert.equal(fresh.toView(1).you.saber.phoneLive, true, "the phone's readings are arriving");
    fresh.dispose();
  });

  test("a knockout finishes the match", () => {
    for (let i = 0; i < Math.ceil(100 / SABER.damage); i++) {
      swingAcross();
      if (match.toSnapshot().result) break;
      mock.timers.tick(SABER.stepMs + SABER.stepCooldownMs);
      match.step(2, "forward");
      mock.timers.tick(SABER.stepMs + SABER.stepCooldownMs);
      for (let k = 0; k < SABER.swingCooldownMs / SABER.tickMs + 1; k++) step(slash(60));
    }
    assert.deepEqual(match.toSnapshot().result, { winner: 1, reason: "knockout" });
  });

  test("the first round counts down once both players are set up, not before", () => {
    match.dispose();
    match = new Match("fresh", "mars", PILOTS, {
      changed: () => {},
      saberResolved: (e) => resolved.push(e),
      arenaFrame: () => {},
      stepped: () => {},
      finished: () => {},
    });
    match.setSaberPaired(1, true);
    match.setSaberPaired(2, true);
    match.handleCommand(1, { commandId: "r1", type: "ready" });
    match.handleCommand(2, { commandId: "r2", type: "ready" });
    // Stepping is allowed during setup, so they can already be engaged.
    match.step(1, "forward");
    match.step(2, "forward");
    mock.timers.tick(SABER.stepMs + SABER.stepCooldownMs);
    assert.equal(match.toView(1).startsInMs, null, "no countdown while setting up");
    step({}, { setupDone: false });
    assert.equal(match.toView(1).startsInMs, null, "or while one player is still setting up");
    step();
    assert.equal(match.toView(1).startsInMs, RULES.countdownMs);
    swingAcross();
    assert.deepEqual(resolved, [], "swings during the countdown don't count");
  });

  test("a rematch counts down; no steps or swings count until it ends", () => {
    match.handleCommand(1, { commandId: "f", type: "forfeit" });
    match.handleCommand(1, { commandId: "re1", type: "rematch" });
    match.handleCommand(2, { commandId: "re2", type: "rematch" });
    step();
    assert.equal(match.toView(2).startsInMs, RULES.countdownMs);
    assert.equal(match.step(1, "forward"), "match_not_active");
    for (let t = 0; t < RULES.countdownMs; t += SABER.tickMs) step();
    assert.equal(match.toView(2).startsInMs, null);
    assert.equal(match.step(1, "forward"), null);
    assert.equal(match.step(2, "forward"), null);
    mock.timers.tick(SABER.stepMs + SABER.stepCooldownMs);
    swingAcross();
    assert.deepEqual(resolved, [{ attackerSlot: 1, outcome: "hit", damage: SABER.damage }]);
  });
});

describe("bodyDirection", () => {
  const close = (a: Vec3, b: Vec3) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-9, `${a} vs ${b}`));

  test("forward is the calibrated heading, right is clockwise from it, up stays up", () => {
    // Calibrated facing west.
    const calibration = { forward: [-1, 0] as [number, number], hand: "right" as const, mirror: false, done: true };
    close(bodyDirection([-1, 0, 0], calibration), [0, 0, 1]);
    close(bodyDirection([0, 1, 0], calibration), [1, 0, 0]);
    close(bodyDirection([0, 0, 1], calibration), [0, 1, 0]);
  });

  test("mirror flips only the sideways axis", () => {
    const calibration = { forward: [0, 1] as [number, number], hand: "right" as const, mirror: true, done: true };
    close(bodyDirection([1, 0, 0], calibration), [-1, 0, 0]);
    close(bodyDirection([0, 1, 0], calibration), [0, 0, 1]);
  });
});
