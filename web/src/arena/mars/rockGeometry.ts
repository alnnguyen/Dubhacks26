import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { PbrSet } from './terrain/terrainMaterial'

/** Procedural geometry (not NASA-derived). */

function seeded(seed: number) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

function noise3(x: number, y: number, z: number, seed: number) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 4.13) * 43758.5453
  return s - Math.floor(s)
}

function smoothNoise(p: THREE.Vector3, seed: number) {
  const ix = Math.floor(p.x), iy = Math.floor(p.y), iz = Math.floor(p.z)
  const fx = p.x - ix, fy = p.y - iy, fz = p.z - iz
  const u = (t: number) => t * t * (3 - 2 * t)
  let v = 0
  for (let dz = 0; dz < 2; dz++)
    for (let dy = 0; dy < 2; dy++)
      for (let dx = 0; dx < 2; dx++) {
        const w = (dx ? u(fx) : 1 - u(fx)) * (dy ? u(fy) : 1 - u(fy)) * (dz ? u(fz) : 1 - u(fz))
        v += w * noise3(ix + dx, iy + dy, iz + dz, seed)
      }
  return v * 2 - 1
}

export type RockShape = 'boulder' | 'angular' | 'slab' | 'mesa' | 'ridge' | 'spire'

/**
 * Displaced icosphere. `facet` > 0 adds planar cuts for fractured basalt;
 * mesa/slab shapes get flattened tops like eroded sedimentary blocks.
 */
export function makeRockGeometry(shape: RockShape, seed: number, detail = 4) {
  const rnd = seeded(seed)
  const geo = mergeVertices(new THREE.IcosahedronGeometry(1, detail).deleteAttribute('normal').deleteAttribute('uv'))
  const pos = geo.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  const planes = Array.from({ length: shape === 'angular' ? 10 : shape === 'boulder' ? 6 : 7 }, () => ({
    n: new THREE.Vector3(rnd() * 2 - 1, rnd() * 1.4 - 0.4, rnd() * 2 - 1).normalize(),
    d: 0.5 + rnd() * 0.28,
  }))
  const stretch = {
    boulder: [1, 0.72, 0.9],
    angular: [1, 0.8, 0.85],
    slab: [1.4, 0.38, 1.1],
    mesa: [1.3, 0.62, 1.15],
    ridge: [2.2, 0.55, 0.75],
    spire: [0.55, 1.6, 0.6],
  }[shape]
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const n = v.clone().normalize()
    const r = 1 + smoothNoise(n.clone().multiplyScalar(1.6), seed) * 0.3 + smoothNoise(n.clone().multiplyScalar(4.5), seed + 7) * 0.1 + smoothNoise(n.clone().multiplyScalar(11), seed + 3) * 0.03
    v.copy(n).multiplyScalar(r)
    // Fracture planes: clamp to flat faces.
    for (const p of planes) {
      const dd = v.dot(p.n)
      if (dd > p.d) v.addScaledVector(p.n, -(dd - p.d) * 0.97)
    }
    v.set(v.x * stretch[0], v.y * stretch[1], v.z * stretch[2])
    if (shape === 'mesa' || shape === 'slab') {
      const top = stretch[1] * 0.72
      if (v.y > top) v.y = top + (v.y - top) * 0.12
    }
    // Strata steps on sedimentary shapes.
    if (shape === 'mesa' || shape === 'ridge' || shape === 'slab') {
      // Stair-stepped strata, like eroded delta sediments.
      const step = 0.11
      const terr = Math.round(v.y / step) * step
      const k = Math.hypot(v.x, v.z) / Math.max(stretch[0], stretch[2])
      v.y = THREE.MathUtils.lerp(v.y, terr, 0.55)
      v.x *= 1 + (Math.sin(terr * 40 + seed) * 0.035) * k
      v.z *= 1 + (Math.cos(terr * 37 + seed) * 0.035) * k
    }
    // Flat-ish base so rocks sit on the ground.
    if (v.y < -0.3 * stretch[1]) v.y = -0.3 * stretch[1] + (v.y + 0.3 * stretch[1]) * 0.25
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  return geo
}

const ROCK_COMMON = /* glsl */ `
uniform sampler2D tC; uniform sampler2D tN; uniform sampler2D tR;
uniform float uScale; uniform vec3 uTint; uniform float uSat; uniform float uDust;
varying vec3 vRWPos; varying vec3 vWNormal2;
vec3 gA; vec3 gNW; float gR;
vec3 rGrade(vec3 c) { float l = dot(c, vec3(0.299, 0.587, 0.114)); return mix(vec3(l), c, uSat) * uTint; }
void rockEval() {
  // World-space triplanar: rocks are static, so textures never swim.
  vec3 n = normalize(vWNormal2);
  vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x + w.y + w.z);
  vec3 p = vRWPos * uScale;
  vec3 c = texture2D(tC, p.zy).rgb * w.x + texture2D(tC, p.xz).rgb * w.y + texture2D(tC, p.xy).rgb * w.z;
  vec3 nx = texture2D(tN, p.zy).xyz * 2.0 - 1.0;
  vec3 ny = texture2D(tN, p.xz).xyz * 2.0 - 1.0;
  vec3 nz = texture2D(tN, p.xy).xyz * 2.0 - 1.0;
  float r = texture2D(tR, p.zy).r * w.x + texture2D(tR, p.xz).r * w.y + texture2D(tR, p.xy).r * w.z;
  vec3 on = normalize(n + vec3(0.0, nx.y, nx.x) * w.x + vec3(ny.x, 0.0, ny.y) * w.y + vec3(nz.x, nz.y, 0.0) * w.z);
  vec3 wn = on;
  c = rGrade(c);
  // Wind-blown dust collects on up-facing surfaces of every rock on Mars.
  float dust = smoothstep(0.35, 0.9, n.y) * uDust;
  c = mix(c, vec3(0.58, 0.36, 0.22), dust);
  gA = c; gNW = wn; gR = mix(r, 0.95, dust);
}
`

export function createRockMaterial(set: PbrSet, opts: { scale: number; tint: [number, number, number]; sat: number; dust: number }) {
  const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 })
  const uniforms = {
    tC: { value: set.color },
    tN: { value: set.normal },
    tR: { value: set.rough },
    uScale: { value: opts.scale },
    uTint: { value: new THREE.Vector3(...opts.tint) },
    uSat: { value: opts.sat },
    uDust: { value: opts.dust },
  }
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRWPos; varying vec3 vWNormal2;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
mat4 rockModel = modelMatrix;
#ifdef USE_INSTANCING
rockModel = rockModel * instanceMatrix;
#endif
vRWPos = (rockModel * vec4(transformed, 1.0)).xyz;
vWNormal2 = normalize(mat3(rockModel) * objectNormal);`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + ROCK_COMMON)
      .replace('#include <map_fragment>', 'rockEval();\ndiffuseColor.rgb *= gA;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = clamp(gR, 0.5, 1.0);')
      .replace(
        '#include <normal_fragment_maps>',
        'normal = normalize((viewMatrix * vec4(gNW, 0.0)).xyz);',
      )
  }
  mat.customProgramCacheKey = () => `mars-rock-${opts.scale}-${opts.tint.join(',')}`
  return mat
}
