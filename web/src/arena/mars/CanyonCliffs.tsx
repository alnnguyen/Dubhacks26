import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { usePbrSet } from './terrain/Terrain'
import { createRockMaterial } from './rockGeometry'
import { fbm, type TerrainSampler } from './terrain/heightmap'

/**
 * Procedural layered canyon walls (artistic, not NASA terrain): curved cliff
 * bands beyond the arena, terraced into strata like the delta and crater-rim
 * outcrops in Perseverance panoramas, with eroded spurs. They sit ahead of and
 * behind the duel so both players' cameras frame them. Each column of the wall
 * starts below the real terrain height so the foot is always buried.
 */
const WALLS = [
  // theta 0 = +z (behind slot 1), π = −z (ahead of slot 1); x = sin θ, z = cos θ.
  { center: Math.PI, span: 1.9, radius: 165, height: 52, seed: 3 },
  { center: 0, span: 1.6, radius: 190, height: 64, seed: 11 },
  { center: Math.PI * 0.55, span: 0.8, radius: 230, height: 40, seed: 23 },
]

function buildWall(sampler: TerrainSampler, w: (typeof WALLS)[number]) {
  const cols = 220, rows = 40
  const positions: number[] = [], uvs: number[] = [], index: number[] = []
  for (let j = 0; j <= rows; j++) {
    const v = j / rows
    for (let i = 0; i <= cols; i++) {
      const u = i / cols
      const theta = w.center - w.span / 2 + u * w.span
      const edgeFade = Math.min(1, Math.min(u, 1 - u) * 6)
      // Silhouette: a ragged skyline with spurs and notches.
      const top = w.height * edgeFade * (0.7 + 0.3 * (fbm(theta * 9 + w.seed, 0.5, 4) + 0.5))
      const y = v * top
      // Strata: terraces every ~5 m, recessed soft layers between harder caps.
      const layer = y / 5.2
      const terrace = (layer - Math.floor(layer)) < 0.35 ? 1.6 : 0
      const erosion = fbm(theta * 22 + w.seed, y * 0.07, 4) * 7 + fbm(theta * 70, y * 0.25, 2) * 1.5
      // Walls lean back as they rise, so the canyon reads as a slope, not a fence.
      const r = w.radius + v * 14 + erosion - terrace
      const x = Math.sin(theta) * r, z = Math.cos(theta) * r
      const base = sampler.heightAt(Math.sin(theta) * w.radius, Math.cos(theta) * w.radius) - 6
      positions.push(x, base + y, z)
      uvs.push(u * 12, v * 4)
    }
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1
    index.push(a, c, b, b, c, d)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(index)
  geo.computeVertexNormals()
  return geo
}

export function CanyonCliffs({ sampler }: { sampler: TerrainSampler }) {
  const set = usePbrSet('rock061')
  const material = useMemo(() => {
    const m = createRockMaterial(set, { scale: 0.08, tint: [0.8, 0.52, 0.4], sat: 0.55, dust: 0.3 })
    m.side = THREE.DoubleSide
    return m
  }, [set])
  const geometries = useMemo(() => WALLS.map((w) => buildWall(sampler, w)), [sampler])
  useEffect(() => () => { geometries.forEach((g) => g.dispose()); material.dispose() }, [geometries, material])
  return (
    <>
      {geometries.map((g, i) => <mesh key={i} geometry={g} material={material} receiveShadow />)}
    </>
  )
}
