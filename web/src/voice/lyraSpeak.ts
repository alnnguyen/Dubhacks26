import { gameAudio } from '../audio/gameAudio';
import type { GameClient } from '../networking/gameClient';
import type { LyraCue } from '../../../server/src/integrations/lyraNarration';

export type { LyraCue };

/** Keep in sync with server `LYRA_LINE_MAX` — do not import the server module (Node Buffer). */
const LYRA_LINE_MAX = 320;

/** Plays LYRA clips from server Grok TTS (arena cues or short explore lines). Stops the previous clip when a new one starts. */
export function createLyraSpeaker(client: GameClient) {
  let generation = 0;
  let audio: HTMLAudioElement | null = null;
  let objectUrl: string | null = null;
  let unduck: (() => void) | null = null;

  function silence() {
    generation++;
    audio?.pause();
    audio = null;
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    unduck?.();
    unduck = null;
  }

  async function playReply(reply: Awaited<ReturnType<GameClient['lyraNarrate']>>, turn: number) {
    if (turn !== generation || !reply.ok) return;
    await gameAudio.unlock();
    if (turn !== generation) return;
    if (audio) {
      audio.pause();
      audio = null;
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    unduck?.();
    const bytes = Uint8Array.from(atob(reply.audioBase64), (c) => c.charCodeAt(0));
    objectUrl = URL.createObjectURL(new Blob([bytes], { type: reply.contentType }));
    const next = new Audio(objectUrl);
    audio = next;
    unduck = gameAudio.duck();
    const finish = () => {
      if (turn !== generation) return;
      unduck?.();
      unduck = null;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
      if (audio === next) audio = null;
    };
    next.onended = finish;
    next.onerror = finish;
    try {
      await next.play();
    } catch {
      finish();
    }
  }

  async function say(cue: LyraCue) {
    const snap = gameAudio.getSnapshot();
    if (snap.settings.muted || snap.unavailable) return;
    const turn = ++generation;
    await playReply(await client.lyraNarrate(cue), turn);
  }

  /** Explore planet / arrive thoughts — same Iris TTS path as arena cues. */
  async function sayLine(text: string) {
    const snap = gameAudio.getSnapshot();
    if (snap.settings.muted || snap.unavailable) return;
    const line = text.replace(/\s+/g, ' ').trim().slice(0, LYRA_LINE_MAX);
    if (!line) return;
    const turn = ++generation;
    await playReply(await client.lyraSpeakLine(line), turn);
  }

  return { say, sayLine, stop: silence };
}
