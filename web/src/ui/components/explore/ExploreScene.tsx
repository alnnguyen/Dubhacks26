import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { BakeShadows, Environment, Lightformer } from '@react-three/drei';
import { Cockpit } from '../spaceship/Cockpit';
import { CAMERA_POSES } from '../spaceship/cockpitLayout';
import type { GraphicsQuality, SceneSettings } from '../../state/lobbyTypes';
import type { ExploreDestination } from './destinations';
import { ExploreUniverse } from './SolarSystem';
import { LocalUniverseScene } from './LocalUniverseScene';
import { planetFacts } from './bodiesScience';
import type { NearbyPilot } from '../../state/lobbyTypes';
import { LocalFlightController } from './LocalFlightController';
import { LocalNavigation, isLocalDestination, type LocalZoomRequest } from './localNavigation';
import { DriveConsole } from './DriveConsole';
import { ShipFlightController, type FlightChrome, type FlightInput, type FlightTelemetry } from './ShipFlightController';
import { PlanetCutaway } from './PlanetCutaway';

function CockpitEnvironment({ high, drive }: { high: boolean; drive: boolean }) {
  return (
    <Environment frames={1} resolution={high ? 256 : 128} environmentIntensity={drive ? 0.28 : 0.65}>
      {!drive && <color attach="background" args={['#05080d']} />}
      {!drive && (
        <>
          <Lightformer form="rect" intensity={2.0} color="#a9c9ff" position={[0, 1.8, -4]} scale={[4.5, 1.8, 1]} />
          <Lightformer form="rect" intensity={1.0} color="#7fb0ff" position={[-3, 1.7, -2]} rotation={[0, Math.PI / 2.6, 0]} scale={[2, 1.4, 1]} />
          <Lightformer form="rect" intensity={1.0} color="#7fb0ff" position={[3, 1.7, -2]} rotation={[0, -Math.PI / 2.6, 0]} scale={[2, 1.4, 1]} />
        </>
      )}
      {drive && (
        <>
          <Lightformer form="rect" intensity={0.7} color="#8ab4ff" position={[0, 0.2, 2]} scale={[3, 1.2, 1]} />
          <Lightformer form="circle" intensity={1.1} color="#5fe1ff" position={[0, -0.1, -1]} scale={0.4} />
        </>
      )}
    </Environment>
  );
}

function PerfGuard({ onLow }: { onLow?: () => void }) {
  const acc = useRef({ t: 0, frames: 0, warm: 0, fired: false });
  useFrame((_, dt) => {
    const a = acc.current;
    if (a.fired || !onLow) return;
    a.warm += dt;
    if (a.warm < 5) return;
    a.t += dt;
    a.frames++;
    if (a.t >= 2.5) {
      if (a.frames / a.t < 28) {
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

function Lights({ high, drive }: { high: boolean; drive: boolean }) {
  if (drive) {
    return (
      <>
        <hemisphereLight args={['#6a84a8', '#03060a', 0.4]} />
        <directionalLight position={[2, 3, 1]} intensity={0.3} color="#cfe3ff" />
        <pointLight position={[0, 0.4, 0.2]} intensity={0.75} distance={3} decay={2} color="#5fe1ff" />
      </>
    );
  }
  return (
    <>
      <hemisphereLight args={['#5d7a99', '#0b0d10', 0.3]} />
      <spotLight
        position={[0, 2.62, 0.4]}
        angle={1.0}
        penumbra={0.9}
        intensity={8}
        distance={6}
        decay={2}
        color="#dbe9ff"
        castShadow={high}
        shadow-mapSize={high ? [1024, 1024] : [512, 512]}
      >
        <object3D attach="target" position={[0, 0, -1.4]} />
      </spotLight>
    </>
  );
}

export interface ExploreSceneProps {
  settings: SceneSettings;
  zoomRequest?: LocalZoomRequest;
  destination: ExploreDestination;
  warp: number;
  flightEnabled: boolean;
  input: FlightInput;
  resetToken: number;
  callsign: string;
  chrome?: FlightChrome;
  onTelemetry: (t: FlightTelemetry) => void;
  onWarpRequest?: () => void;
  onLearn?: (bodyId: string) => void;
  inspectId?: string | null;
  cutawayOpen?: boolean;
  highlightLayer?: number;
  onLowPerformance?: () => void;
  onReady?: () => void;
  /** Other pilots with a reported location; drawn as ships in the local universe. */
  rivals?: NearbyPilot[];
  onSelectRival?: (id: string) => void;
}

export function ExploreScene({
  settings,
  zoomRequest,
  destination,
  warp,
  flightEnabled,
  input,
  resetToken,
  callsign,
  chrome = 'drive',
  onTelemetry,
  onWarpRequest,
  onLearn,
  inspectId = null,
  cutawayOpen = false,
  rivals,
  onSelectRival,
  highlightLayer = -1,
  onLowPerformance,
  onReady,
}: ExploreSceneProps) {
  const local = isLocalDestination(destination);
  const navigation = useMemo(() => new LocalNavigation(), []);
  const high = settings.quality === 'high';
  const drive = chrome === 'drive';
  const dpr: [number, number] = high
    ? [1, Math.min(window.devicePixelRatio || 1, 2)]
    : [1, 1.25];
  const worldRef = useRef<THREE.Group>(null);
  const contentRef = useRef<THREE.Group>(null);
  const [speed, setSpeed] = useState(0);
  const [shaderFailed, setShaderFailed] = useState(false);
  const [showMilkyWay, setShowMilkyWay] = useState(false);
  const camStart = drive ? ([0, 1.28, -0.2] as [number, number, number]) : CAMERA_POSES.lobby.position;

  if (shaderFailed) throw new Error('The graphics driver could not compile the flight shaders.');
  return (
    <Canvas
      key={`${local ? 'local' : destination.id}-${chrome}`}
      shadows={!drive && high ? 'soft' : false}
      className="sd-canvas"
      dpr={dpr}
      gl={{
        antialias: high,
        powerPreference: 'high-performance',
        alpha: false,
        stencil: false,
        logarithmicDepthBuffer: true,
      }}
      camera={{ fov: drive ? 78 : 70, near: 0.05, far: 50000, position: camStart }}
      onCreated={({ gl }) => {
        gl.domElement.dataset.sceneInstance = Math.random().toString(36).slice(2);
        gl.debug.onShaderError = () => setShaderFailed(true);
        gl.localClippingEnabled = true;
        gl.setClearColor('#010205');
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = high ? 1.12 : 1.02;
      }}
    >
      <CockpitEnvironment high={high} drive={drive} />
      <Lights high={high} drive={drive} />
      {high && !drive && <BakeShadows />}
      <group ref={worldRef}>
        <group ref={contentRef}>
          {local ? <LocalUniverseScene navigation={navigation} inspecting={!!inspectId} inspectId={inspectId} quality={settings.quality} onLearn={onLearn ?? (() => {})} rivals={rivals} onSelectRival={onSelectRival} /> : <ExploreUniverse
            destination={destination}
            environment={destination.environment}
            quality={settings.quality as GraphicsQuality}
            warp={warp}
            onLearn={onLearn}
            showMilkyWay={showMilkyWay}
          />}
          {inspectId && inspectId !== 'sun' && inspectId !== 'moon' && planetFacts(inspectId) && (
            <PlanetCutaway key={inspectId} bodyId={inspectId} open={cutawayOpen} highlight={highlightLayer} reducedMotion={settings.reducedMotion} />
          )}
        </group>
      </group>
      {local ? <LocalFlightController navigation={navigation} destination={destination} resetToken={resetToken} zoomRequest={zoomRequest}
        enabled={flightEnabled} input={input} reducedMotion={settings.reducedMotion} worldRef={worldRef} onWarpRequest={onWarpRequest}
        inspectId={inspectId}
        onTelemetry={t => { setSpeed(t.speed); onTelemetry(t); }} /> : <ShipFlightController
        enabled={flightEnabled}
        destination={destination}
        spawn={destination.spawn}
        pitch={destination.pitch}
        yaw={destination.yaw}
        environment={destination.environment}
        reducedMotion={settings.reducedMotion}
        parallax={settings.parallax}
        input={input}
        worldRef={worldRef}
        contentRef={contentRef}
        chrome={chrome}
        inspectId={inspectId}
        onWarpRequest={onWarpRequest}
        onTelemetry={(t) => {
          setSpeed(t.speed);
          setShowMilkyWay(t.showMilkyWay);
          onTelemetry(t);
        }}
        resetToken={resetToken}
      />}
      {drive ? (
        <group position={[0, -1.28, 0.2]}><DriveConsole input={input} speed={speed} /></group>
      ) : (
        <Cockpit quality={settings.quality} alert={false} reducedMotion={settings.reducedMotion} contacts={0} />
      )}
      <group userData={{ callsign }} />
      <PerfGuard onLow={high ? onLowPerformance : undefined} />
      <FirstFrame onReady={onReady} />
      {high && (
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <Bloom
            mipmapBlur
            intensity={drive ? 0.85 : 0.5}
            luminanceThreshold={drive ? 0.7 : 1.0}
            luminanceSmoothing={0.25}
            radius={0.65}
            levels={7}
          />
          <Vignette offset={drive ? 0.15 : 0.28} darkness={drive ? 0.35 : 0.58} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
