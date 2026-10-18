import { useCallback, useEffect, useRef, useState } from 'react';
import { createReplayRecorder, type RecordedReplay } from './recorder';
import { createArenaRecording, type ArenaRecording } from './arenaRecording';
import type { GameClient } from '../networking';

export function useReplay(matchId: string | undefined, client: GameClient, enabled: boolean, round = 1) {
  const [stored, setStored] = useState<{ matchId: string; clip: RecordedReplay } | null>(null);
  const [status, setStatus] = useState('');
  const [arena, setArena] = useState<ArenaRecording | null>(null);
  const motion = useRef<ReturnType<typeof createArenaRecording> | null>(null);
  const recorder = useRef<ReturnType<typeof createReplayRecorder> | null>(null);
  useEffect(() => {
    const capture = createArenaRecording(); motion.current = capture;
    const current = createReplayRecorder(clip => { if (matchId) setStored({ matchId, clip }); }, setStatus, at => capture.begin(at));
    recorder.current = current;
    setStored(null); setStatus(''); setArena(null);
    const offFrame = client.onArena(frame => { if (capture.frame(frame, performance.now())) setArena(capture.snapshot()); });
    const offImpact = client.onSaberResolved(event => capture.impact(event, performance.now()));
    const offView = client.onView(view => {
      if (view && view.matchId === matchId && view.phase === 'finished') { capture.finish(view, performance.now()); setArena(capture.snapshot()); }
    });
    return () => { offFrame(); offImpact(); offView(); capture.discard(); current.dispose(); if (recorder.current === current) recorder.current = null; };
  }, [matchId, client, round]);
  useEffect(() => { if (!enabled) motion.current?.pause(); }, [enabled]);
  const start = useCallback((video: HTMLVideoElement) => recorder.current?.start(video) ?? (() => {}), [matchId, round]);
  const discard = useCallback(() => { recorder.current?.dispose(); motion.current?.discard(); motion.current = null; setStored(null); setArena(null); setStatus('Replay discarded.'); }, []);
  return { clip: stored && stored.matchId === matchId ? stored.clip : null, arena, status, start, discard };
}
