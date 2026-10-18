import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import type { Landmark, Point } from "../vision/types"

/** Phone-friendly handgun asset — drop the 1k-texture GLB here. */
export const GUN_MODEL_URL = "/models/gun.glb"

/** How quickly yaw catches left/right aim (1/s). */
export const GUN_ROT_FOLLOW = 10
/** How quickly position catches the palm. */
export const GUN_POS_FOLLOW = 16
/** Max yaw from center (radians) — keeps the blaster from spinning wildly. */
export const GUN_YAW_MAX = 0.7
/** Horizontal aim gain: screen Δx → yaw. */
export const GUN_YAW_GAIN = 4.2
/** Shift grip up in screen space (y grows down) so the handle sits in the palm. */
export const GUN_GRIP_Y_NUDGE = -0.07
/** Push the blaster along the barrel (into the scene / toward aim). */
export const GUN_FORWARD_NUDGE = 0.11
/** Bias grip toward the index tip so the handle reads in front of the fist. */
export const GUN_GRIP_MUZZLE_MIX = 0.18

export type GunPose = {
  /** Normalized screen point for the grip (0..1, y down). */
  grip: Point
  /** Normalized aim tip (index finger). */
  muzzle: Point
  /** Palm across: pinky MCP → index MCP (y down). Drives roll / left-right twist. */
  across: Point
  /** Palm forward: wrist → middle MCP (y down). */
  palmForward: Point
  /** Approximate hand size in screen units (for scale). */
  span: number
}

export type GunModelHandle = {
  ready: boolean
  missing: boolean
  resize(width: number, height: number): void
  /** Show and pose the gun, or hide when pose is null. */
  draw(pose: GunPose | null, recoil01?: number): void
  dispose(): void
}

function landmarkPoint(landmarks: Landmark[], index: number): Point | null {
  const p = landmarks[index]
  if (!p) return null
  return { x: p.x, y: p.y }
}

function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y }
}

/** Build a gun pose from MediaPipe hand landmarks (palm center → index tip). */
export function gunPoseFromLandmarks(landmarks: Landmark[] | null | undefined): GunPose | null {
  if (!landmarks || landmarks.length < 21) return null
  const wrist = landmarkPoint(landmarks, 0)
  const indexMcp = landmarkPoint(landmarks, 5)
  const middleMcp = landmarkPoint(landmarks, 9)
  const indexTip = landmarkPoint(landmarks, 8)
  const pinkyMcp = landmarkPoint(landmarks, 17)
  if (!wrist || !indexMcp || !middleMcp || !indexTip || !pinkyMcp) return null
  // Sit the grip on the palm, then bias toward the fingers so the gun sits forward of the fist.
  const palm = {
    x: wrist.x * 0.15 + middleMcp.x * 0.55 + indexMcp.x * 0.3,
    y: wrist.y * 0.15 + middleMcp.y * 0.55 + indexMcp.y * 0.3 + GUN_GRIP_Y_NUDGE,
  }
  const grip = {
    x: palm.x + (indexTip.x - palm.x) * GUN_GRIP_MUZZLE_MIX,
    y: palm.y + (indexTip.y - palm.y) * GUN_GRIP_MUZZLE_MIX,
  }
  const across = sub(indexMcp, pinkyMcp)
  const palmForward = sub(middleMcp, wrist)
  const span = Math.hypot(across.x, across.y)
  return {
    grip,
    muzzle: indexTip,
    across,
    palmForward,
    span: Math.max(0.05, span),
  }
}

/**
 * Yaw-only from horizontal hand aim (left/right). No pitch or roll —
 * vertical finger noise and palm twist no longer tumble the blaster.
 */
export function yawFromPose(pose: GunPose): number {
  let dx = pose.muzzle.x - pose.grip.x
  // Fist grip often has a short muzzle vector; fall back to palm across.
  if (Math.abs(dx) < 0.018) dx = pose.across.x * 0.55
  if (Math.abs(dx) < 0.012) dx = pose.palmForward.x
  return THREE.MathUtils.clamp(dx * GUN_YAW_GAIN, -GUN_YAW_MAX, GUN_YAW_MAX)
}

/**
 * Orthonormal basis with world-up locked. Barrel (+Z) yaws left/right only.
 */
export function handBasisFromPose(pose: GunPose): {
  right: THREE.Vector3
  up: THREE.Vector3
  forward: THREE.Vector3
  yaw: number
} {
  const yaw = yawFromPose(pose)
  // +Z barrel into the scene, yawed around world Y.
  const forward = new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw))
  const up = new THREE.Vector3(0, 1, 0)
  const right = new THREE.Vector3().crossVectors(up, forward).normalize()
  return { right, up, forward, yaw }
}

/**
 * Transparent WebGL layer that draws a GLB handgun anchored to the player's hand.
 * If the asset is missing, `missing` stays true and draw is a no-op.
 */
export function createGunModel(canvas: HTMLCanvasElement, url = GUN_MODEL_URL): GunModelHandle {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  })
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  // Close camera + near gun plane → gun reads large over the hand skeleton.
  const camera = new THREE.PerspectiveCamera(48, 1, 0.05, 20)
  const camZ = 1.2
  camera.position.set(0, 0, camZ)

  const key = new THREE.DirectionalLight(0xffffff, 2.6)
  key.position.set(0.4, 0.9, 1.6)
  scene.add(key)
  scene.add(new THREE.AmbientLight(0xc8dcff, 0.7))
  const fill = new THREE.DirectionalLight(0x88ccff, 0.85)
  fill.position.set(-1.0, -0.3, 1.2)
  scene.add(fill)

  const root = new THREE.Group()
  root.visible = false
  scene.add(root)

  let disposed = false
  let ready = false
  let missing = false
  let baseSize = 1
  let lastMs = 0
  const smoothPos = new THREE.Vector3()
  const smoothQuat = new THREE.Quaternion()
  let smoothYaw = 0
  let smoothReady = false
  const targetQuat = new THREE.Quaternion()
  const basisMat = new THREE.Matrix4()
  const yawRight = new THREE.Vector3()
  const yawUp = new THREE.Vector3(0, 1, 0)
  const yawForward = new THREE.Vector3()

  const loader = new GLTFLoader()
  loader.load(
    url,
    (gltf) => {
      if (disposed) return
      const model = gltf.scene
      model.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        if (mesh.isMesh) {
          mesh.castShadow = false
          mesh.receiveShadow = false
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          for (const mat of materials) {
            const std = mat as THREE.MeshStandardMaterial
            if (std.map) std.map.colorSpace = THREE.SRGBColorSpace
            std.needsUpdate = true
          }
        }
      })
      const box = new THREE.Box3().setFromObject(model)
      const size = new THREE.Vector3()
      box.getSize(size)
      baseSize = Math.max(size.x, size.y, size.z, 0.001)
      // Point the barrel along +Z so basis forward aims the muzzle.
      const center = new THREE.Vector3()
      box.getCenter(center)
      model.position.sub(center)
      // X-9 blaster is authored with length mostly on Z; keep +Z = barrel.
      root.add(model)
      ready = true
    },
    undefined,
    () => {
      if (disposed) return
      missing = true
      ready = false
    },
  )

  function resize(width: number, height: number) {
    if (disposed || width < 2 || height < 2) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    renderer.setPixelRatio(dpr)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }

  function draw(pose: GunPose | null, recoil01 = 0) {
    if (disposed) return
    if (!ready || missing || !pose) {
      root.visible = false
      smoothReady = false
      renderer.render(scene, camera)
      return
    }

    const now = performance.now()
    const dt = lastMs > 0 ? Math.min(0.05, (now - lastMs) / 1000) : 1 / 60
    lastMs = now
    const rotAlpha = 1 - Math.exp(-GUN_ROT_FOLLOW * dt)
    const posAlpha = 1 - Math.exp(-GUN_POS_FOLLOW * dt)

    // Plane just in front of the camera so the gun overlays the CV hand at large scale.
    const planeZ = 0.22
    const dist = Math.max(0.2, camZ - planeZ)
    const vFOV = (camera.fov * Math.PI) / 180
    const worldH = 2 * Math.tan(vFOV / 2) * dist
    const worldW = worldH * camera.aspect

    const ndcX = pose.grip.x * 2 - 1
    const ndcY = -(pose.grip.y * 2 - 1)
    const targetPos = new THREE.Vector3(ndcX * (worldW / 2), ndcY * (worldH / 2), planeZ)
    const targetYaw = yawFromPose(pose)

    root.visible = true
    if (!smoothReady) {
      smoothPos.copy(targetPos)
      smoothYaw = targetYaw
      smoothReady = true
    } else {
      smoothPos.lerp(targetPos, posAlpha)
      smoothYaw += (targetYaw - smoothYaw) * rotAlpha
    }

    yawForward.set(Math.sin(smoothYaw), 0, -Math.cos(smoothYaw))
    yawRight.crossVectors(yawUp, yawForward).normalize()
    basisMat.makeBasis(yawRight, yawUp, yawForward)
    targetQuat.setFromRotationMatrix(basisMat)
    smoothQuat.copy(targetQuat)

    root.position.copy(smoothPos)
    root.quaternion.copy(smoothQuat)
    // Seat the model slightly ahead of the palm along the barrel.
    root.position.addScaledVector(yawForward, GUN_FORWARD_NUDGE)

    // Size the blaster as a big fraction of the frame, scaled by tracked palm span.
    const screenFrac = Math.min(0.72, Math.max(0.42, pose.span * 5.5))
    const targetLen = worldH * screenFrac
    const scale = targetLen / baseSize
    const kick = 1 - Math.min(1, Math.max(0, recoil01)) * 0.1
    root.scale.setScalar(scale * kick)
    root.position.addScaledVector(yawForward, -recoil01 * 0.05)

    renderer.render(scene, camera)
  }

  function dispose() {
    disposed = true
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (mesh.isMesh) {
        mesh.geometry?.dispose()
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        for (const mat of mats) mat.dispose()
      }
    })
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
