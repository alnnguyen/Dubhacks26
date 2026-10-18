import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import type { GraphicsQuality } from '../../state/lobbyTypes';
import { bindUniforms } from '../../../three/bindUniforms';

/*
 * Earth shading adapted from ulanch/earth (MIT, (c) 2025 Alex Ulanch).
 * Shared for lobby windshield and free-flight explore.
 * Texture credits: web/public/textures/earth/ATTRIBUTION.md
 */
const EARTH_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vP;
varying vec2 vUv;
#include <common>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main(){
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <logdepthbuf_vertex>
  #include <clipping_planes_vertex>
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
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main(){
  #include <logdepthbuf_fragment>
  #include <clipping_planes_fragment>
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vP);
  vec3 L = normalize(uSun);
  float ndl = dot(N, L);
  float dayMix = smoothstep(-0.1, 0.2, ndl);
  vec3 day = texture2D(uDay, vUv).rgb;
  vec3 night = texture2D(uNight, vUv).rgb;
  float spec = texture2D(uSpec, vUv).r;
  float cloud = texture2D(uClouds, vUv + vec2(uCloudOffset, 0.0)).r;

  vec3 col = day * (0.12 + 1.1 * max(ndl, 0.0)) * (1.0 - cloud * 0.3);
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
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main(){
  #include <logdepthbuf_fragment>
  #include <clipping_planes_fragment>
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
#include <common>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <logdepthbuf_vertex>
  #include <clipping_planes_vertex>
}
`;

const ATMO_FRAG = /* glsl */ `
uniform vec3 uSun;
varying vec3 vN;
varying vec3 vP;
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main(){
  #include <logdepthbuf_fragment>
  #include <clipping_planes_fragment>
  vec3 N = normalize(vN);
  vec3 D = normalize(vP - cameraPosition);
  float i = pow(clamp(0.62 + dot(N, D), 0.0, 1.0), 7.0);
  float day = smoothstep(-0.35, 0.45, dot(N, normalize(uSun)));
  vec3 col = vec3(0.3, 0.62, 1.0) * i * (0.25 + 2.6 * day);
  gl_FragColor = vec4(col, 1.0);
}
`;

const TEX = '/textures/earth/';

export interface PlanetEarthProps {
  quality: GraphicsQuality;
  radius: number;
  position: [number, number, number];
  /** Direction toward the sun in world space. */
  sunDir: THREE.Vector3;
  spin?: number;
}

export function PlanetEarth({ quality, radius, position, sunDir, spin = 0.05 }: PlanetEarthProps) {
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
    () => ({
      uDay: { value: day },
      uNight: { value: night },
      uSpec: { value: spec },
      uClouds: { value: clouds },
      uSun: { value: sunDir.clone() },
      uCloudOffset: { value: 0 },
    }),
    [day, night, spec, clouds, sunDir],
  );
  const atmoUniforms = useMemo(() => ({ uSun: { value: sunDir.clone() } }), [sunDir]);
  const globe = useRef<THREE.Group>(null);
  const frameRotation = useMemo(() => new THREE.Quaternion(), []);
  useFrame((_, dt) => {
    if (globe.current) globe.current.rotation.y += dt * spin;
    uniforms.uCloudOffset.value += dt * 0.000015;
    globe.current?.parent?.getWorldQuaternion(frameRotation);
    uniforms.uSun.value.copy(sunDir).applyQuaternion(frameRotation);
    atmoUniforms.uSun.value.copy(uniforms.uSun.value);
  });
  const seg = quality === 'high' ? 96 : 48;
  return (
    <group position={position} name="solar-body-earth">
      <group ref={globe}>
        <mesh>
          <sphereGeometry args={[radius, seg, seg / 2]} />
          <shaderMaterial clipping vertexShader={EARTH_VERT} fragmentShader={EARTH_FRAG} uniforms={uniforms} ref={bindUniforms(uniforms)} />
        </mesh>
        <mesh scale={1.006}>
          <sphereGeometry args={[radius, seg, seg / 2]} />
          <shaderMaterial clipping
            vertexShader={EARTH_VERT}
            fragmentShader={CLOUD_FRAG}
            uniforms={uniforms}
            ref={bindUniforms(uniforms)}
            transparent
            depthWrite={false}
          />
        </mesh>
      </group>
      <mesh scale={1.04}>
        <sphereGeometry args={[radius, seg, seg / 2]} />
        <shaderMaterial clipping
          vertexShader={ATMO_VERT}
          fragmentShader={ATMO_FRAG}
          uniforms={atmoUniforms}
          ref={bindUniforms(atmoUniforms)}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          transparent
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
