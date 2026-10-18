import { useEffect, useRef, useState, type RefObject } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import type { ArenaFrame, PlayerSlot, Vec3 } from "../../../server/src/contracts"
import { AstronautAvatar, type AvatarLook } from "../features/avatars/components/AstronautAvatar"
import type { AvatarAction } from "../features/avatars/types/avatar"
import type { AstronautRig } from "../features/avatars/utils/astronautModel"
import type { ImpactFlash } from "./ArenaScene"

/**
 * One player's astronaut in the shared arena. It replaces the stick figure:
 * stood at the player's hips, turned to face along their shoulders, sized to
 * their height, with the arm bones aimed at their tracked elbows and wrists.
 * The blade is drawn separately by the arena (it comes from the phone), so the
 * avatar's own saber is hidden.
 */

// MediaPipe pose joints.
const L_SHOULDER = 11, R_SHOULDER = 12, L_ELBOW = 13, R_ELBOW = 14, L_WRIST = 15, R_WRIST = 16, L_HIP = 23, R_HIP = 24

/** Shoulder height as a fraction of the model's boot-to-collar height. */
const SHOULDER_FRACTION = 0.92
/** Full-body clips (hit, etc.) play untouched for this long before the arms follow the player again. */
const FREE_ARMS_MS = 700

const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _target = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _tmp = new THREE.Vector3()
const _delta = new THREE.Quaternion()
const _world = new THREE.Quaternion()
const _parent = new THREE.Quaternion()

/** Arena (server) coordinates to three.js: z flips, as in ArenaScene's toThree. */
function toThree(v: Vec3, out: THREE.Vector3) {
  return out.set(v[0], v[1], -v[2])
}

/** Rotates `bone` (about its own joint) so that the line to `child` points along `direction` in world space. */
function aimBone(bone: THREE.Object3D, child: THREE.Object3D, direction: THREE.Vector3) {
  if (!bone.parent || direction.lengthSq() < 1e-8) return
  bone.updateWorldMatrix(true, true)
  bone.getWorldPosition(_a)
  child.getWorldPosition(_b).sub(_a)
  if (_b.lengthSq() < 1e-10) return
  _delta.setFromUnitVectors(_b.normalize(), direction.normalize())
  bone.getWorldQuaternion(_world).premultiply(_delta)
  bone.parent.getWorldQuaternion(_parent).invert()
  bone.quaternion.copy(_parent.multiply(_world))
}

function isNear(at: Vec3, joints: Vec3[]): boolean {
  const chest = joints[L_SHOULDER]
  return Math.hypot(at[0] - chest[0], at[1] - chest[1], at[2] - chest[2]) < 0.8
}

export function ArenaAstronaut({ frameRef, flashRef, slot, look, faceTexture, opacity = 1 }: {
  frameRef: RefObject<ArenaFrame | null>
  flashRef: RefObject<ImpactFlash | null>
  slot: PlayerSlot
  look: AvatarLook
  faceTexture?: THREE.Texture | null
  /** Below 1 ghosts the avatar, so your own body doesn't hide the rival from the shoulder camera. */
  opacity?: number
}) {
  const group = useRef<THREE.Group>(null)
  const rigRef = useRef<AstronautRig | null>(null)
  const yaw = useRef<number | null>(null)
  const freeArmsUntil = useRef(0)
  const wasSwinging = useRef(false)
  const lastFlash = useRef(0)
  const wrists = useRef<{ rig: AstronautRig; left: THREE.Object3D | null } | null>(null)
  const [action, setAction] = useState<AvatarAction>("idle")
  const [trigger, setTrigger] = useState(0)

  // Child effects (the avatar's suit, helmet and accessories) have mounted by the time this runs.
  useEffect(() => {
    group.current?.traverse((object) => {
      const material = (object as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
      if (!material) return
      for (const m of Array.isArray(material) ? material : [material]) {
        m.userData.baseOpacity ??= m.opacity
        m.userData.baseTransparent ??= m.transparent
        m.userData.baseDepthWrite ??= m.depthWrite
        m.opacity = m.userData.baseOpacity * opacity
        m.transparent = opacity < 1 || m.userData.baseTransparent
        m.depthWrite = opacity < 1 ? false : m.userData.baseDepthWrite
        m.needsUpdate = true
      }
    })
  }, [opacity, look, faceTexture])

  // Runs after the avatar's own animation update (it subscribes first, as our child), so the arms win.
  useFrame((_, dt) => {
    const g = group.current
    const rig = rigRef.current
    const player = frameRef.current?.players.find((p) => p.slot === slot)
    const joints = player?.joints
    if (!g) return
    if (!joints || !rig) {
      g.visible = false
      return
    }
    g.visible = true

    const lSh = toThree(joints[L_SHOULDER], new THREE.Vector3())
    const rSh = toThree(joints[R_SHOULDER], new THREE.Vector3())
    const hips = toThree(joints[L_HIP], new THREE.Vector3()).add(toThree(joints[R_HIP], _target)).multiplyScalar(0.5)
    const shoulderY = (lSh.y + rSh.y) / 2

    // Facing: forward = up × (left shoulder → right shoulder), so the player's right stays on their right.
    const rx = rSh.x - lSh.x
    const rz = rSh.z - lSh.z
    if (Math.hypot(rx, rz) > 1e-3) {
      const target = Math.atan2(rz, -rx)
      if (yaw.current === null) yaw.current = target
      const diff = THREE.MathUtils.euclideanModulo(target - yaw.current + Math.PI, Math.PI * 2) - Math.PI
      yaw.current += diff * Math.min(1, dt * 14)
    }
    g.position.set(hips.x, 0, hips.z)
    g.rotation.set(0, yaw.current ?? 0, 0)
    g.scale.setScalar(Math.max(0.5, shoulderY / SHOULDER_FRACTION))

    // Swinging triggers the attack clip once per swing; a hit near this player plays the hit reaction.
    const swinging = Boolean(player?.swinging)
    if (swinging && !wasSwinging.current) {
      setAction("attack")
      setTrigger((n) => n + 1)
    }
    wasSwinging.current = swinging

    const flash = flashRef.current
    const now = performance.now()
    const hit = flash?.kind === "hit" && flash.startedMs !== lastFlash.current && now - flash.startedMs < 300 && isNear(flash.at, joints)
    if (hit && flash) {
      lastFlash.current = flash.startedMs
      freeArmsUntil.current = now + FREE_ARMS_MS
      setAction("hit")
      setTrigger((n) => n + 1)
    }
    const flashing = flash?.kind === "hit" && now - flash.startedMs < 300 && isNear(flash.at, joints)
    rig.suitMaterial.emissive.set(flashing ? "#ffffff" : "#000000")
    rig.suitMaterial.emissiveIntensity = flashing ? 0.9 : 0

    if (now < freeArmsUntil.current) return

    // Arms follow the tracked pose: upper arm toward the elbow, forearm toward the wrist.
    g.updateMatrixWorld(true)
    if (wrists.current?.rig !== rig) {
      wrists.current = { rig, left: rig.root.getObjectByName("Middle1L") ?? null }
    }
    const dir = (from: number, to: number) => toThree(joints[to], _dir).sub(toThree(joints[from], _tmp))
    aimBone(rig.bones.upperArmR, rig.bones.lowerArmR, dir(R_SHOULDER, R_ELBOW))
    aimBone(rig.bones.lowerArmR, rig.bones.middle1R, dir(R_ELBOW, R_WRIST))
    aimBone(rig.bones.upperArmL, rig.bones.lowerArmL, dir(L_SHOULDER, L_ELBOW))
    if (wrists.current.left) aimBone(rig.bones.lowerArmL, wrists.current.left, dir(L_ELBOW, L_WRIST))
  })

  return (
    <group ref={group} visible={false}>
      <AstronautAvatar
        look={look}
        faceTexture={faceTexture}
        action={action}
        actionTrigger={trigger}
        rigRef={rigRef}
        showSaber={false}
        saberLight={false}
      />
    </group>
  )
}
