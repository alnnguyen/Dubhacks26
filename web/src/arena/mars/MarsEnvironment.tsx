import { Suspense, use, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { BakeShadows, Environment } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { MarsSky, sunDirection } from './MarsSky'
import { Terrain } from './terrain/Terrain'
import { createTerrainSampler, loadMola, type TerrainSampler } from './terrain/heightmap'
import { MarsRocks } from './Rocks'
import { Dust } from './Dust'
import { MarsPlatform } from './MarsPlatform'
import { CanyonCliffs } from './CanyonCliffs'
import { WindDust } from './WindDust'
import { render } from './marsConfig'
import type { ArenaObstacle } from './obstacles'
import type { GraphicsQuality } from '../../ui/state/lobbyTypes'

let samplerPromise: Promise<TerrainSampler> | null = null
export function loadTerrainSampler() {
  samplerPromise ??= loadMola().then(createTerrainSampler)
  return samplerPromise
}

export interface MarsEnvironmentProps {
  quality: GraphicsQuality
  obstacles: ArenaObstacle[]
  reducedMotion?: boolean
}

function Atmosphere() {
  const scene = useThree((s) => s.scene)
  useMemo(() => {
    scene.fog = new THREE.Fog(render.fog.color, render.fog.near, render.fog.far)
    scene.background = new THREE.Color(render.sky.horizon)
  }, [scene])
  return null
}

function MarsLights({ sunDir, quality, reducedMotion }: { sunDir: THREE.Vector3; quality: GraphicsQuality; reducedMotion: boolean }) {
  const pos = sunDir.clone().multiplyScalar(60)
  const sun = useRef<THREE.DirectionalLight>(null)
  // Dust aloft drifting across the sun: a slow, slight swell and fade in sunlight.
  useFrame(({ clock }) => {
    if (!sun.current || reducedMotion) return
    const t = clock.elapsedTime
    sun.current.intensity = render.sun.intensity * (1 + 0.05 * Math.sin(t * 0.13) + 0.03 * Math.sin(t * 0.41 + 1.3))
  })
  const size = quality === 'high' ? 2048 : 1024
  return (
    <>
      <hemisphereLight args={[render.ambient.sky, render.ambient.ground, render.ambient.intensity]} />
      {/* Low-angle sun: one shadow-casting light, shadows baked once (static scene). */}
      <directionalLight
        ref={sun}
        position={pos}
        intensity={render.sun.intensity}
        color={render.sun.color}
        castShadow
        shadow-mapSize={[size, size]}
        shadow-camera-left={-34}
        shadow-camera-right={34}
        shadow-camera-top={34}
        shadow-camera-bottom={-34}
        shadow-camera-near={1}
        shadow-camera-far={140}
        shadow-bias={-0.0006}
        shadow-normalBias={0.04}
      />
    </>
  )
}

/** The Jezero arena, meant to be placed inside an R3F <Canvas>. Player stands at the origin facing -z. */
export function MarsEnvironment({ quality, obstacles, reducedMotion = false }: MarsEnvironmentProps) {
  const sampler = use(loadTerrainSampler())
  const sunDir = useMemo(() => sunDirection(render.sunElevationDeg, render.sunAzimuthDeg), [])
  const skyColors = render.sky
  return (
    <>
      <Atmosphere />
      <MarsSky sunDir={sunDir} colors={skyColors} />
      {/* Image-based light from the same sky, rendered once into a small cube map. */}
      <Environment frames={1} resolution={64} environmentIntensity={0.45}>
        <MarsSky sunDir={sunDir} colors={skyColors} />
      </Environment>
      <MarsLights sunDir={sunDir} quality={quality} reducedMotion={reducedMotion} />
      <Suspense fallback={null}>
        <Terrain sampler={sampler} quality={quality} />
        <MarsPlatform y={sampler.floorY} />
        <CanyonCliffs sampler={sampler} />
        <MarsRocks sampler={sampler} obstacles={obstacles} quality={quality} />
        <BakeShadows />
      </Suspense>
      <Dust count={quality === 'high' ? 700 : 300} reducedMotion={reducedMotion} />
      <WindDust sampler={sampler} reducedMotion={reducedMotion} />
    </>
  )
}

export { loadTerrainSampler as preloadMarsTerrain }
