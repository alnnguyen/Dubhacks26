import * as zlib from "node:zlib";
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import type { ProjectileLanded } from "../contracts.js";
import { RULES } from "../game/rules.js";
import { Lobby } from "./index.js";

const ALICE = "player-alice";
const BOB = "player-bob";
const CAROL = "player-carol";

let lobby: Lobby;
let changes: number;
let landed: { playerIds: string[]; event: ProjectileLanded }[];
let nextId: number;

beforeEach(() => {
  mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1_000_000 });
  changes = 0;
  landed = [];
  nextId = 0;
  lobby = new Lobby(
    {
      changed: () => changes++,
      projectileLanded: (playerIds, event) => landed.push({ playerIds, event }),
      saberResolved: () => {},
      arenaFrame: () => {},
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
    assert.deepEqual([a.phase, a.world.id, a.world.rockFlightMs], ["waiting", "moon", 1980]);
    assert.deepEqual([a.you.callsign, a.rival.callsign], ["ALICE", "BOB"]);
    assert.equal(lobby.lobbyView(ALICE).pilots[0].status, "in-duel");
  });
});

describe("matches", () => {
  test("combat commands are refused outside a match", () => {
    assert.deepEqual(send(ALICE, { type: "throwRock" }, "t"), {
      commandId: "t",
      status: "rejected",
      reason: "not_in_match",
    });
  });

  test("a hit reaches both players and a knockout updates the record", () => {
    startMatch();
    assert.equal(lobby.matchView(ALICE)!.phase, "active");
    send(ALICE, { type: "gunActive" });
    for (let i = 0; i < 5; i++) {
      assert.equal(send(ALICE, { type: "fireGun" }).status, "accepted");
      mock.timers.tick(1000);
    }
    assert.deepEqual(landed[0].playerIds, [ALICE, BOB]);
    assert.deepEqual(lobby.matchView(BOB)!.result, { winner: 1, reason: "knockout" });

    send(ALICE, { type: "leaveMatch" });
    send(BOB, { type: "leaveMatch" });
    assert.equal(lobby.matchView(ALICE), null);
    const view = lobby.lobbyView(ALICE);
    assert.deepEqual([view.you.wins, view.pilots[0].losses, view.pilots[0].status], [1, 1, "available"]);
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

describe('opponent appearance', () => {
  const avatar = { suit: 'purple', accent: 'gold', saber: 'green', accessories: ['cape', 'patch'], face: null };
  test('each participant sees the actual opposing profile, including after reconnect', () => {
    assert.equal(send(ALICE, { type: 'setAvatar', avatar }).status, 'accepted');
    const bobAvatar = { ...avatar, suit: 'orange', accessories: ['antenna'] };
    assert.equal(send(BOB, { type: 'setAvatar', avatar: bobAvatar }).status, 'accepted');
    startMatch();
    assert.deepEqual(lobby.matchView(BOB)!.rival.avatar, avatar);
    assert.deepEqual(lobby.matchView(ALICE)!.rival.avatar, bobAvatar);
    lobby.disconnect(ALICE);
    lobby.join(ALICE);
    assert.deepEqual(lobby.matchView(BOB)!.rival.avatar, avatar);
    assert.equal(JSON.stringify(lobby.lobbyView(BOB)).includes('avatar'), false);
  });
  test('duplicate updates repeat the original acceptance without changing appearance', () => {
    send(ALICE, { type: 'setAvatar', avatar }, 'appearance-1');
    const n = changes;
    send(ALICE, { type: 'setAvatar', avatar: { ...avatar, suit: 'blue' } }, 'appearance-1');
    assert.equal(changes, n);
    startMatch();
    assert.deepEqual(lobby.matchView(BOB)!.rival.avatar, avatar);
  });
  test('rejects malformed appearance and remote/oversized/invalid image data', () => {
    for (const patch of [{ suit: [] }, { suit: 'unknown' }, { accessories: ['bad'] }, { face: 'https://example.org/photo.png' }, { face: 'data:image/png;base64,' + 'A'.repeat(96_001) }, { face: 'data:image/png;base64,AAAA' }]) {
      assert.equal(send(ALICE, { type: 'setAvatar', avatar: { ...avatar, ...patch } }).status, 'rejected');
    }
  });
  test('accepts a processed PNG face and carries it to the opposing player', () => {
    // Full 128 x 160 transparent PNG generated without an external image fixture.
    const { deflateSync } = zlib;
    const header = Buffer.alloc(13);
    header.writeUInt32BE(128, 0); header.writeUInt32BE(160, 4); header[8] = 8; header[9] = 6;
    const crc = (bytes: Buffer) => { let c = 0xffffffff; for (const b of bytes) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0); } return (c ^ 0xffffffff) >>> 0; };
    const chunk = (type: string, data: Buffer) => { const n = Buffer.alloc(4); n.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const check = Buffer.alloc(4); check.writeUInt32BE(crc(body)); return Buffer.concat([n, body, check]); };
    const png = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.alloc((128 * 4 + 1) * 160))), chunk('IEND', Buffer.alloc(0))]);
    const withFace = { ...avatar, face: `data:image/png;base64,${png.toString('base64')}` };
    assert.equal(send(ALICE, { type: 'setAvatar', avatar: withFace }).status, 'accepted');
    startMatch();
    assert.deepEqual(lobby.matchView(BOB)!.rival.avatar, withFace);
    send(ALICE, { type: 'setAvatar', avatar });
    assert.equal(lobby.matchView(BOB)!.rival.avatar!.face, null);
  });
});
