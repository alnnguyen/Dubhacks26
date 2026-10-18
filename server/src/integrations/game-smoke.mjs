// Real Socket.IO clients against a fresh temporary B server; never touches port 3001.
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import { startServer } from '../../dist/server.js';

const clients = [];
const latest = new Map();
const server = await startServer({ port: 0, allowedOrigins: ['http://localhost:5173'] });
function next(client, event, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { client.off(event, listener); reject(new Error(`Timed out waiting for ${event}`)); }, 5000);
    const listener = value => {
      if (!predicate(value)) return;
      clearTimeout(timer); client.off(event, listener); resolve(value);
    };
    client.on(event, listener);
  });
}
async function open() {
  const client = io(`http://127.0.0.1:${server.port}`, { transports: ['websocket'], reconnection: false, timeout: 4000 });
  clients.push(client); client.on('snapshot', snapshot => latest.set(client, snapshot));
  await new Promise((resolve, reject) => {
    client.once('connect', resolve); client.once('connect_error', reject);
  });
  return client;
}
function ack(client, event, payload) {
  return new Promise((resolve, reject) => client.timeout(4000).emit(event, payload, (error, value) => error ? reject(error) : resolve(value)));
}
function command(client, type, commandId) { return ack(client, 'command', { type, commandId }); }
const report = message => console.log(`PASS ${message}`);
try {
  assert.equal(await (await fetch(`http://127.0.0.1:${server.port}/health`)).text(), 'ok'); report('HTTP health');
  const a = await open(), b = await open();
  assert.equal((await ack(a, 'join', { playerId: 'smoke-player-a' })).snapshot.phase, 'waiting');
  const activeA = next(a, 'snapshot', s => s.phase === 'active');
  const activeB = next(b, 'snapshot', s => s.phase === 'active');
  const joinedB = await ack(b, 'join', { playerId: 'smoke-player-b' });
  assert.equal(joinedB.slot, 2); assert.deepEqual(...await Promise.all([activeA, activeB]));
  report('two clients join → identical active snapshot, health 100/100');
  const outsider = await open();
  assert.equal((await command(outsider, 'throwRock', 'outsider-1')).reason, 'not_joined');
  assert.equal((await ack(outsider, 'join', { playerId: 'smoke-player-c' })).reason, 'match_full');
  report('unjoined commands and third player rejected');

  const unblocked = [next(a, 'rockLanded'), next(b, 'rockLanded')];
  const health80 = [next(a, 'snapshot', s => s.players[1].health === 80), next(b, 'snapshot', s => s.players[1].health === 80)];
  let landings = 0; a.on('rockLanded', () => landings++);
  const first = await command(a, 'throwRock', 'smoke-throw-a');
  assert.equal(first.status, 'accepted'); assert.deepEqual(await command(a, 'throwRock', 'smoke-throw-a'), first);
  const [hitA, hitB] = await Promise.all(unblocked);
  assert.deepEqual(hitA, hitB); assert.equal(hitA.damage, 20); assert.equal(hitA.blocked, false);
  assert.deepEqual(...await Promise.all(health80)); assert.equal(landings, 1);
  const cooldown = await command(a, 'throwRock', 'smoke-throw-too-soon');
  assert.equal(cooldown.reason, 'on_cooldown');
  report('real throw lands once for 20 damage; duplicate ID harmless; cooldown enforced');

  assert.equal((await command(a, 'startBlock', 'smoke-block-a')).status, 'accepted');
  const blocked = [next(a, 'rockLanded'), next(b, 'rockLanded')];
  assert.equal((await command(b, 'throwRock', 'smoke-throw-b')).status, 'accepted');
  const [blockA, blockB] = await Promise.all(blocked);
  assert.deepEqual(blockA, blockB); assert.equal(blockA.blocked, true); assert.equal(blockA.damage, 0);
  assert.equal(latest.get(a).players[0].health, 100);
  // End a still-active block; if its timer elapsed, the server correctly reports not_blocking.
  const end = await command(a, 'endBlock', 'smoke-end-block');
  assert.ok(end.status === 'accepted' || end.reason === 'not_blocking');
  report('opponent throw blocked on both clients; zero damage; endBlock handled');

  const disconnected = next(b, 'snapshot', s => !s.players[0].connected);
  a.disconnect(); await disconnected;
  const reconnected = next(b, 'snapshot', s => s.players[0].connected);
  const replacement = await open();
  const reclaim = await ack(replacement, 'join', { playerId: 'smoke-player-a' });
  assert.equal(reclaim.slot, 1); assert.equal(reclaim.snapshot.players[1].health, 80);
  await reconnected;
  report('reconnect reclaims slot 1 and preserves match health');
  console.log('DONE: real network smoke passed. This does not test browser UI, camera, Photon or Voice wiring.');
} finally {
  for (const client of clients) client.disconnect();
  await server.close();
}
