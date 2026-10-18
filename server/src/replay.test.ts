import assert from 'node:assert/strict';
import { test } from 'node:test';
import { io, type Socket } from 'socket.io-client';
import { startServer } from './server.js';
import { MAX_REPLAY_BYTES, type ReplayOptions } from './integrations/perceptron/replay.js';

function request(socket: Socket, event: string, body: unknown): Promise<any> {
  return new Promise((resolve, reject) => socket.timeout(2500).emit(event, body, (error: Error | null, result: unknown) => error ? reject(error) : resolve(result)));
}
async function fixture(options: ReplayOptions) {
  const server = await startServer({ port: 0, allowedOrigins: ['https://game.example'] }, { replay: options });
  const base = `http://127.0.0.1:${server.port}`;
  const a = io(base, { transports: ['websocket'] }), b = io(base, { transports: ['websocket'] });
  const stranger = io(base, { transports: ['websocket'] });
  return {
    base, a, b, stranger,
    async finish(leave = true) {
      await request(a, 'join', { playerId: 'replay-alice', callsign: 'Alice' });
      const bj = await request(b, 'join', { playerId: 'replay-bobby', callsign: 'Bob' });
      await request(stranger, 'join', { playerId: 'replay-outsider', callsign: 'Other' });
      await request(a, 'command', { type: 'challenge', pilotId: bj.lobby.you.id, commandId: 'replay-challenge' });
      const pending = await request(b, 'copilot:context', {});
      await request(b, 'command', { type: 'acceptChallenge', challengeId: pending.context.lobby.challenge.id, commandId: 'replay-accept' });
      const context = await request(a, 'copilot:context', {});
      const matchId = context.context.match.matchId as string;
      assert.deepEqual(await request(a, 'replay:ticket', { matchId }), { ok: false, reason: 'not_finished' });
      await request(b, 'command', { type: leave ? 'leaveMatch' : 'forfeit', commandId: 'replay-leave' });
      return matchId;
    },
    async close() { a.disconnect(); b.disconnect(); stranger.disconnect(); await server.close(); },
  };
}
function upload(base: string, match: string, ticket: string, overrides: Record<string, string> = {}) {
  return fetch(`${base}/replay/${match}`, { method: 'POST', body: Buffer.from('mock-video-for-transport-test'),
    headers: { Authorization: `Bearer ${ticket}`, 'Content-Type': 'video/webm', 'X-Replay-Duration': '10', ...overrides } });
}

test('replay authorization, bounded media and concurrent upload deduplication', async () => {
  let calls = 0;
  const f = await fixture({ key: 'fake-server-key', fetchImpl: (async (_url, options) => {
    calls++;
    const body = JSON.parse(String(options?.body));
    assert.equal((options?.headers as Record<string, string>).Authorization, 'Bearer fake-server-key');
    assert.equal(body.model, 'perceptron-mk1.5');
    assert.match(body.messages[1].content[0].video_url.url, /^data:video\/webm;base64,/);
    return new Response(JSON.stringify({ id: `mock-request-${calls}`, choices: [{ finish_reason: 'stop', message: { content:
      body.vision_config.annotation_format === 'clip' ? '<clip mention="Visible swing" t="1 seconds 3 seconds" />' : '<track mention="player"><point_box t="2 seconds">(100,100) (800,900)</point_box></track>' } }] }));
  }) as typeof fetch });
  try {
    assert.deepEqual(await request(f.a, 'replay:ticket', { matchId: 'unknown' }), { ok: false, reason: 'not_joined' });
    const match = await f.finish();
    assert.deepEqual(await request(f.stranger, 'replay:ticket', { matchId: match }), { ok: false, reason: 'not_finished' });
    assert.deepEqual(await request(f.a, 'replay:ticket', { matchId: match, playerId: 'other' }), { ok: false, reason: 'invalid_request' });
    const ticket = await request(f.a, 'replay:ticket', { matchId: match });
    assert.equal(ticket.ok, true);
    assert.equal((await upload(f.base, match, 'invalid')).status, 401);
    assert.equal((await upload(f.base, 'different-match', ticket.ticket)).status, 401);
    assert.equal((await upload(f.base, match, ticket.ticket, { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await upload(f.base, match, ticket.ticket, { 'Content-Type': 'application/json' })).status, 415);
    assert.equal((await upload(f.base, match, ticket.ticket, { 'X-Replay-Duration': '46' })).status, 400);
    const oversized = await fetch(`${f.base}/replay/${match}`, {method: 'POST', body: Buffer.alloc(MAX_REPLAY_BYTES + 1),
      headers: {Authorization: `Bearer ${ticket.ticket}`, 'Content-Type': 'video/webm', 'X-Replay-Duration': '10'}});
    assert.equal(oversized.status, 413);
    assert.equal(calls, 0);
    const [one, two] = await Promise.all([upload(f.base, match, ticket.ticket), upload(f.base, match, ticket.ticket)]);
    const result = await one.json();
    assert.deepEqual(await two.json(), result);
    assert.equal(result.source, 'perceptron');
    assert.equal(result.boxes.length, 1);
    assert.equal(result.moments[0].caption, 'Visible swing');
    assert.equal(calls, 2, 'one event call plus one framing call, even with concurrent uploads');
    assert.equal(JSON.stringify(result).includes('fake-server-key'), false);
    await request(f.a, 'command', { type: 'leaveMatch', commandId: 'alice-leave' });
    assert.equal((await upload(f.base, match, ticket.ticket)).status, 401, 'leaving invalidates even a cached result');
  } finally { await f.close(); }
});

test('missing key reports unavailable without an upload; expired tickets cannot analyze', async () => {
  const missing = await fixture({ key: '' });
  try {
    const match = await missing.finish();
    assert.deepEqual(await request(missing.a, 'replay:ticket', { matchId: match }), { ok: false, reason: 'unavailable' });
  } finally { await missing.close(); }
  let now = 1000;
  const f = await fixture({ key: 'fake', now: () => now, fetchImpl: (() => { throw new Error('must not call'); }) as typeof fetch });
  try {
    const match = await f.finish();
    const ticket = await request(f.a, 'replay:ticket', { matchId: match });
    now += 120_001;
    assert.equal((await upload(f.base, match, ticket.ticket)).status, 401);
  } finally { await f.close(); }
});

test('framing failure preserves real clip selections and is explicitly labeled', async () => {
  let calls = 0;
  const f = await fixture({ key: 'fake', fetchImpl: (async () => {
    if (++calls === 2) return new Response('rejected', { status: 400 });
    return new Response(JSON.stringify({ choices: [{ message: { content: '<clip mention="Duck" t="1 seconds 2 seconds" />' } }] }));
  }) as typeof fetch });
  try {
    const match = await f.finish();
    const ticket = await request(f.a, 'replay:ticket', { matchId: match });
    const reply = await (await upload(f.base, match, ticket.ticket)).json();
    assert.equal(reply.ok, true); assert.equal(reply.framing, 'unavailable'); assert.deepEqual(reply.boxes, []);
  } finally { await f.close(); }
});

test('no valid provider moments produces an explicit cached failure, never fabricated highlights', async () => {
  let calls = 0;
  const f = await fixture({key:'fake', fetchImpl: (async () => {
    calls++;
    return new Response(JSON.stringify({choices:[{message:{content:'There is no clear action.'}}]}));
  }) as typeof fetch});
  try {
    const match = await f.finish();
    const ticket = await request(f.a, 'replay:ticket', {matchId:match});
    assert.deepEqual(await (await upload(f.base, match, ticket.ticket)).json(), {ok:false,reason:'no_moments'});
    assert.deepEqual(await (await upload(f.base, match, ticket.ticket)).json(), {ok:false,reason:'no_moments'});
    assert.equal(calls, 1);
  } finally { await f.close(); }
});


test('rematch rejects old replay tickets and analyzes the new round separately', async () => {
  let calls = 0;
  const f = await fixture({ key: 'fake-server-key', fetchImpl: (async (_url, options) => {
    calls++;
    const body = JSON.parse(String(options?.body));
    return new Response(JSON.stringify({choices:[{message:{content:body.vision_config.annotation_format === 'clip'
      ? '<clip mention="Visible swing" t="1 seconds 3 seconds" />'
      : '<track><point_box t="2 seconds">(100,100) (800,900)</point_box></track>'}}]}));
  }) as typeof fetch });
  try {
    const match = await f.finish(false);
    const first = await request(f.a, 'replay:ticket', {matchId: match});
    assert.equal((await upload(f.base, match, first.ticket)).status, 200);
    assert.equal(calls, 2);
    await request(f.a, 'command', {type:'rematch', commandId:'rematch-a'});
    await request(f.b, 'command', {type:'rematch', commandId:'rematch-b'});
    await request(f.b, 'command', {type:'forfeit', commandId:'forfeit-round-two'});
    assert.equal((await upload(f.base, match, first.ticket)).status, 401);
    const second = await request(f.a, 'replay:ticket', {matchId: match});
    assert.notEqual(second.ticket, first.ticket);
    assert.equal((await upload(f.base, match, second.ticket)).status, 200);
    assert.equal(calls, 4, 'the second round must not reuse the first round analysis');
  } finally { await f.close(); }
});
