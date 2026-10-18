// Server-owned narration: caller cannot supply arbitrary speech or a player ID.
export function briefingText(state) {
  const names = { earth: 'Earth', mars: 'Mars', moon: 'Moon', neptune: 'Neptune' };
  const name = names[state?.world];
  if (!name || !Number.isFinite(state.gravityMps2) || state.gravityMps2 <= 0 ||
      !Number.isFinite(state.rockFlightSeconds) || state.rockFlightSeconds <= 0) throw new Error('Briefing state unavailable.');
  const prefix = state.fixture ? 'Training arena' : 'Arena selected';
  return `${prefix}: ${name}. Gravity is ${state.gravityMps2} meters per second squared. Your rock defense window is ${state.rockFlightSeconds} seconds. ${state.world === 'earth' ? 'React quickly and time your block.' : state.gravityMps2 > 9.8 ? 'Higher gravity gives you less time to block than on Earth.' : 'Lower gravity gives you more time to block than on Earth.'} Prepare for the jump.`;
}

export function createBriefingService({ port, key, fetchImpl = fetch }) {
  const cache = new Map();
  return async ({ actorId, expectedWorld }) => {
    const state = await port.getMatchState({ actorId });
    if (expectedWorld !== undefined && state?.world !== expectedWorld) throw new Error('World changed. Reload the briefing.');
    const text = briefingText(state);
    if (!key) throw new Error('XAI_API_KEY is not configured on the server.');
    // Cache identical public narration only, never credentials or arbitrary model input.
    if (!cache.has(text)) {
      if (cache.size >= 12) cache.delete(cache.keys().next().value);
      const pending = (async () => {
        const response = await fetchImpl('https://api.x.ai/v1/tts', {
          method: 'POST', signal: AbortSignal.timeout(30000),
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice_id: 'eve', language: 'en' }),
        });
        if (!response.ok) throw new Error(`xAI briefing HTTP ${response.status}.`);
        const audio = Buffer.from(await response.arrayBuffer());
        if (audio.length < 1000 || audio.length > 4000000) throw new Error('Unexpected briefing audio size.');
        return { text, world: state.world, contentType: 'audio/mpeg', audioBase64: audio.toString('base64') };
      })();
      cache.set(text, pending);
      pending.catch(() => { if (cache.get(text) === pending) cache.delete(text); });
    }
    return cache.get(text);
  };
}
