import { useMemo } from 'react'
import * as THREE from 'three'
import { bindUniforms } from '../../three/bindUniforms'

/**
 * Mars sky dome. Grounded in rover imagery: a butterscotch/tan sky from
 * suspended dust, darker toward the zenith, and a bluish halo around the sun
 * (fine dust forward-scatters blue light, as photographed by Curiosity and
 * Perseverance). The sun's disc is ~2/3 its size seen from Earth.
 */
const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`

const FRAG = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uHalo;
uniform vec3 uGround;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uZenith, pow(smoothstep(-0.02, 0.85, h), 0.55));
  float mu = max(dot(d, normalize(uSunDir)), 0.0);
  // Broad warm forward-scatter glow, then the characteristic blue aureole.
  col += vec3(0.32, 0.2, 0.12) * pow(mu, 6.0);
  col = mix(col, uHalo, pow(mu, 40.0) * 0.6);
  col += uHalo * pow(mu, 400.0) * 0.9;
  // Sun disc (angular radius ~0.18 deg, softened for screen resolution).
  col += vec3(1.0, 0.98, 0.94) * smoothstep(0.99975, 0.99992, mu) * 9.0;
  // Below the horizon: dusty ground haze so the far terrain edge never shows a seam.
  col = mix(col, uGround, smoothstep(0.0, -0.12, h));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export function sunDirection(elevationDeg: number, azimuthDeg: number) {
  const el = THREE.MathUtils.degToRad(elevationDeg)
  const az = THREE.MathUtils.degToRad(azimuthDeg)
  // Azimuth 0 = north (-z), 90 = east (+x).
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize()
}

export function MarsSky({ sunDir, colors }: { sunDir: THREE.Vector3; colors: { zenith: string; horizon: string; sunHalo: string; ground: string } }) {
  const uniforms = useMemo(
    () => ({
      uSunDir: { value: sunDir },
      uZenith: { value: new THREE.Color(colors.zenith) },
      uHorizon: { value: new THREE.Color(colors.horizon) },
      uHalo: { value: new THREE.Color(colors.sunHalo) },
      uGround: { value: new THREE.Color(colors.ground) },
    }),
    [sunDir, colors],
  )
  return (
    <mesh frustumCulled={false} renderOrder={-1}>
      <sphereGeometry args={[3000, 48, 24]} />
      <shaderMaterial vertexShader={VERT} fragmentShader={FRAG} uniforms={uniforms} ref={bindUniforms(uniforms)} side={THREE.BackSide} depthWrite={false} fog={false} />
    </mesh>
  )
}
