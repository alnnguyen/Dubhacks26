import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { usePbrSet } from './terrain/Terrain'
import { createRockMaterial, makeRockGeometry, type RockShape } from './rockGeometry'
import { obstaclePosition, OPPONENT_DISTANCE_M, type ArenaObstacle } from './obstacles'
import { MARS_PLATFORM, type TerrainSampler } from './terrain/heightmap'
import type { GraphicsQuality } from '../../ui/state/lobbyTypes'

function seeded(seed: number) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

/** Keep the line between the two players clear so nothing hides the opponent. */
function inDuelCorridor(x: number, z: number, margin: number) {
  return Math.abs(x) < 1.4 + margin && z < 1.6 + margin && z > -(OPPONENT_DISTANCE_M + 1.6 + margin)
}

interface ScatterSpec {
  shapes: RockShape[]
  count: number
  minR: number
  maxR: number
  minSize: number
  maxSize: number
  detail: number
  castShadow: boolean
  seed: number
}

function Scatter({ sampler, spec, material }: { sampler: TerrainSampler; spec: ScatterSpec; material: THREE.Material }) {
  const geometries = useMemo(() => spec.shapes.map((s, i) => makeRockGeometry(s, spec.seed + i * 17, spec.detail)), [spec])
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries])
  const matrices = useMemo(() => {
    const rnd = seeded(spec.seed)
    const buckets: THREE.Matrix4[][] = geometries.map(() => [])
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    let placed = 0
    let tries = 0
    while (placed < spec.count && tries < spec.count * 8) {
      tries++
      // Bias toward the arena with an inverse-square radius distribution.
      const t = rnd()
      const r = spec.minR + (spec.maxR - spec.minR) * t * t
      const a = rnd() * Math.PI * 2
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      // Clustered fields of rocks rather than uniform noise.
      const cluster = Math.sin(x * 0.21 + Math.cos(z * 0.17) * 2.1) * Math.cos(z * 0.23 - x * 0.07)
      if (cluster < -0.2 && rnd() < 0.7) continue
      const size = spec.minSize + (spec.maxSize - spec.minSize) * Math.pow(rnd(), 2.2)
      if (inDuelCorridor(x, z, size)) continue
      // Nothing on the platform deck; its rim is half-buried in a regolith drift instead.
      if (Math.hypot(x, z) < MARS_PLATFORM.radius + 0.8 + size) continue
      const y = sampler.heightAt(x, z) - size * 0.22
      e.set((rnd() - 0.5) * 0.4, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.4)
      q.setFromEuler(e)
      m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(size, size * (0.8 + rnd() * 0.4), size))
      buckets[placed % buckets.length].push(m.clone())
      placed++
    }
    return buckets
  }, [sampler, spec, geometries])

  return (
    <>
      {geometries.map((g, i) => (
        <InstancedRocks key={i} geometry={g} material={material} matrices={matrices[i]} castShadow={spec.castShadow} />
      ))}
    </>
  )
}

function InstancedRocks({ geometry, material, matrices, castShadow }: { geometry: THREE.BufferGeometry; material: THREE.Material; matrices: THREE.Matrix4[]; castShadow: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m))
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [matrices])
  if (!matrices.length) return null
  return <instancedMesh ref={ref} args={[geometry, material, matrices.length]} castShadow={castShadow} receiveShadow />
}

const BASALT_SHAPES: RockShape[] = ['boulder', 'angular', 'boulder', 'angular']
const LAYERED: RockShape[] = ['mesa', 'ridge', 'slab', 'spire']

function Formation({ o, sampler, basalt, layered }: { o: ArenaObstacle; sampler: TerrainSampler; basalt: THREE.Material; layered: THREE.Material }) {
  const seed = useMemo(() => [...o.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7), [o.id])
  const geometry = useMemo(() => makeRockGeometry(o.shape, seed, 4), [o.shape, seed])
  useEffect(() => () => geometry.dispose(), [geometry])
  const [x, z] = obstaclePosition(o)
  const scale = o.sizeM * 0.5
  const y = sampler.heightAt(x, z) - scale * 0.18
  const yaw = (-o.azimuthDeg * Math.PI) / 180 + ((seed % 100) / 100 - 0.5) * 0.5
  return (
    <mesh
      geometry={geometry}
      material={LAYERED.includes(o.shape) ? layered : basalt}
      position={[x, y, z]}
      rotation={[0, yaw, 0]}
      scale={scale}
      castShadow
      receiveShadow
      name={`formation-${o.id}`}
    />
  )
}

export function MarsRocks({ sampler, obstacles, quality }: { sampler: TerrainSampler; obstacles: ArenaObstacle[]; quality: GraphicsQuality }) {
  const basaltSet = usePbrSet('rock035')
  const layeredSet = usePbrSet('rock061')
  const basalt = useMemo(() => createRockMaterial(basaltSet, { scale: 0.9, tint: [0.52, 0.4, 0.34], sat: 0.3, dust: 0.38 }), [basaltSet])
  const layered = useMemo(() => createRockMaterial(layeredSet, { scale: 0.45, tint: [0.78, 0.55, 0.43], sat: 0.5, dust: 0.25 }), [layeredSet])
  useEffect(() => () => (basalt.dispose(), layered.dispose()), [basalt, layered])

  // Shadows are baked once; re-bake when the scan changes the formations.
  const gl = useThree((st) => st.gl)
  useEffect(() => {
    gl.shadowMap.needsUpdate = true
  }, [gl, obstacles])

  const high = quality === 'high'
  const specs = useMemo<ScatterSpec[]>(
    () => [
      { shapes: ['angular', 'boulder'], count: high ? 1400 : 600, minR: 1.2, maxR: 40, minSize: 0.03, maxSize: 0.12, detail: 1, castShadow: false, seed: 11 },
      { shapes: BASALT_SHAPES, count: high ? 220 : 110, minR: 2.5, maxR: 90, minSize: 0.15, maxSize: 0.7, detail: high ? 3 : 2, castShadow: true, seed: 23 },
      { shapes: ['boulder', 'angular'], count: high ? 40 : 20, minR: 14, maxR: 220, minSize: 0.9, maxSize: 3.2, detail: 3, castShadow: true, seed: 41 },
    ],
    [high],
  )

  return (
    <group name="mars-rocks">
      {specs.map((spec) => (
        <Scatter key={spec.seed} sampler={sampler} spec={spec} material={basalt} />
      ))}
      {obstacles.map((o) => (
        <Formation key={o.id} o={o} sampler={sampler} basalt={basalt} layered={layered} />
      ))}
    </group>
  )
}
