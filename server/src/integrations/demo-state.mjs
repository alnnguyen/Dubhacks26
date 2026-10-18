// Explicit fixture only. Replace this adapter with B's actual command service.
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';

export class JsonStore {
  constructor(path, initial) { this.path = path; this.initial = initial; this.tail = Promise.resolve(); }
  transact(fn) {
    const operation = this.tail.then(async () => {
      let data;
      try { data = JSON.parse(await readFile(this.path, 'utf8')); }
      catch (e) { if (e.code !== 'ENOENT') throw e; data = structuredClone(this.initial); }
      const result = await fn(data);
      await mkdir(dirname(this.path), { recursive: true });
      await writeFile(`${this.path}.tmp`, JSON.stringify(data, null, 2), { mode: 0o600 });
      await rename(`${this.path}.tmp`, this.path);
      return result;
    });
    this.tail = operation.catch(() => {});
    return operation;
  }
}

export function fixturePort(path) {
  const store = new JsonStore(path, {
    challenges: {
      'DEMO-42': { id: 'DEMO-42', challengerId: 'pilot-a', defenderId: 'pilot-d', status: 'pending', expiresAt: Date.now() + 86400000 },
      'DEMO-43': { id: 'DEMO-43', challengerId: 'pilot-a', defenderId: 'pilot-d', status: 'pending', expiresAt: Date.now() + 86400000 },
    }, world: 'mars', commands: {},
  });
  function challenge(data, actorId, id) {
    const c = data.challenges[id];
    if (!c || ![c.challengerId, c.defenderId].includes(actorId)) throw new Error('Challenge unavailable for this player.');
    return c;
  }
  return {
    fixture: true,
    getChallenge: ({ actorId, challengeId }) => store.transact(data => ({ ...challenge(data, actorId, challengeId), fixture: true })),
    respondChallenge: ({ actorId, challengeId, decision, commandId }) => store.transact(data => {
      const c = challenge(data, actorId, challengeId);
      if (actorId !== c.defenderId) throw new Error('Only the challenged player can respond.');
      if (!['accept', 'decline'].includes(decision) || !commandId) throw new Error('Invalid decision.');
      const signature = `${actorId}:${challengeId}:${decision}`;
      if (data.commands[commandId]) {
        if (data.commands[commandId].signature !== signature) throw new Error('Command ID reused with different arguments.');
        return data.commands[commandId].result;
      }
      if (c.expiresAt <= Date.now()) throw new Error('Challenge expired.');
      const desired = decision === 'accept' ? 'accepted' : 'declined';
      if (c.status !== 'pending' && c.status !== desired) throw new Error('Challenge already resolved.');
      c.status = desired;
      const result = { ...c, fixture: true };
      data.commands[commandId] = { signature, result };
      return result;
    }),
    getMatchState: ({ actorId }) => store.transact(data => {
      if (!['pilot-a', 'pilot-d'].includes(actorId)) throw new Error('Player unavailable.');
      const gravityMps2 = { earth: 9.8, mars: 3.7, moon: 1.6, neptune: 11.2 }[data.world];
      return { fixture: true, matchId: 'FIXTURE-MATCH', phase: 'briefing', world: data.world, gravityMps2,
        rockFlightSeconds: Number((0.8 * Math.sqrt(9.8 / gravityMps2)).toFixed(2)) };
    }),
    setDemoWorld: world => store.transact(data => {
      if (!['earth', 'mars', 'moon', 'neptune'].includes(world)) throw new Error('Unknown fixture world.');
      data.world = world;
    }),
  };
}
