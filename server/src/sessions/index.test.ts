import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import { RULES } from "../game/rules.js";
import { Lobby, pickArenaWorld } from "./index.js";

const ALICE = "player-alice";
const BOB = "player-bob";
const CAROL = "player-carol";

let lobby: Lobby;
let changes: number;
let nextId: number;

beforeEach(() => {
  mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1_000_000 });
  changes = 0;
  nextId = 0;
  lobby = new Lobby(
    {
      changed: () => changes++,
      saberResolved: () => {},
      arenaFrame: () => {},
      stepped: () => {},
    },
    { pickWorld: () => "moon" },
  );
  lobby.join(ALICE, "alice");
  lobby.join(BOB, "bob");
});

afterEach(() => {
  lobby.dispose();
  mock.timers.reset();
});

function send(playerId: string, command: Record<string, unknown>, commandId = `cmd-${nextId++}`) {
  return lobby.handleCommand(playerId, { commandId, ...command });
}

const idOf = (playerId: string) => lobby.lobbyView(playerId).you.id;

function challengeBobFromAlice(): string {
  assert.equal(send(ALICE, { type: "challenge", pilotId: idOf(BOB) }).status, "accepted");
  return lobby.lobbyView(BOB).challenge!.id;
}

function startMatch() {
  send(BOB, { type: "acceptChallenge", challengeId: challengeBobFromAlice() });
  send(ALICE, { type: "ready" });
  send(BOB, { type: "ready" });
}

describe("joining", () => {
  test("pilots see each other by public ID and callsign, never the private playerId", () => {
    const view = lobby.lobbyView(ALICE);
    assert.equal(view.you.callsign, "ALICE");
    assert.deepEqual(view.pilots.map((p) => [p.callsign, p.status]), [["BOB", "available"]]);
    assert.ok(!JSON.stringify(view).includes(BOB));
    assert.match(view.you.id, /^p[0-9a-f]{8}$/);
  });

  test("rejoining with the same playerId keeps the pilot", () => {
    const id = idOf(ALICE);
    lobby.disconnect(ALICE);
    assert.equal(lobby.lobbyView(BOB).pilots.length, 0);
    lobby.join(ALICE);
    assert.equal(idOf(ALICE), id);
    assert.equal(lobby.lobbyView(ALICE).you.callsign, "ALICE");
  });

  test("malformed playerIds and callsigns are refused", () => {
    assert.deepEqual(lobby.join("x"), { ok: false, reason: "invalid_request" });
    assert.equal(send(ALICE, { type: "setCallsign", callsign: "<script>" }).status, "rejected");
    assert.equal(send(ALICE, { type: "setCallsign", callsign: " nova  7 " }).status, "accepted");
    assert.equal(lobby.lobbyView(BOB).pilots[0].callsign, "NOVA 7");
  });

  test("an exploration location is shown to other pilots until cleared", () => {
    assert.equal(lobby.lobbyView(BOB).pilots[0].location, undefined);
    const place = { bodyId: "exo-trappist-1-e", label: " TRAPPIST-1  e " };
    assert.equal(send(ALICE, { type: "setLocation", location: place }).status, "accepted");
    assert.deepEqual(lobby.lobbyView(BOB).pilots[0].location, { bodyId: "exo-trappist-1-e", label: "TRAPPIST-1 e" });
    assert.deepEqual(lobby.lobbyView(ALICE).you.location, { bodyId: "exo-trappist-1-e", label: "TRAPPIST-1 e" });
    assert.equal(send(ALICE, { type: "setLocation", location: null }).status, "accepted");
    assert.equal(lobby.lobbyView(BOB).pilots[0].location, undefined);
  });

  test("malformed locations are refused and keep the last one", () => {
    send(ALICE, { type: "setLocation", location: { bodyId: "jupiter", label: "Jupiter" } });
    for (const location of [
      { bodyId: "../etc", label: "Jupiter" },
      { bodyId: "jupiter", label: "<script>alert(1)</script>" },
      { bodyId: "jupiter", label: "x".repeat(49) },
      { bodyId: "jupiter" },
      "jupiter",
    ]) {
      assert.equal(send(ALICE, { type: "setLocation", location }).status, "rejected");
    }
    assert.deepEqual(lobby.lobbyView(BOB).pilots[0].location, { bodyId: "jupiter", label: "Jupiter" });
  });

  test("commands from unknown players are rejected", () => {
    assert.deepEqual(lobby.handleCommand("nobody-here", { commandId: "a", type: "ready" }), {
      commandId: "a",
      status: "rejected",
      reason: "not_joined",
    });
  });
});

describe("challenges", () => {
  test("both pilots see the pending challenge from their own side", () => {
    challengeBobFromAlice();
    const a = lobby.lobbyView(ALICE).challenge!;
    const b = lobby.lobbyView(BOB).challenge!;
    assert.equal(a.id, b.id);
    assert.deepEqual([a.role, a.opponent.callsign, a.status], ["challenger", "BOB", "pending"]);
    assert.deepEqual([b.role, b.opponent.callsign], ["defender", "ALICE"]);
    assert.equal(b.expiresInMs, RULES.challengeExpiryMs);
  });

  test("you can't challenge yourself, an unknown pilot, or while a challenge is pending", () => {
    assert.equal(send(ALICE, { type: "challenge", pilotId: idOf(ALICE) }).status, "rejected");
    assert.equal(send(ALICE, { type: "challenge", pilotId: "pnope" }).status, "rejected");
    challengeBobFromAlice();
    lobby.join(CAROL);
    assert.deepEqual(send(ALICE, { type: "challenge", pilotId: idOf(CAROL) }, "x"), {
      commandId: "x",
      status: "rejected",
      reason: "busy",
    });
    assert.deepEqual(send(CAROL, { type: "challenge", pilotId: idOf(BOB) }, "y"), {
      commandId: "y",
      status: "rejected",
      reason: "pilot_unavailable",
    });
  });

  test("only the defender can accept or decline, and only the challenger can cancel", () => {
    const challengeId = challengeBobFromAlice();
    assert.equal(send(ALICE, { type: "acceptChallenge", challengeId }).status, "rejected");
    assert.equal(send(BOB, { type: "cancelChallenge", challengeId }).status, "rejected");
    assert.equal(send(BOB, { type: "declineChallenge", challengeId }).status, "accepted");
    assert.equal(lobby.lobbyView(ALICE).challenge!.status, "declined");
    assert.equal(send(BOB, { type: "acceptChallenge", challengeId }).status, "rejected");
    assert.equal(lobby.matchView(ALICE), null);
  });

  test("a pending challenge expires", () => {
    const challengeId = challengeBobFromAlice();
    mock.timers.tick(RULES.challengeExpiryMs);
    assert.equal(lobby.lobbyView(ALICE).challenge!.status, "expired");
    assert.equal(send(BOB, { type: "acceptChallenge", challengeId }).status, "rejected");
  });

  test("a pilot disconnecting cancels their pending challenge", () => {
    challengeBobFromAlice();
    lobby.disconnect(ALICE);
    assert.equal(lobby.lobbyView(BOB).challenge!.status, "cancelled");
  });

  test("accepting starts one match on the server's world, and a repeated accept doesn't start another", () => {
    const challengeId = challengeBobFromAlice();
    const first = send(BOB, { type: "acceptChallenge", challengeId }, "accept-1");
    assert.deepEqual(send(BOB, { type: "acceptChallenge", challengeId }, "accept-1"), first);
    assert.equal(send(BOB, { type: "acceptChallenge", challengeId }, "accept-2").status, "rejected");

    const a = lobby.matchView(ALICE)!;
    const b = lobby.matchView(BOB)!;
    assert.equal(a.matchId, b.matchId);
    assert.deepEqual([a.phase, a.world.id, a.world.gravityMps2], ["waiting", "moon", 1.6]);
    assert.deepEqual([a.you.callsign, a.rival.callsign], ["ALICE", "BOB"]);
    assert.equal(lobby.lobbyView(ALICE).pilots[0].status, "in-duel");
  });
});

describe("matches", () => {
  test("combat commands are refused outside a match", () => {
    assert.deepEqual(send(ALICE, { type: "ready" }, "t"), {
      commandId: "t",
      status: "rejected",
      reason: "not_in_match",
    });
  });

  test("a finished match updates both records and frees both pilots", () => {
    startMatch();
    assert.equal(lobby.matchView(ALICE)!.phase, "active");
    send(BOB, { type: "leaveMatch" });
    assert.deepEqual(lobby.matchView(ALICE)!.result, { winner: 1, reason: "forfeit" });

    send(ALICE, { type: "leaveMatch" });
    assert.equal(lobby.matchView(ALICE), null);
    const view = lobby.lobbyView(ALICE);
    assert.deepEqual([view.you.wins, view.pilots[0].losses, view.pilots[0].status], [1, 1, "available"]);
  });

  test("a step goes through the command path, and a retried commandId doesn't step twice", () => {
    assert.equal(send(ALICE, { type: "step", direction: "forward" }).status, "rejected", "not in a match");
    startMatch();
    assert.equal(send(ALICE, { type: "step", direction: "forward" }, "step-1").status, "accepted");
    // The retry repeats the first reply instead of stepping again (or being buffered).
    assert.equal(send(ALICE, { type: "step", direction: "forward" }, "step-1").status, "accepted");
    // One more is buffered mid-glide; a third is refused.
    assert.equal(send(ALICE, { type: "step", direction: "left" }, "step-2").status, "accepted");
    assert.deepEqual(send(ALICE, { type: "step", direction: "left" }, "step-3"), {
      commandId: "step-3",
      status: "rejected",
      reason: "busy",
    });
  });

  test("leaving an unfinished match forfeits it to the opponent", () => {
    startMatch();
    assert.equal(send(BOB, { type: "leaveMatch" }).status, "accepted");
    assert.deepEqual(lobby.matchView(ALICE)!.result, { winner: 1, reason: "forfeit" });
    assert.equal(lobby.lobbyView(BOB).you.losses, 1);
  });

  test("a pilot who reconnects mid-match gets the same match back", () => {
    startMatch();
    lobby.disconnect(BOB);
    assert.equal(lobby.matchView(ALICE)!.rival.connected, false);
    lobby.join(BOB);
    assert.equal(lobby.matchView(ALICE)!.rival.connected, true);
    assert.equal(lobby.matchView(BOB)!.phase, "active");
  });

  test("state changes are announced", () => {
    const before = changes;
    challengeBobFromAlice();
    assert.ok(changes > before);
  });
});

describe('destination selection',()=>{
 test('an accepted Neptune challenge shares one immutable world with both pilots and reconnects',()=>{
  assert.equal(send(ALICE,{type:'challenge',pilotId:idOf(BOB),destination:'neptune'},'route').status,'accepted');
  const id=lobby.lobbyView(BOB).challenge!.id;
  assert.equal(send(BOB,{type:'acceptChallenge',challengeId:id},'accept-neptune').status,'accepted');
  const a=lobby.matchView(ALICE)!,b=lobby.matchView(BOB)!;
  assert.equal(a.world.id,'neptune');assert.deepEqual(a.world,b.world);assert.equal(a.matchId,b.matchId);
  assert.equal(send(ALICE,{type:'challenge',pilotId:idOf(BOB),destination:'mars'},'route').status,'accepted');
  assert.equal(lobby.matchView(ALICE)!.world.id,'neptune');
  lobby.disconnect(ALICE);lobby.join(ALICE,'alice');assert.equal(lobby.matchView(ALICE)!.world.id,'neptune');
 });
 test('rejects unsupported destinations and retains explicit Mars',()=>{
  assert.equal(send(ALICE,{type:'challenge',pilotId:idOf(BOB),destination:'saturn'}).status,'rejected');
  assert.equal(lobby.lobbyView(BOB).challenge,null);
  send(ALICE,{type:'challenge',pilotId:idOf(BOB),destination:'mars'});
  send(BOB,{type:'acceptChallenge',challengeId:lobby.lobbyView(BOB).challenge!.id});
  assert.equal(lobby.matchView(BOB)!.world.id,'mars');
 });
});

describe('arena world roll', () => {
  test('splits Mars and Neptune evenly', () => {
    assert.equal(pickArenaWorld(() => 0), 'mars');
    assert.equal(pickArenaWorld(() => 0.49), 'mars');
    assert.equal(pickArenaWorld(() => 0.5), 'neptune');
    assert.equal(pickArenaWorld(() => 0.99), 'neptune');
  });
});
