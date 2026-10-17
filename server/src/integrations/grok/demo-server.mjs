// Local fixture harness only; B mounts these adapters behind actual game auth.
import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixturePort } from '../demo-state.mjs';
import { createBriefingService } from './briefing.mjs';
import { ephemeralToken, runVoiceTool, voiceSession } from './realtime.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const port = fixturePort(resolve(root, 'tmp/d-provider-demo/voice-state.json'));
const briefing = createBriefingService({ port, key: process.env.XAI_API_KEY });
const session = randomBytes(32).toString('hex');
const cookiesEqual = value => {
  const a = Buffer.from(value ?? ''), b = Buffer.from(session);
  return a.length === b.length && timingSafeEqual(a, b);
};
let lastTokenAt = 0;
const assets = new Map([
  ['/', ['demo.html', 'text/html']], ['/client.mjs', ['client.mjs', 'text/javascript']],
  ['/mic-worklet.mjs', ['mic-worklet.mjs', 'text/javascript']],
]);
async function jsonBody(req) {
  let text = '';
  for await (const chunk of req) { text += chunk; if (text.length > 8192) throw new Error('Body too large.'); }
  return JSON.parse(text || '{}');
}
const server = createServer(async (req, res) => {
  const host = `127.0.0.1:${server.address().port}`;
  const reply = (status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  };
  // Loopback-only and exact Host/Origin checks keep this credential endpoint local.
  if (req.headers.host !== host) return reply(403, { error: 'Use the printed loopback address.' });
  const path = new URL(req.url, `http://${host}`).pathname;
  try {
    if (req.method === 'GET' && assets.has(path)) {
      const [name, contentType] = assets.get(path);
      const body = await readFile(resolve(root, 'web/src/voice', name));
      res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store',
        'Set-Cookie': `d_voice_session=${session}; HttpOnly; SameSite=Strict; Path=/`,
        'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; connect-src 'self' wss://api.x.ai; script-src 'self'; style-src 'self' 'unsafe-inline'; media-src 'self' blob:; worker-src 'self'; frame-ancestors 'self'" });
      return res.end(body);
    }
    const cookie = req.headers.cookie?.split('; ').find(x => x.startsWith('d_voice_session='))?.split('=')[1];
    if (!cookiesEqual(cookie)) return reply(401, { error: 'Open the local demo page first.' });
    if (req.method !== 'POST' || req.headers.origin !== `http://${host}`) return reply(403, { error: 'Same-origin POST required.' });
    const body = await jsonBody(req);
    if (path === '/api/state') return reply(200, await port.getMatchState({ actorId: 'pilot-d' }));
    if (path === '/api/world') { await port.setDemoWorld(body.world); return reply(200, { fixture: true, updated: true }); }
    if (path === '/api/briefing') return reply(200, await briefing({ actorId: 'pilot-d', expectedWorld: body.world }));
    if (path === '/api/token') {
      if (Date.now() - lastTokenAt < 5000) return reply(429, { error: 'Wait five seconds between sessions.' });
      lastTokenAt = Date.now();
      return reply(200, { ...(await ephemeralToken(process.env.XAI_API_KEY)), session: voiceSession() });
    }
    if (path === '/api/tool') {
      const result = await runVoiceTool({ port, actorId: 'pilot-d', name: body.name, arguments: body.arguments });
      console.log(`VOICE TOOL: getMatchState → ${result.world} (FIXTURE)`);
      return reply(200, result);
    }
    reply(404, { error: 'Not found.' });
  } catch (error) {
    // Never log raw provider bodies or secrets.
    reply(400, { error: error.message });
  }
});
server.listen(Number(process.env.D_VOICE_PORT ?? 8787), '127.0.0.1', () => {
  console.log(`FIXTURE ONLY: http://127.0.0.1:${server.address().port}`);
  console.log(process.env.XAI_API_KEY ? 'Server key configured; click Connect to create a short-lived session.' : 'Server key missing: configure server/.env.grok.local before live voice.');
});
