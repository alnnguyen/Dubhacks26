import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ArenaFrame, PlayerSlot, ReplayMoment } from '../../../server/src/contracts';
import { ArenaScene, type ArenaReplayPresentation, type ImpactFlash } from '../arena3d/ArenaScene';
import type { Board } from '../arena3d/gridBoard';
import type { DestinationId } from '../destinations/config';
import { finishingImpact, recordedFrameAt, type ArenaRecording } from './arenaRecording';
import { buildReel, cinematicCamera, impactAt, reelCursor, reelDuration, sampledImpactPosition, shotOffset, type CameraAngle } from './director';
import './replay.css';

const EMPTY: ReplayMoment[] = [];
class ReplayGraphicsBoundary extends Component<{ children: ReactNode; onBasic: () => void }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() { return this.state.error ? <div className="cinematic-error" role="alert"><p>Replay graphics could not load. The webcam recording is still available.</p><button onClick={this.props.onBasic}>Retry with simple graphics</button></div> : this.props.children; }
}

export function CinematicReplay({ recording, moments = EMPTY, board, mySlot, destination = 'mars', fixture = false, onSync, pauseSignal = 0, autoPlay = false }: {
  recording: ArenaRecording; moments?: ReplayMoment[]; board: Board; mySlot: PlayerSlot;
  destination?: DestinationId;
  fixture?: boolean;
  pauseSignal?: number;
  /** Start the reel once when the result screen mounts (skipped for reduce-motion). */
  autoPlay?: boolean;
  /** Source-video seconds share the local capture epoch. Never used to send commands. */
  onSync?: (seconds: number, rate: number, playing: boolean) => void;
}) {
  const [reduced, setReduced] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    media.addEventListener('change', update); return () => media.removeEventListener('change', update);
  }, []);
  const shots = useMemo(() => buildReel(recording, moments), [recording, moments]);
  const duration = useMemo(() => reelDuration(shots, reduced), [shots, reduced]);
  const transport = useRef({ elapsed: 0 });
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const autoStarted = useRef(false);
  useEffect(() => { setPlaying(false); }, [pauseSignal]);
  const [angle, setAngle] = useState<CameraAngle | undefined>();
  const angleRef = useRef(angle); angleRef.current = angle;
  const syncRef = useRef(onSync); syncRef.current = onSync;
  const flashRef = useRef<ImpactFlash | null>(null);
  const [simple, setSimple] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { transport.current.elapsed = 0; setElapsed(0); setPlaying(false); autoStarted.current = false; }, [shots, reduced]);
  useEffect(() => {
    if (!autoPlay || reduced || autoStarted.current || !shots.length || duration <= 0) return;
    autoStarted.current = true;
    setPlaying(true);
  }, [autoPlay, reduced, shots, duration]);
  const cursor = reelCursor(shots, elapsed, reduced);
  const selected = cursor ? shots[cursor.index] : null;
  const finish = finishingImpact(recording);
  const finalShot = shots.at(-1)?.finisher;
  const hasAI = shots.some(s => s.source === 'perceptron');

  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now(), lastUi = 0;
    const tick = (now: number) => {
      const delta = document.visibilityState === 'hidden' ? 0 : Math.min(.05, Math.max(0, (now - last) / 1000));
      last = now; transport.current.elapsed = Math.min(duration, transport.current.elapsed + delta);
      const current = reelCursor(shots, transport.current.elapsed, reduced);
      if (!current) return;
      syncRef.current?.(current.seconds, current.rate, !current.done);
      if (now - lastUi > 70 || current.done) { setElapsed(transport.current.elapsed); lastUi = now; }
      if (current.done) setPlaying(false); else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      const current = reelCursor(shots, transport.current.elapsed, reduced);
      if (current) syncRef.current?.(current.seconds, current.rate, false);
    };
  }, [playing, duration, shots, reduced]);

  const presentation = useMemo(() => {
    const current = () => reelCursor(shots, transport.current.elapsed, reduced);
    const getFrame = (): ArenaFrame | null => {
      const c = current();
      if (!c) return null;
      const event = !reduced ? impactAt(recording, c.seconds) : null;
      const at = event ? sampledImpactPosition(recording, event) : null;
      flashRef.current = event && at ? { kind: event.event.outcome, at, startedMs: event.at * 1000 } : null;
      return recordedFrameAt(recording, c.seconds);
    };
    const replay: ArenaReplayPresentation = {
      timeMs: () => (current()?.seconds ?? 0) * 1000,
      reducedMotion: reduced,
      camera: frame => {
        const c = current()!;
        return cinematicCamera(frame, shots[c.index], c, mySlot, reduced, angleRef.current);
      },
    };
    return { getFrame, replay };
  }, [recording, shots, reduced, mySlot]);

  function seek(time: number, play = false) {
    const next = Math.max(0, Math.min(duration, time));
    transport.current.elapsed = next; setElapsed(next); setPlaying(play);
    const c = reelCursor(shots, next, reduced); if (c) syncRef.current?.(c.seconds, c.rate, play);
  }
  function play() { seek(elapsed >= duration - .03 ? 0 : elapsed, true); }
  function pause() { setPlaying(false); setElapsed(transport.current.elapsed); }
  if (!shots.length) return <p className="flight-muted">No continuous arena motion is available for these selected moments. The original webcam replay remains available.</p>;
  const event = cursor ? impactAt(recording, cursor.seconds) : null;
  const impactLabel = event ? event.event.outcome === 'blocked' ? event.weapon && event.weapon !== 'saber' ? 'PROJECTILE BLOCK' : 'BLADE CLASH' : `HIT · −${event.event.damage} HP` : '';
  const finaleLanded = selected?.finisher && selected.impact && cursor && cursor.seconds >= selected.impact.at;

  return <section className="cinematic-replay" aria-label="Cinematic arena replay">
    <div className="cinematic-heading"><span>ARENA / DIRECTOR'S CUT</span><span>{fixture ? 'SYNTHETIC FIXTURE' : hasAI ? 'PERCEPTRON + GAME REPLAY' : 'SERVER HIGHLIGHTS'}</span></div>
    <p className="replay-credit">{hasAI ? 'Perceptron’s video moments select the scenes. ' : moments.length ? 'Only the confirmed finale could be retained alongside the selected model intervals. ' : 'These scenes use server events; run AI analysis below for Perceptron-selected scenes. '}
      Recorded arena motion supplies the angles. {finalShot ? 'The server-confirmed finishing blow is reserved for the finale.' : recording.result?.reason === 'forfeit' ? 'This match ended by forfeit; there is no knockout scene.' : 'A finishing hit was not captured; no knockout scene is invented.'}</p>
    <div className={`cinematic-stage ${finaleLanded ? 'cinematic-stage--finish' : ''}`}>
      <ReplayGraphicsBoundary key={`graphics-${attempt}`} onBasic={() => { setSimple(true); setAttempt(n => n + 1); }}>
        <ArenaScene {...presentation} flashRef={flashRef} mySlot={mySlot} board={board} destination={destination} basicGraphics={simple} />
      </ReplayGraphicsBoundary>
      <div className="cinematic-shot-label">{angle ?? selected?.angle} / {cursor?.hold ? 'IMPACT HOLD' : cursor && cursor.rate < .8 ? 'SLOW MOTION' : 'REPLAY'}</div>
      {cursor && <div className="cinematic-transition" key={`wipe-${cursor.index}-${angle ?? 'auto'}`} aria-hidden="true" />}
      <div className={`cinematic-title ${finaleLanded ? 'cinematic-title--finish' : ''}`} key={`title-${cursor?.index}`}>
        <span>{fixture ? 'SIMULATED / ' : ''}{selected?.finisher ? 'SERVER-CONFIRMED FINALE' : selected?.source === 'perceptron' ? 'PERCEPTRON SELECTED' : selected?.source === 'server' ? 'SERVER EVENT' : 'LOCAL RECORDING'} · {String((cursor?.index ?? 0) + 1).padStart(2, '0')}</span>
        <strong>{finaleLanded ? (finish?.weapon === 'gun' ? 'The finishing shot.' : finish?.weapon === 'rock' ? 'The finishing throw.' : finish?.event.attackerSlot === mySlot ? 'Your finishing blow.' : 'The final strike.') : selected?.caption}</strong>
        <small>{finaleLanded ? `KNOCKOUT · ${finish?.event.damage} HP · final highlight` : `${selected?.start.toFixed(1)}–${selected?.end.toFixed(1)}s in the recording`}</small>
      </div>
      {impactLabel && <div className="cinematic-impact" role="status">{fixture ? 'SIMULATED ' : 'SERVER '}{impactLabel}</div>}
    </div>
    <div className="cinematic-transport">
      <button className="flight-primary" onClick={playing ? pause : play}>{playing ? 'Pause cinematic replay' : elapsed >= duration - .03 ? 'Replay cinematic reel' : 'Play cinematic reel'}</button>
      <span>{elapsed.toFixed(1)} / {duration.toFixed(1)}s</span>
      <label className="cinematic-simple"><input type="checkbox" checked={simple} onChange={e => setSimple(e.target.checked)} /> Simple graphics</label>
    </div>
    <input className="cinematic-scrub" type="range" min={0} max={duration} step={.02} value={elapsed} aria-label="Cinematic replay position" onChange={e => { const value=Number(e.target.value); seek(value >= duration - .021 ? duration : value); }} />
    <div className="cinematic-angles" aria-label="Replay camera angles">
      <span>CAMERA</span>{([undefined, 'orbit', 'low', 'overhead'] as const).map(a => <button key={a ?? 'auto'} aria-pressed={angle === a} onClick={() => setAngle(a)}>{a ?? 'Auto director'}</button>)}
    </div>
    <ol className="replay-moments">{shots.map((s, i) => <li key={`${s.start}-${s.finisher}`}><button aria-pressed={cursor?.index === i} onClick={() => seek(shotOffset(shots, i, reduced), true)}>
      <span>{s.finisher ? 'FINALE' : `${s.start.toFixed(1)}s`}</span><span className="cinematic-card-caption">{s.caption}<small>{s.finisher ? 'Server knockout · always last' : s.source === 'perceptron' ? 'Perceptron video selection' : s.source === 'server' ? 'Server event selection' : 'Local recording'}</small></span>
    </button></li>)}</ol>
    <p className="flight-muted">{reduced ? 'Reduce motion: steady cameras, normal speed, no impact effects.' : 'Camera moves, sparks, slow motion and impact holds are rendered by the game.'} Timing follows local message arrival; webcam and arena alignment is approximate. This does not change the match result.</p>
  </section>;
}
