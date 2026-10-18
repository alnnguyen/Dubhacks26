/** Fixed LYRA lines for arena setup / GO / result. Clients send only a cue id for combat. */
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

/** Explore thoughts use a length-capped line (server scripted facts), not an open chat prompt. */
export const LYRA_LINE_MAX = 320;

export function isLyraCue(value: unknown): value is LyraCue {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(LYRA_LINES, value);
}

/** Trim, clamp, and reject control characters. Empty / oversized after trim → null. */
export function sanitizeLyraLine(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim();
  if (!cleaned || cleaned.length > LYRA_LINE_MAX) return null;
  return cleaned;
}

export type LyraNarrateFailure = {
  ok: false;
  reason: 'not_joined' | 'invalid_request' | 'unavailable' | 'rate_limited' | 'provider_error';
};
export type LyraNarrateReply =
  | LyraNarrateFailure
  | { ok: true; cue: LyraCue | 'explore'; contentType: 'audio/mpeg'; audioBase64: string };

export interface LyraNarrationOptions {
  key?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  voiceId?: string;
}

type Clip = { contentType: 'audio/mpeg'; audioBase64: string };

function lineCacheKey(line: string): string {
  // Stable short key so identical explore facts reuse one clip.
  let hash = 2166136261;
  for (let i = 0; i < line.length; i++) {
    hash ^= line.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `line:${(hash >>> 0).toString(16)}:${line.length}`;
}

/** Server-only Grok TTS for allowlisted cues and short explore lines. Permanent key never leaves this module. */
export function createLyraNarration({
  key = process.env.XAI_API_KEY,
  fetchImpl = fetch,
  now = Date.now,
  voiceId = 'iris',
}: LyraNarrationOptions = {}) {
  const cache = new Map<string, Promise<Clip>>();
  const nextAt = new Map<string, number>();
  let pending = 0;

  async function synthesize(actorId: string, cacheKey: string, text: string): Promise<LyraNarrateReply & { ok: true } | LyraNarrateFailure> {
    if (!key) return { ok: false, reason: 'unavailable' };
    const time = now();

    // Cache hits are free; rate-limit only new provider fetches so fight_go after setup_done still plays.
    if (!cache.has(cacheKey)) {
      if (pending >= 3 || time < (nextAt.get(actorId) ?? 0)) return { ok: false, reason: 'rate_limited' };
      nextAt.set(actorId, time + 1200);
      if (nextAt.size > 512) for (const [id, until] of nextAt) if (until <= time) nextAt.delete(id);
      if (cache.size >= 48) cache.delete(cache.keys().next().value!);
      const pendingClip = (async (): Promise<Clip> => {
        const response = await fetchImpl('https://api.x.ai/v1/tts', {
          method: 'POST',
          signal: AbortSignal.timeout(20000),
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice_id: voiceId, language: 'en' }),
        });
        if (!response.ok) throw new Error(`tts ${response.status}`);
        const audio = Buffer.from(await response.arrayBuffer());
        if (audio.length < 400 || audio.length > 2_000_000) throw new Error('unexpected audio size');
        return { contentType: 'audio/mpeg', audioBase64: audio.toString('base64') };
      })();
      cache.set(cacheKey, pendingClip);
      pendingClip.catch(() => { if (cache.get(cacheKey) === pendingClip) cache.delete(cacheKey); });
    }

    pending++;
    try {
      const clip = await cache.get(cacheKey)!;
      return { ok: true, cue: cacheKey.startsWith('line:') ? 'explore' : cacheKey as LyraCue, contentType: clip.contentType, audioBase64: clip.audioBase64 };
    } catch {
      return { ok: false, reason: 'provider_error' };
    } finally {
      pending--;
    }
  }

  return {
    async speak(actorId: string, cue: unknown): Promise<LyraNarrateReply> {
      if (!isLyraCue(cue)) return { ok: false, reason: 'invalid_request' };
      const result = await synthesize(actorId, cue, LYRA_LINES[cue]);
      if (!result.ok) return result;
      return { ok: true, cue, contentType: result.contentType, audioBase64: result.audioBase64 };
    },

    /** Explore planet / arrive thoughts. Text is already chosen by the client from local NASA facts. */
    async speakLine(actorId: string, line: unknown): Promise<LyraNarrateReply> {
      const text = sanitizeLyraLine(line);
      if (!text) return { ok: false, reason: 'invalid_request' };
      return synthesize(actorId, lineCacheKey(text), text);
    },
  };
}
