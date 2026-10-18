import { gameAudio } from '../audio/gameAudio';
import type { GameClient } from '../networking/gameClient';
import type { LyraCue } from '../../../server/src/integrations/lyraNarration';

export type { LyraCue };

/** Plays allowlisted LYRA lines from server Grok TTS. Stops the previous clip when a new cue starts. */
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

  async function say(cue: LyraCue) {
    const snap = gameAudio.getSnapshot();
    if (snap.settings.muted || snap.unavailable) return;
    const turn = ++generation;
    const reply = await client.lyraNarrate(cue);
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

  return { say, stop: silence };
}
