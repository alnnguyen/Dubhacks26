import assert from 'node:assert/strict';
import { test } from 'node:test';
import { io, type Socket } from 'socket.io-client';
import { startServer } from './server.js';

function request(socket: Socket, event: string, body: unknown): Promise<any> {
  return new Promise((resolve, reject) => socket.timeout(2500).emit(event, body, (error: Error | null, result: unknown) => error ? reject(error) : resolve(result)));
}

test('copilot context is bound to the joined player and the actual running match', async () => {
  const server = await startServer({port: 0, allowedOrigins: []});
  const a = io(`http://127.0.0.1:${server.port}`, {transports: ['websocket']});
  const b = io(`http://127.0.0.1:${server.port}`, {transports: ['websocket']});
  try {
    assert.deepEqual(await request(a, 'copilot:context', {}), {ok: false, reason: 'not_joined'});
    const aj = await request(a, 'join', {playerId: 'copilot-alice', callsign: 'ALICE'});
    const bj = await request(b, 'join', {playerId: 'copilot-bobby', callsign: 'BOB'});
    const context = await request(a, 'copilot:context', {});
    assert.equal(context.context.source, 'live');
    assert.equal(context.context.lobby.you.callsign, 'ALICE');
    assert.equal(context.context.lobby.pilots[0].callsign, 'BOB');
    assert.equal(JSON.stringify(context).includes('copilot-bobby'), false);
    assert.deepEqual(await request(a, 'copilot:context', {actorId: 'copilot-bobby'}), {ok: false, reason: 'invalid_request'});
    await request(a, 'command', {type: 'challenge', pilotId: bj.lobby.you.id, commandId: 'copilot-challenge'});
    const pending = await request(b, 'copilot:context', {});
    await request(b, 'command', {type: 'acceptChallenge', challengeId: pending.context.lobby.challenge.id, commandId: 'copilot-accept'});
    const real = await request(a, 'copilot:context', {});
    assert.ok(['mars', 'neptune'].includes(real.context.match.world.id));
    assert.equal(real.context.match.you.pilotId, aj.lobby.you.id);
    assert.equal(real.context.match.rival.pilotId, bj.lobby.you.id);
    assert.equal(real.context.match.phase, 'waiting');
  } finally { a.disconnect(); b.disconnect(); await server.close(); }
});

test('only a joined game socket can mint a Voice session', async () => {
  let requests = 0;
  const server = await startServer({port: 0, allowedOrigins: []}, {copilot: {
    key: 'permanent-test-key',
    fetchImpl: (async () => { requests++; return new Response(JSON.stringify({value: 'ephemeral-test-value'})); }) as typeof fetch,
  }});
  const socket = io(`http://127.0.0.1:${server.port}`, {transports: ['websocket']});
  try {
    assert.deepEqual(await request(socket, 'copilot:session', {}), {ok: false, reason: 'not_joined'});
    assert.equal(requests, 0);
    await request(socket, 'join', {playerId: 'copilot-member', callsign: 'NOVA'});
    assert.deepEqual(await request(socket, 'copilot:session', {actorId: 'other'}), {ok: false, reason: 'invalid_request'});
    const session = await request(socket, 'copilot:session', {});
    assert.equal(session.clientSecret, 'ephemeral-test-value');
    assert.equal(session.session.tools[0].name, 'getFlightState');
    assert.equal(requests, 1);
    assert.deepEqual(await request(socket, 'copilot:session', {}), {ok: false, reason: 'rate_limited'});
  } finally { socket.disconnect(); await server.close(); }
});
