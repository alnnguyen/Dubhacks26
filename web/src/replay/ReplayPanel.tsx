import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameClient } from '../networking';
import type { PlayerSlot, ReplayMoment, ReplayReply } from '../../../server/src/contracts';
import type { RecordedReplay } from './recorder';
import type { ArenaRecording } from './arenaRecording';
import type { Board } from '../arena3d/gridBoard';
import type { DestinationId } from '../destinations/config';
import { CinematicReplay } from './CinematicReplay';
import { BRAND_NAME } from '../ui/brand';
import './replay.css';

const ERRORS: Record<string, string> = {
  unavailable: 'Perceptron is not configured on this game server yet. Your recording remains local.',
  not_finished: 'The server requires your current finished match. Replays expire when you leave it.',
  not_joined: 'Reconnect to the game server before analyzing.',
  unauthorized: 'Replay access expired. Request analysis again while still on this result screen.',
  rate_limited: 'Replay analysis is busy or has reached its demo limit. Try later.',
  no_moments: 'Perceptron returned no usable action intervals. Watch the original recording below.',
  provider_error: 'Perceptron could not analyze this recording. No AI highlights were created. The provider may not accept this browser’s video format.',
  no_response: 'The replay request did not complete. Your local recording is still available.',
  offline: 'Reconnect before uploading your replay.',
  too_large: 'The replay exceeds the 8 MiB upload limit.',
};
const EMPTY_MOMENTS: ReplayMoment[] = [];

export function ReplayPanel({ client, matchId, clip, status, onDiscard, arena, board, mySlot, destination }: {
  client: GameClient; matchId: string; clip: RecordedReplay | null; status: string; onDiscard: () => void;
  arena?: ArenaRecording | null; board?: Board; mySlot?: PlayerSlot;
  /** The world the duel was fought on, so the cinematic replays the same environment. */
  destination?: DestinationId;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const abort = useRef<AbortController | null>(null);
  const [url, setUrl] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<ReplayReply | null>(null);
  const [index, setIndex] = useState(0);
  const [reel, setReel] = useState(false);
  const [time, setTime] = useState(0);
  const [playError, setPlayError] = useState('');
  const [webcamGap, setWebcamGap] = useState(false);
  const [cinematicPause, setCinematicPause] = useState(0);
  const syncWebcam = useCallback((seconds: number, rate: number, playing: boolean) => {
    const v = video.current;
    if (!v || !clip) return;
    if (playing) setReel(false);
    const gap = seconds > clip.duration;
    setWebcamGap(gap);
    if (gap) { v.pause(); return; }
    if (Math.abs(v.currentTime - seconds) > .16) v.currentTime = seconds;
    if (rate < .05 || !playing) v.pause();
    else { v.playbackRate = Math.max(.1, Math.min(2, rate)); if (v.paused) void v.play().catch(() => {}); }
  }, [clip]);
  const reduced = useRef(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (!clip) { setUrl(''); return; }
    const local = URL.createObjectURL(clip.video); setUrl(local);
    return () => URL.revokeObjectURL(local);
  }, [clip]);
  useEffect(() => () => { abort.current?.abort(); }, []);
  const result = reply?.ok ? reply : null;
  const moment = result?.moments[index];
  const box = reel ? result?.boxes.reduce<typeof result.boxes[number] | undefined>((closest, b) =>
    Math.abs(b.at - time) < Math.abs((closest?.at ?? Infinity) - time) ? b : closest, undefined) : undefined;
  const focused = box && Math.abs(box.at - time) <= 0.75 && !reduced.current ? box : null;
  const zoom = focused ? Math.min(1.55, Math.max(1, 0.8 / Math.max(focused.x2 - focused.x1, focused.y2 - focused.y1))) : 1;
  const cx = focused ? (focused.x1 + focused.x2) / 2 : 0.5;
  const cy = focused ? (focused.y1 + focused.y2) / 2 : 0.5;
  // Bound translation so framing never reveals empty edges.
  const tx = Math.max(-(zoom - 1) / 2, Math.min((zoom - 1) / 2, (0.5 - cx) * zoom));
  const ty = Math.max(-(zoom - 1) / 2, Math.min((zoom - 1) / 2, (0.5 - cy) * zoom));

  async function analyze() {
    if (!clip || !consent || busy) return;
    const controller = new AbortController(); abort.current = controller;
    setBusy(true); setReply(null);
    const response = await client.analyzeReplay(matchId, clip.video, clip.duration, controller.signal);
    if (!controller.signal.aborted) { setReply(response); setBusy(false); }
  }
  function playMoment(next: number) {
    const v = video.current, m = result?.moments[next];
    if (!v || !m) return;
    setCinematicPause(n => n + 1); setWebcamGap(false);
    setPlayError(''); setIndex(next); setReel(true);
    v.currentTime = m.start;
    v.playbackRate = reduced.current ? 1 : 0.65;
    void v.play().catch(() => { setReel(false); setPlayError('Press play in the video controls to start playback.'); });
  }
  function stopReel() { setReel(false); if (video.current) { video.current.pause(); video.current.playbackRate = 1; } }
  function tick() {
    const v = video.current;
    if (!v) return;
    setTime(v.currentTime);
    if (reel && moment && v.currentTime >= moment.end - 0.05) {
      if (index + 1 < (result?.moments.length ?? 0)) playMoment(index + 1);
      else stopReel();
    }
  }

  const panelStatus = busy
    ? 'Perceptron is selecting moments and framing the player…'
    : arena && board && mySlot
      ? (clip
        ? 'Press Play cinematic reel. The 3D arena is the director’s cut; the webcam below follows the same timeline.'
        : 'Press Play cinematic reel to watch the recorded arena. Webcam capture was not available for this duel.')
      : clip
        ? 'Your webcam clip is ready below. Download it or allow Perceptron upload for AI highlights.'
        : (status || 'Enable local replay recording during arena setup to save a clip.');

  return <section className="replay-panel" aria-label="Duel replay">
    <p className="flight-eyebrow">REPLAY / DIRECTOR</p>
    <h2>Your duel. The highlights.</h2>
    <p role="status">{panelStatus}</p>
    {arena && board && mySlot && <CinematicReplay recording={arena} moments={result?.moments ?? EMPTY_MOMENTS} board={board} mySlot={mySlot} destination={destination} onSync={syncWebcam} pauseSignal={cinematicPause} autoPlay={!reduced.current} />}
    {clip && url && <>
      {arena && <h3>Original webcam / model evidence</h3>}
      {webcamGap && <p className="flight-muted">Arena-only closing moment: the webcam capture ended before this part of the match. The finale comes from the server's recorded result.</p>}
      <div className={`replay-screen ${reel ? 'replay-screen--cinema' : ''}`}>
        <video ref={video} src={url} playsInline muted controls preload="auto" onTimeUpdate={tick} onEnded={stopReel}
          onError={() => setPlayError('This browser could not decode the local recording. Download it to inspect the file.')}
          style={{ transform: `translate(${tx * 100}%, ${ty * 100}%) scale(${zoom})` }} />
        {reel && moment && <div className="replay-caption" key={index}>
          <span>PERCEPTRON SELECTED / {String(index + 1).padStart(2, '0')}</span>
          <strong>{moment.caption}</strong>
          <small>{moment.start.toFixed(1)}–{moment.end.toFixed(1)}s · {focused ? 'AI framing' : 'Original framing'}</small>
        </div>}
      </div>
      {playError && <p role="alert">{playError}</p>}
      <div className="replay-actions">
        <a href={url} download={`duel-${matchId}.${clip.video.type.includes('mp4') ? 'mp4' : 'webm'}`}>Save original ({Math.round(clip.duration)}s)</a>
        <button disabled={busy} onClick={() => { stopReel(); onDiscard(); }}>Discard local recording</button>
      </div>
      {!result && <div className="replay-consent-row">
        <button type="button" className="replay-allow" aria-pressed={consent} disabled={busy} onClick={() => setConsent(v => !v)}>
          {consent ? 'Upload allowed' : 'Allow Perceptron upload'}
        </button>
        <p>Everyone visible agrees to send this silent webcam clip to Perceptron for highlight analysis.</p>
        <button className="flight-primary" disabled={!consent || busy} onClick={() => void analyze()}>{busy ? 'Directing your replay…' : 'Create AI highlights'}</button>
      </div>}
      {reply && !reply.ok && <p role="alert">{ERRORS[reply.reason] ?? `Replay unavailable (${reply.reason}).`}</p>}
      {result && <>
        <p className="replay-credit">Moments and captions: Perceptron · cuts and slow motion: {BRAND_NAME}.
          {result.framing === 'unavailable' ? ' AI framing unavailable; playing the original view.' : ' Camera crops follow Perceptron’s player boxes.'}</p>
        <div className="replay-actions"><button className="flight-primary" onClick={() => playMoment(0)}>Play highlight reel</button><button onClick={stopReel}>Stop highlights</button></div>
        <ol className="replay-moments">{result.moments.map((m, i) => <li key={`${m.start}-${i}`}>
          <button onClick={() => playMoment(i)} aria-pressed={reel && index === i}><span>{m.start.toFixed(1)}s</span>{m.caption}</button>
        </li>)}</ol>
        <details><summary>Analysis evidence</summary><p>{result.model} · {result.moments.length} moments · {result.boxes.length} framing waypoints</p>
          <p>Request IDs: {result.requestIds.join(', ') || 'Provider did not supply an ID'}</p></details>
      </>}
      <p className="flight-muted">Webcam observations do not change the server’s score. The original recording stays in this tab until you discard it or leave; analysis sends it to Perceptron. Highlights play here and are not an exported movie.</p>
    </>}
  </section>;
}
