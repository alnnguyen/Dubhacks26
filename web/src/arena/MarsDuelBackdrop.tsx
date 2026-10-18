import { Suspense } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { MarsEnvironment } from './mars/MarsEnvironment'
import { ArenaCamera } from './mars/ArenaCamera'
import { OpponentCutout } from './OpponentCutout'
import { DEFAULT_LAYOUT, type ArenaObstacle } from './mars/obstacles'
import { render } from './mars/marsConfig'
import type { PersonMask } from './segmentation'
import type { PoseOverlay } from '../camera/mediapipeVision'
import type { GraphicsQuality } from '../ui/state/lobbyTypes'
import './arena.css'

export interface MarsDuelBackdropProps {
  /** The live camera element (hidden in immersive mode, still the CV input). */
  video: HTMLVideoElement | null
  mask: PersonMask
  pose: React.RefObject<PoseOverlay | null>
  deviceQuat: React.RefObject<THREE.Quaternion | null>
  obstacles?: ArenaObstacle[]
  quality?: GraphicsQuality
  mirror?: boolean
}

/**
 * Immersive Mars behind the duel: the real background is replaced by the 3D
 * Jezero arena, and the real opponent is composited in via segmentation. The
 * team's 2D rock overlay and HUD stay on top, unchanged.
 */
export function MarsDuelBackdrop({ video, mask, pose, deviceQuat, obstacles = DEFAULT_LAYOUT, quality = 'low', mirror = false }: MarsDuelBackdropProps) {
  return (
    <div className="mars-backdrop" aria-hidden>
      <Canvas
        dpr={[1, 1.25]}
        shadows="soft"
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.05
        }}
      >
        <Suspense fallback={null}>
          <MarsEnvironment quality={quality} obstacles={obstacles} />
          <ArenaCamera deviceQuat={deviceQuat} fov={58} />
        </Suspense>
        {video ? <OpponentCutout video={video} mask={mask} pose={pose} mirror={mirror} wrapColor={render.sky.horizon} /> : null}
      </Canvas>
    </div>
  )
}

export default MarsDuelBackdrop
