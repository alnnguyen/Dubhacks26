import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { CAMERA_POSES } from './cockpitLayout';
import type { GraphicsQuality } from '../../state/lobbyTypes';
import { bindUniforms } from '../../../three/bindUniforms';
import { PlanetEarth } from '../explore/PlanetEarth';

const STAR_VERT = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute vec3 aColor;
uniform float uTime;
uniform float uPixelRatio;
uniform float uWarp;
varying vec3 vColor;
void main(){
  vColor = aColor;
  float tw = 0.7 + 0.3 * sin(uTime * (0.6 + aPhase) + aPhase * 17.0);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPixelRatio * tw * (1.0 + uWarp * 1.5);
  gl_Position = projectionMatrix * mv;
}
`;

const STAR_FRAG = /* glsl */ `
uniform float uWarp;
varying vec3 vColor;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  a *= a;
  gl_FragColor = vec4(vColor * a * (1.0 + uWarp * 2.0), a);
}
`;

const SUN_DIR = new THREE.Vector3(0.75, -0.25, -0.62).normalize();
const PLANET_R = 500;

/**
 * Puts Earth low on the left of the windshield: its curved horizon fills the
 * left half and leaves open space on the right.
 */
function planetPlacement() {
  const cam = new THREE.Vector3(...CAMERA_POSES.lobby.position);
  const D = PLANET_R / Math.sin(THREE.MathUtils.degToRad(45));
  const az = THREE.MathUtils.degToRad(-38);
  const el = THREE.MathUtils.degToRad(-30);
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
  const center = cam.clone().addScaledVector(dir, D);
  const FACING_LON = -25;
  const n0 = cam.clone().sub(center);
  const yaw = Math.atan2(-n0.z, n0.x) - THREE.MathUtils.degToRad(FACING_LON);
  return { center: center.toArray() as [number, number, number], yaw };
}

function LobbyEarth({ quality, hidden }: { quality: GraphicsQuality; hidden: boolean }) {
  const placement = useMemo(planetPlacement, []);
  const root = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!root.current) return;
    const target = hidden ? 0.001 : 1;
    root.current.scale.setScalar(THREE.MathUtils.damp(root.current.scale.x, target, hidden ? 3.2 : 2.4, dt));
  });
  return (
    <group ref={root} position={placement.center}>
      <group rotation={[0, placement.yaw, 0]}>
        <PlanetEarth quality={quality} radius={PLANET_R} position={[0, 0, 0]} sunDir={SUN_DIR} spin={0.0006} />
      </group>
    </group>
  );
}

function Stars({ count, warp }: { count: number; warp: number }) {
  const dpr = useThree((s) => s.viewport.dpr);
  const geometry = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const phase = new Float32Array(count);
    const color = new Float32Array(count * 3);
    let seed = 1337;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      v.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
      if (v.lengthSq() > 1 || v.lengthSq() < 0.01) {
        i--;
        continue;
      }
      v.normalize().multiplyScalar(1500);
      pos.set([v.x, v.y, v.z], i * 3);
      const bright = rnd();
      size[i] = bright > 0.985 ? 3.6 + rnd() * 2 : 1.0 + rnd() * 1.6;
      phase[i] = rnd() * 3;
      const tint = rnd();
      const c = tint > 0.85 ? [1, 0.85, 0.7] : tint > 0.6 ? [0.75, 0.85, 1] : [0.95, 0.97, 1];
      const k = 0.5 + bright * 0.7;
      color.set([c[0] * k, c[1] * k, c[2] * k], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
    return g;
  }, [count]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uPixelRatio: { value: dpr }, uWarp: { value: 0 } }), [dpr]);
  const warpRef = useRef(warp);
  warpRef.current = warp;
  useFrame(({ clock }, dt) => {
    uniforms.uTime.value = clock.elapsedTime;
    uniforms.uWarp.value = THREE.MathUtils.damp(uniforms.uWarp.value, warpRef.current, 3, dt);
  });
  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        vertexShader={STAR_VERT}
        fragmentShader={STAR_FRAG}
        uniforms={uniforms}
        ref={bindUniforms(uniforms)}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export function SpaceEnvironment({ quality, warp, hideEarth }: { quality: GraphicsQuality; warp: number; hideEarth?: boolean }) {
  return (
    <group name="space-environment">
      <Stars count={quality === 'high' ? 2600 : 1400} warp={warp} />
      <Suspense fallback={null}>
        <LobbyEarth quality={quality} hidden={hideEarth ?? false} />
      </Suspense>
    </group>
  );
}
