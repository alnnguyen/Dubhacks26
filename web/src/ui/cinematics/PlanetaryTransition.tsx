import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlanetId, PlanetaryCinematicState } from './sequence';
import { advanceCinematicFrame, buildPlanetarySequence } from './sequence';
import type { PlanetarySound } from './PlanetarySound';
import './planetary-transition.css';
import { gameAudio } from '../../audio/gameAudio';
import { DESTINATIONS, preloadDestination, type DestinationId } from '../../destinations/config';
import { NeptuneArrival } from '../../arena/neptune/NeptuneArrival';
import { MarsArrival } from '../../arena/mars/MarsArrival';

const PLANET_NAMES: Record<PlanetId, string> = {
  mercury: 'Mercury',
  venus: 'Venus',
  earth: 'Earth',
  mars: 'Mars',
  jupiter: 'Jupiter',
  saturn: 'Saturn',
  uranus: 'Uranus',
  neptune: 'Neptune',
};

export function PlanetaryTransition({
  reducedMotion,
  destination = 'mars',
  sceneReady,
  frameTick,
  audio,
  audioEnabled,
  audioUnavailable,
  onEnableAudio,
  onStateChange,
  onComplete,
}: {
  destination?: DestinationId;
  reducedMotion: boolean;
  sceneReady: boolean;
  frameTick: React.RefObject<((delta: number) => void) | null>;
  audio: PlanetarySound;
  audioEnabled: boolean;
  audioUnavailable: boolean;
  onEnableAudio: () => void;
  onStateChange: (state: PlanetaryCinematicState) => void;
  onComplete: (destination: DestinationId) => void;
}) {
  const config=DESTINATIONS[destination];
  const [skipArrival,setSkipArrival]=useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const completeOnce = useRef(false);
  const travelSound = useRef({ jumped: false, arrived: false });
  const soundStops = useRef<Array<() => void>>([]);
  const arrivalStop = useRef<(() => void) | null>(null);
  const landedNaturally = useRef(false);
  useEffect(() => () => {
    soundStops.current.forEach((stop) => stop());
    if (!landedNaturally.current) arrivalStop.current?.();
    gameAudio.setEngine(false);
  }, []);
  const [state, setState] = useState<PlanetaryCinematicState>({ phase: 'idle', selectedPlanet: 'earth' });
  useEffect(() => {
    void preloadDestination(destination).catch(() => { /* Arena recovery handles failed terrain. */ });
  }, [destination]);

  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [backdropImage, setBackdropImage] = useState<string | null>(null);

  useEffect(() => {
    if (!sceneReady) return;
    const sequence = buildPlanetarySequence(reducedMotion,destination);
    let cursor = { index: 0, elapsedMs: 0 };
    const publish = () => {
      const next = sequence[cursor.index].state;
      setState(next);
      onStateChange(next);
    };
    publish();
    // Advance only when the cockpit renders, using the same capped time as its motion.
    frameTick.current = (delta) => {
      const previousIndex = cursor.index;
      cursor = advanceCinematicFrame(sequence, cursor.index, cursor.elapsedMs, delta);
      if (cursor.index !== previousIndex) publish();
    };
    return () => { frameTick.current = null; };
  }, [onStateChange, reducedMotion, sceneReady, frameTick,destination]);

  const complete = useCallback(() => {
    if (completeOnce.current) return;
    completeOnce.current = true;
    onComplete(destination);
  }, [onComplete,destination]);

  useEffect(() => {
    if (state.phase !== 'video' || videoError) return;
    const element = video.current;
    if (!element) return;

    let cancelled = false;
    const startPlayback = () => {
      if (cancelled) return;
      element.play().catch(() => {
        if (!cancelled) setVideoError(true);
      });
    };

    if (element.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) startPlayback();
    else element.addEventListener('canplay', startPlayback, { once: true });

    return () => {
      cancelled = true;
      element.removeEventListener('canplay', startPlayback);
    };
  }, [state.phase, videoError]);

  useEffect(() => {
    if (!audioEnabled) return;
    if (state.phase === 'roulette') audio.tick();
    else if (state.phase === 'locked') audio.lock();
    else if (state.phase === 'zooming') {
      audio.engine();
      soundStops.current.push(gameAudio.play('charge'));
    }
  }, [audio, audioEnabled, state.phase, state.selectedPlanet]);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const onVisibilityChange = () => {
      if (document.hidden) {
        element.pause();
      } else if (state.phase === 'video' && !videoError) {
        element.play().catch(() => setVideoError(true));
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [state.phase, videoError]);

  useEffect(() => {
    gameAudio.setEngine(videoPlaying && !travelSound.current.arrived);
    if (videoPlaying && !travelSound.current.jumped) {
      travelSound.current.jumped = true;
      soundStops.current.push(gameAudio.play('jump'));
    }
    return () => gameAudio.setEngine(false);
  }, [videoPlaying]);

  const locked = state.phase === 'locked' || state.phase === 'zooming' || state.phase === 'flash' || state.phase === 'video';
  const holdFlash = state.phase === 'video' && !videoPlaying && !videoError;
  const showFlash = state.phase === 'flash' || holdFlash || (state.phase === 'video' && videoPlaying);
  const captureBackdrop = () => {
    const element = video.current;
    if (!element || !element.videoWidth || !element.videoHeight) return;
    const canvas = document.createElement('canvas');
    canvas.width = 144;
    canvas.height = Math.round((144 * element.videoHeight) / element.videoWidth);
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(element, 0, 0, canvas.width, canvas.height);
    setBackdropImage(canvas.toDataURL('image/jpeg', 0.48));
  };

  return (
    <section
      className="planetary-transition"
      data-phase={state.phase}
      data-destination={destination}
      data-reduced-motion={reducedMotion}
      aria-label="Planetary travel sequence"
    >
      {destination==='neptune'&&<NeptuneArrival active={state.phase==='video'||skipArrival} skip={skipArrival} reducedMotion={reducedMotion} onComplete={complete} onPlaying={()=>setVideoPlaying(true)} onError={()=>setVideoError(true)}/>}
      {destination==='mars'&&<MarsArrival
        active={state.phase==='video'||skipArrival}
        skip={skipArrival}
        reducedMotion={reducedMotion}
        onComplete={() => { landedNaturally.current = !skipArrival; complete(); }}
        onPlaying={() => setVideoPlaying(true)}
        onError={() => setVideoError(true)}
        onArrive={() => {
          if (travelSound.current.arrived) return;
          travelSound.current.arrived = true;
          gameAudio.setEngine(false);
          arrivalStop.current = gameAudio.play('arrive');
        }}
      />}
      <div
        className="planetary-transition__backdrop"
        style={backdropImage ? { backgroundImage: `linear-gradient(rgba(3, 8, 13, 0.3), rgba(3, 8, 13, 0.3)), url("${backdropImage}")` } : undefined}
        aria-hidden="true"
      />
      <div className="planetary-transition__scrim" aria-hidden="true" />
      {showFlash && (
        <div
          className="planetary-transition__flash"
          data-hold={holdFlash}
          data-release={state.phase === 'video' && videoPlaying}
          aria-hidden="true"
        />
      )}

      {state.phase !== 'video' && (
        <div className="planetary-transition__heading" aria-live="polite">
          <p className="planetary-transition__eyebrow">
            {!sceneReady ? 'Loading navigation visuals…' : state.phase === 'activating' ? 'Navigation core online' : locked ? `Destination locked: ${config.displayName}` : 'Scanning destinations'}
          </p>
            <h1 key={`${state.phase}:${state.selectedPlanet}`}>{locked ? config.displayName.toUpperCase() : PLANET_NAMES[state.selectedPlanet].toUpperCase()}</h1>
          {locked ? (
            <p className="planetary-transition__details">{config.description}</p>
          ) : (
            <p className="planetary-transition__status">AUTONAV // {state.phase === 'roulette' ? 'ROUTE CALIBRATION' : 'SOLAR SYSTEM ACQUISITION'}</p>
          )}
        </div>
      )}

      <button
        type="button"
        className="planetary-transition__skip"
        onClick={()=>setSkipArrival(true)}
        aria-label={`Continue to the ${config.displayName} arena`}
      >
        {videoError ? `Continue to ${config.displayName} arena` : state.phase === 'video' ? 'Skip flight' : 'Skip cinematic'}
      </button>

      {!audioEnabled && state.phase !== 'video' && (
        <button type="button" className="planetary-transition__sound" onClick={onEnableAudio}>
          {audioUnavailable ? 'Sound unavailable' : 'Enable sound'}
        </button>
      )}

      {videoError && state.phase === 'video' && (
        <p className="planetary-transition__error" role="alert">
          The travel video could not play. Continue to the {config.displayName} arena when ready.
        </p>
      )}

      <p className="planetary-transition__next" aria-live="polite">
        {`${config.displayName.toUpperCase()} // ${state.phase==='video'?'APPROACH':'DESTINATION ROUTING'}`}
      </p>
      {audioUnavailable && state.phase !== 'video' && (
        <span className="planetary-transition__audio-status" role="status">
          Audio is blocked by this browser. Visual travel cues remain active.
        </span>
      )}
    </section>
  );
}
