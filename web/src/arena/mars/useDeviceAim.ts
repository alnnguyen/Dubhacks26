import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

/**
 * "Magic window" phone orientation → camera rotation (same math as three.js
 * DeviceOrientationControls). The heading the phone points at when tracking
 * starts (or on recenter) becomes "forward" toward the opponent. Rotation
 * only: walking around is not tracked.
 */

export type AimStatus = 'unsupported' | 'needs-permission' | 'active' | 'denied'

type DOEWithPermission = { requestPermission?: () => Promise<'granted' | 'denied'> }

const Z_AXIS = new THREE.Vector3(0, 0, 1)
const Y_AXIS = new THREE.Vector3(0, 1, 0)
// Camera looks out of the back of the device, not the top.
const BACK_CAMERA = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5))

function deviceQuaternion(out: THREE.Quaternion, alpha: number, beta: number, gamma: number, screenAngle: number) {
  const euler = new THREE.Euler(beta, alpha, -gamma, 'YXZ')
  out.setFromEuler(euler)
  out.multiply(BACK_CAMERA)
  out.multiply(new THREE.Quaternion().setFromAxisAngle(Z_AXIS, -screenAngle))
  return out
}

function headingOf(q: THREE.Quaternion) {
  const f = new THREE.Vector3(0, 0, -1).applyQuaternion(q)
  return Math.atan2(f.x, -f.z) // radians, positive = right
}

export function useDeviceAim() {
  const quat = useRef<THREE.Quaternion | null>(null)
  const raw = useRef(new THREE.Quaternion())
  const align = useRef<THREE.Quaternion | null>(null)
  const listening = useRef(false)
  const [status, setStatus] = useState<AimStatus>(() => {
    if (typeof window === 'undefined' || typeof DeviceOrientationEvent === 'undefined') return 'unsupported'
    return (DeviceOrientationEvent as unknown as DOEWithPermission).requestPermission ? 'needs-permission' : 'active'
  })

  const onOrient = useCallback((e: DeviceOrientationEvent) => {
    if (e.alpha == null || e.beta == null || e.gamma == null) return
    const angle = THREE.MathUtils.degToRad(screen.orientation?.angle ?? (window as { orientation?: number }).orientation ?? 0)
    deviceQuaternion(raw.current, THREE.MathUtils.degToRad(e.alpha), THREE.MathUtils.degToRad(e.beta), THREE.MathUtils.degToRad(e.gamma), angle)
    if (!align.current) align.current = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, headingOf(raw.current))
    quat.current ??= new THREE.Quaternion()
    quat.current.copy(align.current).multiply(raw.current)
  }, [])

  const start = useCallback(() => {
    if (listening.current) return
    listening.current = true
    window.addEventListener('deviceorientation', onOrient)
  }, [onOrient])

  useEffect(() => {
    if (status === 'active') start()
    return () => {
      window.removeEventListener('deviceorientation', onOrient)
      listening.current = false
    }
  }, [status, start, onOrient])

  /** Must be called from a tap on iOS. */
  const request = useCallback(async () => {
    const DOE = DeviceOrientationEvent as unknown as DOEWithPermission
    if (!DOE.requestPermission) return setStatus('active')
    try {
      setStatus((await DOE.requestPermission()) === 'granted' ? 'active' : 'denied')
    } catch {
      setStatus('denied')
    }
  }, [])

  /** Make the current phone direction "forward". */
  const recenter = useCallback(() => {
    align.current = null
  }, [])

  return { quat, status, request, recenter }
}
