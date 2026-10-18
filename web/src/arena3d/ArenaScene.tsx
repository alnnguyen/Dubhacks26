import { NeptuneEnvironment } from '../arena/neptune/NeptuneEnvironment';
import { NeptuneDust } from '../arena/neptune/NeptuneDust';
import type { DestinationId } from '../destinations/config';
import { Suspense, use, useMemo, useRef, type RefObject } from "react"
import * as THREE from "three"
import { Canvas, useFrame } from "@react-three/fiber"
import { Bloom, EffectComposer } from "@react-three/postprocessing"
import type { ArenaFrame, PlayerSlot, Vec3 } from "../../../server/src/contracts"
import { MarsEnvironment, loadTerrainSampler } from "../arena/mars/MarsEnvironment"
import { cellToWorld, type Board } from "./gridBoard"

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

export type ImpactFlash = { kind: "blocked" | "hit" | "guardBreak"; at: Vec3; startedMs: number }
/** Presentation-only replay controls; omitted in live combat. Coordinates use the arena frame. */
export interface ArenaReplayPresentation {
  timeMs: () => number
  camera: (frame: ArenaFrame) => { position: Vec3; target: Vec3; fov: number }
  reducedMotion: boolean
}
const realTime = () => performance.now()

// The swing trail: about this much of the blade's recent path, as a fading ribbon.
const TRAIL_MS = 120
const TRAIL_POINTS = 24

const COLORS: Record<"you" | "rival", string> = { you: "#4cc3ff", rival: "#ff4b3a" }

// MediaPipe pose bones drawn as limbs.
const BONES: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
]
const LIMB_RADIUS = 0.045
const HEAD_RADIUS = 0.11
const NOSE = 0

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

function Avatar({ frameRef, slot, color, flashRef, clock = realTime }: {
  frameRef: RefObject<ArenaFrame | null>
  slot: PlayerSlot
  color: string
  flashRef: RefObject<ImpactFlash | null>
  clock?: () => number
}) {
  const limbs = useRef<(THREE.Mesh | null)[]>([])
  const head = useRef<THREE.Mesh>(null)
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 }),
    [color],
  )
  const base = useMemo(() => new THREE.Color(color), [color])
  const hurt = useMemo(() => new THREE.Color("#ffffff"), [])

  useFrame(() => {
    const player = frameRef.current?.players.find((p) => p.slot === slot)
    const joints = player?.joints?.map(toThree) ?? null
    BONES.forEach(([i, j], k) => {
      const mesh = limbs.current[k]
      if (!mesh) return
      if (!joints) mesh.visible = false
      else placeBetween(mesh, joints[i], joints[j])
    })
    if (head.current) {
      head.current.visible = Boolean(joints)
      if (joints) head.current.position.copy(joints[NOSE])
    }
    // A hit flashes the avatar white for a moment.
    const flash = flashRef.current
    const age = flash ? clock() - flash.startedMs : Infinity
    const hitMe = flash?.kind === "hit" && age < 300 && player?.joints && isNear(flash.at, player.joints)
    material.emissive.copy(hitMe ? hurt : base)
    // A stunned fighter (guard broken) flickers until they can act again.
    const stunned = player?.stunned && Math.floor(clock() / 80) % 2 === 0
    material.emissiveIntensity = hitMe ? 2.5 : stunned ? 0.1 : 0.6
  })

  return (
    <group>
      {BONES.map((_, k) => (
        <mesh key={k} ref={(m) => void (limbs.current[k] = m)} material={material} castShadow>
          <cylinderGeometry args={[LIMB_RADIUS, LIMB_RADIUS, 1, 10]} />
        </mesh>
      ))}
      <mesh ref={head} material={material} castShadow>
        <sphereGeometry args={[HEAD_RADIUS, 20, 14]} />
      </mesh>
    </group>
  )
}

function isNear(at: Vec3, joints: Vec3[]): boolean {
  const chest = joints[11]
  return Math.hypot(at[0] - chest[0], at[1] - chest[1], at[2] - chest[2]) < 0.8
}

function Blade({ frameRef, slot, color, clock = realTime }: { frameRef: RefObject<ArenaFrame | null>; slot: PlayerSlot; color: string; clock?: () => number }) {
  const core = useRef<THREE.Mesh>(null)
  const glow = useRef<THREE.Mesh>(null)
  const hilt = useRef<THREE.Mesh>(null)
  // Brighter than 1 so bloom picks the blade up.
  const coreMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 3.2), toneMapped: false }), [])
  const glowMaterial = useMemo(() => {
    const c = new THREE.Color(color).multiplyScalar(2.2)
    return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.55, toneMapped: false, depthWrite: false })
  }, [color])
  const trailColor = useMemo(() => new THREE.Color(color).multiplyScalar(2.5), [color])
  const trail = useRef<{ atMs: number; hilt: THREE.Vector3; tip: THREE.Vector3 }[]>([])
  const trailMesh = useRef<THREE.Mesh>(null)
  const trailGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRAIL_POINTS * 2 * 3), 3))
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(TRAIL_POINTS * 2 * 4), 4))
    // Two triangles between each pair of consecutive blade positions.
    const index: number[] = []
    for (let i = 0; i < TRAIL_POINTS - 1; i++) {
      const [h0, t0, h1, t1] = [i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 3]
      index.push(h0, t0, t1, h0, t1, h1)
    }
    g.setIndex(index)
    g.setDrawRange(0, 0)
    return g
  }, [])
  const trailMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  )

  useFrame(() => {
    const player = frameRef.current?.players.find((p) => p.slot === slot)
    const blade = player?.blade ?? null
    for (const mesh of [core.current, glow.current, hilt.current]) if (mesh) mesh.visible = Boolean(blade)
    if (!blade) {
      trail.current = []
      trailGeometry.setDrawRange(0, 0)
      return
    }
    const a = toThree(blade.hilt)
    const b = toThree(blade.tip)
    updateTrail(a, b, player?.swinging ?? false)
    // A stunned fighter's guard is down: their blade gutters and blocks nothing.
    glowMaterial.opacity = player?.stunned ? 0.12 : 0.55
    if (core.current) placeBetween(core.current, a, b)
    if (glow.current) placeBetween(glow.current, a, b)
    if (hilt.current) {
      const back = a.clone().addScaledVector(new THREE.Vector3().subVectors(a, b).normalize(), 0.24)
      placeBetween(hilt.current, back, a)
    }
  })

  // A ribbon through the blade's recent positions: bright while swinging, a faint wake otherwise.
  function updateTrail(hiltNow: THREE.Vector3, tipNow: THREE.Vector3, swinging: boolean) {
    const now = clock()
    if (now < (trail.current.at(-1)?.atMs ?? -Infinity)) trail.current = []
    const points = [...trail.current, { atMs: now, hilt: hiltNow, tip: tipNow }]
      .filter((p) => now - p.atMs <= TRAIL_MS)
      .slice(-TRAIL_POINTS)
    trail.current = points
    const position = trailGeometry.getAttribute("position") as THREE.BufferAttribute
    const colors = trailGeometry.getAttribute("color") as THREE.BufferAttribute
    const strength = swinging ? 0.85 : 0.2
    points.forEach((p, i) => {
      // Older positions fade out; the tip end glows more than the hilt end.
      const fade = (1 - (now - p.atMs) / TRAIL_MS) * strength
      position.setXYZ(i * 2, p.hilt.x, p.hilt.y, p.hilt.z)
      position.setXYZ(i * 2 + 1, p.tip.x, p.tip.y, p.tip.z)
      colors.setXYZW(i * 2, trailColor.r, trailColor.g, trailColor.b, fade * 0.25)
      colors.setXYZW(i * 2 + 1, trailColor.r, trailColor.g, trailColor.b, fade)
    })
    position.needsUpdate = true
    colors.needsUpdate = true
    trailGeometry.setDrawRange(0, Math.max(0, points.length - 1) * 6)
    trailGeometry.computeBoundingSphere()
  }

  return (
    <group>
      <mesh ref={trailMesh} geometry={trailGeometry} material={trailMaterial} frustumCulled={false} />
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

const IMPACT_COLORS: Record<ImpactFlash["kind"], { core: string; light: string }> = {
  blocked: { core: "#ffffff", light: "#bfe6ff" },
  hit: { core: "#ff6a4a", light: "#ff6a4a" },
  guardBreak: { core: "#ffd34d", light: "#ffc23a" },
}

function Impact({ flashRef, clock = realTime, cinematic = false, reducedMotion = false }: { flashRef: RefObject<ImpactFlash | null>; clock?: () => number; cinematic?: boolean; reducedMotion?: boolean }) {
  const mesh = useRef<THREE.Mesh>(null)
  const light = useRef<THREE.PointLight>(null)
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4, 4), transparent: true, toneMapped: false, depthWrite: false }),
    [],
  )
  useFrame(() => {
    const flash = flashRef.current
    const age = flash ? (clock() - flash.startedMs) / 1000 : Infinity
    const on = flash !== null && age < 0.3
    if (mesh.current) mesh.current.visible = on
    if (light.current) light.current.intensity = on ? 25 * (1 - age / 0.3) : 0
    if (!on || !flash) return
    const at = toThree(flash.at)
    const t = age / 0.3
    mesh.current!.position.copy(at)
    // A guard break bursts bigger, in gold.
    mesh.current!.scale.setScalar(0.05 + (flash.kind === "guardBreak" ? 0.6 : 0.35) * t)
    material.opacity = 1 - t
    material.color.set(IMPACT_COLORS[flash.kind].core).multiplyScalar(4)
    light.current!.position.copy(at)
    light.current!.color.set(IMPACT_COLORS[flash.kind].light)
  })
  return (
    <>
      <mesh ref={mesh} material={material}>
        <sphereGeometry args={[1, 16, 12]} />
      </mesh>
      <pointLight ref={light} intensity={0} distance={4} />
      {cinematic && !reducedMotion && <ReplaySparks flashRef={flashRef} clock={clock} />}
    </>
  )
}

/** Replay-only sparks/shock ring; driven by captured server outcomes, never a hit detector. */
function ReplaySparks({ flashRef, clock }: { flashRef: RefObject<ImpactFlash | null>; clock: () => number }) {
  const group = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 6), 3))
    return g
  }, [])
  const material = useMemo(() => new THREE.LineBasicMaterial({ color: '#ffe2aa', transparent: true, toneMapped: false, depthWrite: false }), [])
  const ringMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#a3edff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }), [])
  useFrame(() => {
    const flash = flashRef.current, age = flash ? (clock() - flash.startedMs) / 1000 : Infinity
    const visible = age >= 0 && age < .35
    if (group.current) group.current.visible = visible
    if (!visible || !flash || !group.current) return
    group.current.position.copy(toThree(flash.at))
    const u = age / .35
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < 24; i++) {
      const theta = i * 2.39996, y = (i / 23) * 2 - 1, r = Math.sqrt(1 - y * y)
      const length = .05 + u * (.45 + (i % 4) * .07)
      const x = Math.cos(theta) * r, z = Math.sin(theta) * r
      positions.setXYZ(i * 2, x * length * .55, y * length * .55 - u * u * .12, z * length * .55)
      positions.setXYZ(i * 2 + 1, x * length, y * length - u * u * .12, z * length)
    }
    positions.needsUpdate = true
    material.opacity = (1 - u) * .9
    material.color.set(flash.kind === 'blocked' ? '#c6f4ff' : '#ffb36e').multiplyScalar(2)
    ringMaterial.opacity = (1 - u) * .55
    ring.current?.scale.setScalar(.15 + u * .9)
  })
  return <group ref={group} visible={false}>
    <lineSegments geometry={geometry} material={material} frustumCulled={false} />
    <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} material={ringMaterial}>
      <ringGeometry args={[.93, 1, 48]} />
    </mesh>
  </group>
}

// Looking down at 35°: steep enough that walking forward reads as moving up the
// screen (matching a pinch nudged up), shallow enough that blade heights and
// the rival's torso still read.
const CAMERA_PITCH = (35 * Math.PI) / 180
// From the aim point (halfway to the rival, a little above the hips) back along the view.
const CAMERA_DISTANCE = 3.8
const AIM_AHEAD = 0.65
const AIM_HEIGHT = 0.3
const SHOULDER_OFFSET = 0.45

/** Over your own shoulder, looking down at the duel. Follows your hips as you walk. */
function ShoulderCamera({ frameRef, mySlot, groundY, initiation = false }: {
  frameRef: RefObject<ArenaFrame | null>
  mySlot: PlayerSlot
  groundY: number
  initiation?: boolean
}) {
  const target = useRef(new THREE.Vector3())
  useFrame(({ camera }, delta) => {
    const player = frameRef.current?.players.find((p) => p.slot === mySlot)
    // Follow the fighter as they turn toward their rival.
    const [fx, fz] = player?.facing ?? [0, mySlot === 1 ? 1 : -1]
    const forward = toThree([fx, 0, fz])
    const right = toThree([fz, 0, -fx])
    const me = player?.joints
    const hips = me ? toThree(me[23]).add(toThree(me[24])).multiplyScalar(0.5) : toThree([0, 1, mySlot === 1 ? -1.3 : 1.3])
    // The camera isn't inside the arena's ground group, so it adds the ground height itself.
    hips.y += groundY
    const aim = hips.clone().addScaledVector(forward, AIM_AHEAD).add(new THREE.Vector3(0, AIM_HEIGHT, 0))
    // Setup fills a square viewport with only your real tracked fighter.
    if (initiation) aim.copy(hips).add(new THREE.Vector3(0, 0.55, 0));
    const distance = initiation ? 4.2 : CAMERA_DISTANCE;
    const pitch = initiation ? 0.06 : CAMERA_PITCH;
    const desired = aim
      .clone()
      .addScaledVector(forward, -distance * Math.cos(pitch))
      .addScaledVector(right, initiation ? 0 : SHOULDER_OFFSET)
      .add(new THREE.Vector3(0, distance * Math.sin(pitch), 0))
    // Follow with the same feel at any frame rate (~130 ms to catch up most of the way).
    const follow = 1 - Math.exp(-delta / 0.13)
    camera.position.lerp(desired, follow)
    target.current.lerp(aim, follow)
    camera.lookAt(target.current)
  })
  return null
}

type FightersProps = {
  frameRef: RefObject<ArenaFrame | null>
  flashRef: RefObject<ImpactFlash | null>
  mySlot: PlayerSlot
  board: Board
  initiation?: boolean
  replay?: ArenaReplayPresentation
}

/** Stands the arena on the Mars terrain at its center. */
function MarsFighters(props: FightersProps) {
  const sampler = use(loadTerrainSampler())
  return <Fighters {...props} groundY={sampler.heightAt(0, 0)} />
}

/** Round foot markers replace the square board; the link indicates saber reach. */
function DuelMarkers({ frameRef, mySlot, board }: { frameRef: RefObject<ArenaFrame | null>; mySlot: PlayerSlot; board: Board }) {
  const mine = useRef<THREE.Mesh>(null)
  const theirs = useRef<THREE.Mesh>(null)
  const link = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const frame = frameRef.current
    const place = (mesh: THREE.Mesh | null, slot: PlayerSlot) => {
      const player = frame?.players.find((p) => p.slot === slot)
      if (!mesh) return null
      mesh.visible = Boolean(player)
      if (!player) return null
      const hips = player.joints
      const [x, z] = hips
        ? [(hips[23][0] + hips[24][0]) / 2, (hips[23][2] + hips[24][2]) / 2]
        : cellToWorld(player.cell, board.cellSize)
      mesh.position.set(x, 0.015, -z)
      return mesh.position
    }
    const a = place(mine.current, mySlot)
    const b = place(theirs.current, mySlot === 1 ? 2 : 1)
    if (link.current) {
      link.current.visible = Boolean(frame?.engaged && a && b)
      if (link.current.visible) placeBetween(link.current, a!.clone().setY(0.03), b!.clone().setY(0.03))
    }
  })
  return <group>
    <mesh ref={mine} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.25, 0.30, 64]} />
      <meshBasicMaterial color={COLORS.you} transparent opacity={0.6} depthWrite={false} />
    </mesh>
    <mesh ref={theirs} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.25, 0.30, 64]} />
      <meshBasicMaterial color={COLORS.rival} transparent opacity={0.6} depthWrite={false} />
    </mesh>
    <mesh ref={link}>
      <cylinderGeometry args={[0.02, 0.02, 1, 8]} />
      <meshBasicMaterial color={new THREE.Color(3, 1.2, 0.8)} toneMapped={false} />
    </mesh>
  </group>
}

function DirectedCamera({ frameRef, groundY, replay }: { frameRef: RefObject<ArenaFrame | null>; groundY: number; replay: ArenaReplayPresentation }) {
  useFrame(({ camera }) => {
    if (!frameRef.current) return
    const pose = replay.camera(frameRef.current)
    camera.position.copy(toThree(pose.position)).y += groundY
    const target = toThree(pose.target); target.y += groundY
    camera.lookAt(target)
    if (camera instanceof THREE.PerspectiveCamera && Math.abs(camera.fov - pose.fov) > .01) { camera.fov = pose.fov; camera.updateProjectionMatrix() }
  })
  return null
}

function Fighters({ frameRef, flashRef, mySlot, board, groundY, initiation, replay }: FightersProps & { groundY: number }) {
  const rivalSlot: PlayerSlot = mySlot === 1 ? 2 : 1
  return (
    <group position={[0, groundY, 0]}>
      {replay ? <DirectedCamera frameRef={frameRef} groundY={groundY} replay={replay} /> : <ShoulderCamera frameRef={frameRef} mySlot={mySlot} groundY={groundY} initiation={initiation} />}
      <Avatar frameRef={frameRef} slot={mySlot} color={COLORS.you} flashRef={flashRef} clock={replay?.timeMs} />
      {!initiation && <Avatar frameRef={frameRef} slot={rivalSlot} color={COLORS.rival} flashRef={flashRef} clock={replay?.timeMs} />}
      <Blade frameRef={frameRef} slot={mySlot} color={COLORS.you} clock={replay?.timeMs} />
      {!initiation && <Blade frameRef={frameRef} slot={rivalSlot} color={COLORS.rival} clock={replay?.timeMs} />}
      {!initiation && <Impact flashRef={flashRef} clock={replay?.timeMs} cinematic={Boolean(replay)} reducedMotion={replay?.reducedMotion} />}
      {!initiation && <DuelMarkers frameRef={frameRef} mySlot={mySlot} board={board} />}
    </group>
  )
}

/** Reads the frame to draw once per rendered frame, before anything else draws. */
function FrameSampler({ getFrame, frameRef }: { getFrame: () => ArenaFrame | null; frameRef: RefObject<ArenaFrame | null> }) {
  useFrame(() => {
    frameRef.current = getFrame()
  }, -1)
  return null
}

export function ArenaScene({ getFrame, flashRef, mySlot, board, basicGraphics = false, initiation = false, replay, destination = 'mars' }: {
  /** Which world's environment to draw; the server's view decides it. */
  destination?: DestinationId
  basicGraphics?: boolean
  initiation?: boolean
  /** The arena to draw right now: blended server frames, with your own fighter drawn locally. */
  getFrame: () => ArenaFrame | null
  flashRef: RefObject<ImpactFlash | null>
  mySlot: PlayerSlot
  board: Board
  replay?: ArenaReplayPresentation
}) {
  const frameRef = useRef<ArenaFrame | null>(null)
  return (
    <Canvas
      className="arena-canvas"
      dpr={[1, 1.5]}
      shadows
      camera={{ fov: 55, near: 0.05, far: 2400, position: [0, 2, 2.5] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <FrameSampler getFrame={getFrame} frameRef={frameRef} />
      {initiation ? <>
        {/* The saber setup square is world-agnostic: a calm grid while the player calibrates. */}
        <color attach="background" args={["#061326"]} />
        <hemisphereLight args={["#c5efff", "#174d80", 2.2]} />
        <directionalLight position={[2, 5, 4]} intensity={2} color="#9de4ff" />
        <gridHelper args={[12, 24, "#225884", "#102b46"]} />
        <Fighters frameRef={frameRef} flashRef={flashRef} mySlot={mySlot} board={board} groundY={0} initiation />
      </> : destination === 'neptune' ? <>
        {basicGraphics ? <>
          <color attach="background" args={["#4f97d8"]} />
          <hemisphereLight args={["#8cc4f0", "#0d2c58", 1.6]} />
          <mesh rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[11, 48]} /><meshStandardMaterial color="#3a4a5c" /></mesh>
        </> : <>
          <NeptuneEnvironment/>
          <NeptuneDust/>
        </>}
        <Fighters frameRef={frameRef} flashRef={flashRef} mySlot={mySlot} board={board} groundY={0} replay={replay} />
      </> : basicGraphics ? <>
        <color attach="background" args={["#1b0f0b"]} />
        <hemisphereLight args={["#ffd9b0", "#3a2216", 1.2]} />
        <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[200, 200]} /><meshStandardMaterial color="#4a2a1a" /></mesh>
        <Fighters frameRef={frameRef} flashRef={flashRef} mySlot={mySlot} board={board} groundY={0} initiation={initiation} replay={replay} />
      </> : <Suspense
        fallback={
          // Plain floor while the Mars terrain loads, so the duel is playable immediately.
          <>
            <color attach="background" args={["#1b0f0b"]} />
            <hemisphereLight args={["#ffd9b0", "#3a2216", 1.2]} />
            <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[200, 200]} /><meshStandardMaterial color="#4a2a1a" /></mesh>
            <Fighters frameRef={frameRef} flashRef={flashRef} mySlot={mySlot} board={board} groundY={0} initiation={initiation} replay={replay} />
          </>
        }
      >
        <MarsEnvironment quality="low" obstacles={[]} />
        <MarsFighters frameRef={frameRef} flashRef={flashRef} mySlot={mySlot} board={board} initiation={initiation} replay={replay} />
      </Suspense>}
      {!basicGraphics && <EffectComposer multisampling={0} enableNormalPass={false}>
        <Bloom mipmapBlur intensity={0.9} luminanceThreshold={1.0} luminanceSmoothing={0.2} radius={0.55} />
      </EffectComposer>}
    </Canvas>
  )
}
