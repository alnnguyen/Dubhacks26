import { useEffect, useRef, useState } from "react"
import { createBattleInput, stepBattleInput, type BattleInputState } from "../vision/battleInput"
import { createHandLock, resetHandLock, tickHandLock, type HandLockState } from "../vision/handLock"
import { classifyGesture } from "../vision/landmarks"
import type { BattleCommand, Phase, TouchInput } from "../vision/types"
import {
  createRockVisual,
  opponentTarget,
  tickRockVisual,
  type RockVisualState,
} from "../overlay/rockVisual"
import { CameraStartError } from "./openRearCamera"
import { openDebugCamera, type DebugCameraKind } from "./openDebugCamera"
import {
  createVisionBundle,
  handsFromLandmarker,
  poseFromLandmarker,
  type PoseOverlay,
  type VisionBundle,
} from "./mediapipeVision"
import { drawCameraOverlay } from "./drawOverlay"

const SESSION_ID = "debug-pilot"
const MATCH_ID = "debug-match"
const POSE_EVERY_N_FRAMES = 2
const idleTouch: TouchInput = { lift: false, throw: false, block: false, cancel: false }

type LogLine = { at: string; text: string }

function nowLabel() {
  return new Date().toLocaleTimeString()
}

export function CameraDebugPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const battleRef = useRef<BattleInputState>(createBattleInput(performance.now()))
  const rockRef = useRef<RockVisualState>(createRockVisual())
  const lockRef = useRef<HandLockState>(createHandLock())
  const touchRef = useRef<TouchInput>({ ...idleTouch })
  const visionRef = useRef<VisionBundle | null>(null)
  const stopCameraRef = useRef<(() => void) | null>(null)
  const poseRef = useRef<PoseOverlay | null>(null)
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
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [touchUi, setTouchUi] = useState<TouchInput>({ ...idleTouch })

  function pushCommands(commands: BattleCommand[]) {
    if (commands.length === 0) return
    setCommandLog((prev) => {
      const next = [
        ...commands.map((command) => ({
          at: nowLabel(),
          text: `${command.name} · ${command.commandId}`,
        })),
        ...prev,
      ]
      return next.slice(0, 12)
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
    setError(null)
    setStatus("Loading MediaPipe…")
    try {
      const vision = await createVisionBundle()
      visionRef.current = vision
      setStatus("Opening camera…")
      const devices = navigator.mediaDevices
      if (!devices?.getUserMedia) {
        throw new CameraStartError("unsupported", "This browser has no getUserMedia.")
      }
      const session = await openDebugCamera(devices, window.isSecureContext)
      stopCameraRef.current = session.stop
      setCameraKind(session.kind)
      setCameraNote(session.note)
      setCameraWide(session.wide)

      const video = videoRef.current
      if (!video) throw new Error("Missing video element")
      video.srcObject = session.stream as unknown as MediaStream
      await video.play()

      battleRef.current = createBattleInput(performance.now())
      rockRef.current = createRockVisual()
      lockRef.current = createHandLock()
      setLockPhase("calibrating")
      setLockProgress(0)
      setRockMode("ground")
      setRunning(true)
      setStatus("Running")
      loop()
    } catch (err) {
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
    cancelAnimationFrame(rafRef.current)
    stopCameraRef.current?.()
    stopCameraRef.current = null
    visionRef.current?.close()
    visionRef.current = null
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
        poseRef.current = poseFromLandmarker(poseResult)
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
        sessionId: SESSION_ID,
        matchId: MATCH_ID,
        lockHint: lock.phase === "locked" ? lock.hint : null,
        gesturesPaused,
      })
      battleRef.current = stepped.state
      pushCommands(stepped.commands)
      setPhase(stepped.phase)
      setGesture(stepped.gesture)
      setIntent(stepped.intent)
      setSelection(stepped.selection.status)
      setHandCount(hands.length)
      setPoseOk(Boolean(poseRef.current))

      const ownHand = hands.find((hand) => hand.id === stepped.ownHandId) ?? null
      const rockHand =
        ownHand ??
        (gesturesPaused ? null : hands.find((hand) => hand.landmarks.length >= 21) ?? null)
      const rockFrame = tickRockVisual(rockRef.current, {
        nowMs,
        phase: stepped.phase,
        commands: stepped.commands,
        ownHand: rockHand,
        target: opponentTarget(poseRef.current),
        palmOpen:
          stepped.gesture === "palm" ||
          touchRef.current.lift ||
          (rockHand ? classifyGesture(rockHand.landmarks) === "palm" : false),
      })
      rockRef.current = rockFrame.state
      setRockMode(rockFrame.state.mode)

      const width = video.videoWidth || 640
      const height = video.videoHeight || 480
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      const ctx = canvas.getContext("2d")
      if (ctx) {
        drawCameraOverlay(ctx, width, height, hands, stepped.ownHandId, poseRef.current, rockFrame.draw.rocks)
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

  return (
    <main className="page">
      <header className="header">
        <h1>Camera debug</h1>
        <p>
          Role C harness — hand lock, ~0.5× rear when available, ground rocks, palm pickup, velocity
          throw. Screen-space overlay for iPhone (not WebXR / ARKit). Not the lobby.
        </p>
      </header>

      <section className="stage">
        <video ref={videoRef} className="video" playsInline muted autoPlay />
        <canvas ref={canvasRef} className="overlay" />
        {running ? <div className={`lock-banner ${lockPhase}`}>{lockBanner}</div> : null}
      </section>

      <section className="controls">
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
        >
          Block
        </button>
        <button
          type="button"
          className={touchUi.cancel ? "on" : ""}
          onPointerDown={() => setTouch({ cancel: true })}
          onPointerUp={() => setTouch({ cancel: false })}
          onPointerLeave={() => setTouch({ cancel: false })}
        >
          Cancel
        </button>
      </section>

      <section className="panel">
        <p>
          <strong>Status</strong> {status}
        </p>
        <p>
          <strong>Secure context</strong> {String(typeof window !== "undefined" ? window.isSecureContext : false)}
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
          Calibrate your near hand first. Rocks sit in the lower third — open palm (or Lift) to pick up;
          swipe + fist or Throw to fling toward upper-center / shoulders. Cancel drops. No gun/saber yet.
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
