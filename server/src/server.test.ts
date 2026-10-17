import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { io as connect, type Socket } from "socket.io-client";
import type { ClientToServerEvents, JoinReply, MatchSnapshot, ServerToClientEvents } from "./contracts.js";
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

function nextSnapshot(client: Client, matches: (s: MatchSnapshot) => boolean): Promise<MatchSnapshot> {
  return new Promise((resolve) => {
    const listener = (snapshot: MatchSnapshot) => {
      if (!matches(snapshot)) return;
      client.off("snapshot", listener);
      resolve(snapshot);
    };
    client.on("snapshot", listener);
  });
}

// Tests share one server and run in order: they build on the same demo match.

test("two players join and receive the same snapshot", async () => {
  const alice = open();
  const bob = open();
  const isReady = (s: MatchSnapshot) => s.phase === "ready";
  const aliceSees = nextSnapshot(alice, isReady);

  assert.deepEqual(await join(alice, "player-alice"), {
    ok: true,
    slot: 1,
    snapshot: {
      matchId: "demo-match",
      phase: "waiting",
      players: [{ slot: 1, connected: true, health: 100, action: "idle", weapon: "rock", block: { active: false, endsInMs: null } }],
      rock: null,
    },
  });

  const bobSees = nextSnapshot(bob, isReady);
  const bobJoin = await join(bob, "player-bob");
  assert.equal(bobJoin.ok && bobJoin.slot, 2);

  const [a, b] = await Promise.all([aliceSees, bobSees]);
  assert.deepEqual(a, b);
  assert.deepEqual(a.players.map((p) => [p.slot, p.health]), [[1, 100], [2, 100]]);
});

test("a third player is rejected", async () => {
  assert.deepEqual(await join(open(), "player-carol"), { ok: false, reason: "match_full" });
});

test("malformed join is rejected", async () => {
  assert.deepEqual(await join(open(), "x"), { ok: false, reason: "invalid_request" });
});

test("a player who disconnects reclaims their slot with the same playerId", async () => {
  const [alice, bob] = clients;
  const bobSeesAliceLeave = nextSnapshot(bob, (s) => s.players[0].connected === false);
  alice.disconnect();
  await bobSeesAliceLeave;

  const bobSeesAliceReturn = nextSnapshot(bob, (s) => s.players[0].connected === true);
  const rejoin = await join(open(), "player-alice");
  assert.equal(rejoin.ok && rejoin.slot, 1);
  await bobSeesAliceReturn;
});
