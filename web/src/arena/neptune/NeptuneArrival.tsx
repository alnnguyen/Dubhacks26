import { Suspense, useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CloudPuffs, NeptuneEnvironment, arrivalVeil, type PuffSpec } from './NeptuneEnvironment';
import { render } from './neptuneConfig';
import { DESTINATIONS } from '../../destinations/config';
import { NeptuneDust } from './NeptuneDust';
import './neptune.css';

/** The video fades out over its final 0.55 s, uncovering the matched cockpit and cloud layers. */
export const NEPTUNE_HANDOFF_SECONDS = 0.55;
const SKIP_FADE_SECONDS = 0.3;
const REVEAL_SECONDS = 4.6;
const REDUCED_REVEAL_SECONDS = 1.2;

/**
 * Where the reveal ends: the same over-the-shoulder pose ArenaScene's
 * ShoulderCamera computes for slot 1 at the server's spawn (35° pitch, 3.8 m back).
 */
export const NEPTUNE_COMBAT_CAMERA = {
  position: new THREE.Vector3(0.45, 3.48, 3.76),
  target: new THREE.Vector3(0, 1.3, 0.65),
};
const START = new THREE.Vector3(0, 24, 74);
const START_TARGET = new THREE.Vector3(0, 6, 0);
/** Continues the cinematic's forward, descending flight, then settles behind the fighter. */
const PATH = new THREE.CatmullRomCurve3([START, new THREE.Vector3(3, 14, 38), new THREE.Vector3(2, 6.5, 13), NEPTUNE_COMBAT_CAMERA.position], false, 'centripetal');

/** Clouds the camera flies through on its way out of the storm; behind the final view. */
const FLIGHT_PUFFS: PuffSpec[] = Array.from({ length: 40 }, (_, i) => {
  const point = PATH.getPointAt(0.04 + 0.58 * (i / 40));
  const side = i % 2 ? 1 : -1;
  return {
    position: [point.x + side * (4 + (i % 5) * 3), point.y - 3 + (i % 4) * 2.2, point.z - (i % 3) * 3],
    size: [16 + (i % 4) * 6, 10 + (i % 3) * 4],
  };
});

const ease = THREE.MathUtils.smoothstep;
const ARRIVAL_FOG = new THREE.Color(render.arrivalFog.mid);
const ARENA_FOG = new THREE.Color(render.fog.color);

function Reveal({ video, veil, cockpit, active, skip, reduced, onReady, onComplete }: {
  video: RefObject<HTMLVideoElement | null>;
  veil: RefObject<HTMLDivElement | null>;
  cockpit: RefObject<HTMLImageElement | null>;
  active: boolean;
  skip: boolean;
  reduced: boolean;
  onReady: () => void;
  onComplete: () => void;
}) {
  const { gl, scene, camera } = useThree();
  const ready = useRef(false);
  const skipFade = useRef(0);
  const revealAt = useRef<number | null>(null);
  const done = useRef(false);
  const target = useRef(START_TARGET.clone());

  // Start inside the cloud: dense scene fog, every shader at the arrival color.
  useEffect(() => {
    arrivalVeil.value = 1;
    const fog = scene.fog as THREE.Fog | null;
    if (fog) { fog.near = 0; fog.far = 2; fog.color.copy(ARRIVAL_FOG); }
    camera.position.copy(START);
    camera.lookAt(START_TARGET);
    let alive = true;
    // Compile every program behind the video so the handoff never stalls on shaders.
    // A driver that never reports completion must not strand the player in the cloud.
    const finish = () => { if (alive && !ready.current) { ready.current = true; onReady(); } };
    const fallback = window.setTimeout(finish, 2500);
    gl.compileAsync(scene, camera).then(finish, finish);
    return () => { alive = false; window.clearTimeout(fallback); };
  }, [gl, scene, camera, onReady]);

  useFrame((_, rawDelta) => {
    const el = video.current;
    if (!active || !el) return;
    const dt = Math.min(rawDelta, 0.05);
    if (!ready.current) { el.style.opacity = '1'; return; }

    let fade: number;
    if (skip || el.error) {
      skipFade.current = Math.min(1, skipFade.current + dt / SKIP_FADE_SECONDS);
      fade = skipFade.current;
    } else if (el.ended) {
      fade = 1;
    } else {
      const remaining = el.duration - el.currentTime;
      fade = Number.isFinite(remaining) ? THREE.MathUtils.clamp(1 - remaining / NEPTUNE_HANDOFF_SECONDS, 0, 1) : 0;
    }
    el.style.opacity = String(1 - fade);
    if (fade < 1) return;

    if (revealAt.current === null) revealAt.current = 0;
    const t = (revealAt.current += dt);
    const length = reduced ? REDUCED_REVEAL_SECONDS : REVEAL_SECONDS;
    const s = reduced ? length / REVEAL_SECONDS : 1;

    // The cockpit drifts past and dissolves as the ship pushes through the cloud.
    if (cockpit.current) {
      cockpit.current.style.opacity = String(1 - ease(t, 0.1 * s, 1.0 * s));
      cockpit.current.style.transform = reduced ? '' : `scale(${1 + 0.12 * ease(t, 0, 1.3)})`;
    }
    if (veil.current) veil.current.style.opacity = String(1 - ease(t, 0.3 * s, 1.8 * s));
    arrivalVeil.value = 1 - ease(t, 0.5 * s, 2.9 * s);
    const fog = scene.fog as THREE.Fog | null;
    if (fog) {
      const k = ease(t, 0.4 * s, 3.6 * s);
      fog.near = render.fog.near * k * k;
      fog.far = 2 + (render.fog.far - 2) * k * k * k;
      fog.color.lerpColors(ARRIVAL_FOG, ARENA_FOG, k);
    }

    const u = reduced ? 1 : THREE.MathUtils.smootherstep(t / length, 0, 1);
    camera.position.copy(PATH.getPointAt(u));
    target.current.copy(START_TARGET).lerp(NEPTUNE_COMBAT_CAMERA.target, u);
    camera.lookAt(target.current);

    if (t >= length && !done.current) {
      done.current = true;
      onComplete();
    }
  });
  return null;
}

/**
 * Neptune arrival: the cinematic plays over a live canvas that is already
 * compiled and parked inside matching cloud. The video fades to a cutout of
 * its own final cockpit frame and a gradient sampled from that frame, so the
 * swap is invisible; then the camera flies out of the cloud to the platform.
 */
export function NeptuneArrival({ active, skip = false, reducedMotion = false, onComplete, onPlaying, onError }: {
  active: boolean;
  skip?: boolean;
  reducedMotion?: boolean;
  onComplete: () => void;
  onPlaying?: () => void;
  onError?: () => void;
}) {
  const errorRef = useRef(onError);
  errorRef.current = onError;
  const video = useRef<HTMLVideoElement>(null);
  const veil = useRef<HTMLDivElement>(null);
  const cockpit = useRef<HTMLImageElement>(null);
  const [ready, setReady] = useState(false);
  const [ended, setEnded] = useState(false);
  const markReady = useCallback(() => setReady(true), []);

  useEffect(() => {
    const el = video.current;
    if (!el || !active) return;
    if (skip) { el.pause(); return; }
    let disposed = false;
    void el.play().catch(() => { if (!disposed) errorRef.current?.(); });
    const visibility = () => {
      if (document.hidden) el.pause();
      else if (!el.ended) void el.play().catch(() => errorRef.current?.());
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', visibility);
      el.pause();
    };
  }, [active, skip]);

  return (
    <div className="neptune-arrival" data-active={active}>
      <div className="neptune-arrival__frame">
        <Canvas
          shadows
          dpr={[1, 1.5]}
          frameloop={active ? 'always' : 'demand'}
          camera={{ position: START.toArray(), fov: 50, near: 0.05, far: 5000 }}
          gl={{ antialias: true }}
        >
          <Suspense fallback={null}>
            <NeptuneEnvironment reducedMotion={reducedMotion} />
            <CloudPuffs puffs={FLIGHT_PUFFS} opacity={0.9} near={3} />
            <NeptuneDust active={active} />
            <Reveal video={video} veil={veil} cockpit={cockpit} active={active} skip={skip} reduced={reducedMotion} onReady={markReady} onComplete={onComplete} />
          </Suspense>
        </Canvas>
        <div ref={veil} className="neptune-arrival__veil" aria-hidden />
        <img ref={cockpit} className="neptune-arrival__cockpit" src="/assets/neptune/cockpit-final.png" alt="" aria-hidden />
        <video
          ref={video}
          src={DESTINATIONS.neptune.cinematicPath}
          poster="/assets/neptune/poster.jpg"
          muted
          playsInline
          preload="auto"
          onEnded={() => setEnded(true)}
          onPlaying={onPlaying}
          onError={onError}
          aria-label="Spaceship descent into Neptune's clouds"
        />
      </div>
      {active && (ended || skip) && !ready && <p className="neptune-arrival__loading" role="status">Preparing the station…</p>}
    </div>
  );
}
