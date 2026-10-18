import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import type { ArenaFrame, Hand, PlayerSlot, SaberResolved, Vec3 } from "../contracts.js";
import { bodyDirection, Match } from "./match.js";
import { SABER } from "./rules.js";
import { bodyToWorld, resolveSweep, segmentDistance, worldToDirection } from "./saber3d.js";
import { HEX_SPACING, hexDistance, hexToWorld, neighbors, onBoard } from "./hex.js";

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

  test("hexes: neighbors are all one spacing apart; the board has 19 cells", () => {
    const [cx, cz] = hexToWorld({ q: 1, r: -1 });
    for (const n of neighbors({ q: 1, r: -1 })) {
      const [x, z] = hexToWorld(n);
      assert.ok(Math.abs(Math.hypot(x - cx, z - cz) - HEX_SPACING) < 1e-9);
      assert.equal(hexDistance(n, { q: 1, r: -1 }), 1);
    }
    let cells = 0;
    for (let q = -3; q <= 3; q++) for (let r = -3; r <= 3; r++) if (onBoard({ q, r })) cells++;
    assert.equal(cells, 19);
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
      projectileLanded: () => {},
      saberResolved: (e) => resolved.push(e),
      arenaFrame: (f) => frames.push(f),
      stepped: (e) => stepped.push(e),
      finished: () => {},
    });
    match.setSaberPaired(1, true);
    match.setSaberPaired(2, true);
    match.handleCommand(1, { commandId: "r1", type: "ready" });
    match.handleCommand(2, { commandId: "r2", type: "ready" });
    // Players start two hexes apart; slot 1 steps in to the center so they're engaged,
    // 1.3 m apart along z, facing each other.
    assert.equal(match.step(1, "forward"), null);
    mock.timers.tick(SABER.stepMs + SABER.stepCooldownMs);
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
    step(slash(-40));
    assert.equal(resolved.length, 1, "carrying on through doesn't hit again");
  });

  test("the defender's blade in the path blocks, and the body behind it is safe", () => {
    swingAcross(guard);
    assert.deepEqual(resolved, [{ attackerSlot: 1, outcome: "blocked", damage: 0 }]);
    assert.equal(health(2), 100);
  });

  test("a slow movement into the body is not a swing", () => {
    for (let a = 60; a >= -15; a -= 1) step(slash(a));
    assert.equal(resolved.length, 0);
  });

  test("a new swing waits for the cooldown", () => {
    swingAcross();
    for (const angle of [60, 35, 10, -15]) step(slash(angle));
    assert.equal(resolved.length, 1, "the back-swing came during the cooldown");
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
    match.handleBodyPose(1, { seq: 1, tracked: true, joints: [[0, 0, 0]], calibrated: true, setup: null });
    match.handleSaberAim(1, { seq: 1, tracked: true, top: [0, 0, 0], rate: 0 });
    assert.equal(match.setSaberCalibration(1, { forward: [0, 1], hand: "middle", mirror: false, done: true }), "invalid_command");
    mock.timers.tick(SABER.tickMs);
    assert.equal(frames.at(-1)!.players[0].joints, null);
    assert.equal(frames.at(-1)!.players[0].blade, null);
  });

  test("the arena frame places slot 2 across from slot 1, facing them", () => {
    step({}, {});
    const [one, two] = frames.at(-1)!.players;
    close(one.joints![24], [0.12, SABER.hipHeight, 0]);
    close(two.joints![24], [-0.12, SABER.hipHeight, HEX_SPACING]);
    assert.ok(two.blade!.hilt[2] < HEX_SPACING, "slot 2's hands are in front of them, toward slot 1");
    assert.deepEqual([one.cell, two.cell], [{ q: 0, r: 0 }, { q: 0, r: 1 }]);
    assert.equal(frames.at(-1)!.engaged, true);
  });

  const hips = (slot: PlayerSlot) => frames.at(-1)!.players[slot - 1].joints![24];

  const settle = () => mock.timers.tick(SABER.stepMs + SABER.stepCooldownMs);

  test("players start two hexes apart, not engaged, and swings there don't count", () => {
    const fresh = new Match("start", "mars", PILOTS, {
      changed: () => {},
      projectileLanded: () => {},
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
    assert.equal(hexDistance(one.cell, two.cell), 2);
    assert.equal(frames.at(-1)!.engaged, false);
    fresh.dispose();
  });

  test("forward and back are toward and away from the rival; you can't step into them", () => {
    assert.equal(match.step(1, "forward"), "blocked", "the rival's hex");
    assert.equal(match.step(1, "back"), null);
    settle();
    step();
    close(hips(1), [0.12, SABER.hipHeight, -HEX_SPACING]);
    assert.equal(frames.at(-1)!.engaged, false);
  });

  test("left and right circle the rival, staying engaged, and the turn to face them follows", () => {
    assert.equal(match.step(1, "right"), null);
    settle();
    step({ dir: [0, 0, 1] });
    const [one, two] = frames.at(-1)!.players;
    assert.equal(frames.at(-1)!.engaged, true);
    assert.ok(one.joints![24][0] > 0.5, "moved to the player's right (+x when facing +z)");
    // Pointing the saber forward points it at the rival, even off the z axis.
    const blade = one.blade!;
    // Facing runs between cell centers.
    const [ax, az] = hexToWorld(one.cell);
    const [bx, bz] = hexToWorld(two.cell);
    const toRival = [bx - ax, bz - az];
    const d = Math.hypot(toRival[0], toRival[1]);
    const dir = [blade.tip[0] - blade.hilt[0], blade.tip[2] - blade.hilt[2]];
    const dl = Math.hypot(dir[0], dir[1]);
    close([dir[0] / dl, dir[1] / dl], [toRival[0] / d, toRival[1] / d], 0.05);
  });

  test("the board's edge blocks a step", () => {
    assert.equal(match.step(2, "back"), null);
    settle();
    assert.equal(match.step(2, "back"), "blocked");
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
    assert.ok(midway < 0 && midway > -HEX_SPACING, `gliding: ${midway}`);
    settle();
    assert.equal(match.step(1, "forward"), null);
    assert.equal(match.step(1, "sideways"), "invalid_command");
  });

  test("swings only count while engaged", () => {
    match.step(1, "back");
    settle();
    swingAcross();
    assert.equal(resolved.length, 0, "two hexes apart");
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
    assert.deepEqual(frames.at(-1)!.players.map((p) => p.cell), [{ q: 0, r: -1 }, { q: 0, r: 1 }]);
  });

  test("an accepted step is announced at once; a refused one isn't", () => {
    stepped = [];
    assert.equal(match.step(1, "forward"), "blocked");
    assert.equal(match.step(1, "back"), null);
    assert.deepEqual(stepped, [{ slot: 1, cell: { q: 0, r: -1 } }]);
  });

  test("circling with the blade held still isn't a swing", () => {
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
      projectileLanded: () => {},
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
      for (let k = 0; k < SABER.swingCooldownMs / SABER.tickMs + 1; k++) step(slash(60));
    }
    assert.deepEqual(match.toSnapshot().result, { winner: 1, reason: "knockout" });
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
