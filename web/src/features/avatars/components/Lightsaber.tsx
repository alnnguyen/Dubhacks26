import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { bindUniforms } from '../../../three/bindUniforms';

/** Hilt profile (radius, height) in meters; lathed into a smooth machined handle. */
const HILT_PROFILE: [number, number][] = [
  [0, -0.13], [0.017, -0.13], [0.021, -0.124], [0.021, -0.112], [0.017, -0.106], // pommel
  [0.0165, -0.1], [0.0185, -0.095], [0.0165, -0.09], [0.0185, -0.085], [0.0165, -0.08], // grip ridges
  [0.0185, -0.075], [0.0165, -0.07], [0.0185, -0.065], [0.0165, -0.06], [0.0185, -0.055],
  [0.0165, -0.05], [0.0185, -0.045], [0.0165, -0.04], [0.0185, -0.035], [0.0165, -0.03],
  [0.0175, -0.02], [0.0175, 0.04], // body
  [0.02, 0.046], [0.024, 0.06], [0.024, 0.09], [0.021, 0.1], // emitter shroud
  [0.014, 0.104], [0.012, 0.1],
];

const BLADE_START = 0.1;

const GLOW_VERTEX = /* glsl */ `
varying vec3 vNormalV;
varying vec3 vViewDir;
varying float vAlong;
uniform float uLength;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormalV = normalize(normalMatrix * normal);
  vViewDir = normalize(-mv.xyz);
  vAlong = position.y / uLength + 0.5;
  gl_Position = projectionMatrix * mv;
}`;

const GLOW_FRAGMENT = /* glsl */ `
varying vec3 vNormalV;
varying vec3 vViewDir;
varying float vAlong;
uniform vec3 uColor;
uniform float uIntensity;
uniform float uFalloff;
void main() {
  float facing = abs(dot(normalize(vNormalV), normalize(vViewDir)));
  float glow = pow(facing, uFalloff) * uIntensity;
  // Slightly dimmer toward the tip.
  glow *= mix(1.0, 0.7, smoothstep(0.6, 1.0, vAlong));
  gl_FragColor = vec4(uColor * glow, glow);
}`;

export interface LightsaberProps {
  color: string;
  /** 0 = retracted, 1 = fully extended. */
  ignited?: boolean;
  bladeLength?: number;
  /** Adds a colored point light from the blade (one per saber). */
  castLight?: boolean;
  /** Hilt size multiplier (cartoon gloves need a chunkier handle). */
  hiltScale?: number;
}

export function Lightsaber({ color, ignited = true, bladeLength = 0.82, castLight = true, hiltScale = 1 }: LightsaberProps) {
  const blade = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  const extension = useRef(ignited ? 1 : 0);

  const geometry = useMemo(() => {
    const hilt = new THREE.LatheGeometry(HILT_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), 48);
    hilt.computeVertexNormals();
    return {
      hilt,
      button: new THREE.BoxGeometry(0.008, 0.016, 0.01),
      core: new THREE.CapsuleGeometry(0.014, 1, 8, 24),
      inner: new THREE.CapsuleGeometry(0.03, 1, 8, 32),
      outer: new THREE.CapsuleGeometry(0.075, 1, 8, 32),
    };
  }, []);

  const uniforms = useMemo(
    () => ({
      inner: { uColor: { value: new THREE.Color() }, uIntensity: { value: 2.2 }, uFalloff: { value: 1.2 }, uLength: { value: 1 } },
      outer: { uColor: { value: new THREE.Color() }, uIntensity: { value: 0.8 }, uFalloff: { value: 2.2 }, uLength: { value: 1 } },
    }),
    [],
  );

  const materials = useMemo(
    () => ({
      hilt: new THREE.MeshStandardMaterial({ color: '#b9c0c8', metalness: 1, roughness: 0.28 }),
      dark: new THREE.MeshStandardMaterial({ color: '#1d2126', metalness: 0.6, roughness: 0.45 }),
      button: new THREE.MeshStandardMaterial({ color: '#000', emissiveIntensity: 2, toneMapped: false }),
      core: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.6, 1.6), toneMapped: false }),
    }),
    [],
  );

  useEffect(() => {
    uniforms.inner.uColor.value.set(color);
    uniforms.outer.uColor.value.set(color);
    materials.button.emissive.set(color);
    // A whisper of the blade color in the white-hot core.
    materials.core.color.set(color).lerp(new THREE.Color('#ffffff'), 0.8).multiplyScalar(1.6);
    light.current?.color.set(color);
  }, [color, materials, uniforms]);

  useEffect(
    () => () => {
      Object.values(geometry).forEach((g) => g.dispose());
      Object.values(materials).forEach((m) => m.dispose());
    },
    [geometry, materials],
  );

  useFrame((state, dt) => {
    extension.current = THREE.MathUtils.damp(extension.current, ignited ? 1 : 0, 10, Math.min(dt, 0.05));
    const length = Math.max(0.0001, bladeLength * extension.current);
    if (blade.current) {
      blade.current.visible = extension.current > 0.01;
      blade.current.scale.set(1, length, 1);
      blade.current.position.y = BLADE_START * hiltScale + length / 2;
    }
    // Gentle hum: tiny intensity flicker.
    const hum = 1 + Math.sin(state.clock.elapsedTime * 47) * 0.03 + Math.sin(state.clock.elapsedTime * 13) * 0.04;
    uniforms.inner.uIntensity.value = 2.2 * hum;
    uniforms.outer.uIntensity.value = 0.8 * hum;
    if (light.current) {
      light.current.intensity = 1.6 * extension.current * hum;
      light.current.position.y = BLADE_START * hiltScale + length / 2;
    }
  });

  return (
    <group>
      <group scale={hiltScale}>
        <mesh geometry={geometry.hilt} material={materials.hilt} castShadow />
        <mesh geometry={geometry.hilt} material={materials.dark} scale={[1.04, 0.32, 1.04]} position={[0, -0.04, 0]} />
        <mesh geometry={geometry.button} material={materials.button} position={[0, 0.02, 0.019]} />
      </group>
      <group ref={blade}>
        <mesh geometry={geometry.core} material={materials.core} />
        <mesh geometry={geometry.inner} renderOrder={3}>
          <shaderMaterial
            ref={bindUniforms(uniforms.inner)}
            uniforms={uniforms.inner}
            vertexShader={GLOW_VERTEX}
            fragmentShader={GLOW_FRAGMENT}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
        <mesh geometry={geometry.outer} renderOrder={3}>
          <shaderMaterial
            ref={bindUniforms(uniforms.outer)}
            uniforms={uniforms.outer}
            vertexShader={GLOW_VERTEX}
            fragmentShader={GLOW_FRAGMENT}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      </group>
      {castLight && <pointLight ref={light} distance={2.2} decay={2} intensity={1.6} />}
    </group>
  );
}
