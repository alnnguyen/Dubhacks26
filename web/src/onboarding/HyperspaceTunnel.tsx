import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

const STREAK_COUNT = 420;

function StreakField({ speed = 1 }: { speed?: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const velocities = useMemo(() => {
    const v = new Float32Array(STREAK_COUNT);
    for (let i = 0; i < STREAK_COUNT; i++) v[i] = 18 + Math.random() * 42;
    return v;
  }, []);

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    for (let i = 0; i < STREAK_COUNT; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.4 + Math.random() * 7;
      dummy.position.set(Math.cos(a) * r, Math.sin(a) * r, -Math.random() * 80);
      dummy.scale.set(0.035, 0.035, 1.2 + Math.random() * 4.5);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    const temp = dummy.matrix;
    for (let i = 0; i < STREAK_COUNT; i++) {
      m.getMatrixAt(i, temp);
      dummy.position.setFromMatrixPosition(temp);
      dummy.scale.setFromMatrixScale(temp);
      dummy.position.z += velocities[i] * speed * dt;
      const stretch = THREE.MathUtils.clamp(velocities[i] * speed * 0.12, 1.5, 9);
      dummy.scale.z = stretch;
      if (dummy.position.z > 12) {
        const a = Math.random() * Math.PI * 2;
        const r = 0.35 + Math.random() * 7.2;
        dummy.position.set(Math.cos(a) * r, Math.sin(a) * r, -70 - Math.random() * 40);
        dummy.scale.set(0.03, 0.03, 2 + Math.random() * 5);
      }
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, STREAK_COUNT]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#b8f4ff" toneMapped={false} />
    </instancedMesh>
  );
}

function CoreGlow() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.scale.setScalar(1.15 + Math.sin(t * 8) * 0.18);
  });
  return (
    <mesh ref={ref} position={[0, 0, -8]}>
      <sphereGeometry args={[0.55, 24, 24]} />
      <meshBasicMaterial color="#e8fbff" toneMapped={false} />
    </mesh>
  );
}

function Rig({ intensity }: { intensity: number }) {
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime;
    camera.position.x = Math.sin(t * 3.2) * 0.08 * intensity;
    camera.position.y = Math.cos(t * 2.4) * 0.05 * intensity;
    camera.lookAt(0, 0, -20);
  });
  return null;
}

export function HyperspaceTunnel({
  active,
  onFinished,
  durationMs = 2400,
}: {
  active: boolean;
  onFinished: () => void;
  durationMs?: number;
}) {
  const finishedRef = useRef(onFinished);
  finishedRef.current = onFinished;

  useEffect(() => {
    if (!active) return;
    const id = window.setTimeout(() => finishedRef.current(), durationMs);
    return () => clearTimeout(id);
  }, [active, durationMs]);

  if (!active) return null;

  return (
    <div className="ob-warp" aria-hidden>
      <Canvas
        className="ob-warp__canvas"
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 6], fov: 85, near: 0.1, far: 200 }}
        gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#020814']} />
        <fog attach="fog" args={['#020814', 12, 90]} />
        <Rig intensity={1} />
        <StreakField speed={1.35} />
        <CoreGlow />
        <EffectComposer multisampling={0}>
          <Bloom intensity={2.6} luminanceThreshold={0.12} mipmapBlur />
          <Vignette offset={0.25} darkness={0.85} />
        </EffectComposer>
      </Canvas>
      <div className="ob-warp__flash" />
      <p className="ob-warp__caption">Jumping to bridge…</p>
    </div>
  );
}
