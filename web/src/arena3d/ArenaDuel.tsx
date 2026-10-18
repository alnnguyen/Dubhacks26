import { useEffect, useRef, useState } from "react"
import { FilesetResolver, HandLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision"
import QRCode from "qrcode"
import type { ArenaFrame, PlayerView, SaberAim, SetupStep, Vec3 } from "../../../server/src/contracts"
import type { GameClient } from "../networking"
import { HAND_MODEL_URL, handsFromLandmarker, WASM_ROOT } from "../camera/mediapipeVision"
import { placement, worldToBody } from "./bodyFrame"
import { createStabilizer, stabilize } from "./bodyStabilizer"
import { createJoystick, pickFreeHand, tickJoystick } from "./pinchJoystick"
import { ArenaScene, type ImpactFlash } from "./ArenaScene"
import {
  applyCameraFix,
  calibrationOf,
  createWizard,
  INSTRUCTIONS,
  mirrorIndex,
  STEP_ORDER,
  tickWizard,
  type WizardState,
} from "./setupWizard"
import "./arena3d.css"

// The full model's 3D world landmarks are steadier than lite's, and a laptop can afford it.
const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task"
const BODY_SEND_MS = 50
const LEFT_WRIST = 15
const RIGHT_WRIST = 16
// A phone reading older than this doesn't count for setup checks.
const PHONE_FRESH_MS = 300

/** Body (pose) and fingers (hands, for pinch-and-nudge walking), GPU first. */
async function createTrackers(): Promise<{ pose: PoseLandmarker; hands: HandLandmarker }> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_ROOT)
  const create = (delegate: "GPU" | "CPU") =>
    Promise.all([
      PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      }),
      HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      }),
    ])
  try {
    const [pose, hands] = await create("GPU")
    return { pose, hands }
  } catch {
    const [pose, hands] = await create("CPU")
    return { pose, hands }
  }
}

/** Held movement keys to a walking intent in the player's frame. */
function keysToMove(keys: Set<string>): { x: number; z: number } {
  const has = (...k: string[]) => k.some((key) => keys.has(key))
  return {
    x: (has("d", "arrowright") ? 1 : 0) - (has("a", "arrowleft") ? 1 : 0),
    z: (has("w", "arrowup") ? 1 : 0) - (has("s", "arrowdown") ? 1 : 0),
  }
}
const MOVE_KEYS = new Set(["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"])

// Setup steps shown as a checklist (the final "done" isn't a step to do).
const CHECKLIST: SetupStep[] = STEP_ORDER.filter((step) => step !== "done")

/**
 * The lightsaber duel on a laptop: the laptop camera tracks your body, your
 * paired phone is the saber, and the shared 3D arena shows both fighters from
 * over your shoulder. A guided setup links the two devices first (see
 * setupWizard); swings only count once both players finish it. The server
 * judges every swing.
 */
export function ArenaDuel({ client, view, pairCode, note, onLeave }: {
  client: GameClient
  view: PlayerView
  pairCode: string
  note: string
  /** Back to the cockpit; before the end this forfeits. */
  onLeave: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const frameRef = useRef<ArenaFrame | null>(null)
  const flashRef = useRef<ImpactFlash | null>(null)
  const wizardRef = useRef<WizardState>(createWizard(performance.now()))
  const phoneRef = useRef<{ aim: SaberAim; atMs: number } | null>(null)
  const sentCalibrationRef = useRef("")
  const [wizard, setWizard] = useState<WizardState>(wizardRef.current)
  const [running, setRunning] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bodySeen, setBodySeen] = useState(false)
  const [qr, setQr] = useState<string | null>(null)
  // The pinched hand's nudge, for the on-screen joystick; null while not pinched.
  const [stick, setStick] = useState<{ x: number; y: number } | null>(null)
  // Keyboard fallback: hold WASD or arrow keys to walk.
  const keysRef = useRef(new Set<string>())

  useEffect(() => {
    const onDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (!MOVE_KEYS.has(key) || event.target instanceof HTMLInputElement) return
      event.preventDefault()
      keysRef.current.add(key)
    }
    const onUp = (event: KeyboardEvent) => keysRef.current.delete(event.key.toLowerCase())
    // Switching windows mid-press would otherwise leave you walking.
    const onBlur = () => keysRef.current.clear()
    window.addEventListener("keydown", onDown)
    window.addEventListener("keyup", onUp)
    window.addEventListener("blur", onBlur)
    return () => {
      window.removeEventListener("keydown", onDown)
      window.removeEventListener("keyup", onUp)
      window.removeEventListener("blur", onBlur)
    }
  }, [])
  const { you, rival } = view
  const saberUrl = `${location.origin}/?saber=${pairCode}`

  useEffect(() => {
    if (!pairCode) return
    let cancelled = false
    QRCode.toDataURL(saberUrl, { margin: 1, width: 220 })
      .then((url) => !cancelled && setQr(url))
      .catch(() => !cancelled && setQr(null))
    return () => {
      cancelled = true
    }
  }, [saberUrl, pairCode])

  useEffect(() => {
    const offArena = client.onArena((frame) => {
      frameRef.current = frame
    })
    const offPhone = client.onPhoneAim((aim) => {
      phoneRef.current = { aim, atMs: performance.now() }
    })
    // Clash sparks between the blades; a hit flashes at the defender's chest.
    const offResolved = client.onSaberResolved((event) => {
      const players = frameRef.current?.players ?? []
      const attacker = players.find((p) => p.slot === event.attackerSlot)
      const defender = players.find((p) => p.slot !== event.attackerSlot)
      let at: Vec3 | null = null
      if (event.outcome === "blocked" && attacker?.blade && defender?.blade) {
        at = midpoint(midpoint(attacker.blade.hilt, attacker.blade.tip), midpoint(defender.blade.hilt, defender.blade.tip))
      } else if (defender?.joints) {
        at = midpoint(defender.joints[11], defender.joints[12])
      }
      if (at) flashRef.current = { kind: event.outcome, at, startedMs: performance.now() }
    })
    return () => {
      offArena()
      offPhone()
      offResolved()
    }
  }, [client])

  useEffect(() => {
    if (!running) return
    let cancelled = false
    let raf = 0
    let trackers: { pose: PoseLandmarker; hands: HandLandmarker } | null = null
    let stream: MediaStream | null = null
    let lastVideoTime = -1
    let lastSent = 0
    let stabilizer = createStabilizer()
    let joystick = createJoystick()
    let shownStick: { x: number; y: number } | null = null

    function loop() {
      const video = videoRef.current
      if (cancelled || !video || !trackers) return
      if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime
        const now = performance.now()
        const result = trackers.pose.detectForVideo(video, now)
        const hands = handsFromLandmarker(trackers.hands.detectForVideo(video, now + 0.001))
        const world = result.worldLandmarks[0]
        const image = result.landmarks[0]
        const aspect = video.videoWidth / video.videoHeight || 16 / 9
        const place = placement(image, aspect)
        setBodySeen(Boolean(world))

        // Setup's camera fix corrects a mirrored or depth-reversed camera before anything uses the body;
        // the stabilizer then keeps only head, torso and arms, smoothed.
        const before = wizardRef.current
        const { mirrorX } = before.cameraFix
        let body: Vec3[] | null = null
        if (world && image) {
          const fixed = applyCameraFix(world.map(worldToBody), before.cameraFix)
          const visibility = fixed.map((_, i) => image[mirrorIndex(i, mirrorX)]?.visibility ?? 0)
          const stable = stabilize(stabilizer, fixed, visibility, now)
          stabilizer = stable.state
          body = stable.joints
        } else {
          stabilizer = createStabilizer()
        }

        // The free hand, matched to where the body tracker sees the free wrist.
        const freeIndex = before.hand ? mirrorIndex(before.hand === "right" ? LEFT_WRIST : RIGHT_WRIST, mirrorX) : null
        const freeWrist = freeIndex !== null && image ? image[freeIndex] : null
        const freeHand = pickFreeHand(hands, freeWrist ? { x: freeWrist.x, y: freeWrist.y } : null)

        const phone = phoneRef.current
        const freshPhone = phone && phone.aim.tracked && now - phone.atMs <= PHONE_FRESH_MS ? phone.aim : null
        const wizard = tickWizard(before, { nowMs: now, body, placement: place, phone: freshPhone, freeHand, aspect })
        wizardRef.current = wizard
        if (wizard.step !== before.step || Math.abs(wizard.progress - before.progress) > 0.05) setWizard(wizard)

        // Each time setup measures something new, store it on the server so the blade follows it.
        const calibration = calibrationOf(wizard)
        const key = JSON.stringify(calibration)
        if (calibration && key !== sentCalibrationRef.current) {
          sentCalibrationRef.current = key
          void client.calibrateSaber(calibration).then((reply) => {
            if (reply.status === "rejected") sentCalibrationRef.current = ""
          })
        }

        // Pinch-and-nudge walks once setup has measured the free hand; held keys work any time.
        let move = keysToMove(keysRef.current)
        if (wizard.move) {
          const stepped = tickJoystick(joystick, freeHand, aspect, wizard.move, mirrorX, now)
          joystick = stepped.state
          if (joystick.pinched) move = stepped.move
          const offset = stepped.offset
          const changed = !offset !== !shownStick || (offset && shownStick && Math.hypot(offset.x - shownStick.x, offset.y - shownStick.y) > 0.04)
          if (changed) {
            shownStick = offset
            setStick(offset ? { x: offset.x / wizard.move.nudge, y: offset.y / wizard.move.nudge } : null)
          }
        }

        if (now - lastSent >= BODY_SEND_MS) {
          lastSent = now
          client.sendBodyPose({
            tracked: body !== null,
            joints: body ?? [],
            move,
            calibrated: wizard.baseline !== null,
            setup: { step: wizard.step, progress: wizard.progress },
          })
        }
      }
      raf = requestAnimationFrame(loop)
    }

    async function start() {
      setLoading(true)
      setError(null)
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        const video = videoRef.current!
        video.srcObject = stream
        await video.play()
        trackers = await createTrackers()
        if (cancelled) return
        setLoading(false)
        loop()
      } catch (err) {
        if (cancelled) return
        setLoading(false)
        setRunning(false)
        setError(err instanceof Error ? err.message : "Couldn't start the camera.")
      }
    }

    void start()
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      trackers?.pose.close()
      trackers?.hands.close()
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [running, client])

  function redoSetup() {
    const fresh = createWizard(performance.now())
    wizardRef.current = fresh
    sentCalibrationRef.current = ""
    setWizard(fresh)
  }

  const youArmed = you.saber.bodyReady && you.saber.saberReady
  const rivalArmed = rival.saber.bodyReady && rival.saber.saberReady
  const fighting = view.phase === "active" && youArmed && rivalArmed
  const currentIndex = CHECKLIST.indexOf(wizard.step)

  return (
    <main className="arena-duel">
      <ArenaScene frameRef={frameRef} flashRef={flashRef} mySlot={you.slot} />

      <div className="arena-hud">
        <div className="arena-bars">
          <Bar label="You" value={you.health} side="you" />
          <Bar label={rival.callsign} value={rival.health} side="rival" />
        </div>
        <button type="button" className="arena-leave" onClick={onLeave}>Forfeit & return</button>
        <p className="arena-note" role="status">
          {fighting
            ? note
            : view.phase === "waiting"
              ? `Waiting for ${rival.callsign} to finish the briefing…`
              : wizard.step === "done"
                ? `Waiting for ${rival.callsign} to finish setup…`
                : "Finish setup to fight."}
        </p>
      </div>

      {!fighting && view.phase !== "finished" ? (
        <section className="arena-setup" aria-label="Setup">
          <h2>Link your saber</h2>
          <div className="arena-checks">
            <Check ok={running && bodySeen} label={running ? (bodySeen ? "Camera sees you" : "Camera can't see you") : "Camera off"} />
            <Check ok={you.saber.paired} label={you.saber.paired ? "Phone linked" : "Phone not linked"} />
            <Check
              ok={you.saber.phoneLive}
              label={you.saber.phoneLive ? "Phone motion live" : you.saber.paired ? "Tap Ignite saber on the phone" : "No phone motion"}
            />
          </div>

          {!running ? (
            <div className="arena-setup-actions">
              <button type="button" onClick={() => setRunning(true)}>Start camera</button>
            </div>
          ) : loading ? (
            <p className="arena-instruction">Loading body tracking…</p>
          ) : (
            <>
              <ol className="arena-steps">
                {CHECKLIST.map((step, i) => (
                  <li key={step} className={i < currentIndex || wizard.step === "done" ? "done" : i === currentIndex ? "now" : ""}>
                    {INSTRUCTIONS[step]}
                    {i === currentIndex ? (
                      <div className="arena-progress">
                        <div style={{ width: `${Math.round(wizard.progress * 100)}%` }} />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
              {(wizard.step === "phone" || !you.saber.paired) && pairCode ? (
                <div className="arena-pair">
                  {qr ? <img src={qr} alt={`QR code for ${saberUrl}`} width={150} height={150} /> : null}
                  <p>
                    Scan with your iPhone camera, or open <strong>{saberUrl}</strong>
                  </p>
                </div>
              ) : null}
              {wizard.notes.map((n) => (
                <p key={n} className="arena-warning">{n}</p>
              ))}
              <div className="arena-setup-actions">
                <button type="button" className="secondary" onClick={redoSetup}>Redo setup</button>
              </div>
            </>
          )}
          {error ? <p className="arena-error">{error}</p> : null}
        </section>
      ) : null}

      {stick ? (
        <div className="arena-stick" aria-hidden>
          <div
            className="arena-stick-knob"
            style={{ transform: `translate(${clampUnit(stick.x) * 34}px, ${-clampUnit(stick.y) * 34}px)` }}
          />
        </div>
      ) : null}
      {wizard.step === "done" ? (
        <p className="arena-controls">Walk: pinch your free hand and nudge it · let go to stop · or hold WASD / arrow keys</p>
      ) : null}
      <video ref={videoRef} className={`arena-self ${running ? "" : "hidden"}`} playsInline muted autoPlay />
    </main>
  )
}

const clampUnit = (v: number) => Math.max(-1, Math.min(1, v))

function midpoint(a: Vec3, b: Vec3): Vec3 {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return <span className={`arena-check ${ok ? "ok" : ""}`}>{ok ? "✓" : "•"} {label}</span>
}

function Bar({ label, value, side }: { label: string; value: number; side: "you" | "rival" }) {
  return (
    <div className="arena-bar">
      <span>{label}</span>
      <div className="arena-bar-track">
        <div className={`arena-bar-fill ${side}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
      <strong>{value}</strong>
    </div>
  )
}
