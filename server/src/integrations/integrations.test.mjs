import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixturePort, JsonStore } from './demo-state.mjs';
import { parseOrder, trustedMessage, challengeAgent } from './photon/challenge-agent.mjs';
import { runVoiceTool, ephemeralToken } from './grok/realtime.mjs';

const identity = { sender: 'test-human', agent: 'test-agent', playerId: 'pilot-d' };
const message = (text = 'ACCEPT DEMO-42', id = 'pho_msg_test1') => ({ id, platform: 'imessage', status: 'received',
  sentBy: { kind: 'human', platform: 'imessage', handle: identity.sender },
  receivedBy: { kind: 'agent', platform: 'imessage', handle: identity.agent, id: 'agent-id' },
  space: { kind: 'direct', platform: 'imessage', id: 'space-id' }, content: { type: 'text', format: 'plain', text } });
async function setup(t) {
  const dir = await mkdtemp(join(tmpdir(), 'duel-d-test-')); t.after(() => rm(dir, { recursive: true, force: true }));
  return { port: fixturePort(join(dir, 'state.json')), journal: new JsonStore(join(dir, 'journal.json'), {}) };
}
test('only explicit action + ID is parsed; no ambiguous or injected extra words', () => {
  assert.deepEqual(parseOrder(' accept demo-42 '), { action: 'accept', challengeId: 'DEMO-42' });
  for (const s of ['ACCEPT', 'accept 42 please', 'ACCEPT A\nDECLINE B', 'delete DEMO-42']) assert.equal(parseOrder(s), null);
});
test('rejects another sender, outbound events and group conversations', () => {
  assert.ok(trustedMessage(message(), identity));
  assert.equal(trustedMessage(message(), { ...identity, sender: 'someone-else' }), false);
  assert.equal(trustedMessage({ ...message(), status: 'dispatched' }, identity), false);
  assert.equal(trustedMessage({ ...message(), space: { ...message().space, kind: 'group' } }, identity), false);
});
test('actual fixture acceptance persists; duplicate event sends/mutates only once', async t => {
  const { port, journal } = await setup(t); let sends = 0;
  const handler = challengeAgent({ port, journal, identity, photon: { send: async () => { sends++; return { id: 'out', status: 'dispatched' }; } } });
  await Promise.all([handler(message()), handler(message())]);
  assert.equal((await port.getChallenge({ actorId: 'pilot-d', challengeId: 'DEMO-42' })).status, 'accepted'); assert.equal(sends, 1);
});
test('retry after send failure preserves original result and stable command ID', async t => {
  const { port, journal } = await setup(t); let calls = 0, mutations = 0;
  const wrapped = { ...port, respondChallenge: async args => { mutations++; return port.respondChallenge(args); } };
  const handler = challengeAgent({ port: wrapped, journal, identity, photon: { send: async () => { if (!calls++) throw new Error('network'); return { id: 'out' }; } } });
  await assert.rejects(handler(message())); await handler(message()); assert.equal(mutations, 1);
});
test('only defender may respond; cannot flip an already resolved challenge', async t => {
  const { port } = await setup(t);
  await assert.rejects(port.respondChallenge({ actorId: 'pilot-a', challengeId: 'DEMO-42', decision: 'accept', commandId: 'x' }));
  await port.respondChallenge({ actorId: 'pilot-d', challengeId: 'DEMO-42', decision: 'decline', commandId: 'y' });
  await assert.rejects(port.respondChallenge({ actorId: 'pilot-d', challengeId: 'DEMO-42', decision: 'accept', commandId: 'z' }));
  await assert.rejects(port.getChallenge({ actorId: 'intruder', challengeId: 'DEMO-42' }));
});
test('command ID reused with different arguments is rejected', async t => {
  const { port } = await setup(t);
  await port.respondChallenge({ actorId: 'pilot-d', challengeId: 'DEMO-42', decision: 'accept', commandId: 'same' });
  await assert.rejects(port.respondChallenge({ actorId: 'pilot-d', challengeId: 'DEMO-43', decision: 'accept', commandId: 'same' }));
});
test('unknown challenge error does not disclose internal error or mutate', async t => {
  const { port, journal } = await setup(t); const replies = [];
  await challengeAgent({ port, journal, identity, photon: { send: async (m, text) => { replies.push(text); return { id: 'out' }; } } })(message('ACCEPT UNKNOWN'));
  assert.match(replies[0], /unavailable/); assert.equal((await port.getChallenge({ actorId: 'pilot-d', challengeId: 'DEMO-42' })).status, 'pending');
});
test('voice tool reads changed fixture state, not a hard-coded Mars answer', async t => {
  const { port } = await setup(t);
  const invoke = () => runVoiceTool({ port, actorId: 'pilot-d', name: 'getMatchState', arguments: '{}' });
  assert.equal((await invoke()).world, 'mars'); await port.setDemoWorld('moon');
  const state = await invoke(); assert.equal(state.world, 'moon'); assert.equal(state.gravityMps2, 1.6); assert.equal(state.fixture, true);
});
test('voice tool rejects caller-selected identities and unknown functions', async t => {
  const { port } = await setup(t);
  await assert.rejects(runVoiceTool({ port, actorId: 'pilot-d', name: 'getMatchState', arguments: '{"actorId":"intruder"}' }));
  await assert.rejects(runVoiceTool({ port, actorId: 'pilot-d', name: 'acceptChallenge', arguments: '{}' }));
  for (const args of ['null', '[]', '1', 'true']) await assert.rejects(runVoiceTool({ port, actorId: 'pilot-d', name: 'getMatchState', arguments: args }));
});
test('ephemeral token request keeps permanent key in auth header and enforces expiry', async () => {
  let sent;
  const result = await ephemeralToken('test-key', async (url, options) => { sent = options; return { ok: true, json: async () => ({ value: 'short-token' }) }; });
  assert.equal(result.value, 'short-token'); assert.deepEqual(JSON.parse(sent.body), { expires_after: { seconds: 60 } });
  assert.equal(sent.headers.Authorization, 'Bearer test-key'); assert.equal(result.key, undefined);
});
