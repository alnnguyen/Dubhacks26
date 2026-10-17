export function photonClient({ key, project, fetchImpl = fetch }) {
  if (!key?.startsWith('pho_sk_') || !/^pho_prj_[a-z0-9]+$/.test(project ?? '')) throw new Error('Photon 2.0 key/project missing.');
  const base = `https://api.photon.codes/v1/projects/${project}`;
  async function request(path, body, idempotencyKey) {
    for (let attempt = 0; attempt < 3; attempt++) {
      let response;
      try {
        response = await fetchImpl(base + path, {
          method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(12000),
          headers: { Authorization: `Bearer ${key}`, ...(body ? { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey } : {}) },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
      } catch {
        if (attempt < 2) { await new Promise(r => setTimeout(r, 1000)); continue; }
        throw new Error('Photon network request timed out/failed.');
      }
      if (response.ok) return response.json();
      if ((response.status >= 500 || response.status === 429) && attempt < 2) {
        await new Promise(r => setTimeout(r, 2000)); continue;
      }
      throw new Error(`Photon HTTP ${response.status}; inspect dashboard logs (response body omitted).`);
    }
  }
  return {
    list: query => request(`/messages?${new URLSearchParams(query)}`),
    send: (message, text) => request('/messages', {
      spaceId: message.space.id, senderId: message.receivedBy.id,
      content: { type: 'text', format: 'plain', text },
    }, `duel-command-v1:${message.id}`),
  };
}
