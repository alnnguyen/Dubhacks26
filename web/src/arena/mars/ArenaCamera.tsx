import { use, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { loadTerrainSampler } from './MarsEnvironment'

export const EYE_HEIGHT = 1.55

/** Look direction in radians; yaw 0 = forward (-z), positive = right. */
export interface Aim {
  yaw: number
  pitch: number
}

const UP = new THREE.Vector3(0, 1, 0)

/**
 * First-person camera standing on the terrain. `aim` is read every frame so a
 * device-orientation source can drive it without React re-renders. Drag adds
 * a manual offset (useful on desktop and when motion access is unavailable).
 */
export function ArenaCamera({
  aim,
  deviceQuat,
  fov = 62,
  drag = true,
  initialYawDeg = 0,
}: {
  aim?: React.RefObject<Aim>
  /** Phone orientation (see useDeviceAim); overrides `aim` while available. */
  deviceQuat?: React.RefObject<THREE.Quaternion | null>
  fov?: number
  drag?: boolean
  initialYawDeg?: number
}) {
  const sampler = use(loadTerrainSampler())
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const gl = useThree((s) => s.gl)
  const yaw0 = (initialYawDeg * Math.PI) / 180
  const offset = useRef<Aim>({ yaw: yaw0, pitch: -0.04 })
  const smooth = useRef<Aim>({ yaw: yaw0, pitch: -0.04 })

  useEffect(() => {
    camera.near = 0.05
    camera.far = 4000
    camera.fov = fov
    camera.updateProjectionMatrix()
  }, [camera, fov])

  useEffect(() => {
    if (!drag) return
    const el = gl.domElement
    let last: { x: number; y: number } | null = null
    const down = (e: PointerEvent) => (last = { x: e.clientX, y: e.clientY })
    const move = (e: PointerEvent) => {
      if (!last) return
      offset.current.yaw += ((e.clientX - last.x) / el.clientWidth) * 2.2
      offset.current.pitch = THREE.MathUtils.clamp(offset.current.pitch - ((e.clientY - last.y) / el.clientHeight) * 1.4, -0.7, 0.6)
      last = { x: e.clientX, y: e.clientY }
    }
    const up = () => (last = null)
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [gl, drag])

  const groundY = sampler.heightAt(0, 0)
  const target = useRef(new THREE.Quaternion())
  const dragQ = useRef(new THREE.Quaternion())
  useFrame((_, dt) => {
    camera.position.set(0, groundY + EYE_HEIGHT, 0)
    const dq = deviceQuat?.current
    if (dq) {
      // Phone orientation drives the view; drag still adds a yaw offset.
      dragQ.current.setFromAxisAngle(UP, -offset.current.yaw)
      target.current.copy(dragQ.current).multiply(dq)
      camera.quaternion.slerp(target.current, 1 - Math.exp(-dt * 22))
      return
    }
    const yaw = (aim?.current?.yaw ?? 0) + offset.current.yaw
    const pitch = (aim?.current?.pitch ?? 0) + offset.current.pitch
    const k = 1 - Math.exp(-dt * 12)
    smooth.current.yaw += (yaw - smooth.current.yaw) * k
    smooth.current.pitch += (pitch - smooth.current.pitch) * k
    camera.rotation.set(smooth.current.pitch, -smooth.current.yaw, 0, 'YXZ')
  })
  return null
}
