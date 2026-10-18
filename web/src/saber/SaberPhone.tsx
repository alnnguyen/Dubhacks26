import { useEffect, useMemo, useRef, useState } from "react"
import type { SetupStep, StepDirection, Vec3 } from "../../../server/src/contracts"
import { INSTRUCTIONS } from "../arena3d/setupWizard"
import { angularSpeed, smoothDirection, topEdgeDirection, type DirectionFilter } from "./aimMath"
import { createSaberAudio } from "./saberAudio"
import { createSaberClient, type SaberClient } from "./saberClient"
import { createSwipe, swipeEnd, swipeMove, swipeStart } from "./swipePad"
import "./saber.css"

// About 60 a second, as fast as the phone's sensors report and the server accepts.
const AIM_SEND_MS = 16

type PermissionResult = "granted" | "denied"
type WithPermission = { requestPermission?: () => Promise<PermissionResult> }

/**
 * The phone in the player's hand is their lightsaber: hold it like a hilt, the
 * blade comes out of the top edge. Opened from the laptop's QR code as
 * /?saber=CODE. It streams only which way its top edge points; the laptop's
 * guided setup works out how that maps onto the player, the laptop camera
 * supplies where the hand is, and the server judges every swing. The phone
 * shows the same setup step as the laptop so the player needn't look away.
 */
export function SaberPhone({ code }: { code: string }) {
  // Created in the effect, not during render: StrictMode mounts twice in
  // development, and a client made once and closed by the first cleanup would
  // stay on "Connecting…" forever.
  const [client, setClient] = useState<SaberClient | null>(null)
  const audio = useMemo(() => createSaberAudio(), [])
  const [, rerender] = useState(0)
  const [enabled, setEnabled] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sensing, setSensing] = useState(false)
  const topRef = useRef<Vec3 | null>(null)
  const filterRef = useRef<DirectionFilter | null>(null)
  const rateRef = useRef(0)
  const lastStepRef = useRef<SetupStep | null>(null)
  const padRef = useRef<HTMLDivElement>(null)
  // The last swipe, for a quick arrow flash: refused swipes flash red.
  const [swipeFlash, setSwipeFlash] = useState<{ direction: StepDirection; blocked: boolean; key: number } | null>(null)

  useEffect(() => {
    const client = createSaberClient(code)
    setClient(client)
    const off = client.onChange(() => {
      // A chime each time the laptop's setup moves on.
      const step = client.status()?.match?.setup?.step ?? null
      if (step && lastStepRef.current && step !== lastStepRef.current) audio.chime()
      lastStepRef.current = step
      rerender((n) => n + 1)
    })
    const offResolved = client.onResolved((event) => {
      if (event.outcome === "blocked") audio.clash()
      else if (event.attackerSlot === client.status()?.match?.slot) audio.hit()
      else audio.hurt()
    })
    return () => {
      off()
      offResolved()
      client.close()
    }
  }, [code, audio])

  useEffect(() => {
    if (!enabled || !client) return
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.alpha == null || e.beta == null) return
      const smoothed = smoothDirection(filterRef.current, topEdgeDirection(e.alpha, e.beta), performance.now())
      filterRef.current = smoothed.filter
      topRef.current = smoothed.top
      setSensing(true)
    }
    const onMotion = (e: DeviceMotionEvent) => {
      rateRef.current = angularSpeed(e.rotationRate)
      audio.setSpeed(rateRef.current)
    }
    window.addEventListener("deviceorientation", onOrient)
    window.addEventListener("devicemotion", onMotion)
    const timer = window.setInterval(() => {
      const top = topRef.current
      client.sendAim(top ? { tracked: true, top, rate: rateRef.current } : { tracked: false, top: [0, 0, 1], rate: 0 })
    }, AIM_SEND_MS)
    return () => {
      window.removeEventListener("deviceorientation", onOrient)
      window.removeEventListener("devicemotion", onMotion)
      window.clearInterval(timer)
    }
  }, [enabled, client, audio])

  // Thumb swipes on the pad: native listeners so the page never scrolls or zooms mid-duel.
  useEffect(() => {
    const pad = padRef.current
    if (!enabled || !client || !pad) return
    let swipe = createSwipe()
    const point = (t: Touch) => ({ id: t.identifier, x: t.clientX, y: t.clientY, t: performance.now() })
    const onStart = (e: TouchEvent) => {
      e.preventDefault()
      swipe = swipeStart(swipe, point(e.changedTouches[0]), e.touches.length)
    }
    const onMove = (e: TouchEvent) => {
      e.preventDefault()
      for (const t of Array.from(e.changedTouches)) {
        const moved = swipeMove(swipe, point(t))
        swipe = moved.state
        if (!moved.step) continue
        const direction = moved.step
        const key = performance.now()
        audio.whoosh()
        setSwipeFlash({ direction, blocked: false, key })
        void client.step(direction).then((reply) => {
          if (reply.status !== "rejected" || reply.reason !== "blocked") return
          audio.thud()
          setSwipeFlash((current) => (current?.key === key ? { ...current, blocked: true } : current))
        })
      }
    }
    const onEnd = (e: TouchEvent) => {
      swipe = swipeEnd(e.touches.length)
    }
    pad.addEventListener("touchstart", onStart, { passive: false })
    pad.addEventListener("touchmove", onMove, { passive: false })
    pad.addEventListener("touchend", onEnd)
    pad.addEventListener("touchcancel", onEnd)
    return () => {
      pad.removeEventListener("touchstart", onStart)
      pad.removeEventListener("touchmove", onMove)
      pad.removeEventListener("touchend", onEnd)
      pad.removeEventListener("touchcancel", onEnd)
    }
  }, [enabled, client, audio])

  async function enable() {
    setError(null)
    try {
      // iOS asks for motion permission only from a tap. Ask for both before any other await.
      const orientation = (DeviceOrientationEvent as unknown as WithPermission).requestPermission
      const motion = (DeviceMotionEvent as unknown as WithPermission).requestPermission
      const [orientationResult] = await Promise.all([
        orientation ? orientation() : Promise.resolve<PermissionResult>("granted"),
        motion ? motion().catch(() => "denied" as const) : Promise.resolve("granted"),
      ])
      if (orientationResult !== "granted") throw new Error("Motion access was denied. Reload the page and allow it.")
      await audio.start()
      try {
        await (navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<unknown> } }).wakeLock?.request("screen")
      } catch { /* the screen may dim; the saber still works */ }
      setEnabled(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start the saber.")
    }
  }

  const connection = client?.connection() ?? "connecting"
  const status = client?.status() ?? null
  const connectionError = client?.error() ?? null
  const match = status?.match ?? null
  const setup = match?.setup ?? null

  return (
    <main className="saber-phone">
      <header>
        <p className="saber-eyebrow">LIGHTSABER · {code.toUpperCase()}</p>
        <h1>
          {connection === "paired"
            ? `Linked to ${status?.callsign ?? "your laptop"}`
            : connection === "invalid_code"
              ? "Unknown pair code"
              : connection === "offline"
                ? "Offline"
                : "Connecting…"}
        </h1>
        {connection === "invalid_code" ? <p>Scan the QR code on your laptop's duel screen again.</p> : null}
        {connection === "offline" ? (
          <p className="saber-error">
            Can't reach the game server at {location.host}
            {connectionError ? ` (${connectionError})` : ""}. Retrying… Check the game server is running and this is the
            same address your laptop uses.
          </p>
        ) : null}
      </header>

      {match ? (
        <section className="saber-health">
          <span>You {match.health}</span>
          <span>Rival {match.rivalHealth}</span>
          <p>{match.phase === "finished" ? "Duel over" : match.armed ? "Armed — swing!" : "Setting up"}</p>
        </section>
      ) : connection === "paired" ? (
        <p className="saber-note">Linked. Challenge someone from your laptop.</p>
      ) : null}

      {!enabled ? (
        <button type="button" className="saber-primary" onClick={() => void enable()}>
          Ignite saber
        </button>
      ) : (
        <section className="saber-step" aria-live="polite">
          <p className="saber-eyebrow">{setup && setup.step !== "done" ? "SETUP — FOLLOW YOUR LAPTOP" : "SABER LIVE"}</p>
          <p className="saber-instruction">
            {!sensing
              ? "No motion data yet — make sure motion access was allowed."
              : setup
                ? INSTRUCTIONS[setup.step]
                : "Hold the phone like a hilt — the blade comes out of the top edge."}
          </p>
          {setup && setup.step !== "done" ? (
            <div className="saber-progress">
              <div style={{ width: `${Math.round(setup.progress * 100)}%` }} />
            </div>
          ) : null}
        </section>
      )}
      {enabled ? (
        // Thumb swipes move you: up toward your rival, down away, left/right to sidestep.
        <div ref={padRef} className="saber-pad" aria-label="Swipe to move">
          <span className="up">↑</span>
          <span className="down">↓</span>
          <span className="left">←</span>
          <span className="right">→</span>
          {swipeFlash ? (
            <span key={swipeFlash.key} className={`flash ${swipeFlash.direction} ${swipeFlash.blocked ? "blocked" : ""}`}>
              {{ forward: "↑", back: "↓", left: "←", right: "→" }[swipeFlash.direction]}
            </span>
          ) : null}
          <p>Swipe with your thumb to move</p>
        </div>
      ) : null}
      {error ? <p className="saber-error">{error}</p> : null}
    </main>
  )
}
