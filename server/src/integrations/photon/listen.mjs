import { resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { JsonStore, fixturePort } from '../demo-state.mjs';
import { validateGamePort } from '../game-port.mjs';
import { photonClient } from './client.mjs';
import { challengeAgent } from './challenge-agent.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const fixture = process.argv.includes('--fixture');
const adapter = process.env.D_GAME_ADAPTER;
if (!fixture && !adapter) throw new Error('Choose --fixture explicitly or set D_GAME_ADAPTER to B\'s server-only adapter module.');
const port = validateGamePort(fixture ? fixturePort(resolve(root, 'tmp/d-provider-demo/state.json'))
  : await (await import(pathToFileURL(resolve(adapter)).href)).createGamePort());
const identity = { sender: process.env.PHOTON_TEST_SENDER, agent: process.env.PHOTON_AGENT_HANDLE,
  playerId: process.env.PHOTON_PLAYER_ID ?? (fixture ? 'pilot-d' : undefined) };
if (!identity.sender || !identity.agent || !identity.playerId) throw new Error('Set Photon test identities and PHOTON_PLAYER_ID.');
const client = photonClient({ key: process.env.PHOTON_API_KEY, project: process.env.PHOTON_PROJECT_ID });
const journal = new JsonStore(resolve(root, 'tmp/d-provider-demo/photon-journal.json'), {});
const handle = challengeAgent({ port, photon: client, journal, identity });
// Replay a fixed startup window so transient send errors remain recoverable.
const createdSince = new Date(Date.now() - 5 * 60000).toISOString();
let running = true;
process.on('SIGINT', () => { running = false; });
process.on('SIGTERM', () => { running = false; });
console.log(fixture ? 'FIXTURE ONLY: DEMO-42 / DEMO-43. Text STATUS, ACCEPT or DECLINE plus ID.' : 'Connected to configured game adapter.');
while (running) {
  try {
    let pageToken;
    do {
      const page = await client.list({ createdSince, direction: 'received', platform: 'imessage', order: 'asc', pageSize: '100', ...(pageToken ? { pageToken } : {}) });
      if (!Array.isArray(page.items)) throw new Error('Unexpected Photon message list.');
      for (const message of page.items) {
        const result = await handle(message);
        if (result.accepted) console.log(JSON.stringify(result));
      }
      pageToken = page.nextPageToken;
    } while (running && pageToken);
  } catch (error) { console.error(error.message); }
  if (running) await new Promise(r => setTimeout(r, 2500));
}
