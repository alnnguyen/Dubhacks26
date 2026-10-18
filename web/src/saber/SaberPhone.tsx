import { useEffect, useMemo, useRef, useState } from "react"
import type { SetupStep, Vec3 } from "../../../server/src/contracts"
import { INSTRUCTIONS } from "../arena3d/setupWizard"
import { angularSpeed, topEdgeDirection } from "./aimMath"
import { createSaberAudio } from "./saberAudio"
import { createSaberClient, type SaberClient } from "./saberClient"
import "./saber.css"

const AIM_SEND_MS = 33

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
  const rateRef = useRef(0)
  const lastStepRef = useRef<SetupStep | null>(null)

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
      topRef.current = topEdgeDirection(e.alpha, e.beta)
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
      {error ? <p className="saber-error">{error}</p> : null}
    </main>
  )
}
