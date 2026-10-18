import { useEffect, useMemo, useRef, useState } from "react"
import type { SetupStep, StepDirection, Vec3 } from "../../../server/src/contracts"
import { angularSpeed, smoothDirection, topEdgeDirection, type DirectionFilter } from "./aimMath"
import { createSaberAudio } from "./saberAudio"
import { createSaberClient, type SaberClient } from "./saberClient"
import { createSwipe, swipeEnd, swipeMove, swipeStart } from "./swipePad"
import "./saber.css"
import { gameServerUrl } from "../networking/gameEndpoint"

// About 60 a second, as fast as the phone's sensors report and the server accepts.
const AIM_SEND_MS = 16
const HOLD_MS = 450

type PermissionResult = "granted" | "denied"
type WithPermission = { requestPermission?: () => Promise<PermissionResult> }

/**
 * The phone in the player's hand is their lightsaber: hold it like a hilt, the
 * blade comes out of the top edge. Opened from the laptop's pair code as
 * /?saber=CODE. It streams only which way its top edge points; the laptop's
 * guided setup works out how that maps onto the player. Phone UI is a HUD for
 * ignite + thumb swipes — setup cues stay on the laptop.
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
  const [holdProgress, setHoldProgress] = useState(0)
  const topRef = useRef<Vec3 | null>(null)
  const filterRef = useRef<DirectionFilter | null>(null)
  const rateRef = useRef(0)
  const lastStepRef = useRef<SetupStep | null>(null)
  const padRef = useRef<HTMLDivElement>(null)
  const holdTimerRef = useRef<number | null>(null)
  const holdStartRef = useRef(0)
  const holdRafRef = useRef(0)
  const ignitingRef = useRef(false)
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

  useEffect(() => () => {
    if (holdTimerRef.current != null) window.clearTimeout(holdTimerRef.current)
    if (holdRafRef.current) cancelAnimationFrame(holdRafRef.current)
  }, [])

  async function enable() {
    if (ignitingRef.current || enabled) return
    ignitingRef.current = true
    setError(null)
    try {
      // iOS asks for motion permission only from a user gesture. Ask for both before any other await.
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
      setHoldProgress(0)
    } catch (err) {
      setHoldProgress(0)
      setError(err instanceof Error ? err.message : "Couldn't start the saber.")
    } finally {
      ignitingRef.current = false
    }
  }

  function clearHold() {
    if (holdTimerRef.current != null) {
      window.clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
    if (holdRafRef.current) {
      cancelAnimationFrame(holdRafRef.current)
      holdRafRef.current = 0
    }
    setHoldProgress(0)
  }

  function beginHold() {
    if (enabled || ignitingRef.current) return
    clearHold()
    holdStartRef.current = performance.now()
    const tick = () => {
      const p = Math.min(1, (performance.now() - holdStartRef.current) / HOLD_MS)
      setHoldProgress(p)
      if (p < 1) holdRafRef.current = requestAnimationFrame(tick)
    }
    holdRafRef.current = requestAnimationFrame(tick)
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null
      setHoldProgress(1)
      void enable()
    }, HOLD_MS)
  }

  const connection = client?.connection() ?? "connecting"
  const status = client?.status() ?? null
  const connectionError = client?.error() ?? null
  const match = status?.match ?? null

  const linkLabel =
    connection === "paired" ? "LINKED"
      : connection === "invalid_code" ? "NO LINK"
        : connection === "offline" ? "OFFLINE"
          : "CONNECTING"

  const phaseHint = !match ? null
    : match.phase === "finished" ? "Duel over"
      : match.armed ? "Armed — swing!"
        : match.startsInMs != null ? `Get ready · ${Math.max(1, Math.ceil(match.startsInMs / 1000))}`
          : enabled && !sensing ? "Waiting for motion…"
            : null

  return (
    <main className="saber-phone" data-lit={enabled || undefined}>
      <header className="saber-top">
        <p className="saber-eyebrow">LIGHTSABER · {code.toUpperCase()}</p>
        <p className={`saber-link saber-link--${connection === "paired" ? "ok" : connection === "offline" || connection === "invalid_code" ? "bad" : "wait"}`}>
          <i aria-hidden />
          {linkLabel}
        </p>
      </header>

      {connection === "invalid_code" ? (
        <p className="saber-panel">Scan the QR code on your laptop&apos;s duel screen again.</p>
      ) : null}
      {connection === "offline" ? (
        <p className="saber-panel saber-panel--warn">
          Can&apos;t reach {new URL(gameServerUrl() || location.origin).host}
          {connectionError ? ` (${connectionError})` : ""}. Retrying…
        </p>
      ) : null}
      {connection === "paired" && !match ? (
        <p className="saber-panel">Linked. Challenge someone from your laptop.</p>
      ) : null}
      {phaseHint ? <p className="saber-phase" role="status">{phaseHint}</p> : null}

      <div className="saber-stage" aria-hidden={!enabled}>
        <div className={`saber-blade ${enabled ? "saber-blade--lit" : ""}`}>
          <span className="saber-blade__beam" />
          <span className="saber-blade__hilt">
            <i /><i /><i /><b />
          </span>
        </div>
        {!enabled ? (
          <p className="saber-hold-cue">
            <span className="saber-hold-cue__arrow" aria-hidden>↑</span>
            HOLD TO IGNITE
          </p>
        ) : null}
      </div>

      {!enabled ? (
        <div className="saber-ignite">
          <button
            type="button"
            className="saber-hold"
            aria-label="Hold to ignite saber"
            onPointerDown={(e) => {
              if (e.button !== 0) return
              e.currentTarget.setPointerCapture(e.pointerId)
              beginHold()
            }}
            onPointerUp={() => clearHold()}
            onPointerCancel={() => clearHold()}
            onLostPointerCapture={() => clearHold()}
            onContextMenu={(e) => e.preventDefault()}
          >
            <span className="saber-hold__fill" style={{ transform: `scaleX(${holdProgress})` }} />
            <span className="saber-hold__label">IGNITE SABER</span>
            <span className="saber-hold__hint">HOLD ›</span>
          </button>
          <p className="saber-ignite-note">Also turns on motion for aiming.</p>
        </div>
      ) : (
        <div ref={padRef} className="saber-pad" aria-label="Swipe to move">
          <span className="dir up">FWD</span>
          <span className="dir down">BACK</span>
          <span className="dir left">L</span>
          <span className="dir right">R</span>
          <span className="saber-pad__ring" aria-hidden />
          {swipeFlash ? (
            <span key={swipeFlash.key} className={`flash ${swipeFlash.direction} ${swipeFlash.blocked ? "blocked" : ""}`}>
              {{ forward: "↑", back: "↓", left: "←", right: "→" }[swipeFlash.direction]}
            </span>
          ) : null}
          <p>Swipe to move</p>
        </div>
      )}
      {error ? <p className="saber-error">{error}</p> : null}
    </main>
  )
}
