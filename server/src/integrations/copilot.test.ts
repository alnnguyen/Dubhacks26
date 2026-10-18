import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCopilotService } from './copilot.js';

test('missing provider key never makes an external request', async () => {
  const service = createCopilotService({key: '', fetchImpl: (async () => { throw new Error('must not fetch'); }) as typeof fetch});
  assert.deepEqual(await service.open('pilot-a'), {ok: false, reason: 'unavailable'});
});

test('only an ephemeral credential is returned; repeat minting is limited', async () => {
  let calls = 0;
  const permanent = 'test-permanent-server-key';
  const service = createCopilotService({key: permanent, now: () => 10000, fetchImpl: (async (_url, init) => {
    calls++;
    assert.equal(new Headers(init?.headers).get('Authorization'), `Bearer ${permanent}`);
    return new Response(JSON.stringify({value: 'short-lived-test-secret', expires_at: 12345}));
  }) as typeof fetch});
  const reply = await service.open('pilot-a');
  assert.equal(reply.ok, true);
  assert.equal(JSON.stringify(reply).includes(permanent), false);
  if (reply.ok) assert.equal(reply.clientSecret, 'short-lived-test-secret');
  assert.deepEqual(await service.open('pilot-a'), {ok: false, reason: 'rate_limited'});
  assert.equal(calls, 1);
});

test('upstream failures never return raw provider bodies or credentials', async () => {
  const service = createCopilotService({key: 'server-key', fetchImpl: (async () => new Response('sensitive provider body', {status: 403})) as typeof fetch});
  assert.deepEqual(await service.open('pilot-a'), {ok: false, reason: 'provider_error'});
});

test('global token budget cannot be bypassed by repeatedly joining as a new player', async () => {
  const service = createCopilotService({key: 'test-key', now: () => 10000, fetchImpl: (async () => new Response(JSON.stringify({value: 'temporary'}))) as typeof fetch});
  for (let i = 0; i < 20; i++) assert.equal((await service.open(`pilot-${i}`)).ok, true);
  assert.deepEqual(await service.open('new-player-21'), {ok: false, reason: 'rate_limited'});
});
