import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { createTerrainMaterial, type PbrSet } from './terrainMaterial'
import type { TerrainSampler } from './heightmap'
import type { GraphicsQuality } from '../../../ui/state/lobbyTypes'

const TEX = '/arena/mars/textures/'

export function usePbrSet(name: string): PbrSet {
  const gl = useThree((s) => s.gl)
  const [color, normal, rough, height] = useTexture([
    `${TEX}${name}_color.jpg`,
    `${TEX}${name}_normal.jpg`,
    `${TEX}${name}_rough.jpg`,
    `${TEX}${name}_height.jpg`,
  ])
  return useMemo(() => {
    const aniso = Math.min(8, gl.capabilities.getMaxAnisotropy())
    color.colorSpace = THREE.SRGBColorSpace
    for (const t of [normal, rough, height]) t.colorSpace = THREE.NoColorSpace
    for (const t of [color, normal, rough, height]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.anisotropy = aniso
      t.needsUpdate = true
    }
    return { color, normal, rough, height }
  }, [color, normal, rough, height, gl])
}

/**
 * Polar-grid terrain: ring radii grow as r = R·(i/N)^k, so vertices are dense
 * under the players and sparse at the crater rim. One mesh, one draw call.
 */
function buildTerrainGeometry(sampler: TerrainSampler, radius: number, rings: number, segments: number) {
  const k = 2.6
  const positions: number[] = [0, sampler.groundAt(0, 0), 0]
  for (let i = 1; i <= rings; i++) {
    const r = radius * Math.pow(i / rings, k)
    for (let j = 0; j < segments; j++) {
      const a = (j / segments) * Math.PI * 2
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      positions.push(x, sampler.groundAt(x, z), z)
    }
  }
  const index: number[] = []
  const ringStart = (i: number) => 1 + (i - 1) * segments
  for (let j = 0; j < segments; j++) index.push(0, 1 + ((j + 1) % segments), 1 + j)
  for (let i = 1; i < rings; i++) {
    const a0 = ringStart(i)
    const b0 = ringStart(i + 1)
    for (let j = 0; j < segments; j++) {
      const j1 = (j + 1) % segments
      index.push(a0 + j, a0 + j1, b0 + j, a0 + j1, b0 + j1, b0 + j)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(index)
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  return geo
}

export function Terrain({ sampler, quality }: { sampler: TerrainSampler; quality: GraphicsQuality }) {
  const regolith = usePbrSet('ground079s')
  const sand = usePbrSet('ground097')
  const rock = usePbrSet('rock061')
  const radius = Math.min(1600, sampler.halfExtent * 0.95)
  const geometry = useMemo(
    () => (quality === 'high' ? buildTerrainGeometry(sampler, radius, 190, 240) : buildTerrainGeometry(sampler, radius, 120, 150)),
    [sampler, radius, quality],
  )
  const material = useMemo(() => createTerrainMaterial({ regolith, sand, rock }, quality === 'high' ? 80 : 50), [regolith, sand, rock, quality])
  useEffect(() => () => (geometry.dispose(), material.dispose()), [geometry, material])
  return <mesh geometry={geometry} material={material} receiveShadow name="mars-terrain" />
}
