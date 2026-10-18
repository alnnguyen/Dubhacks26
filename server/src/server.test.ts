import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { io as connect, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  Command,
  CommandReply,
  JoinReply,
  LobbyView,
  PlayerView,
  ServerToClientEvents,
} from "./contracts.js";
import { startServer, type RunningServer } from "./server.js";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

let server: RunningServer;
const clients: Client[] = [];

before(async () => {
  server = await startServer({ port: 0, allowedOrigins: ["http://localhost:5173"] }, { pickWorld: () => "earth" });
});

after(async () => {
  for (const client of clients) client.disconnect();
  await server.close();
});

function open(): Client {
  const client: Client = connect(`http://localhost:${server.port}`, { transports: ["websocket"] });
  clients.push(client);
  return client;
}

function join(client: Client, playerId: string, callsign?: string): Promise<JoinReply> {
  return new Promise((resolve) => client.emit("join", { playerId, callsign }, resolve));
}

function send(client: Client, command: Command): Promise<CommandReply> {
  return new Promise((resolve) => client.emit("command", command, resolve));
}

function next<E extends "lobby" | "view">(
  client: Client,
  event: E,
  matches: (value: Parameters<ServerToClientEvents[E]>[0]) => boolean,
): Promise<Parameters<ServerToClientEvents[E]>[0]> {
  return new Promise((resolve) => {
    const listener = (value: never) => {
      if (!matches(value)) return;
      client.off(event, listener as never);
      resolve(value);
    };
    client.on(event, listener as never);
  });
}

// Tests share one server and run in order: they build on the same lobby.

let alice: Client;
let bob: Client;
let bobPilotId: string;
let alicePairCode: string;

test("two players join the lobby and see each other", async () => {
  alice = open();
  bob = open();
  const aliceJoin = await join(alice, "player-alice", "alice");
  assert.ok(aliceJoin.ok);
  alicePairCode = aliceJoin.lobby.pairCode;
  assert.equal(aliceJoin.view, null);

  const aliceSeesBob = next(alice, "lobby", (l: LobbyView) => l.pilots.length === 1);
  const bobJoin = await join(bob, "player-bob", "bob");
  assert.ok(bobJoin.ok);
  assert.deepEqual(bobJoin.lobby.pilots.map((p) => p.callsign), ["ALICE"]);
  bobPilotId = bobJoin.lobby.you.id;
  assert.equal((await aliceSeesBob).pilots[0].callsign, "BOB");
});

test("malformed join is rejected", async () => {
  assert.deepEqual(await join(open(), "x"), { ok: false, reason: "invalid_request" });
});

test("a socket that has not joined cannot send commands", async () => {
  assert.deepEqual(await send(open(), { commandId: "c1", type: "ready" }), {
    commandId: "c1",
    status: "rejected",
    reason: "not_joined",
  });
});

test("a challenge reaches the defender, and accepting puts both in the same match", async () => {
  const bobIncoming = next(bob, "lobby", (l: LobbyView) => l.challenge?.status === "pending");
  const reply = await send(alice, { commandId: "ch-1", type: "challenge", pilotId: bobPilotId });
  assert.equal(reply.status, "accepted");
  const incoming = (await bobIncoming).challenge!;
  assert.deepEqual([incoming.role, incoming.opponent.callsign], ["defender", "ALICE"]);

  const aliceMatch = next(alice, "view", (v: PlayerView | null) => v !== null);
  assert.equal((await send(bob, { commandId: "acc-1", type: "acceptChallenge", challengeId: incoming.id })).status, "accepted");
  const view = (await aliceMatch)!;
  assert.deepEqual([view.phase, view.world.id, view.rival.callsign], ["waiting", "earth", "BOB"]);
});

test("the match starts when both are ready, and a retried command isn't applied twice", async () => {
  const active = next(alice, "view", (v: PlayerView | null) => v?.phase === "active");
  await send(alice, { commandId: "ready-1", type: "ready" });
  await send(bob, { commandId: "ready-1", type: "ready" });
  await active;

  // A retry of an applied ready repeats its reply instead of being refused as match_not_active.
  assert.deepEqual(await send(bob, { commandId: "ready-1", type: "ready" }), { commandId: "ready-1", status: "accepted" });
});

test("a phone pairs as a pilot's saber, and the arena shows the blade to both laptops", async () => {
  const phone = open();
  const pair = (code: string) =>
    new Promise<Parameters<Parameters<ClientToServerEvents["pairSaber"]>[1]>[0]>((resolve) =>
      phone.emit("pairSaber", { code }, resolve),
    );
  assert.deepEqual(await pair("NOPE00"), { ok: false, reason: "invalid_code" });
  const paired = await pair(alicePairCode.toLowerCase());
  assert.ok(paired.ok);
  assert.equal(paired.status.callsign, "ALICE");
  assert.equal(paired.status.match?.phase, "active");

  const bobSeesBlade = new Promise<Parameters<ServerToClientEvents["arena"]>[0]>((resolve) => {
    const listener = (frame: Parameters<ServerToClientEvents["arena"]>[0]) => {
      if (!frame.players[0].blade) return;
      bob.off("arena", listener);
      resolve(frame);
    };
    bob.on("arena", listener);
  });
  const joints = Array.from({ length: 33 }, () => [0, 0, 0]);
  joints[16] = [0.2, 0.3, 0.3];
  const aliceSeesPhone = new Promise((resolve) => alice.once("phoneAim", resolve));
  const calibrated = await send(alice, {
    commandId: "cal-1",
    type: "calibrateSaber",
    calibration: { forward: [0, 1], hand: "right", mirror: false, done: true },
  });
  assert.equal(calibrated.status, "accepted");
  alice.emit("bodyPose", { seq: 1, tracked: true, joints, move: { x: 0, z: 0 }, calibrated: true, setup: null } as never);
  phone.emit("saberAim", { seq: 1, tracked: true, top: [0, 0, 1], rate: 0 });
  // Alice's laptop gets her own phone's readings for its setup checks.
  assert.deepEqual(await aliceSeesPhone, { seq: 1, tracked: true, top: [0, 0, 1], rate: 0 });
  const frame = await bobSeesBlade;
  // Alice's right wrist, in her starting cell (a row back from the front line, hips 1 m up), blade straight up.
  const round = (v: number[] | undefined) => v?.map((n) => Math.round(n * 100) / 100);
  assert.deepEqual(round(frame.players[0].blade?.hilt), [0.2, 1.3, -1]);
  assert.deepEqual(round(frame.players[0].blade?.tip), [0.2, 2.2, -1]);
  assert.equal(frame.engaged, false);
});

test("a phone's thumb swipe steps its pilot, announced to both laptops at once", async () => {
  const phone = open();
  await new Promise((resolve) => phone.emit("pairSaber", { code: alicePairCode }, resolve));
  const step = (stepId: string) =>
    new Promise<CommandReply>((resolve) => phone.emit("saberStep", { stepId, direction: "forward" }, resolve));
  const bobSees = new Promise<Parameters<ServerToClientEvents["stepped"]>[0]>((resolve) => bob.once("stepped", resolve));
  assert.deepEqual(await step("swipe-1"), { commandId: "swipe-1", status: "accepted" });
  assert.deepEqual(await bobSees, { slot: 1, cell: { q: 0, r: -1 } });
  // A retried swipe repeats its reply instead of stepping again.
  assert.deepEqual(await step("swipe-1"), { commandId: "swipe-1", status: "accepted" });

  const stranger = open();
  const refused = await new Promise<CommandReply>((resolve) =>
    stranger.emit("saberStep", { stepId: "x", direction: "forward" }, resolve),
  );
  assert.equal(refused.status, "rejected");
});

test("a player who disconnects reclaims their match with the same playerId", async () => {
  const bobSeesAliceLeave = next(bob, "view", (v: PlayerView | null) => v?.rival.connected === false);
  alice.disconnect();
  await bobSeesAliceLeave;

  const bobSeesAliceReturn = next(bob, "view", (v: PlayerView | null) => v?.rival.connected === true);
  alice = open();
  const rejoin = await join(alice, "player-alice");
  assert.ok(rejoin.ok);
  assert.equal(rejoin.view?.you.slot, 1);
  assert.equal(rejoin.view?.phase, "active");
  await bobSeesAliceReturn;
});

test("leaving forfeits, and both return to the lobby", async () => {
  const aliceResult = next(alice, "view", (v: PlayerView | null) => v?.phase === "finished");
  await send(bob, { commandId: "leave-1", type: "leaveMatch" });
  assert.deepEqual((await aliceResult)!.result, { winner: 1, reason: "forfeit" });

  const aliceBack = next(alice, "view", (v: PlayerView | null) => v === null);
  await send(alice, { commandId: "leave-1", type: "leaveMatch" });
  await aliceBack;
});
