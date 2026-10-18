import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import type { MatchCommandType, MatchResult, PlayerSlot } from "../contracts.js";
import { Match, type MatchEvents } from "./match.js";
import { RULES, world } from "./rules.js";

const PILOTS = { 1: { pilotId: "p1", callsign: "ONE" }, 2: { pilotId: "p2", callsign: "TWO" } };

let match: Match;
let results: MatchResult[];
let nextId: number;

function newMatch(events: Partial<MatchEvents> = {}): Match {
  return new Match("test", "mars", PILOTS, {
    changed: () => {},
    saberResolved: () => {},
    arenaFrame: () => {},
    stepped: () => {},
    finished: (r) => results.push(r),
    ...events,
  });
}

beforeEach(() => {
  // Fake setTimeout and Date so tests can fast-forward time with mock.timers.tick().
  mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1_000_000 });
  results = [];
  nextId = 0;
  match = newMatch();
  send(1, "ready");
  send(2, "ready");
});

afterEach(() => {
  match.dispose();
  mock.timers.reset();
});

function send(slot: PlayerSlot, type: MatchCommandType, commandId = `cmd-${nextId++}`) {
  return match.handleCommand(slot, { commandId, type });
}

const player = (slot: PlayerSlot) => match.toSnapshot().players[slot - 1];

describe("worlds", () => {
  test("each world keeps its rounded NASA surface gravity", () => {
    assert.deepEqual(
      (["earth", "mars", "moon"] as const).map((id) => world(id).gravityMps2),
      [9.8, 3.7, 1.6],
    );
  });

  test("a Moon match reports the Moon to both players", () => {
    const moon = new Match("moon", "moon", PILOTS, {
      changed: () => {},
      saberResolved: () => {},
      arenaFrame: () => {},
      stepped: () => {},
      finished: () => {},
    });
    assert.equal(moon.toView(1).world.id, "moon");
    assert.deepEqual(moon.toView(2).world, moon.toView(1).world);
    moon.dispose();
  });
});

describe("commands and match lifecycle", () => {
  test("the same command ID from different players is not a duplicate", () => {
    const waiting = newMatch();
    assert.equal(waiting.handleCommand(1, { commandId: "same", type: "ready" }).status, "accepted");
    assert.equal(waiting.handleCommand(2, { commandId: "same", type: "ready" }).status, "accepted");
    assert.equal(waiting.toView(1).phase, "active");
    waiting.dispose();
  });

  test("a repeated command ID returns the original reply", () => {
    const waiting = newMatch();
    const first = waiting.handleCommand(1, { commandId: "r", type: "ready" });
    waiting.handleCommand(2, { commandId: "r", type: "ready" });
    assert.deepEqual(waiting.handleCommand(1, { commandId: "r", type: "ready" }), first);
    waiting.dispose();
  });

  test("rock and gun commands no longer exist", () => {
    for (const type of ["throwRock", "fireGun", "startBlock"]) {
      assert.deepEqual(match.handleCommand(1, { commandId: type, type }), {
        commandId: type,
        status: "rejected",
        reason: "invalid_command",
      });
    }
  });

  test("malformed commands are rejected", () => {
    assert.deepEqual(match.handleCommand(1, { commandId: "x", type: "fly" }), {
      commandId: "x",
      status: "rejected",
      reason: "invalid_command",
    });
    assert.equal(match.handleCommand(1, null).status, "rejected");
  });

  test("the match starts once both players are ready, and not before", () => {
    const waiting = newMatch();
    assert.equal(waiting.toView(1).phase, "waiting");
    assert.equal(waiting.handleCommand(1, { commandId: "r", type: "ready" }).status, "accepted");
    assert.equal(waiting.toView(2).rival.ready, true);
    assert.equal(waiting.toView(1).phase, "waiting");
    waiting.handleCommand(2, { commandId: "r", type: "ready" });
    assert.equal(waiting.toView(1).phase, "active");
    assert.deepEqual(waiting.handleCommand(1, { commandId: "r2", type: "ready" }), {
      commandId: "r2",
      status: "rejected",
      reason: "match_not_active",
    });
    waiting.dispose();
  });

  test("leaving gives the match to the other player", () => {
    match.leave(2);
    assert.deepEqual(match.toSnapshot().result, { winner: 1, reason: "forfeit" });
    assert.deepEqual(results, [{ winner: 1, reason: "forfeit" }]);
    match.leave(1);
    assert.equal(results.length, 1);
  });

  test("disconnecting during the briefing also starts the grace period", () => {
    const waiting = newMatch();
    waiting.disconnect(1);
    mock.timers.tick(RULES.reconnectGraceMs);
    assert.deepEqual(waiting.toView(2).result, { winner: 2, reason: "forfeit" });
    waiting.dispose();
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
  });

  test("an expired grace period with both players gone is a draw", () => {
    match.disconnect(1);
    match.disconnect(2);
    mock.timers.tick(RULES.reconnectGraceMs);
    assert.deepEqual(match.toSnapshot().result, { winner: null, reason: "forfeit" });
  });

  test("each player's view puts them as you and the opponent as rival", () => {
    const view1 = match.toView(1);
    const view2 = match.toView(2);
    assert.deepEqual([view1.you.slot, view1.rival.slot], [1, 2]);
    assert.deepEqual([view1.you.callsign, view1.rival.pilotId], ["ONE", "p2"]);
    assert.equal(view1.rival.health, RULES.startingHealth);
    assert.deepEqual(view2.you, view1.rival);
    assert.deepEqual(view2.rival, view1.you);
  });
});

describe("rematch", () => {
  // Ends the match by forfeit, then brings the loser back so both are still there.
  function finishWithBothPresent() {
    match.disconnect(2);
    mock.timers.tick(RULES.reconnectGraceMs);
    match.reconnect(2);
    assert.equal(match.toSnapshot().phase, "finished");
  }

  test("is refused before the match ends", () => {
    assert.deepEqual(send(1, "rematch", "re"), { commandId: "re", status: "rejected", reason: "match_not_active" });
  });

  test("one request waits for the rival and shows on their view", () => {
    finishWithBothPresent();
    assert.equal(send(1, "rematch").status, "accepted");
    assert.equal(match.toView(2).rival.rematch, true);
    assert.equal(match.toView(1).phase, "finished");
  });

  test("both requests start a fresh round", () => {
    finishWithBothPresent();
    send(1, "rematch");
    send(2, "rematch");
    const view = match.toView(1);
    assert.equal(view.phase, "active");
    assert.equal(view.result, null);
    // The countdown waits for both players to be armed (see the saber tests).
    assert.equal(view.startsInMs, null);
    assert.deepEqual([view.you.health, view.rival.health], [RULES.startingHealth, RULES.startingHealth]);
    assert.deepEqual([view.you.rematch, view.rival.rematch], [false, false]);
  });

  test("keeps the phone pairing and saber calibration", () => {
    match.setSaberPaired(1, true);
    assert.equal(match.setSaberCalibration(1, { forward: [0, 1], hand: "right", mirror: false, done: true }), null);
    finishWithBothPresent();
    // The phone keeps streaming through the result screen.
    match.handleSaberAim(1, { seq: 1, tracked: true, top: [0, 1, 0], rate: 0 });
    send(1, "rematch");
    send(2, "rematch");
    assert.equal(player(1).saber.paired, true);
    assert.equal(player(1).saber.saberReady, true);
  });

  test("is refused once the rival has left", () => {
    finishWithBothPresent();
    match.leave(2);
    assert.deepEqual(send(1, "rematch", "re"), { commandId: "re", status: "rejected", reason: "pilot_unavailable" });
  });

  test("a retried request doesn't count twice", () => {
    finishWithBothPresent();
    const first = send(1, "rematch", "re");
    assert.deepEqual(send(1, "rematch", "re"), first);
    assert.equal(match.toView(1).phase, "finished");
  });

  test("the new round's result is counted like the first", () => {
    finishWithBothPresent();
    send(1, "rematch");
    send(2, "rematch");
    match.leave(1);
    assert.deepEqual(results, [
      { winner: 1, reason: "forfeit" },
      { winner: 2, reason: "forfeit" },
    ]);
  });
});

describe("forfeit", () => {
  test("gives the round to the rival and both can still rematch", () => {
    assert.equal(send(1, "forfeit").status, "accepted");
    assert.deepEqual(match.toSnapshot().result, { winner: 2, reason: "forfeit" });
    assert.equal(match.toView(2).rival.connected, true);
    send(1, "rematch");
    send(2, "rematch");
    assert.equal(match.toView(1).phase, "active");
  });

  test("is refused once the match is over", () => {
    send(1, "forfeit");
    assert.deepEqual(send(2, "forfeit", "f"), { commandId: "f", status: "rejected", reason: "match_not_active" });
  });
});
