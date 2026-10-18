/**
 * First-person lightsaber overlay: grip at wrist/palm, tip along index, blade ignited while drawn.
 * Hits are server-timed slashes — this mesh is cosmetic aim feedback only.
 */
import * as THREE from "three"
type Landmark = { x: number; y: number; z?: number }
import { Lightsaber } from "./Lightsaber"

export const SABER_MODEL_URL = "/models/saber.glb"

const WRIST = 0
const INDEX_MCP = 5
const INDEX_TIP = 8
const MIDDLE_MCP = 9
const PINKY_MCP = 17

/** Hilt as a fraction of frame height — keep compact for first-person. */
export const SABER_HILT_SCREEN_FRAC = 0.16
/** How far the tip extends past the index (screen units). */
export const SABER_TIP_EXTEND = 0.22
/**
 * MediaPipe hand `z` → world depth. More negative z = closer to camera.
 * Maps into overlay space so the blade leaves the flat screen plane.
 */
export const SABER_DEPTH_GAIN = 0.55
export const SABER_DEPTH_BASE = 0.26

export type SaberPose = {
  grip: { x: number; y: number }
  tip: { x: number; y: number }
  /** Relative depth vs wrist (MediaPipe z); more negative = nearer lens. */
  gripDepth: number
  tipDepth: number
  span: number
}

export type SaberModelHandle = {
  readonly ready: boolean
  readonly missing: boolean
  resize(width: number, height: number): void
  /** `slash01` 0..1 kick after a slash. */
  draw(pose: SaberPose | null, slash01?: number, ignited?: boolean): void
  dispose(): void
}

function dist2(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}

export function saberPoseFromLandmarks(landmarks: Landmark[] | null | undefined): SaberPose | null {
  if (!landmarks || landmarks.length < 21) return null
  const wrist = landmarks[WRIST]
  const indexMcp = landmarks[INDEX_MCP]
  const indexTip = landmarks[INDEX_TIP]
  const mid = landmarks[MIDDLE_MCP]
  const pinky = landmarks[PINKY_MCP]
  if (!wrist || !indexMcp || !indexTip || !mid || !pinky) return null

  const palm = {
    x: (wrist.x + indexMcp.x + mid.x + pinky.x) / 4,
    y: (wrist.y + indexMcp.y + mid.y + pinky.y) / 4,
  }
  const tip = {
    x: indexTip.x + (indexTip.x - palm.x) * SABER_TIP_EXTEND,
    y: indexTip.y + (indexTip.y - palm.y) * SABER_TIP_EXTEND,
  }
  const wristZ = wrist.z ?? 0
  const palmZ =
    ((wrist.z ?? 0) + (indexMcp.z ?? 0) + (mid.z ?? 0) + (pinky.z ?? 0)) / 4 - wristZ
  const tipZ = (indexTip.z ?? 0) - wristZ
  const span = Math.max(0.04, dist2(indexMcp, pinky))
  return { grip: palm, tip, gripDepth: palmZ, tipDepth: tipZ, span }
}

export function createSaberModel(canvas: HTMLCanvasElement, url = SABER_MODEL_URL): SaberModelHandle {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  })
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 20)
  const camZ = 0.95
  camera.position.set(0, 0, camZ)
  camera.lookAt(0, 0, 0)

  scene.add(new THREE.AmbientLight(0xffffff, 0.85))
  const key = new THREE.DirectionalLight(0xffffff, 0.9)
  key.position.set(0.4, 0.8, 1.2)
  scene.add(key)

  let saber: Lightsaber | null = null
  let ready = false
  let missing = false
  let disposed = false
  let lastMs = 0
  let smoothReady = false
  const smoothFrom = new THREE.Vector3()
  const smoothTo = new THREE.Vector3()
  const tmpFrom = new THREE.Vector3()
  const tmpTo = new THREE.Vector3()

  void Lightsaber.load(url, { color: "cyan", ignited: true, light: false, flicker: 0.28 })
    .then((loaded) => {
      if (disposed) {
        loaded.dispose()
        return
      }
      saber = loaded
      scene.add(loaded.object)
      ready = true
    })
    .catch(() => {
      missing = true
    })

  function resize(width: number, height: number) {
    if (disposed || width < 2 || height < 2) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    renderer.setPixelRatio(dpr)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }

  function ndcToPlane(nx: number, ny: number, planeZ: number, worldW: number, worldH: number): THREE.Vector3 {
    return new THREE.Vector3(nx * (worldW / 2), ny * (worldH / 2), planeZ)
  }

  function draw(pose: SaberPose | null, slash01 = 0, ignited = true) {
    if (disposed) return
    if (!ready || missing || !saber || !pose) {
      if (saber) saber.object.visible = false
      smoothReady = false
      renderer.render(scene, camera)
      return
    }

    const now = performance.now()
    const dt = lastMs > 0 ? Math.min(0.05, (now - lastMs) / 1000) : 1 / 60
    lastMs = now
    saber.update(dt)

    if (ignited && !saber.isOn) saber.ignite(0.2)
    if (!ignited && saber.isOn) saber.retract(0.15)

    const planeZ = 0.22
    const dist = Math.max(0.2, camZ - planeZ)
    const vFOV = (camera.fov * Math.PI) / 180
    const worldH = 2 * Math.tan(vFOV / 2) * dist
    const worldW = worldH * camera.aspect

    const gripNdcX = pose.grip.x * 2 - 1
    const gripNdcY = -(pose.grip.y * 2 - 1)
    const tipNdcX = pose.tip.x * 2 - 1
    const tipNdcY = -(pose.tip.y * 2 - 1)

    tmpFrom.copy(ndcToPlane(gripNdcX, gripNdcY, planeZ, worldW, worldH))
    tmpTo.copy(ndcToPlane(tipNdcX, tipNdcY, planeZ, worldW, worldH))

    // Prefer upright blade when the tip is nearly on the grip (noisy CV).
    if (tmpFrom.distanceToSquared(tmpTo) < 1e-6) {
      tmpTo.set(tmpFrom.x, tmpFrom.y + worldH * 0.35, planeZ)
    }

    const posAlpha = 1 - Math.exp(-5.5 * dt)
    const rotAlpha = 1 - Math.exp(-6.5 * dt)
    if (!smoothReady) {
      smoothFrom.copy(tmpFrom)
      smoothTo.copy(tmpTo)
      smoothReady = true
    } else {
      smoothFrom.lerp(tmpFrom, posAlpha)
      smoothTo.lerp(tmpTo, rotAlpha)
    }

    saber.object.visible = true
    saber.alignToSegment(smoothFrom, smoothTo)

    const hiltFrac = Math.min(0.18, Math.max(0.11, pose.span * 2.4 * SABER_HILT_SCREEN_FRAC))
    const scale = (worldH * hiltFrac) / 0.28
    const kick = 1 + Math.min(1, Math.max(0, slash01)) * 0.06
    saber.object.scale.setScalar(scale * kick)

    renderer.render(scene, camera)
  }

  function dispose() {
    disposed = true
    saber?.dispose()
    saber = null
    renderer.dispose()
  }

  return {
    get ready() {
      return ready
    },
    get missing() {
      return missing
    },
    resize,
    draw,
    dispose,
  }
}
