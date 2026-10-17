import { useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { BakeShadows, Environment, Lightformer } from '@react-three/drei';
import { Cockpit } from './Cockpit';
import { SpaceEnvironment } from './SpaceEnvironment';
import { HolographicConsole } from './HolographicConsole';
import { CommanderDisplay } from './CommanderDisplay';
import { ConsoleHotspot } from './ConsoleHotspot';
import { CameraController } from './CameraController';
import { AnchorProjector, type AnchorRegistry } from './anchors';
import { CAMERA_POSES } from './cockpitLayout';
import type { ConnectionStatus, LobbyView, NearbyPilot, SceneSettings } from '../../state/lobbyTypes';

export interface SpaceshipSceneProps {
  settings: SceneSettings;
  view: LobbyView;
  /** Visual state driven by the challenge flow. */
  mood: 'calm' | 'alert' | 'ready' | 'launch';
  pilots: NearbyPilot[];
  selectedId: string | null;
  callsign: string;
  connection: ConnectionStatus;
  anchors: AnchorRegistry;
  /** Optional authored cockpit model (GLB/GLTF) to replace the procedural one. */
  cockpitModelUrl?: string;
  onNavigate: (view: LobbyView) => void;
  onSelectPilot: (id: string) => void;
  onLowPerformance?: () => void;
  onReady?: () => void;
}

/**
 * Image-based lighting built from Lightformers that mirror the cockpit's real
 * light sources (window/planet, ceiling strips, hologram, warm console glow).
 * frames={1}: the cube map renders once, so it costs nothing per frame.
 */
function CockpitEnvironment({ high }: { high: boolean }) {
  return (
    <Environment frames={1} resolution={high ? 256 : 128} environmentIntensity={0.7}>
      <color attach="background" args={['#05080d']} />
      <Lightformer form="rect" intensity={2.2} color="#a9c9ff" position={[0, 1.8, -4]} scale={[4.5, 1.8, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#7fb0ff" position={[-3, 1.7, -2]} rotation={[0, Math.PI / 2.6, 0]} scale={[2, 1.4, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#7fb0ff" position={[3, 1.7, -2]} rotation={[0, -Math.PI / 2.6, 0]} scale={[2, 1.4, 1]} />
      {[-1.9, 1.9].map((x) => (
        <Lightformer key={x} form="rect" intensity={4} color="#eef6ff" position={[x, 2.5, -0.4]} rotation={[Math.PI / 2, 0, 0]} scale={[0.18, 3.6, 1]} />
      ))}
      <Lightformer form="circle" intensity={2.5} color="#5fd8ff" position={[0, 1.74, -2.3]} scale={0.7} />
      <Lightformer form="rect" intensity={0.8} color="#ff8a3d" position={[0, 0.3, 0.6]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.2, 1.2, 1]} />
      <Lightformer form="rect" intensity={0.25} color="#8aa0b8" position={[0, 1.4, 3.5]} rotation={[0, Math.PI, 0]} scale={[5, 3, 1]} />
    </Environment>
  );
}

/** Drops to low quality once if the device can't hold ~35 fps. */
function PerfGuard({ onLow }: { onLow?: () => void }) {
  const acc = useRef({ t: 0, frames: 0, warm: 0, fired: false });
  useFrame((_, dt) => {
    const a = acc.current;
    if (a.fired || !onLow) return;
    a.warm += dt;
    if (a.warm < 4) return;
    a.t += dt;
    a.frames++;
    if (a.t >= 2.5) {
      if (a.frames / a.t < 35) {
        a.fired = true;
        onLow();
      }
      a.t = 0;
      a.frames = 0;
    }
  });
  return null;
}

function FirstFrame({ onReady }: { onReady?: () => void }) {
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    requestAnimationFrame(() => onReady?.());
  });
  return null;
}

function Lights({ mood, high }: { mood: SpaceshipSceneProps['mood']; high: boolean }) {
  const warm = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (!warm.current) return;
    const base = mood === 'alert' ? 1.6 + Math.sin(clock.elapsedTime * 5) * 0.9 : 0.55;
    warm.current.intensity = base;
  });
  return (
    <>
      <hemisphereLight args={['#5d7a99', '#0b0d10', 0.35]} />
      {/* Overhead key light: the only shadow caster. Shadows are baked once (BakeShadows). */}
      <spotLight
        position={[0, 2.62, 0.4]}
        angle={1.0}
        penumbra={0.9}
        intensity={9}
        distance={6}
        decay={2}
        color="#dbe9ff"
        castShadow
        shadow-mapSize={high ? [1024, 1024] : [512, 512]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={4}
      >
        <object3D attach="target" position={[0, 0, -1.4]} />
      </spotLight>
      {/* Planet-shine through the windows */}
      <directionalLight position={[1.5, 5, -6]} intensity={1.6} color="#cfe3ff" />
      {/* Ceiling strips */}
      <pointLight position={[-1.5, 2.2, -0.9]} intensity={1.4} distance={4} decay={2} color="#dfefff" />
      <pointLight position={[1.5, 2.2, -0.9]} intensity={1.4} distance={4} decay={2} color="#dfefff" />
      {/* Subtle orange accent at the console base */}
      <pointLight ref={warm} position={[0, 0.7, -0.1]} intensity={0.55} distance={2.6} decay={2} color="#ff8a3d" />
    </>
  );
}

export function SpaceshipScene(props: SpaceshipSceneProps) {
  const { settings, view, mood, anchors } = props;
  const high = settings.quality === 'high';
  const pose = mood === 'launch' ? CAMERA_POSES.launch : CAMERA_POSES[view];
  const dpr: [number, number] = high ? [1, Math.min(window.devicePixelRatio || 1, 1.75)] : [1, 1.25];
  const screenFps = settings.reducedMotion ? 1 : high ? 6 : 2;

  return (
    <Canvas
      key={settings.quality}
      shadows={high ? 'soft' : 'percentage'}
      className="sd-canvas"
      dpr={dpr}
      gl={{ antialias: !high, powerPreference: 'high-performance', alpha: false, stencil: false }}
      camera={{ fov: 70, near: 0.05, far: 3200, position: CAMERA_POSES.lobby.position }}
      onCreated={({ gl }) => {
        gl.setClearColor('#010205');
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
      onPointerMissed={() => document.body.style.removeProperty('cursor')}
      aria-hidden
    >
      <CockpitEnvironment high={high} />
      <Lights mood={mood} high={high} />
      <BakeShadows />
      <CameraController pose={pose} reducedMotion={settings.reducedMotion} parallax={settings.parallax} panelOpen={view !== 'lobby' && view !== 'console' && mood !== 'launch'} />
      <SpaceEnvironment quality={settings.quality} warp={mood === 'launch' ? 1 : 0} />
      <Cockpit
        modelUrl={props.cockpitModelUrl}
        quality={settings.quality}
        alert={mood === 'alert'}
        reducedMotion={settings.reducedMotion}
        contacts={props.pilots.length}
      />
      <CommanderDisplay
        callsign={props.callsign}
        connection={props.connection}
        alert={mood === 'alert'}
        fps={screenFps}
        onActivate={() => props.onNavigate('profile')}
      />
      <HolographicConsole
        pilots={props.pilots}
        selectedId={props.selectedId}
        interactive={view === 'lobby' ? 'globe' : view === 'radar' ? 'blips' : 'none'}
        alert={mood === 'alert'}
        boost={mood === 'ready' || mood === 'launch' || view === 'radar'}
        reducedMotion={settings.reducedMotion}
        quality={settings.quality}
        anchors={anchors}
        onActivate={() => props.onNavigate('radar')}
        onSelect={props.onSelectPilot}
      />
      <ConsoleHotspot interactive={view === 'lobby' && mood !== 'launch'} onActivate={() => props.onNavigate('console')} />
      <AnchorProjector registry={anchors} />
      <PerfGuard onLow={high ? props.onLowPerformance : undefined} />
      <FirstFrame onReady={props.onReady} />
      {high && (
        <EffectComposer multisampling={0} enableNormalPass={false}>
          {/* Threshold above 1: only HDR emissives (holograms, indicator lights, strips) bloom. */}
          <Bloom mipmapBlur intensity={0.55} luminanceThreshold={1.0} luminanceSmoothing={0.25} radius={0.6} levels={6} />
          <Vignette offset={0.28} darkness={0.62} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
