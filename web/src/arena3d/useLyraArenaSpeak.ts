import { useEffect, useRef } from 'react';
import type { SetupStep } from '../../../server/src/contracts';
import type { GameClient } from '../networking/gameClient';
import { createLyraSpeaker, type LyraCue } from '../voice/lyraSpeak';

const SETUP_CUE: Record<SetupStep, LyraCue> = {
  stand: 'setup_stand',
  phone: 'setup_phone',
  upright: 'setup_upright',
  right: 'setup_right',
  reach: 'setup_reach',
  done: 'setup_done',
};

/** Speaks LYRA setup / fight-start / result lines through server Grok TTS. Silent if muted or Voice is unavailable. */
export function useLyraArenaSpeak(
  client: GameClient,
  opts: {
    step: SetupStep;
    fighting: boolean;
    finished: boolean;
    winner: 1 | 2 | null | undefined;
    mySlot: 1 | 2;
  },
) {
  const speaker = useRef<ReturnType<typeof createLyraSpeaker> | null>(null);
  useEffect(() => {
    speaker.current = createLyraSpeaker(client);
    return () => speaker.current?.stop();
  }, [client]);

  useEffect(() => {
    void speaker.current?.say(SETUP_CUE[opts.step]);
  }, [opts.step]);

  const wasFighting = useRef(false);
  useEffect(() => {
    if (opts.fighting && !wasFighting.current) void speaker.current?.say('fight_go');
    wasFighting.current = opts.fighting;
  }, [opts.fighting]);

  const saidResult = useRef<string | null>(null);
  useEffect(() => {
    if (!opts.finished) {
      saidResult.current = null;
      return;
    }
    const key = `${opts.winner ?? 'draw'}:${opts.mySlot}`;
    if (saidResult.current === key) return;
    saidResult.current = key;
    const cue: LyraCue =
      opts.winner == null ? 'result_draw'
        : opts.winner === opts.mySlot ? 'result_win'
          : 'result_lose';
    void speaker.current?.say(cue);
  }, [opts.finished, opts.winner, opts.mySlot]);
}
