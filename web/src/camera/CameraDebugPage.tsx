import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react"
import { createBattleInput, stepBattleInput, type BattleInputState } from "../vision/battleInput"
import { createHandLock, resetHandLock, tickHandLock, type HandLockState } from "../vision/handLock"
import { classifyGesture } from "../vision/landmarks"
import type { BattleCommand, Phase, TouchInput } from "../vision/types"
import {
  createTracerShot,
  DEFAULT_MUZZLE,
  muzzleFromHand,
  tickTracers,
  type TracerShot,
} from "../overlay/bulletTracer"
import { createGunModel, gunPoseFromLandmarks, type GunModelHandle } from "../overlay/gunModel"
import {
  createRockVisual,
  DEFAULT_AIM,
  opponentTarget,
  tickRockVisual,
  type RockVisualState,
} from "../overlay/rockVisual"
import { CameraStartError, type CameraDevices } from "./openRearCamera"
import { openDebugCamera, type DebugCameraKind } from "./openDebugCamera"
import {
  createVisionBundle,
  handsFromLandmarker,
  poseCenter,
  poseFromLandmarker,
  selectOpponentIndex,
  type PoseOverlay,
  type VisionBundle,
} from "./mediapipeVision"
import { drawCameraOverlay } from "./drawOverlay"
import { PersonMask } from "../arena/segmentation"
import { useDeviceAim } from "../arena/mars/useDeviceAim"
import type { ArenaObstacle } from "../arena/mars/obstacles"
import { arenaDev } from "../arena/devFlags"

// Immersive Mars arena (3D scene + segmented opponent). Lazy so other routes don't load it.
const MarsDuelBackdrop = lazy(() => import("../arena/MarsDuelBackdrop"))

const SESSION_ID = "debug-pilot"
const MATCH_ID = "debug-match"
const POSE_EVERY_N_FRAMES = 2
const DEFAULT_GUN_FLIGHT_MS = 800
const idleTouch: TouchInput = { lift: false, throw: false, block: false, cancel: false }

type LogLine = { at: string; text: string }

export type CameraPageMode = "debug" | "duel"

export type DuelHudProps = {
  worldName: string
  gravity: number
  rivalName?: string
  health?: number
  rivalHealth?: number
  note?: string
  incoming?: boolean
  onSimulateRival?: () => void
  /**
   * Replace the real background with the 3D arena and composite the opponent
   * in via segmentation. Defaults to true when the world is Mars.
   */
  immersive?: boolean
  /** Optional custom arena formations. Defaults to a Jezero layout. */
  arenaObstacles?: ArenaObstacle[]
  /** Active server weapon, used to highlight Rock / Gun. */
  weapon?: "rock" | "gun"
  onSelectRock?: () => void
  onSelectGun?: () => void
  onFireGun?: () => void
  /** When set, spawn a forward tracer from the muzzle (Fire gun button / accepted shot). */
  boltStartedAt?: number | null
  /** Server gun flight window in ms. */
  boltFlightMs?: number
  /** Bumps when the server resolves our rock, so the arc stops with the hit. */
  rockResolvedAt?: number
  /** Latest server reply / status line from LiveDuel. */
  serverNote?: string
}

function nowLabel() {
  return new Date().toLocaleTimeString()
}

export function CameraDebugPage({
  mode = "debug",
  onCommands,
  flightSeconds = 0.8,
  duel,
}: {
  mode?: CameraPageMode
  onCommands?: (commands: BattleCommand[]) => void
  flightSeconds?: number
  duel?: DuelHudProps
} = {}) {
  const isDuel = mode === "duel"
  const immersive = isDuel && (duel?.immersive ?? (duel?.worldName ?? "").toLowerCase().includes("mars"))
  const personMask = useMemo(() => new PersonMask(), [])
  useEffect(() => () => personMask.dispose(), [personMask])
  const aim = useDeviceAim()
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null)
  const commandSinkRef = useRef(onCommands)
  commandSinkRef.current = onCommands
  const duelRef = useRef(duel)
  duelRef.current = duel
  const cameraGenerationRef = useRef(0)
  const commandSessionRef = useRef(SESSION_ID)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const gunCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const gunModelRef = useRef<GunModelHandle | null>(null)
  const battleRef = useRef<BattleInputState>(createBattleInput(performance.now()))
  const rockRef = useRef<RockVisualState>(createRockVisual(flightSeconds))
  const tracersRef = useRef<TracerShot[]>([])
  const lastTracerSpawnMs = useRef(0)
  const boltStartedSeen = useRef(0)
  const flightSecondsRef = useRef(flightSeconds)
  flightSecondsRef.current = flightSeconds
  const rockResolvedSeen = useRef(0)
  const lockRef = useRef<HandLockState>(createHandLock())
  const touchRef = useRef<TouchInput>({ ...idleTouch })
  const visionRef = useRef<VisionBundle | null>(null)
  const stopCameraRef = useRef<(() => void) | null>(null)
  const poseRef = useRef<PoseOverlay | null>(null)
  const opponentCenterRef = useRef<{ x: number; y: number } | null>(null)
  const frameRef = useRef(0)
  const rafRef = useRef(0)
  const lastVideoTimeRef = useRef(-1)

  const [status, setStatus] = useState("Idle")
  const [cameraKind, setCameraKind] = useState<DebugCameraKind | null>(null)
  const [cameraNote, setCameraNote] = useState("")
  const [cameraWide, setCameraWide] = useState(false)
  const [phase, setPhase] = useState<Phase>("IDLE")
  const [gesture, setGesture] = useState("none")
  const [intent, setIntent] = useState("lost")
  const [selection, setSelection] = useState("none")
  const [handCount, setHandCount] = useState(0)
  const [poseOk, setPoseOk] = useState(false)
  const [rockMode, setRockMode] = useState("hidden")
  const [lockPhase, setLockPhase] = useState<HandLockState["phase"]>("calibrating")
  const [lockProgress, setLockProgress] = useState(0)
  const [commandLog, setCommandLog] = useState<LogLine[]>([])
  const [handSpeed, setHandSpeed] = useState(0)
  const [handVy, setHandVy] = useState(0)
  const [handUpDelta, setHandUpDelta] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [touchUi, setTouchUi] = useState<TouchInput>({ ...idleTouch })

  function pushCommands(commands: BattleCommand[]) {
    if (commands.length === 0) return
    commandSinkRef.current?.(commands)
    setCommandLog((prev) => {
      const next = [
        ...commands.map((command) => ({
          at: nowLabel(),
          text: `→ ${command.name}`,
        })),
        ...prev,
      ]
      return next.slice(0, isDuel ? 6 : 12)
    })
  }

  function setTouch(partial: Partial<TouchInput>) {
    const next = { ...touchRef.current, ...partial }
    touchRef.current = next
    setTouchUi(next)
  }

  function recalibrate() {
    lockRef.current = resetHandLock()
    setLockPhase("calibrating")
    setLockProgress(0)
  }

  async function start() {
    // iOS only grants motion access synchronously inside the tap, so ask first.
    if (immersive && aim.status === "needs-permission") void aim.request()
    const generation = ++cameraGenerationRef.current
    setRunning(true)
    setError(null)
    setStatus("Loading MediaPipe…")
    try {
      // Immersive arena: track up to 3 people so bystanders don't steal the opponent.
      const vision = await createVisionBundle({ segmentation: immersive, numPoses: immersive ? 3 : 1 })
      if (generation !== cameraGenerationRef.current) {
        vision.close()
        return
      }
      visionRef.current = vision
      setStatus("Opening camera…")
      const devices = navigator.mediaDevices
      if (!devices?.getUserMedia) {
        throw new CameraStartError("unsupported", "This browser has no getUserMedia.")
      }
      const session = await openDebugCamera(
        {
          getUserMedia: (constraints) =>
            devices.getUserMedia(constraints) as ReturnType<CameraDevices["getUserMedia"]>,
        },
        window.isSecureContext,
      )
      if (generation !== cameraGenerationRef.current) {
        session.stop()
        return
      }
      stopCameraRef.current = session.stop
      setCameraKind(session.kind)
      setCameraNote(session.note)
      setCameraWide(session.wide)

      const video = videoRef.current
      if (!video) throw new Error("Missing video element")
      video.srcObject = session.stream as unknown as MediaStream
      await video.play()
      if (generation !== cameraGenerationRef.current) return
      if (immersive) {
        setVideoEl(video)
        aim.recenter() // wherever the phone points now (the opponent) is "forward" on Mars
      }
      commandSessionRef.current = `${SESSION_ID}:${crypto.randomUUID()}`
      lastVideoTimeRef.current = -1
      poseRef.current = null

      battleRef.current = createBattleInput(performance.now())
      rockRef.current = createRockVisual(flightSeconds)
      lockRef.current = createHandLock()
      setLockPhase("calibrating")
      setLockProgress(0)
      setRockMode(isDuel ? "hidden" : "ground")
      setRunning(true)
      setStatus("Running")
      loop()
    } catch (err) {
      if (generation !== cameraGenerationRef.current) return
      const message =
        err instanceof CameraStartError
          ? `${err.code}: ${err.message}`
          : err instanceof Error
            ? err.message
            : "Failed to start"
      setError(message)
      setStatus("Failed")
      stop()
    }
  }

  function stop() {
    cameraGenerationRef.current += 1
    cancelAnimationFrame(rafRef.current)
    stopCameraRef.current?.()
    stopCameraRef.current = null
    visionRef.current?.close()
    visionRef.current = null
    gunModelRef.current?.dispose()
    gunModelRef.current = null
    const video = videoRef.current
    if (video) video.srcObject = null
    setRunning(false)
    setStatus("Stopped")
  }

  function loop() {
    const video = videoRef.current
    const canvas = canvasRef.current
    const vision = visionRef.current
    if (!video || !canvas || !vision || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(loop)
      return
    }

    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime
      const nowMs = performance.now()
      frameRef.current += 1

      const handResult = vision.handLandmarker.detectForVideo(video, nowMs)
      const hands = handsFromLandmarker(handResult)

      if (frameRef.current % POSE_EVERY_N_FRAMES === 0) {
        const poseResult = vision.poseLandmarker.detectForVideo(video, nowMs + 0.001)
        if (immersive) arenaDev.stats.people = poseResult.landmarks.length
        if (poseResult.landmarks.length > 1) {
          const index = selectOpponentIndex(poseResult.landmarks, opponentCenterRef.current)
          poseRef.current = index >= 0 ? poseFromLandmarker(poseResult, index) : null
        } else {
          poseRef.current = poseFromLandmarker(poseResult)
        }
        opponentCenterRef.current = poseRef.current ? poseCenter(poseRef.current.landmarks) : null
        if (vision.segmentation) personMask.update(poseResult.segmentationMasks, nowMs)
      }

      const lock = tickHandLock(lockRef.current, { nowMs, hands })
      lockRef.current = lock
      setLockPhase(lock.phase)
      setLockProgress(lock.progress01)

      const gesturesPaused = lock.phase !== "locked"
      const stepped = stepBattleInput(battleRef.current, {
        nowMs,
        hands,
        touch: touchRef.current,
        sessionId: commandSessionRef.current,
        matchId: MATCH_ID,
        lockHint: lock.phase === "locked" ? lock.hint : null,
        gesturesPaused,
        weapon: duelRef.current?.weapon ?? "rock",
      })
      battleRef.current = stepped.state
      pushCommands(stepped.commands)
      setPhase(stepped.phase)
      setGesture(stepped.gesture)
      setIntent(stepped.intent)
      setSelection(stepped.selection.status)
      setHandCount(hands.length)
      setPoseOk(Boolean(poseRef.current))
      setHandSpeed(stepped.handSpeed)
      setHandVy(stepped.handVy)
      setHandUpDelta(stepped.handUpDelta)

      const flightSecondsNow = flightSecondsRef.current
      if (rockRef.current.flightSeconds !== flightSecondsNow && rockRef.current.mode !== "flying") {
        rockRef.current = { ...rockRef.current, flightSeconds: flightSecondsNow }
      }
      const resolvedAt = duelRef.current?.rockResolvedAt ?? 0
      if (resolvedAt !== rockResolvedSeen.current) {
        rockResolvedSeen.current = resolvedAt
        if (resolvedAt > 0 && rockRef.current.mode === "flying") {
          rockRef.current = createRockVisual(flightSecondsNow)
        }
      }

      const ownHand = hands.find((hand) => hand.id === stepped.ownHandId) ?? null
      const rockHand =
        ownHand ??
        (gesturesPaused ? null : hands.find((hand) => hand.landmarks.length >= 21) ?? null)
      const activeWeapon = duelRef.current?.weapon ?? "rock"
      const aim = opponentTarget(poseRef.current) ?? DEFAULT_AIM
      const muzzle =
        muzzleFromHand(ownHand?.landmarks) ??
        muzzleFromHand(rockHand?.landmarks) ??
        DEFAULT_MUZZLE
      const flightMs = duelRef.current?.boltFlightMs ?? DEFAULT_GUN_FLIGHT_MS

      // Dedupe local CV fire + server boltStartedAt so one shot = one tracer.
      const spawnTracer = (id: string) => {
        if (nowMs - lastTracerSpawnMs.current < 350) return
        lastTracerSpawnMs.current = nowMs
        tracersRef.current = [
          ...tracersRef.current,
          createTracerShot(muzzle, aim, nowMs, flightMs, id),
        ]
      }
      for (const command of stepped.commands) {
        if (command.name === "fireGun") spawnTracer(`cmd-${command.commandId}`)
      }
      const boltAt = duelRef.current?.boltStartedAt ?? null
      if (boltAt != null && boltAt !== boltStartedSeen.current) {
        boltStartedSeen.current = boltAt
        spawnTracer(`bolt-${boltAt}`)
      }

      const rockFrame = tickRockVisual(rockRef.current, {
        nowMs,
        phase: stepped.phase,
        commands: stepped.commands,
        ownHand: rockHand,
        target: aim,
        weapon: activeWeapon,
        palmOpen:
          activeWeapon === "rock" &&
          (stepped.gesture === "palm" ||
            touchRef.current.lift ||
            (rockHand ? classifyGesture(rockHand.landmarks) === "palm" : false)),
      })
      rockRef.current = rockFrame.state
      setRockMode(rockFrame.state.mode)

      const tracerFrame = tickTracers(tracersRef.current, nowMs)
      tracersRef.current = tracerFrame.shots

      const width = video.videoWidth || 640
      const height = video.videoHeight || 480
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      const ctx = canvas.getContext("2d")
      if (ctx) {
        drawCameraOverlay(ctx, width, height, hands, stepped.ownHandId, poseRef.current, rockFrame.draw.rocks, {
          // Keep the hand skeleton visible while tuning CV on phones.
          showLandmarks: true,
          rivalHealth: duelRef.current?.rivalHealth ?? 100,
          rockScale: isDuel ? 1.35 : 1,
          tracers: tracerFrame.draw,
        })
      }

      const gunCanvas = gunCanvasRef.current
      let gun = gunModelRef.current
      if (gunCanvas && !gun) {
        gun = createGunModel(gunCanvas)
        gunModelRef.current = gun
      }
      if (gun && gunCanvas) {
        if (gunCanvas.width !== width || gunCanvas.height !== height) {
          gunCanvas.width = width
          gunCanvas.height = height
          gun.resize(width, height)
        }
        const showGun = activeWeapon === "gun"
        const pose = showGun ? gunPoseFromLandmarks(ownHand?.landmarks ?? rockHand?.landmarks) : null
        const newest = tracerFrame.draw[tracerFrame.draw.length - 1]
        const recoil = newest && newest.progress < 0.35 ? 1 - newest.progress / 0.35 : 0
        gun.draw(pose, recoil)
      }
    }

    rafRef.current = requestAnimationFrame(loop)
  }

  useEffect(() => {
    return () => stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const lockBanner =
    lockPhase === "calibrating"
      ? `Hold your hand low in front of the lens for 2 seconds… ${Math.round(lockProgress * 100)}%`
      : lockPhase === "lost"
        ? "Hand lock lost — Recalibrate. Touch Lift/Throw/Block still work."
        : "Hand locked — opponent hands ignored."

  const worldKey = (duel?.worldName ?? "earth").toLowerCase()
  const tintClass =
    worldKey.includes("mars") ? "duel-tint-mars" : worldKey.includes("moon") ? "duel-tint-moon" : "duel-tint-earth"

  const controls = (
    <section className={`controls ${isDuel ? "duel-controls" : ""}`}>
      {!running ? (
        <button type="button" className="primary" onClick={() => void start()}>
          Start camera
        </button>
      ) : (
        <button type="button" className="primary" onClick={stop}>
          Stop
        </button>
      )}
      <button type="button" onClick={recalibrate} disabled={!running}>
        Recalibrate
      </button>
      <button
        type="button"
        className={touchUi.lift ? "on" : ""}
        onPointerDown={() => setTouch({ lift: true })}
        onPointerUp={() => setTouch({ lift: false })}
        onPointerLeave={() => setTouch({ lift: false })}
      >
        Lift
      </button>
      <button
        type="button"
        className={touchUi.throw ? "on" : ""}
        onPointerDown={() => setTouch({ throw: true })}
        onPointerUp={() => setTouch({ throw: false })}
        onPointerLeave={() => setTouch({ throw: false })}
      >
        Throw
      </button>
      <button
        type="button"
        className={touchUi.block ? "on" : ""}
        onPointerDown={() => setTouch({ block: true })}
        onPointerUp={() => setTouch({ block: false })}
        onPointerLeave={() => setTouch({ block: false })}
        onPointerCancel={() => setTouch({ block: false })}
      >
        Block
      </button>
      {duel?.onSelectRock || duel?.onSelectGun ? (
        <span className="weapon-switch" role="group" aria-label="Switch weapon">
          {duel?.onSelectRock ? (
            <button
              type="button"
              className={duel.weapon === "rock" ? "on" : ""}
              aria-pressed={duel.weapon === "rock"}
              onClick={duel.onSelectRock}
            >
              Rock
            </button>
          ) : null}
          {duel?.onSelectGun ? (
            <button
              type="button"
              className={duel.weapon === "gun" ? "on" : ""}
              aria-pressed={duel.weapon === "gun"}
              onClick={duel.onSelectGun}
            >
              Gun
            </button>
          ) : null}
        </span>
      ) : null}
      {duel?.onFireGun ? (
        <button type="button" className="primary" onClick={duel.onFireGun}>
          Fire gun
        </button>
      ) : null}
      <button
        type="button"
        className={touchUi.cancel ? "on" : ""}
        onPointerDown={() => setTouch({ cancel: true })}
        onPointerUp={() => setTouch({ cancel: false })}
        onPointerLeave={() => setTouch({ cancel: false })}
      >
        Cancel
      </button>
      {isDuel && duel?.onSimulateRival ? (
        <button type="button" disabled={duel.incoming} onClick={duel.onSimulateRival}>
          Simulate rival
        </button>
      ) : null}
    </section>
  )

  if (isDuel && duel) {
    const you = duel.health ?? 100
    const rival = duel.rivalHealth ?? 100
    return (
      <main className={`duel-page${immersive ? " duel-page--immersive" : ""}`}>
        <div className={`duel-stage ${immersive ? "duel-stage--immersive" : tintClass}`}>
          {immersive ? (
            <Suspense fallback={null}>
              <MarsDuelBackdrop
                video={running ? videoEl : null}
                mask={personMask}
                pose={poseRef}
                deviceQuat={aim.quat}
                obstacles={duel.arenaObstacles}
              />
            </Suspense>
          ) : null}
          <video ref={videoRef} className={`video${immersive ? " video--source" : ""}`} playsInline muted autoPlay />
          <canvas ref={canvasRef} className="overlay" />
          <canvas ref={gunCanvasRef} className="overlay gun-layer" />
          {immersive ? null : <div className="duel-tint" aria-hidden />}
          {immersive && running ? (
            <p className={`mars-target ${poseOk ? "locked" : ""}`} role="status">
              {poseOk ? "Opponent on Mars" : "Point the camera at your opponent"}
            </p>
          ) : null}
          {running ? <div className={`lock-banner ${lockPhase}`}>{lockBanner}</div> : null}
          <div className="duel-hud">
            <div className="duel-world-chip">
              {duel.worldName} · {duel.gravity} m/s² · window {flightSeconds.toFixed(2)} s
            </div>
            <div className="duel-bars">
              <div className="duel-bar">
                <span>You</span>
                <div className="duel-bar-track">
                  <div className="duel-bar-fill you" style={{ width: `${you}%` }} />
                </div>
                <strong>{you}</strong>
              </div>
              <div className="duel-bar">
                <span>{duel.rivalName ?? "Rival"}</span>
                <div className="duel-bar-track">
                  <div className="duel-bar-fill rival" style={{ width: `${rival}%` }} />
                </div>
                <strong>{rival}</strong>
              </div>
            </div>
            {duel.incoming ? (
              <p className="duel-incoming" role="alert">
                INCOMING — BLOCK
              </p>
            ) : null}
            <p className="duel-phase" role="status">
              {duel.note ?? (running ? `Rock ${rockMode} · ${phase}` : "Start camera to begin")}
            </p>
            {running ? (
              <div className="duel-cv" role="status">
                <p>
                  CV · sign <strong>{gesture}</strong> · intent <strong>{intent}</strong> · phase{" "}
                  <strong>{phase}</strong>
                </p>
                <p>
                  lock <strong>{lockPhase}</strong> · hands {handCount} · speed {handSpeed.toFixed(2)} · vy{" "}
                  {handVy.toFixed(2)} · Δy {handUpDelta.toFixed(2)} · rock <strong>{rockMode}</strong> · weapon{" "}
                  <strong>{duel.weapon ?? "—"}</strong>
                </p>
                <p className="duel-cv-server">{duel.serverNote ?? duel.note ?? "No server reply yet."}</p>
                {commandLog.length > 0 ? (
                  <ul className="duel-cv-log">
                    {commandLog.slice(0, 4).map((line) => (
                      <li key={`${line.at}-${line.text}`}>
                        {line.at} {line.text}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="duel-cv-log-empty">No battle commands sent yet.</p>
                )}
              </div>
            ) : null}
          </div>
        </div>
        {controls}
        {error ? <p className="error">{error}</p> : null}
        {!running ? (
          <p className="duel-hint">
            Start camera, recalibrate if needed. Rock: palm → fist grab → fling. Gun: fist holds the grip, extend
            index + middle to fire. Rock/Gun buttons switch weapons; Fire gun still works as a touch backup.
          </p>
        ) : null}
      </main>
    )
  }

  return (
    <main className="page">
      <header className="header">
        <h1>Camera debug</h1>
        <p>
          Role C harness — hand lock, ~0.5× rear when available, ground rocks, palm pickup, velocity throw, plus{" "}
          <code>stepBattleInput</code> commands. Screen-space overlay for iPhone (not WebXR / ARKit). Not the lobby.
          FlightApp / LiveDuel duel mode uses a separate HUD.
        </p>
      </header>

      <section className="stage">
        <video ref={videoRef} className="video" playsInline muted autoPlay />
        <canvas ref={canvasRef} className="overlay" />
        <canvas ref={gunCanvasRef} className="overlay gun-layer" />
        {running ? <div className={`lock-banner ${lockPhase}`}>{lockBanner}</div> : null}
      </section>

      {controls}

      <section className="panel">
        <p>
          <strong>Status</strong> {status}
        </p>
        <p>
          <strong>Secure context</strong>{" "}
          {String(typeof window !== "undefined" ? window.isSecureContext : false)}
        </p>
        <p>
          <strong>Camera</strong> {cameraKind ?? "—"} {cameraNote ? `· ${cameraNote}` : ""}
          {cameraKind === "environment" && !cameraWide ? " · banner: wide unavailable" : ""}
        </p>
        <p>
          <strong>Hand lock</strong> {lockPhase}
          {lockPhase === "calibrating" ? ` · ${Math.round(lockProgress * 100)}%` : ""}
        </p>
        <p>
          <strong>Phase</strong> {phase} · <strong>gesture</strong> {gesture} · <strong>intent</strong>{" "}
          {intent}
        </p>
        <p>
          <strong>Hands</strong> {handCount} · <strong>selection</strong> {selection} ·{" "}
          <strong>pose</strong> {poseOk ? "yes" : "no"} · <strong>rock</strong> {rockMode}
        </p>
        {error ? <p className="error">{error}</p> : null}
        {!cameraWide && cameraKind === "environment" ? (
          <p className="warn">Wide lens unavailable — default rear. Use rear / 0.5 if the phone offers it.</p>
        ) : null}
        <p className="hint">
          Calibrate your near hand first. Palm near a rock, fist to grab, fling open (or Throw) to release. Gun pose
          fist to hold, index + middle out to fire. Cancel drops. Saber still deferred.
        </p>
      </section>

      <section className="log">
        <h2>Commands</h2>
        {commandLog.length === 0 ? <p className="muted">None yet</p> : null}
        <ul>
          {commandLog.map((line) => (
            <li key={`${line.at}-${line.text}`}>
              <span className="muted">{line.at}</span> {line.text}
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
