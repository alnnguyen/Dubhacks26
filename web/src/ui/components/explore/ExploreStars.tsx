import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { bindUniforms } from '../../../three/bindUniforms';
import type { GraphicsQuality } from '../../state/lobbyTypes';

const STAR_VERT = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute vec3 aColor;
uniform float uTime;
uniform float uPixelRatio;
uniform float uWarp;
varying vec3 vColor;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){
  vColor = aColor;
  float tw = 0.7 + 0.3 * sin(uTime * (0.6 + aPhase) + aPhase * 17.0);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPixelRatio * tw * (1.0 + uWarp * 1.5);
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}
`;

const STAR_FRAG = /* glsl */ `
uniform float uWarp;
varying vec3 vColor;
#include <logdepthbuf_pars_fragment>
void main(){
  #include <logdepthbuf_fragment>
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  a *= a;
  gl_FragColor = vec4(vColor * a * (1.0 + uWarp * 2.0), a);
}
`;

/** Phone/low ~30k (fps budget) · desktop high ~109401 (HYG-scale density, procedural). */
export function starCountForQuality(quality: GraphicsQuality, _deepField = false): number {
  if (quality === 'high') return 109401;
  return 30000;
}

export function ExploreStars({
  count,
  warp,
  radius = 2400,
}: {
  count: number;
  warp: number;
  radius?: number;
}) {
  const dpr = useThree((s) => s.viewport.dpr);
  const geometry = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const phase = new Float32Array(count);
    const color = new Float32Array(count * 3);
    let seed = 4242;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      v.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
      if (v.lengthSq() > 1 || v.lengthSq() < 0.02) {
        i--;
        continue;
      }
      v.multiplyScalar(radius);
      pos.set([v.x, v.y, v.z], i * 3);
      const bright = rnd();
      size[i] = bright > 0.992 ? 3.8 + rnd() * 2.4 : bright > 0.94 ? 1.8 + rnd() * 1.4 : 0.7 + rnd() * 1.1;
      phase[i] = rnd() * 3;
      const tint = rnd();
      const c = tint > 0.88 ? [1, 0.82, 0.65] : tint > 0.55 ? [0.72, 0.84, 1] : [0.95, 0.97, 1];
      const k = 0.35 + bright * 0.85;
      color.set([c[0] * k, c[1] * k, c[2] * k], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
    return g;
  }, [count, radius]);
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
