import { CatalogScene } from './CatalogScene';
import { ExploreBoundary } from './ExploreBoundary';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import type { GraphicsQuality } from '../../state/lobbyTypes';
import type { ExploreDestination, ExploreEnvironment } from './destinations';
import { SOLAR_BODIES, bodyWorldPosition, type BodyDef } from './bodies';
import { PlanetEarth } from './PlanetEarth';
import { ExploreStars, starCountForQuality } from './ExploreStars';
import { StarSkybox } from './StarSkybox';
import { LearnTargets } from './LearnTargets';
import { MilkyWayDisk } from './MilkyWay';

function MappedBody({
  body,
  quality,
  position,
}: {
  body: BodyDef;
  quality: GraphicsQuality;
  position?: [number, number, number];
}) {
  const map = useTexture(body.map!);
  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
  }, [map]);
  const ref = useRef<THREE.Mesh>(null);
  const pos = position ?? bodyWorldPosition(body);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * body.spin;
  });
  const seg = quality === 'high' ? 64 : 32;
  return (
    <group position={pos} name={`solar-body-${body.id}`}>
      <mesh ref={ref}>
        <sphereGeometry args={[body.radius, seg, seg / 2]} />
        <meshStandardMaterial map={map} emissiveMap={map} emissive="#ffffff" emissiveIntensity={0.12} roughness={0.85} metalness={0.05} />
      </mesh>
      {body.atmosphere && (
        <mesh scale={1.045}>
          <sphereGeometry args={[body.radius, 24, 16]} />
          <meshBasicMaterial color={body.atmosphere} transparent opacity={0.18} side={THREE.BackSide} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

function ColorBody({
  body,
  quality,
  position,
}: {
  body: BodyDef;
  quality: GraphicsQuality;
  position?: [number, number, number];
}) {
  const ref = useRef<THREE.Mesh>(null);
  const pos = position ?? bodyWorldPosition(body);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * body.spin;
  });
  const seg = quality === 'high' ? 48 : 24;
  const bands=useMemo(()=> {
    if(!body.rings)return null;
    const canvas=document.createElement('canvas');canvas.width=8;canvas.height=128;
    const ctx=canvas.getContext('2d')!;
    for(let y=0;y<128;y++) {const l=65+Math.sin(y*.3)*5+Math.sin(y*1.7)*3;ctx.fillStyle=`hsl(38, 36%, ${l}%)`;ctx.fillRect(0,y,8,1);}
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
  },[body.rings]);
  useEffect(()=>()=>bands?.dispose(),[bands]);
  return (
    <group position={pos} name={`solar-body-${body.id}`}>
      <mesh ref={ref}>
        <sphereGeometry args={[body.radius, seg, seg / 2]} />
        <meshStandardMaterial
          map={bands}
          color={bands ? '#ffffff' : body.color}
          emissive={body.emissive ?? '#000000'}
          emissiveIntensity={body.emissiveIntensity ?? 0}
          roughness={body.id === 'sun' ? 0.4 : 0.9}
          metalness={0}
        />
      </mesh>
      {body.rings && <group rotation={[.42,0,.22]}>
        {[[1.3,1.65,'#a9987b'],[1.7,2.05,'#e3d2aa'],[2.13,2.3,'#b7a487']].map(([inner,outer,color],i)=><mesh key={i} rotation={[-Math.PI/2,0,0]}>
          <ringGeometry args={[body.radius*Number(inner),body.radius*Number(outer),96]} />
          <meshStandardMaterial color={String(color)} side={THREE.DoubleSide} transparent opacity={.8} roughness={1} />
        </mesh>)}
      </group>}
      {body.id === 'sun' && (
        <mesh scale={1.35}>
          <sphereGeometry args={[body.radius, 24, 16]} />
          <meshBasicMaterial color="#ffbb55" transparent opacity={0.22} side={THREE.BackSide} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

function OrbitRing({ radius }: { radius: number }) {
  const object = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: '#5fe1ff', transparent: true, opacity: 0.12 });
    return new THREE.Line(geom, mat);
  }, [radius]);
  useEffect(() => () => {
    object.geometry.dispose();
    (object.material as THREE.Material).dispose();
  }, [object]);
  return <primitive object={object} />;
}

export function SolarBodies({ quality }: { quality: GraphicsQuality }) {
  const earth = SOLAR_BODIES.find((b) => b.id === 'earth')!;
  const earthPos = bodyWorldPosition(earth);
  const sunDir = useMemo(() => new THREE.Vector3(...earthPos).normalize().negate(), [earthPos]);

  return (
    <>
      {SOLAR_BODIES.filter((b) => b.orbit > 0 && b.id !== 'moon').map((b) => (
        <OrbitRing key={`orbit-${b.id}`} radius={b.orbit} />
      ))}
      {SOLAR_BODIES.map((body) => {
        if (body.id === 'earth') {
          return (
            <ExploreBoundary key={body.id} fallback={<ColorBody body={body} quality={quality} />}><Suspense fallback={<ColorBody body={body} quality={quality} />}>
              <PlanetEarth quality={quality} radius={body.radius} position={earthPos} sunDir={sunDir} spin={body.spin} />
            </Suspense></ExploreBoundary>
          );
        }
        if (body.map && body.map !== 'earth-special') {
          return (
            <ExploreBoundary key={body.id} fallback={<ColorBody body={body} quality={quality} />}><Suspense fallback={<ColorBody body={body} quality={quality} />}>
              <MappedBody body={body} quality={quality} />
            </Suspense></ExploreBoundary>
          );
        }
        return <ColorBody key={body.id} body={body} quality={quality} />;
      })}
      <ambientLight intensity={0.35} color="#d9e7ff" />
      {/* Navigation lighting for the compressed layout: stays consistent as the world rescales. */}
      <pointLight position={[0, 0, 0]} intensity={1.8} decay={0} color="#fff2d0" />
      <directionalLight position={[40, 60, 20]} intensity={0.35} color="#cfe3ff" />
    </>
  );
}

function SkyMars({ quality }: { quality: GraphicsQuality }) {
  const map = useTexture('/textures/bodies/mars_1k.jpg');
  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
  }, [map]);
  return (
    <mesh position={[-60, 55, -120]}>
      <sphereGeometry args={[22, quality === 'high' ? 48 : 24, 24]} />
      <meshStandardMaterial map={map} color="#c1440e" roughness={0.9} />
    </mesh>
  );
}

function MoonOrbitEnv({ quality }: { quality: GraphicsQuality }) {
  const moon = SOLAR_BODIES.find((b) => b.id === 'moon')!;
  const earth = SOLAR_BODIES.find((b) => b.id === 'earth')!;
  return (
    <group>
      <ambientLight intensity={0.12} />
      <directionalLight position={[50, 25, 15]} intensity={1.8} color="#eef4ff" />
      <ExploreBoundary fallback={<ColorBody body={{ ...moon, radius: 8 }} quality={quality} position={[0, 0, 0]} />}><Suspense fallback={<ColorBody body={{ ...moon, radius: 8 }} quality={quality} position={[0, 0, 0]} />}>
        <MappedBody body={{ ...moon, radius: 8 }} quality={quality} position={[0, 0, 0]} />
      </Suspense></ExploreBoundary>
      <ExploreBoundary fallback={<ColorBody body={{ ...earth, radius: earth.radius * 3.4 }} quality={quality} position={[48, -4, -10]} />}><Suspense fallback={null}>
        <PlanetEarth
          quality={quality}
          radius={earth.radius * 3.4}
          position={[48, -4, -10]}
          sunDir={new THREE.Vector3(1, 0.15, 0.2).normalize()}
          spin={0.02}
        />
      </Suspense></ExploreBoundary>
    </group>
  );
}

function DeepFieldEnv({ quality }: { quality: GraphicsQuality }) {
  return (
    <group>
      <ambientLight intensity={0.22} />
      <pointLight position={[30, 10, -20]} intensity={2} color="#a8c8ff" distance={200} />
      {[
        { pos: [-25, 0, -40] as const, r: 4.5, c: '#6a8cff', e: '#3344aa' },
        { pos: [35, 5, -70] as const, r: 6.2, c: '#ff8866', e: '#aa3311' },
      ].map((p, i) => (
        <mesh key={i} position={p.pos}>
          <sphereGeometry args={[p.r, quality === 'high' ? 48 : 24, 24]} />
          <meshStandardMaterial color={p.c} emissive={p.e} emissiveIntensity={0.25} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

export function ExploreUniverse({
  destination,
  environment,
  quality,
  warp,
  onLearn,
  showMilkyWay = false,
}: {
  destination: ExploreDestination;
  environment: ExploreEnvironment;
  quality: GraphicsQuality;
  warp: number;
  onLearn?: (bodyId: string) => void;
  showMilkyWay?: boolean;
}) {
  const catalogMode = ['stars','galaxies','exoplanets'].includes(environment);
  const starCount = starCountForQuality(quality, environment === 'deep-field');
  const milky = environment === 'galaxy' || (environment !== 'mars-surface' && showMilkyWay);

  return (
    <group name="explore-universe">
      {environment !== 'mars-surface' && !catalogMode && (
        <ExploreBoundary fallback={null}><Suspense fallback={null}>
          <StarSkybox />
        </Suspense></ExploreBoundary>
      )}
      {!catalogMode && <ExploreStars count={starCount} warp={warp} radius={environment === 'deep-field' ? 1800 : 2600} />}
      {catalogMode && <CatalogScene destination={destination} onLearn={onLearn ?? (() => {})} />}
      <MilkyWayDisk visible={milky} />
      
      {environment === 'solar' && <SolarBodies quality={quality} />}
      {environment === 'mars-surface' && (
        <>
          <color attach="background" args={['#1a0c08']} />
          <fog attach="fog" args={['#2a120c', 40, 220]} />
          <hemisphereLight args={['#c48a5a', '#3a180e', 0.55]} />
          <directionalLight position={[30, 50, 10]} intensity={1.4} color="#ffc090" />
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[180, 64]} />
            <meshStandardMaterial color="#8a3a1e" roughness={0.95} />
          </mesh>
          {[
            [20, 3, -30, 8],
            [-35, 4, -50, 12],
            [50, 3, 20, 10],
            [-15, 2, 45, 7],
          ].map(([x, y, z, r], i) => (
            <mesh key={i} position={[x, y, z]}>
              <dodecahedronGeometry args={[r, 0]} />
              <meshStandardMaterial color="#6e2e16" roughness={1} flatShading />
            </mesh>
          ))}
          <ExploreBoundary fallback={null}><Suspense fallback={null}>
            <SkyMars quality={quality} />
          </Suspense></ExploreBoundary>
        </>
      )}
      {environment === 'moon-orbit' && <MoonOrbitEnv quality={quality} />}
      {environment === 'deep-field' && <DeepFieldEnv quality={quality} />}
      {environment !== 'mars-surface' && <hemisphereLight args={['#4a6080', '#05080d', 0.25]} />}
      {onLearn && !catalogMode && <LearnTargets environment={environment} onLearn={onLearn} />}
    </group>
  );
}
