import { Suspense, use, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { MarsEnvironment, loadTerrainSampler } from './MarsEnvironment'
import { render } from './marsConfig'
import { DESTINATIONS } from '../../destinations/config'
import './mars-arrival.css'

/**
 * Mars arrival: spacetomars.mp4 plays unchanged over a live canvas that is
 * already compiled and parked inside matching dust. The video's last second
 * is solid dust (no cockpit), so it fades to a veil sampled from its final
 * frame; then the camera pushes forward out of the dust storm, the fog thins
 * to reveal the canyon and the embedded platform, and settles at the
 * over-the-shoulder combat pose.
 */
export const MARS_HANDOFF_SECONDS = 0.55
const SKIP_FADE_SECONDS = 0.3
const REVEAL_SECONDS = 5
const REDUCED_REVEAL_SECONDS = 1.2
/** Sampled from the final frame of spacetomars.mp4 (centre glow, mid, edges). */
const DUST = { center: '#dd3d0a', mid: '#a82508', edge: '#8a1c04' }
const ARRIVAL_FOG = new THREE.Color(DUST.mid)
const ARENA_FOG = new THREE.Color(render.fog.color)
const ease = THREE.MathUtils.smoothstep

/** Combat pose ArenaScene's ShoulderCamera computes for slot 1 at spawn, relative to the floor. */
const COMBAT = { position: new THREE.Vector3(0.45, 3.48, 3.76), target: new THREE.Vector3(0, 1.3, 0.65) }

function Reveal({ video, veil, active, skip, reduced, onReady, onComplete }: {
  video: RefObject<HTMLVideoElement | null>
  veil: RefObject<HTMLDivElement | null>
  active: boolean
  skip: boolean
  reduced: boolean
  onReady: () => void
  onComplete: () => void
}) {
  const sampler = use(loadTerrainSampler())
  const { gl, scene, camera } = useThree()
  const floor = sampler.floorY
  const path = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, floor + 34, 78),
    new THREE.Vector3(5, floor + 17, 36),
    new THREE.Vector3(2.5, floor + 7.5, 13),
    COMBAT.position.clone().setY(floor + COMBAT.position.y),
  ], false, 'centripetal'), [floor])
  const startTarget = useMemo(() => new THREE.Vector3(0, floor + 6, 0), [floor])
  const endTarget = useMemo(() => COMBAT.target.clone().setY(floor + COMBAT.target.y), [floor])
  const target = useRef(new THREE.Vector3())
  const ready = useRef(false)
  const skipFade = useRef(0)
  const revealAt = useRef<number | null>(null)
  const done = useRef(false)

  // Start inside the dust storm: dense scene fog in the video's final colour.
  useEffect(() => {
    const fog = scene.fog as THREE.Fog | null
    if (fog) { fog.near = 0; fog.far = 2; fog.color.copy(ARRIVAL_FOG) }
    camera.position.copy(path.getPointAt(0))
    camera.lookAt(startTarget)
    let alive = true
    const finish = () => { if (alive && !ready.current) { ready.current = true; onReady() } }
    // Compile every program behind the video; never strand the player if the driver never reports back.
    const fallback = window.setTimeout(finish, 2500)
    gl.compileAsync(scene, camera).then(finish, finish)
    return () => { alive = false; window.clearTimeout(fallback) }
  }, [gl, scene, camera, path, startTarget, onReady])

  useFrame((_, rawDelta) => {
    const el = video.current
    if (!active || !el) return
    const dt = Math.min(rawDelta, 0.05)
    if (!ready.current) { el.style.opacity = '1'; return }
    let fade: number
    if (skip || el.error) {
      skipFade.current = Math.min(1, skipFade.current + dt / SKIP_FADE_SECONDS)
      fade = skipFade.current
    } else if (el.ended) {
      fade = 1
    } else {
      const remaining = el.duration - el.currentTime
      fade = Number.isFinite(remaining) ? THREE.MathUtils.clamp(1 - remaining / MARS_HANDOFF_SECONDS, 0, 1) : 0
    }
    el.style.opacity = String(1 - fade)
    if (fade < 1) return

    if (revealAt.current === null) revealAt.current = 0
    const t = (revealAt.current += dt)
    const length = reduced ? REDUCED_REVEAL_SECONDS : REVEAL_SECONDS
    const s = reduced ? length / REVEAL_SECONDS : 1
    // Dust thins gradually: the screen veil first, then scene fog from near to far.
    if (veil.current) veil.current.style.opacity = String(1 - ease(t, 0.25 * s, 2.0 * s))
    const fog = scene.fog as THREE.Fog | null
    if (fog) {
      const k = ease(t, 0.3 * s, 4.0 * s)
      fog.near = render.fog.near * k * k
      fog.far = 2 + (render.fog.far - 2) * k * k * k
      fog.color.lerpColors(ARRIVAL_FOG, ARENA_FOG, k)
    }
    const u = reduced ? 1 : THREE.MathUtils.smootherstep(t / length, 0, 1)
    camera.position.copy(path.getPointAt(u))
    target.current.copy(startTarget).lerp(endTarget, u)
    camera.lookAt(target.current)
    if (t >= length && !done.current) { done.current = true; onComplete() }
  })
  return null
}

export function MarsArrival({ active, skip = false, reducedMotion = false, onComplete, onPlaying, onError, onArrive }: {
  active: boolean
  skip?: boolean
  reducedMotion?: boolean
  onComplete: () => void
  onPlaying?: () => void
  onError?: () => void
  /** Called once near the end of the flight (the arrival sound cue). */
  onArrive?: () => void
}) {
  const errorRef = useRef(onError)
  errorRef.current = onError
  const video = useRef<HTMLVideoElement>(null)
  const veil = useRef<HTMLDivElement>(null)
  const arrived = useRef(false)
  const [ready, setReady] = useState(false)
  const [ended, setEnded] = useState(false)
  const markReady = useCallback(() => setReady(true), [])

  useEffect(() => {
    const el = video.current
    if (!el || !active) return
    if (skip) { el.pause(); return }
    let disposed = false
    void el.play().catch(() => { if (!disposed) errorRef.current?.() })
    const visibility = () => {
      if (document.hidden) el.pause()
      else if (!el.ended) void el.play().catch(() => errorRef.current?.())
    }
    document.addEventListener('visibilitychange', visibility)
    return () => { disposed = true; document.removeEventListener('visibilitychange', visibility); el.pause() }
  }, [active, skip])

  return (
    <div className="mars-arrival" data-active={active}>
      <div className="mars-arrival__frame">
        <Canvas shadows dpr={[1, 1.5]} frameloop={active ? 'always' : 'demand'} camera={{ fov: 50, near: 0.05, far: 2400, position: [0, 40, 80] }} gl={{ antialias: true }}>
          <Suspense fallback={null}>
            <MarsEnvironment quality="low" obstacles={[]} reducedMotion={reducedMotion} />
            <Reveal video={video} veil={veil} active={active} skip={skip} reduced={reducedMotion} onReady={markReady} onComplete={onComplete} />
          </Suspense>
        </Canvas>
        <div ref={veil} className="mars-arrival__veil" aria-hidden />
        <video
          ref={video}
          src={DESTINATIONS.mars.cinematicPath}
          muted
          playsInline
          preload="auto"
          onTimeUpdate={(e) => {
            const el = e.currentTarget
            if (!arrived.current && el.duration && el.currentTime / el.duration > 0.84) { arrived.current = true; onArrive?.() }
          }}
          onEnded={() => setEnded(true)}
          onPlaying={onPlaying}
          onError={onError}
          aria-label="Spaceship travel from the cockpit into a Martian dust storm"
        />
      </div>
      {active && (ended || skip) && !ready && <p className="mars-arrival__loading" role="status">Clearing the dust…</p>}
    </div>
  )
}
