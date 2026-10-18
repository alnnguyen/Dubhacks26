import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { bindUniforms } from '../../three/bindUniforms'

/** Suspended dust drifting on a light wind. Artistic, kept sparse so it never hides gameplay. */
const VERT = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform vec3 uWind;
uniform float uBox;
uniform float uPixelRatio;
varying float vAlpha;
void main() {
  vec3 p = position + uWind * uTime + vec3(sin(uTime * 0.7 + aSeed * 6.0), cos(uTime * 0.5 + aSeed * 4.0) * 0.4, cos(uTime * 0.6 + aSeed * 5.0)) * 0.25;
  // Wrap inside a box that follows the camera.
  vec3 c = cameraPosition;
  p = c + mod(p - c + uBox * 0.5, uBox) - uBox * 0.5;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  float d = -mv.z;
  vAlpha = smoothstep(0.5, 2.5, d) * (1.0 - smoothstep(uBox * 0.3, uBox * 0.5, d));
  gl_PointSize = (0.6 + aSeed * 1.4) * uPixelRatio * 18.0 / max(d, 0.5);
  gl_Position = projectionMatrix * mv;
}
`

const FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  float r = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, r) * vAlpha * 0.35;
  gl_FragColor = vec4(uColor, a);
}
`

export function Dust({ count, reducedMotion }: { count: number; reducedMotion: boolean }) {
  const geometry = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const seed = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos.set([(Math.random() - 0.5) * 30, Math.random() * 6, (Math.random() - 0.5) * 30], i * 3)
      seed[i] = Math.random()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    return g
  }, [count])
  useEffect(() => () => geometry.dispose(), [geometry])
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uWind: { value: new THREE.Vector3(0.55, 0.02, 0.18) },
      uBox: { value: 30 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uColor: { value: new THREE.Color('#d6a27a') },
    }),
    [],
  )
  const t = useRef(0)
  useFrame((_, dt) => {
    t.current += reducedMotion ? dt * 0.2 : dt
    uniforms.uTime.value = t.current
  })
  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial vertexShader={VERT} fragmentShader={FRAG} uniforms={uniforms} ref={bindUniforms(uniforms)} transparent depthWrite={false} />
    </points>
  )
}
