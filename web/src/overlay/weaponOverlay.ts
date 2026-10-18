/**
 * Single WebGL weapon layer: gun + saber share one renderer.
 * Swap by visibility only — never dispose/recreate on weapon change (fixes stuck gun).
 */
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import type { Landmark } from "../vision/types"
import {
  GUN_FORWARD_NUDGE,
  GUN_MODEL_URL,
  GUN_POS_FOLLOW,
  GUN_ROT_FOLLOW,
  gunPoseFromLandmarks,
  yawFromPose,
  type GunPose,
} from "./gunModel"
import { Lightsaber } from "./Lightsaber"
import {
  SABER_DEPTH_BASE,
  SABER_DEPTH_GAIN,
  SABER_HILT_SCREEN_FRAC,
  SABER_MODEL_URL,
  saberPoseFromLandmarks,
  type SaberPose,
} from "./saberModel"

export type WeaponOverlayKind = "rock" | "gun" | "saber"

export type WeaponOverlayHandle = {
  resize(width: number, height: number): void
  draw(args: {
    weapon: WeaponOverlayKind
    landmarks: Landmark[] | null | undefined
    recoil01?: number
    slash01?: number
    /** Tip velocity for snappier saber follow / trail. */
    tipSpeed?: number
    swingDx?: number
    swingDy?: number
  }): void
  dispose(): void
}

/** Soft follow — high rates make MediaPipe noise look like a vibrating flat sticker. */
const SABER_POS_IDLE = 5.5
const SABER_POS_SWING = 11
const SABER_ROT_IDLE = 6.5
const SABER_ROT_SWING = 12
const TRAIL_COUNT = 5
const Y_UP = new THREE.Vector3(0, 1, 0)

export function createWeaponOverlay(canvas: HTMLCanvasElement): WeaponOverlayHandle {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  })
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(46, 1, 0.05, 20)
  const camZ = 1.1
  camera.position.set(0, 0, camZ)

  scene.add(new THREE.AmbientLight(0xc8dcff, 0.75))
  const key = new THREE.DirectionalLight(0xffffff, 2.4)
  key.position.set(0.4, 0.9, 1.6)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0x88ccff, 0.7)
  fill.position.set(-1.0, -0.3, 1.2)
  scene.add(fill)

  const gunRoot = new THREE.Group()
  gunRoot.visible = false
  scene.add(gunRoot)

  let disposed = false
  let gunReady = false
  let gunMissing = false
  let gunBaseSize = 1
  let saber: Lightsaber | null = null
  let saberReady = false
  let saberMissing = false

  let lastMs = 0
  let gunSmoothReady = false
  const gunSmoothPos = new THREE.Vector3()
  let gunSmoothYaw = 0
  const yawRight = new THREE.Vector3()
  const yawUp = new THREE.Vector3(0, 1, 0)
  const yawForward = new THREE.Vector3()
  const basisMat = new THREE.Matrix4()
  const targetQuat = new THREE.Quaternion()

  let saberSmoothReady = false
  const saberFrom = new THREE.Vector3()
  const saberTo = new THREE.Vector3()
  const tmpFrom = new THREE.Vector3()
  const tmpTo = new THREE.Vector3()
  const saberSmoothQuat = new THREE.Quaternion()
  const saberTargetQuat = new THREE.Quaternion()
  let saberSmoothScale = 1

  // Tip trail ghosts (small emissive spheres).
  const trailMats: THREE.MeshBasicMaterial[] = []
  const trailMeshes: THREE.Mesh[] = []
  const trailGeom = new THREE.SphereGeometry(0.012, 8, 8)
  for (let i = 0; i < TRAIL_COUNT; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x22e5ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    const mesh = new THREE.Mesh(trailGeom, mat)
    mesh.visible = false
    scene.add(mesh)
    trailMats.push(mat)
    trailMeshes.push(mesh)
  }
  const trailHistory: THREE.Vector3[] = []

  new GLTFLoader().load(
    GUN_MODEL_URL,
    (gltf) => {
      if (disposed) return
      const model = gltf.scene
      model.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        if (!mesh.isMesh) return
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        for (const mat of materials) {
          const std = mat as THREE.MeshStandardMaterial
          if (std.map) std.map.colorSpace = THREE.SRGBColorSpace
          std.needsUpdate = true
        }
      })
      const box = new THREE.Box3().setFromObject(model)
      const size = new THREE.Vector3()
      box.getSize(size)
      gunBaseSize = Math.max(size.x, size.y, size.z, 0.001)
      const center = new THREE.Vector3()
      box.getCenter(center)
      model.position.sub(center)
      gunRoot.add(model)
      gunReady = true
    },
    undefined,
    () => {
      gunMissing = true
    },
  )

  void Lightsaber.load(SABER_MODEL_URL, { color: "cyan", ignited: true, light: false, flicker: 0.28 })
    .then((loaded) => {
      if (disposed) {
        loaded.dispose()
        return
      }
      saber = loaded
      loaded.object.visible = false
      scene.add(loaded.object)
      saberReady = true
    })
    .catch(() => {
      saberMissing = true
    })

  function resize(width: number, height: number) {
    if (disposed || width < 2 || height < 2) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    renderer.setPixelRatio(dpr)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }

  function planeMetrics() {
    const planeZ = 0.22
    const dist = Math.max(0.2, camZ - planeZ)
    const vFOV = (camera.fov * Math.PI) / 180
    const worldH = 2 * Math.tan(vFOV / 2) * dist
    const worldW = worldH * camera.aspect
    return { planeZ, worldH, worldW }
  }

  function ndcToPlane(nx: number, ny: number, planeZ: number, worldW: number, worldH: number) {
    return new THREE.Vector3(nx * (worldW / 2), ny * (worldH / 2), planeZ)
  }

  function hideTrail() {
    for (const mesh of trailMeshes) mesh.visible = false
    for (const mat of trailMats) mat.opacity = 0
    trailHistory.length = 0
  }

  function drawGun(pose: GunPose, recoil01: number, dt: number) {
    gunRoot.visible = true
    if (saber) saber.object.visible = false
    hideTrail()

    const { planeZ, worldH, worldW } = planeMetrics()
    const rotAlpha = 1 - Math.exp(-GUN_ROT_FOLLOW * dt)
    const posAlpha = 1 - Math.exp(-GUN_POS_FOLLOW * dt)
    const ndcX = pose.grip.x * 2 - 1
    const ndcY = -(pose.grip.y * 2 - 1)
    const targetPos = new THREE.Vector3(ndcX * (worldW / 2), ndcY * (worldH / 2), planeZ)
    const targetYaw = yawFromPose(pose)

    if (!gunSmoothReady) {
      gunSmoothPos.copy(targetPos)
      gunSmoothYaw = targetYaw
      gunSmoothReady = true
    } else {
      gunSmoothPos.lerp(targetPos, posAlpha)
      gunSmoothYaw += (targetYaw - gunSmoothYaw) * rotAlpha
    }

    yawForward.set(Math.sin(gunSmoothYaw), 0, -Math.cos(gunSmoothYaw))
    yawRight.crossVectors(yawUp, yawForward).normalize()
    basisMat.makeBasis(yawRight, yawUp, yawForward)
    targetQuat.setFromRotationMatrix(basisMat)

    gunRoot.position.copy(gunSmoothPos)
    gunRoot.quaternion.copy(targetQuat)
    gunRoot.position.addScaledVector(yawForward, GUN_FORWARD_NUDGE)

    const screenFrac = Math.min(0.72, Math.max(0.42, pose.span * 5.5))
    const scale = (worldH * screenFrac) / gunBaseSize
    const kick = 1 - Math.min(1, Math.max(0, recoil01)) * 0.1
    gunRoot.scale.setScalar(scale * kick)
    gunRoot.position.addScaledVector(yawForward, -recoil01 * 0.05)
  }

  /** Landmark depth → world Z (toward camera when hand is nearer). */
  function depthToWorldZ(relDepth: number): number {
    // MediaPipe: more negative z ≈ closer to lens → push toward camera (+Z).
    const z = SABER_DEPTH_BASE + -relDepth * SABER_DEPTH_GAIN
    return THREE.MathUtils.clamp(z, 0.08, camZ - 0.25)
  }

  function landmarkToWorld(x: number, y: number, relDepth: number): THREE.Vector3 {
    const worldZ = depthToWorldZ(relDepth)
    // Perspective: points farther from camera (smaller Z) occupy less of the FOV plane.
    const dist = Math.max(0.15, camZ - worldZ)
    const vFOV = (camera.fov * Math.PI) / 180
    const planeH = 2 * Math.tan(vFOV / 2) * dist
    const planeW = planeH * camera.aspect
    const ndcX = x * 2 - 1
    const ndcY = -(y * 2 - 1)
    return new THREE.Vector3(ndcX * (planeW / 2), ndcY * (planeH / 2), worldZ)
  }

  function drawSaber(
    pose: SaberPose,
    slash01: number,
    tipSpeed: number,
    swingDx: number,
    swingDy: number,
    dt: number,
  ) {
    if (!saber || saberMissing) return
    gunRoot.visible = false
    saber.object.visible = true
    saber.update(dt)
    if (!saber.isOn) saber.ignite(0.18)

    const { worldH } = planeMetrics()
    const swinging = tipSpeed > 0.7 || slash01 > 0.05
    const posFollow = swinging ? SABER_POS_SWING : SABER_POS_IDLE
    const rotFollow = swinging ? SABER_ROT_SWING : SABER_ROT_IDLE
    const posAlpha = 1 - Math.exp(-posFollow * dt)
    const rotAlpha = 1 - Math.exp(-rotFollow * dt)

    let tipX = pose.tip.x
    let tipY = pose.tip.y
    let tipDepth = pose.tipDepth
    // Soft slash bias — keep small so it doesn't yank the mesh sideways.
    if (slash01 > 0.02) {
      tipX += swingDx * 0.18 * slash01
      tipY += swingDy * 0.18 * slash01
      tipDepth -= 0.04 * slash01 // tip flares slightly toward camera on cut
    }

    tmpFrom.copy(landmarkToWorld(pose.grip.x, pose.grip.y, pose.gripDepth))
    tmpTo.copy(landmarkToWorld(tipX, tipY, tipDepth))
    if (tmpFrom.distanceToSquared(tmpTo) < 1e-6) {
      tmpTo.set(tmpFrom.x, tmpFrom.y + 0.12, tmpFrom.z - 0.04)
    }

    // Ensure tip extends meaningfully in 3D (blade length in world).
    const bladeDir = new THREE.Vector3().subVectors(tmpTo, tmpFrom)
    if (bladeDir.length() < 0.08) {
      bladeDir.set(0, 0.14, -0.06).normalize().multiplyScalar(0.16)
      tmpTo.copy(tmpFrom).add(bladeDir)
    }

    if (!saberSmoothReady) {
      saberFrom.copy(tmpFrom)
      saberTo.copy(tmpTo)
      const initDir = new THREE.Vector3().subVectors(saberTo, saberFrom).normalize()
      saberTargetQuat.setFromUnitVectors(Y_UP, initDir)
      saberSmoothQuat.copy(saberTargetQuat)
      saberSmoothReady = true
    } else {
      saberFrom.lerp(tmpFrom, posAlpha)
      saberTo.lerp(tmpTo, posAlpha)
      const dir = new THREE.Vector3().subVectors(saberTo, saberFrom)
      if (dir.lengthSq() > 1e-8) {
        saberTargetQuat.setFromUnitVectors(Y_UP, dir.normalize())
        saberSmoothQuat.slerp(saberTargetQuat, rotAlpha)
      }
    }

    saber.object.position.copy(saberFrom)
    saber.object.quaternion.copy(saberSmoothQuat)

    // Compact hilt: ~12–18% of frame, scaled by palm span + slight depth foreshortening.
    const depthScale = THREE.MathUtils.clamp(1.05 - pose.gripDepth * 0.8, 0.85, 1.15)
    const hiltFrac = THREE.MathUtils.clamp(pose.span * 2.4 * SABER_HILT_SCREEN_FRAC, 0.11, 0.18)
    const targetScale = ((worldH * hiltFrac) / 0.28) * depthScale
    const scaleAlpha = 1 - Math.exp(-7 * dt)
    saberSmoothScale += (targetScale - saberSmoothScale) * (saberSmoothScale < 0.01 ? 1 : scaleAlpha)
    const kick = 1 + Math.min(1, Math.max(0, slash01)) * 0.06
    saber.object.scale.setScalar(saberSmoothScale * kick)

    // Trail follows smoothed tip in 3D.
    if (swinging || slash01 > 0.05) {
      trailHistory.unshift(saberTo.clone())
      if (trailHistory.length > TRAIL_COUNT) trailHistory.length = TRAIL_COUNT
      for (let i = 0; i < TRAIL_COUNT; i++) {
        const p = trailHistory[i]
        const mesh = trailMeshes[i]!
        const mat = trailMats[i]!
        if (!p) {
          mesh.visible = false
          continue
        }
        mesh.visible = true
        mesh.position.copy(p)
        mat.opacity = (0.4 - i * 0.07) * Math.max(slash01, Math.min(1, tipSpeed / 1.8))
        mesh.scale.setScalar(0.7 + i * 0.25)
      }
    } else {
      hideTrail()
    }
  }

  function draw(args: {
    weapon: WeaponOverlayKind
    landmarks: Landmark[] | null | undefined
    recoil01?: number
    slash01?: number
    tipSpeed?: number
    swingDx?: number
    swingDy?: number
  }) {
    if (disposed) return
    const now = performance.now()
    const dt = lastMs > 0 ? Math.min(0.05, (now - lastMs) / 1000) : 1 / 60
    lastMs = now

    const weapon = args.weapon
    if (weapon === "rock") {
      gunRoot.visible = false
      if (saber) saber.object.visible = false
      hideTrail()
      gunSmoothReady = false
      saberSmoothReady = false
      renderer.render(scene, camera)
      return
    }

    if (weapon === "gun") {
      saberSmoothReady = false
      if (!gunReady || gunMissing) {
        gunRoot.visible = false
        if (saber) saber.object.visible = false
        hideTrail()
        renderer.render(scene, camera)
        return
      }
      const pose = gunPoseFromLandmarks(args.landmarks)
      if (!pose) {
        gunRoot.visible = false
        gunSmoothReady = false
        hideTrail()
        renderer.render(scene, camera)
        return
      }
      drawGun(pose, args.recoil01 ?? 0, dt)
      renderer.render(scene, camera)
      return
    }

    // saber
    gunSmoothReady = false
    if (!saberReady || saberMissing || !saber) {
      gunRoot.visible = false
      hideTrail()
      renderer.render(scene, camera)
      return
    }
    const pose = saberPoseFromLandmarks(args.landmarks)
    if (!pose) {
      saber.object.visible = false
      saberSmoothReady = false
      hideTrail()
      renderer.render(scene, camera)
      return
    }
    drawSaber(
      pose,
      args.slash01 ?? 0,
      args.tipSpeed ?? 0,
      args.swingDx ?? 0,
      args.swingDy ?? 0,
      dt,
    )
    renderer.render(scene, camera)
  }

  function dispose() {
    disposed = true
    hideTrail()
    trailGeom.dispose()
    for (const mat of trailMats) mat.dispose()
    saber?.dispose()
    saber = null
    gunRoot.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.geometry?.dispose()
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const mat of mats) mat.dispose()
    })
    renderer.dispose()
  }

  return { resize, draw, dispose }
}
