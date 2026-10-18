import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { TerrainSampler } from './terrain/heightmap'

/**
 * Wind-driven surface dust: low, stretched wisps skimming the regolith and
 * the platform, plus slow haze sheets. Few instances, one draw call each.
 */
const WIND = new THREE.Vector2(0.9, -0.25).normalize()
const COUNT = 48
const RANGE = 34

const vertex = /* glsl */ `
attribute float aSeed;
uniform float uTime;
varying vec2 vUv; varying float vSeed;
void main(){
  vUv=uv; vSeed=aSeed;
  vec4 center=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
  vec2 size=vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));
  center.xy+=position.xy*size;
  gl_Position=projectionMatrix*center;
}`
const fragment = /* glsl */ `
uniform float uTime; uniform vec3 uColor; uniform float uOpacity;
varying vec2 vUv; varying float vSeed;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
void main(){
  vec2 p=vUv*vec2(6.,2.)+vec2(-uTime*1.4+vSeed*40.,vSeed*9.);
  float wisp=n(p)*.6+n(p*2.3)*.3+n(p*5.)*.1;
  float edge=smoothstep(0.,.25,vUv.x)*smoothstep(1.,.6,vUv.x)*smoothstep(0.,.35,vUv.y)*smoothstep(1.,.4,vUv.y);
  float a=smoothstep(.35,.8,wisp)*edge*uOpacity;
  gl_FragColor=vec4(uColor,a);
}`

export function WindDust({ sampler, reducedMotion = false }: { sampler: TerrainSampler; reducedMotion?: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const state = useMemo(() => Array.from({ length: COUNT }, (_, i) => {
    const a = (i / COUNT) * Math.PI * 2 * 7.3
    const r = 3 + ((i * 37) % 100) / 100 * RANGE
    return { x: Math.cos(a) * r, z: Math.sin(a) * r, speed: 2.2 + ((i * 13) % 10) / 4, len: 3 + (i % 5) * 1.4, seed: (i * 0.618) % 1 }
  }), [])
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1)
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(state.map((s) => s.seed)), 1))
    return g
  }, [state])
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#d39a72') }, uOpacity: { value: 0.32 } },
  }), [])
  useEffect(() => () => { geometry.dispose(); material.dispose() }, [geometry, material])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  useFrame(({ clock }, dtRaw) => {
    const m = mesh.current
    if (!m) return
    const dt = reducedMotion ? 0 : Math.min(dtRaw, 0.05)
    material.uniforms.uTime.value = reducedMotion ? 0 : clock.elapsedTime
    state.forEach((s, i) => {
      s.x += WIND.x * s.speed * dt
      s.z += WIND.y * s.speed * dt
      // Wrap round the arena so the wind never runs out of dust.
      if (Math.hypot(s.x, s.z) > RANGE + 4) { s.x -= WIND.x * (RANGE * 2); s.z -= WIND.y * (RANGE * 2) }
      dummy.position.set(s.x, sampler.heightAt(s.x, s.z) + 0.25 + (i % 3) * 0.12, s.z)
      dummy.scale.set(s.len, 0.45 + (i % 4) * 0.15, 1)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[geometry, material, COUNT]} frustumCulled={false} renderOrder={2} />
}
