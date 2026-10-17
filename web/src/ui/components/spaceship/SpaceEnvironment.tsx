import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { CAMERA_POSES } from './cockpitLayout';
import type { GraphicsQuality } from '../../state/lobbyTypes';

/*
 * Earth shading adapted from ulanch/earth (MIT, (c) 2025 Alex Ulanch):
 * day/night blend driven by sun angle, specular-masked oceans, city-light glow
 * on the night side, separate cloud shell and a fresnel atmosphere.
 * Texture credits: web/public/textures/earth/ATTRIBUTION.md
 */
const EARTH_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vP;
varying vec2 vUv;
void main(){
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const EARTH_FRAG = /* glsl */ `
uniform sampler2D uDay;
uniform sampler2D uNight;
uniform sampler2D uSpec;
uniform sampler2D uClouds;
uniform vec3 uSun;
uniform float uCloudOffset;
varying vec3 vN;
varying vec3 vP;
varying vec2 vUv;
void main(){
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vP);
  vec3 L = normalize(uSun);
  float ndl = dot(N, L);
  float dayMix = smoothstep(-0.1, 0.2, ndl);
  vec3 day = texture2D(uDay, vUv).rgb;
  vec3 night = texture2D(uNight, vUv).rgb;
  float spec = texture2D(uSpec, vUv).r;
  float cloud = texture2D(uClouds, vUv + vec2(uCloudOffset, 0.0)).r;

  vec3 col = day * (0.02 + 1.1 * max(ndl, 0.0)) * (1.0 - cloud * 0.3);
  vec3 H = normalize(L + V);
  col += vec3(0.75, 0.85, 1.0) * pow(max(dot(N, H), 0.0), 55.0) * spec * dayMix * 0.55;
  col += night * vec3(1.0, 0.8, 0.55) * 1.9 * (1.0 - dayMix) * (1.0 - cloud * 0.75);

  float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
  col = mix(col, vec3(0.3, 0.56, 1.0) * (0.04 + 0.9 * max(ndl + 0.15, 0.0)), fres * 0.6);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const CLOUD_FRAG = /* glsl */ `
uniform sampler2D uClouds;
uniform vec3 uSun;
uniform float uCloudOffset;
varying vec3 vN;
varying vec3 vP;
varying vec2 vUv;
void main(){
  vec3 N = normalize(vN);
  float ndl = dot(N, normalize(uSun));
  float c = texture2D(uClouds, vUv + vec2(uCloudOffset, 0.0)).r;
  vec3 col = vec3(0.95, 0.97, 1.0) * (0.015 + 1.05 * max(ndl, 0.0));
  gl_FragColor = vec4(col, c * 0.9);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const ATMO_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vP;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const ATMO_FRAG = /* glsl */ `
uniform vec3 uSun;
varying vec3 vN;
varying vec3 vP;
void main(){
  vec3 N = normalize(vN);
  vec3 D = normalize(vP - cameraPosition);
  float i = pow(clamp(0.62 + dot(N, D), 0.0, 1.0), 7.0);
  float day = smoothstep(-0.35, 0.45, dot(N, normalize(uSun)));
  vec3 col = vec3(0.3, 0.62, 1.0) * i * (0.25 + 2.6 * day);
  gl_FragColor = vec4(col, 1.0);
}
`;

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
const TEX = '/textures/earth/';

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
  // Spin the globe so longitude FACING_LON faces the cockpit.
  const FACING_LON = -25;
  const n0 = cam.clone().sub(center);
  const yaw = Math.atan2(-n0.z, n0.x) - THREE.MathUtils.degToRad(FACING_LON);
  return { center, yaw };
}

function Earth({ quality }: { quality: GraphicsQuality }) {
  const placement = useMemo(planetPlacement, []);
  const gl = useThree((s) => s.gl);
  const [day, night, spec, clouds] = useTexture([
    TEX + (quality === 'high' ? 'earth_day_4k.jpg' : 'earth_day_2k.jpg'),
    TEX + 'earth_night_2k.jpg',
    TEX + 'earth_specular_1k.jpg',
    TEX + 'earth_clouds_2k.jpg',
  ]);
  useMemo(() => {
    const aniso = Math.min(4, gl.capabilities.getMaxAnisotropy());
    day.colorSpace = night.colorSpace = THREE.SRGBColorSpace;
    for (const t of [day, night, spec, clouds]) {
      t.wrapS = THREE.RepeatWrapping;
      t.anisotropy = aniso;
      t.needsUpdate = true;
    }
  }, [day, night, spec, clouds, gl]);

  const uniforms = useMemo(
    () => ({ uDay: { value: day }, uNight: { value: night }, uSpec: { value: spec }, uClouds: { value: clouds }, uSun: { value: SUN_DIR }, uCloudOffset: { value: 0 } }),
    [day, night, spec, clouds],
  );
  const atmoUniforms = useMemo(() => ({ uSun: { value: SUN_DIR } }), []);
  const globe = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (globe.current) globe.current.rotation.y += dt * 0.0006;
    uniforms.uCloudOffset.value += dt * 0.000015;
  });
  const seg = quality === 'high' ? 128 : 72;
  return (
    <group position={placement.center}>
      <group ref={globe} rotation={[0, placement.yaw, 0]}>
        <mesh>
          <sphereGeometry args={[PLANET_R, seg, seg / 2]} />
          <shaderMaterial vertexShader={EARTH_VERT} fragmentShader={EARTH_FRAG} uniforms={uniforms} />
        </mesh>
        <mesh scale={1.006}>
          <sphereGeometry args={[PLANET_R, seg, seg / 2]} />
          <shaderMaterial vertexShader={EARTH_VERT} fragmentShader={CLOUD_FRAG} uniforms={uniforms} transparent depthWrite={false} />
        </mesh>
      </group>
      <mesh scale={1.025}>
        <sphereGeometry args={[PLANET_R, seg, seg / 2]} />
        <shaderMaterial
          vertexShader={ATMO_VERT}
          fragmentShader={ATMO_FRAG}
          uniforms={atmoUniforms}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          transparent
          depthWrite={false}
        />
      </mesh>
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
      <shaderMaterial vertexShader={STAR_VERT} fragmentShader={STAR_FRAG} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

export function SpaceEnvironment({ quality, warp }: { quality: GraphicsQuality; warp: number }) {
  return (
    <group name="space-environment">
      <Stars count={quality === 'high' ? 2600 : 1400} warp={warp} />
      {/* Earth streams its textures in; the cockpit renders without waiting. */}
      <Suspense fallback={null}>
        <Earth quality={quality} />
      </Suspense>
    </group>
  );
}
