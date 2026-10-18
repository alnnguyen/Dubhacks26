import { Suspense, use, useMemo, useRef, type RefObject } from "react"
import * as THREE from "three"
import { Canvas, useFrame } from "@react-three/fiber"
import { Bloom, EffectComposer } from "@react-three/postprocessing"
import type { ArenaFrame, AvatarAppearance, PlayerSlot, Vec3 } from "../../../server/src/contracts"
import { MarsEnvironment, loadTerrainSampler } from "../arena/mars/MarsEnvironment"
import { ArenaAstronaut } from "./ArenaAstronaut"
import { DEFAULT_AVATAR } from "../features/avatars/types/avatar"
import { SABER_PALETTES } from "../features/avatars/utils/palette"
import { useRemoteFace } from "../features/avatars/hooks/useRemoteFace"
import { useSavedAvatar } from "../features/avatars/hooks/useSavedAvatar"

/**
 * The shared saber arena as this laptop sees it: both players as glowing
 * avatars built from their streamed skeletons, their blades, and the camera
 * over your own shoulder. Everything comes from the server's arena frames.
 *
 * Arena (server) coordinates are x to slot 1's right, y up, z toward slot 2;
 * three.js is right-handed, so z flips. That keeps each player's right on the
 * right of the screen when viewed from behind them.
 */
export const toThree = (v: Vec3): THREE.Vector3 => new THREE.Vector3(v[0], v[1], -v[2])

export type ImpactFlash = { kind: "blocked" | "hit"; at: Vec3; startedMs: number }

// Light ghosting keeps your own suit from hiding the opponent at main's camera distance.
const OWN_OPACITY = 0.22

const UP = new THREE.Vector3(0, 1, 0)

/** Stretch a unit-height cylinder (along +y, centered) between two points. */
function placeBetween(mesh: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
  const dir = new THREE.Vector3().subVectors(b, a)
  const len = dir.length()
  if (len < 1e-6) {
    mesh.visible = false
    return
  }
  mesh.visible = true
  mesh.position.copy(a).addScaledVector(dir, 0.5)
  mesh.quaternion.setFromUnitVectors(UP, dir.divideScalar(len))
  mesh.scale.set(1, len, 1)
}

function Blade({ frameRef, slot, color }: { frameRef: RefObject<ArenaFrame | null>; slot: PlayerSlot; color: string }) {
  const core = useRef<THREE.Mesh>(null)
  const glow = useRef<THREE.Mesh>(null)
  const hilt = useRef<THREE.Mesh>(null)
  // Brighter than 1 so bloom picks the blade up.
  const coreMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 3.2), toneMapped: false }), [])
  const glowMaterial = useMemo(() => {
    const c = new THREE.Color(color).multiplyScalar(2.2)
    return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.55, toneMapped: false, depthWrite: false })
  }, [color])

  useFrame(() => {
    const blade = frameRef.current?.players.find((p) => p.slot === slot)?.blade ?? null
    for (const mesh of [core.current, glow.current, hilt.current]) if (mesh) mesh.visible = Boolean(blade)
    if (!blade) return
    const a = toThree(blade.hilt)
    const b = toThree(blade.tip)
    if (core.current) placeBetween(core.current, a, b)
    if (glow.current) placeBetween(glow.current, a, b)
    if (hilt.current) {
      const back = a.clone().addScaledVector(new THREE.Vector3().subVectors(a, b).normalize(), 0.24)
      placeBetween(hilt.current, back, a)
    }
  })

  return (
    <group>
      <mesh ref={core} material={coreMaterial}>
        <cylinderGeometry args={[0.014, 0.014, 1, 12]} />
      </mesh>
      <mesh ref={glow} material={glowMaterial}>
        <cylinderGeometry args={[0.04, 0.04, 1, 16]} />
      </mesh>
      <mesh ref={hilt}>
        <cylinderGeometry args={[0.022, 0.022, 1, 12]} />
        <meshStandardMaterial color="#5a606a" metalness={0.8} roughness={0.35} />
      </mesh>
    </group>
  )
}

function Impact({ flashRef }: { flashRef: RefObject<ImpactFlash | null> }) {
  const mesh = useRef<THREE.Mesh>(null)
  const light = useRef<THREE.PointLight>(null)
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4, 4), transparent: true, toneMapped: false, depthWrite: false }),
    [],
  )
  useFrame(() => {
    const flash = flashRef.current
    const age = flash ? (performance.now() - flash.startedMs) / 1000 : Infinity
    const on = flash !== null && age < 0.3
    if (mesh.current) mesh.current.visible = on
    if (light.current) light.current.intensity = on ? 25 * (1 - age / 0.3) : 0
    if (!on || !flash) return
    const at = toThree(flash.at)
    const t = age / 0.3
    mesh.current!.position.copy(at)
    mesh.current!.scale.setScalar(0.05 + 0.35 * t)
    material.opacity = 1 - t
    material.color.set(flash.kind === "blocked" ? "#ffffff" : "#ff6a4a").multiplyScalar(4)
    light.current!.position.copy(at)
    light.current!.color.set(flash.kind === "blocked" ? "#bfe6ff" : "#ff6a4a")
  })
  return (
    <>
      <mesh ref={mesh} material={material}>
        <sphereGeometry args={[1, 16, 12]} />
      </mesh>
      <pointLight ref={light} intensity={0} distance={4} />
    </>
  )
}

/** Over your own shoulder, looking at the rival. Follows your hips as you step. */
function ShoulderCamera({ frameRef, mySlot, groundY }: {
  frameRef: RefObject<ArenaFrame | null>
  mySlot: PlayerSlot
  groundY: number
}) {
  const target = useRef(new THREE.Vector3())
  useFrame(({ camera }) => {
    const forward = new THREE.Vector3(0, 0, mySlot === 1 ? -1 : 1)
    const right = new THREE.Vector3(mySlot === 1 ? 1 : -1, 0, 0)
    const me = frameRef.current?.players.find((p) => p.slot === mySlot)?.joints
    const hips = me
      ? toThree(me[23]).add(toThree(me[24])).multiplyScalar(0.5)
      : toThree([0, 1, mySlot === 1 ? 0 : 1.3])
    // The camera isn't inside the arena's ground group, so it adds the ground height itself.
    hips.y += groundY
    const desired = hips.clone().addScaledVector(forward, -2.3).addScaledVector(right, 0.55).add(new THREE.Vector3(0, 0.95, 0))
    camera.position.lerp(desired, 0.12)
    target.current.lerp(hips.clone().addScaledVector(forward, 1.4).add(new THREE.Vector3(0, 0.45, 0)), 0.12)
    camera.lookAt(target.current)
  })
  return null
}

type FightersProps = {
  frameRef: RefObject<ArenaFrame | null>
  flashRef: RefObject<ImpactFlash | null>
  mySlot: PlayerSlot
  appearances?: Partial<Record<PlayerSlot, AvatarAppearance>>
}

/** Stands the arena on the Mars terrain at its center. */
function MarsFighters(props: FightersProps) {
  const sampler = use(loadTerrainSampler())
  return <Fighters {...props} groundY={sampler.heightAt(0, -0.65)} />
}

function SuitedFighter({ frameRef, flashRef, slot, appearance, local = false }: {
  frameRef: RefObject<ArenaFrame | null>
  flashRef: RefObject<ImpactFlash | null>
  slot: PlayerSlot
  appearance?: AvatarAppearance
  local?: boolean
}) {
  const saved = useSavedAvatar()
  const remoteFace = useRemoteFace(appearance?.face)
  const look = appearance ?? (local ? saved.look : DEFAULT_AVATAR)
  const face = appearance ? remoteFace : local ? saved.faceTexture : null
  return <>
    <ArenaAstronaut frameRef={frameRef} flashRef={flashRef} slot={slot} look={look} faceTexture={face} opacity={local ? OWN_OPACITY : 1} />
    <Blade frameRef={frameRef} slot={slot} color={SABER_PALETTES[look.saber].glow} />
  </>
}

function Fighters({ frameRef, flashRef, mySlot, groundY, appearances }: FightersProps & { groundY: number }) {
  const rivalSlot: PlayerSlot = mySlot === 1 ? 2 : 1
  return (
    <group position={[0, groundY, 0]}>
      <ShoulderCamera frameRef={frameRef} mySlot={mySlot} groundY={groundY} />
      <SuitedFighter frameRef={frameRef} flashRef={flashRef} slot={mySlot} appearance={appearances?.[mySlot]} local />
      <SuitedFighter frameRef={frameRef} flashRef={flashRef} slot={rivalSlot} appearance={appearances?.[rivalSlot]} />
      <Impact flashRef={flashRef} />
      {/* The two calibrated spots. */}
      {[0, 1.3].map((z) => (
        <mesh key={z} position={[0, 0.01, -z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.32, 0.36, 48]} />
          <meshBasicMaterial color="#ffd7a0" transparent opacity={0.5} />
        </mesh>
      ))}
    </group>
  )
}

export function ArenaScene({ frameRef, flashRef, mySlot, appearances }: {
  frameRef: RefObject<ArenaFrame | null>
  flashRef: RefObject<ImpactFlash | null>
  mySlot: PlayerSlot
  appearances?: Partial<Record<PlayerSlot, AvatarAppearance>>
}) {
  return (
    <Canvas
      className="arena-canvas"
      dpr={[1, 1.5]}
      shadows
      camera={{ fov: 55, near: 0.05, far: 400, position: [0, 2, 2.5] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <Suspense
        fallback={
          // Plain floor while the Mars terrain loads, so the duel is playable immediately.
          <>
            <color attach="background" args={["#1b0f0b"]} />
            <hemisphereLight args={["#ffd9b0", "#3a2216", 1.2]} />
            <gridHelper args={[10, 20, "#a8643c", "#4a2a1a"]} />
            <Fighters frameRef={frameRef} flashRef={flashRef} mySlot={mySlot} groundY={0} appearances={appearances} />
          </>
        }
      >
        <MarsEnvironment quality="low" obstacles={[]} />
        <MarsFighters frameRef={frameRef} flashRef={flashRef} mySlot={mySlot} appearances={appearances} />
      </Suspense>
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <Bloom mipmapBlur intensity={0.9} luminanceThreshold={1.0} luminanceSmoothing={0.2} radius={0.55} />
      </EffectComposer>
    </Canvas>
  )
}
