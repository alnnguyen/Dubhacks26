import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { bindUniforms } from '../../../three/bindUniforms';

const VERT = /* glsl */ `
varying vec2 vUv;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;

/** Artistic spiral disk — not 2MRS/Gaia data. Honest far-field backdrop. */
const FRAG = /* glsl */ `
uniform float uTime;
uniform float uFade;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
#include <logdepthbuf_pars_fragment>
void main(){
  #include <logdepthbuf_fragment>
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float a = atan(p.y, p.x);
  float arms = 0.55 + 0.45 * cos(a * 2.0 - log(max(r, 0.04)) * 6.5 + uTime * 0.02);
  float disk = smoothstep(1.05, 0.15, r) * smoothstep(0.0, 0.08, r);
  float lane = pow(arms, 2.2) * disk;
  float dust = hash(p * 40.0 + uTime * 0.01) * 0.15 * disk;
  vec3 col = mix(vec3(0.05, 0.08, 0.18), vec3(0.55, 0.62, 0.95), lane);
  col += vec3(0.9, 0.75, 0.55) * dust;
  col += vec3(1.0, 0.95, 0.85) * pow(smoothstep(0.22, 0.0, r), 3.0) * 0.9;
  float alpha = (lane * 0.55 + dust + pow(smoothstep(0.3, 0.0, r), 2.0) * 0.4) * uFade;
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.85));
}
`;

export function MilkyWayDisk({ visible, radius = 2800 }: { visible: boolean; radius?: number }) {
  const fade = useRef(0);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uFade: { value: 0 } }), []);
  useFrame((_, dt) => {
    uniforms.uTime.value += dt;
    fade.current = THREE.MathUtils.damp(fade.current, visible ? 1 : 0, 2.2, dt);
    uniforms.uFade.value = fade.current;
  });
  return (
    <mesh rotation={[Math.PI / 2.05, 0, 0.35]} position={[0, -40, 0]} frustumCulled={false} renderOrder={-2}>
      <circleGeometry args={[radius, 96]} />
      <shaderMaterial
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        ref={bindUniforms(uniforms)}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

/** Tiny “you are here” marker near the solar neighborhood of the disk. */
export function YouAreHereMarker({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <group position={[120, -20, 80]}>
      <mesh>
        <sphereGeometry args={[8, 12, 12]} />
        <meshBasicMaterial color="#5fe1ff" transparent opacity={0.9} toneMapped={false} />
      </mesh>
      <mesh>
        <ringGeometry args={[14, 22, 24]} />
        <meshBasicMaterial color="#b4f3ff" transparent opacity={0.45} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  );
}
