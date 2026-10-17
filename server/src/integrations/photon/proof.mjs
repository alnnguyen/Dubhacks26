// Server-only Photon 2.0 proof. Node 22+; no SDK or game dependencies.
import { setTimeout as sleep } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

export function matchingPing(m, c, startedAt) {
  return m.platform === 'imessage' && m.status === 'received'
    && Date.parse(m.createdAt) >= startedAt
    && m.sentBy?.platform === 'imessage' && m.sentBy.kind === 'human'
    && m.sentBy.handle === c.sender
    && m.receivedBy?.platform === 'imessage' && m.receivedBy.kind === 'agent'
    && m.receivedBy.handle === c.agent && m.sentBy.id !== m.receivedBy.id
    && m.space?.platform === 'imessage' && m.space.kind === 'direct'
    && typeof m.id === 'string' && typeof m.space.id === 'string'
    && m.content?.type === 'text' && m.content.format === 'plain'
    && m.content.text.trim().toLowerCase() === 'ping';
}

export async function run() {
  const required = (name) => {
    if (!process.env[name]) throw new Error(`Missing ${name}`);
    return process.env[name];
  };
  const c = {
    key: required('PHOTON_API_KEY'), project: required('PHOTON_PROJECT_ID'),
    sender: required('PHOTON_TEST_SENDER'), agent: required('PHOTON_AGENT_HANDLE'),
  };
  if (!/^pho_prj_[a-z0-9]+$/.test(c.project) || !c.key.startsWith('pho_sk_')) {
    throw new Error('Expected Photon 2.0 project ID and project API key.');
  }
  const base = `https://api.photon.codes/v1/projects/${c.project}`;
  async function request(path, body, idempotency) {
    for (let attempt = 0; attempt < 3; attempt++) {
      let response;
      try {
        response = await fetch(base + path, {
          method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(12000),
          headers: {
            Authorization: `Bearer ${c.key}`,
            ...(body ? { 'Content-Type': 'application/json', 'Idempotency-Key': idempotency } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
      } catch {
        if (attempt < 2) { await sleep(1500); continue; }
        throw new Error('Photon network request failed or timed out (credentials omitted).');
      }
      if (response.ok) return response.status === 204 ? {} : response.json();
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        await sleep(2000); continue;
      }
      throw new Error(`Photon HTTP ${response.status}; inspect dashboard API logs. No response body logged.`);
    }
  }
  const startedAt = Date.now();
  const createdSince = new Date(startedAt - 5000).toISOString();
  console.log('READY: send a fresh plain PING from the configured test phone. Waiting up to 2 minutes.');
  while (Date.now() - startedAt < 120000) {
    let pageToken;
    do {
      const query = new URLSearchParams({ createdSince, direction: 'received', platform: 'imessage', order: 'asc', pageSize: '100' });
      if (pageToken) query.set('pageToken', pageToken);
      const page = await request(`/messages?${query}`);
      if (!Array.isArray(page.items)) throw new Error('Unexpected message-list response.');
      for (const message of page.items) {
        if (!matchingPing(message, c, startedAt)) continue;
        console.log(`INBOUND VERIFIED: ${message.id} at ${message.createdAt}`);
        const reply = await request('/messages', {
          spaceId: message.space.id, senderId: message.receivedBy.id,
          content: { type: 'text', format: 'plain', text: 'PONG — ship communications online. Photon 2.0 proof successful.' },
        }, `dubhacks-proof-direct:${message.id}`);
        console.log(`OUTBOUND ACCEPTED: ${reply.id ?? 'no message ID returned'}; status=${reply.status ?? 'unknown'}. Acceptance alone is not delivery.`);
        if (!reply.id) return;
        for (let i = 0; i < 15; i++) {
          const status = await request(`/messages/${encodeURIComponent(reply.id)}`);
          if (status.status === 'delivered') {
            console.log(`OUTBOUND DELIVERY VERIFIED: ${reply.id}`); return;
          }
          if (status.status === 'failed') throw new Error('Reply failed delivery. Inspect Photon dashboard.');
          await sleep(2000);
        }
        console.log('Delivery not confirmed by the API within 30 seconds. Check the phone; do not record delivery as verified yet.');
        return;
      }
      pageToken = page.nextPageToken;
    } while (pageToken && Date.now() - startedAt < 120000);
    await sleep(2000);
  }
  throw new Error('No matching fresh PING. Check sender identity, assigned line, and first-message onboarding.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
