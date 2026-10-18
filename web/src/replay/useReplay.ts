import { useCallback, useEffect, useRef, useState } from 'react';
import { createReplayRecorder, type RecordedReplay } from './recorder';

export function useReplay(matchId: string | undefined) {
  const [stored, setStored] = useState<{ matchId: string; clip: RecordedReplay } | null>(null);
  const [status, setStatus] = useState('');
  const recorder = useRef<ReturnType<typeof createReplayRecorder> | null>(null);
  useEffect(() => {
    const current = createReplayRecorder(clip => { if (matchId) setStored({ matchId, clip }); }, setStatus);
    recorder.current = current;
    setStored(null); setStatus('');
    return () => { current.dispose(); if (recorder.current === current) recorder.current = null; };
  }, [matchId]);
  const start = useCallback((video: HTMLVideoElement) => recorder.current?.start(video) ?? (() => {}), [matchId]);
  const discard = useCallback(() => { recorder.current?.dispose(); setStored(null); setStatus('Replay discarded.'); }, []);
  return { clip: stored && stored.matchId === matchId ? stored.clip : null, status, start, discard };
}
