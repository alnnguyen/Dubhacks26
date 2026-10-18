import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { io as connect, type Socket } from "socket.io-client";
import type { ClientToServerEvents, JoinReply, PlayerView, ServerToClientEvents } from "./contracts.js";
import { startServer, type RunningServer } from "./server.js";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

let server: RunningServer;
const clients: Client[] = [];

before(async () => {
  server = await startServer({ port: 0, allowedOrigins: ["http://localhost:5173"] });
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

function join(client: Client, playerId: string): Promise<JoinReply> {
  return new Promise((resolve) => client.emit("join", { playerId }, resolve));
}

function nextView(client: Client, matches: (v: PlayerView) => boolean): Promise<PlayerView> {
  return new Promise((resolve) => {
    const listener = (view: PlayerView) => {
      if (!matches(view)) return;
      client.off("view", listener);
      resolve(view);
    };
    client.on("view", listener);
  });
}

// Tests share one server and run in order: they build on the same demo match.

test("two players join and each receives their own view", async () => {
  const alice = open();
  const bob = open();
  const aliceSeesBob = nextView(alice, (v) => v.phase === "active");

  const aliceJoin = await join(alice, "player-alice");
  assert.ok(aliceJoin.ok);
  assert.equal(aliceJoin.slot, 1);
  assert.equal(aliceJoin.view.phase, "waiting");
  assert.equal(aliceJoin.view.you.slot, 1);
  assert.equal(aliceJoin.view.rival, null);

  const bobJoin = await join(bob, "player-bob");
  assert.ok(bobJoin.ok);
  assert.equal(bobJoin.view.phase, "active");
  assert.deepEqual([bobJoin.view.you.slot, bobJoin.view.rival?.slot], [2, 1]);

  const a = await aliceSeesBob;
  assert.deepEqual([a.you.slot, a.rival?.slot], [1, 2]);
  assert.deepEqual(a.you, bobJoin.view.rival);
  assert.deepEqual(a.rival, bobJoin.view.you);
});

test("a third player is rejected", async () => {
  assert.deepEqual(await join(open(), "player-carol"), { ok: false, reason: "match_full" });
});

test("malformed join is rejected", async () => {
  assert.deepEqual(await join(open(), "x"), { ok: false, reason: "invalid_request" });
});

test("a command is acknowledged and a retry gets the same reply", async () => {
  const [, bob] = clients;
  const send = () =>
    new Promise((resolve) => bob.emit("command", { commandId: "bob-block-1", type: "startBlock" }, resolve));
  assert.deepEqual(await send(), { commandId: "bob-block-1", status: "accepted" });
  assert.deepEqual(await send(), { commandId: "bob-block-1", status: "accepted" });
});

test("a socket that has not joined cannot send commands", async () => {
  const stranger = open();
  const reply = await new Promise((resolve) =>
    stranger.emit("command", { commandId: "c1", type: "throwRock" }, resolve),
  );
  assert.deepEqual(reply, { commandId: "c1", status: "rejected", reason: "not_joined" });
});

test("a player who disconnects reclaims their slot with the same playerId", async () => {
  const [alice, bob] = clients;
  const bobSeesAliceLeave = nextView(bob, (v) => v.rival?.connected === false);
  alice.disconnect();
  await bobSeesAliceLeave;

  const bobSeesAliceReturn = nextView(bob, (v) => v.rival?.connected === true);
  const rejoin = await join(open(), "player-alice");
  assert.equal(rejoin.ok && rejoin.slot, 1);
  await bobSeesAliceReturn;
});
