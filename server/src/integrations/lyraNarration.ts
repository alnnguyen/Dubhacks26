/** Fixed LYRA lines for arena setup / GO / result. Clients send only a cue id — never free text. */
export const LYRA_LINES = {
  setup_stand: 'Find your position. Face your laptop and hold still.',
  setup_phone: 'Link your saber. Scan the code, then ignite.',
  setup_upright: 'Hold your saber upright in front of you.',
  setup_right: 'Point your saber to your right. Keep it level.',
  setup_reach: 'Reach forward. Extend your saber toward the screen.',
  setup_done: 'All systems aligned. Stay ready, pilot.',
  fight_go: 'Fight! Swing true.',
  result_win: 'Good work, pilot. The field is yours.',
  result_lose: 'Better luck next time. Stay sharp.',
  result_draw: 'Evenly matched. Ready when you are.',
} as const;

export type LyraCue = keyof typeof LYRA_LINES;

export function isLyraCue(value: unknown): value is LyraCue {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(LYRA_LINES, value);
}

export type LyraNarrateFailure = {
  ok: false;
  reason: 'not_joined' | 'invalid_request' | 'unavailable' | 'rate_limited' | 'provider_error';
};
export type LyraNarrateReply =
  | LyraNarrateFailure
  | { ok: true; cue: LyraCue; contentType: 'audio/mpeg'; audioBase64: string };

export interface LyraNarrationOptions {
  key?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  voiceId?: string;
}

/** Server-only Grok TTS for allowlisted LYRA cues. Permanent key never leaves this module. */
export function createLyraNarration({
  key = process.env.XAI_API_KEY,
  fetchImpl = fetch,
  now = Date.now,
  voiceId = 'iris',
}: LyraNarrationOptions = {}) {
  const cache = new Map<LyraCue, Promise<{ contentType: 'audio/mpeg'; audioBase64: string }>>();
  const nextAt = new Map<string, number>();
  let pending = 0;

  return {
    async speak(actorId: string, cue: unknown): Promise<LyraNarrateReply> {
      if (!isLyraCue(cue)) return { ok: false, reason: 'invalid_request' };
      if (!key) return { ok: false, reason: 'unavailable' };
      const time = now();

      // Cache hits are free; rate-limit only new provider fetches so fight_go after setup_done still plays.
      if (!cache.has(cue)) {
        if (pending >= 3 || time < (nextAt.get(actorId) ?? 0)) return { ok: false, reason: 'rate_limited' };
        nextAt.set(actorId, time + 1200);
        if (nextAt.size > 512) for (const [id, until] of nextAt) if (until <= time) nextAt.delete(id);
        if (cache.size >= 24) cache.delete(cache.keys().next().value!);
        const text = LYRA_LINES[cue];
        const pendingClip = (async () => {
          const response = await fetchImpl('https://api.x.ai/v1/tts', {
            method: 'POST',
            signal: AbortSignal.timeout(20000),
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, voice_id: voiceId, language: 'en' }),
          });
          if (!response.ok) throw new Error(`tts ${response.status}`);
          const audio = Buffer.from(await response.arrayBuffer());
          if (audio.length < 400 || audio.length > 2_000_000) throw new Error('unexpected audio size');
          return { contentType: 'audio/mpeg' as const, audioBase64: audio.toString('base64') };
        })();
        cache.set(cue, pendingClip);
        pendingClip.catch(() => { if (cache.get(cue) === pendingClip) cache.delete(cue); });
      }

      pending++;
      try {
        const clip = await cache.get(cue)!;
        return { ok: true, cue, contentType: clip.contentType, audioBase64: clip.audioBase64 };
      } catch {
        return { ok: false, reason: 'provider_error' };
      } finally {
        pending--;
      }
    },
  };
}
