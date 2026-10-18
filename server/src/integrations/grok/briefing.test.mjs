import { test } from 'node:test';
import assert from 'node:assert/strict';
import { briefingText, createBriefingService } from './briefing.mjs';
const mars = { fixture: true, world: 'mars', gravityMps2: 3.7, rockFlightSeconds: 1.3 };
test('narration uses selected state and labels training; invalid state fails closed', () => {
  assert.match(briefingText(mars), /Training arena: Mars.*3.7.*1.3/);
  assert.match(briefingText({ ...mars, world: 'moon', gravityMps2: 1.6, rockFlightSeconds: 1.98 }), /Moon.*1.6.*1.98/);
  assert.match(briefingText({ ...mars, world: 'neptune', gravityMps2: 11.2, rockFlightSeconds: 0.75 }), /Neptune.*11.2.*0.75.*Higher gravity/);
  assert.throws(() => briefingText({ ...mars, gravityMps2: NaN }));
  assert.throws(() => briefingText(null));
});
test('concurrent replays reuse speech; changed state generates a new briefing', async () => {
  let state = mars, calls = 0;
  const service = createBriefingService({ port: { getMatchState: async () => state }, key: 'test', fetchImpl: async () => { calls++; return { ok: true, arrayBuffer: async () => new Uint8Array(2000).buffer }; } });
  const [a,b] = await Promise.all([service({ actorId: 'pilot' }), service({ actorId: 'pilot' })]);
  assert.equal(calls, 1); assert.equal(a.audioBase64, b.audioBase64);
  state = { ...mars, world: 'moon', gravityMps2: 1.6, rockFlightSeconds: 1.98 };
  assert.match((await service({ actorId: 'pilot' })).text, /Moon/); assert.equal(calls, 2);
});
test('stale world does not call provider; failed generation can retry', async () => {
  let calls = 0;
  const service = createBriefingService({ port: { getMatchState: async () => mars }, key: 'test', fetchImpl: async () => { calls++; return calls === 1 ? { ok: false, status: 503 } : { ok: true, arrayBuffer: async () => new Uint8Array(2000).buffer }; } });
  await assert.rejects(service({ actorId: 'pilot', expectedWorld: 'moon' }), /World changed/); assert.equal(calls, 0);
  await assert.rejects(service({ actorId: 'pilot', expectedWorld: 'mars' }), /503/);
  await service({ actorId: 'pilot', expectedWorld: 'mars' }); assert.equal(calls, 2);
});
