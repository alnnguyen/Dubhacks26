import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLyraNarration, LYRA_LINES } from './lyraNarration.js';

test('missing key never calls the provider', async () => {
  const service = createLyraNarration({
    key: '',
    fetchImpl: (async () => { throw new Error('must not fetch'); }) as typeof fetch,
  });
  assert.deepEqual(await service.speak('pilot-a', 'fight_go'), { ok: false, reason: 'unavailable' });
});

test('unknown cue is rejected without a provider call', async () => {
  const service = createLyraNarration({
    key: 'test-key',
    fetchImpl: (async () => { throw new Error('must not fetch'); }) as typeof fetch,
  });
  assert.deepEqual(await service.speak('pilot-a', 'hack_me'), { ok: false, reason: 'invalid_request' });
  assert.deepEqual(await service.speak('pilot-a', { text: 'hi' }), { ok: false, reason: 'invalid_request' });
});

test('allowlisted cue returns cached mpeg audio', async () => {
  let calls = 0;
  const fakeMp3 = Buffer.alloc(1200, 1);
  const service = createLyraNarration({
    key: 'test-key',
    now: () => 10_000,
    fetchImpl: (async (_url, init) => {
      calls++;
      const body = JSON.parse(String(init?.body)) as { text: string; voice_id: string };
      assert.equal(body.text, LYRA_LINES.fight_go);
      assert.equal(body.voice_id, 'iris');
      return new Response(fakeMp3, { status: 200 });
    }) as typeof fetch,
  });
  const first = await service.speak('pilot-a', 'fight_go');
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.contentType, 'audio/mpeg');
  assert.equal(first.cue, 'fight_go');
  assert.equal(Buffer.from(first.audioBase64, 'base64').length, 1200);
  const second = await service.speak('pilot-b', 'fight_go');
  assert.equal(second.ok, true);
  assert.equal(calls, 1);
});

test('per-actor rate limit applies to new fetches; cache hits stay free', async () => {
  let now = 20_000;
  let calls = 0;
  const service = createLyraNarration({
    key: 'test-key',
    now: () => now,
    fetchImpl: (async () => { calls++; return new Response(Buffer.alloc(1200, 2)); }) as typeof fetch,
  });
  assert.equal((await service.speak('pilot-a', 'setup_stand')).ok, true);
  assert.deepEqual(await service.speak('pilot-a', 'setup_phone'), { ok: false, reason: 'rate_limited' });
  assert.equal((await service.speak('pilot-a', 'setup_stand')).ok, true);
  assert.equal(calls, 1);
  now += 1300;
  assert.equal((await service.speak('pilot-a', 'setup_phone')).ok, true);
  assert.equal(calls, 2);
});
