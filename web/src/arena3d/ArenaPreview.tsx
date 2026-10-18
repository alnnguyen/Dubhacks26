import { useEffect, useRef, useState } from "react"
import type { ArenaFrame, PlayerSlot, Vec3 } from "../../../server/src/contracts"
import { ArenaScene, type ImpactFlash } from "./ArenaScene"
import "./arena3d.css"

/**
 * /?dev=arena — the arena scene with two synthetic fighters, no camera, phone
 * or server: slot 1 slashes, slot 2 guards. For checking the look, the
 * shoulder camera and which way is which. Not game logic.
 */

// Same standing body as the server tests, in the player's frame.
function body(): Vec3[] {
  const j: Vec3[] = Array.from({ length: 33 }, () => [0, 0, 0] as Vec3)
  j[0] = [0, 0.75, 0.1]
  j[11] = [-0.2, 0.5, 0]
  j[12] = [0.2, 0.5, 0]
  j[13] = [-0.3, 0.3, 0.15]
  j[14] = [0.3, 0.3, 0.15]
  j[15] = [-0.25, 0.25, 0.4]
  j[16] = [0.25, 0.25, 0.4]
  j[23] = [-0.12, 0, 0]
  j[24] = [0.12, 0, 0]
  j[25] = [-0.14, -0.45, 0.02]
  j[26] = [0.14, -0.45, 0.02]
  j[27] = [-0.14, -0.9, 0]
  j[28] = [0.14, -0.9, 0]
  return j
}

// Mirrors the server's placement: slot 2 stands 1.3 m away, turned around, hips 1 m up.
function toWorld(p: Vec3, slot: PlayerSlot): Vec3 {
  return slot === 1 ? [p[0], p[1] + 1, p[2]] : [-p[0], p[1] + 1, 1.3 - p[2]]
}

function blade(slot: PlayerSlot, hand: Vec3, dir: Vec3): { hilt: Vec3; tip: Vec3 } {
  const hilt = toWorld(hand, slot)
  const d = slot === 1 ? dir : ([-dir[0], dir[1], -dir[2]] as Vec3)
  return { hilt, tip: [hilt[0] + d[0] * 0.9, hilt[1] + d[1] * 0.9, hilt[2] + d[2] * 0.9] }
}

type Move = "forward" | "back" | "left" | "right"
const KEY_MOVES: Record<string, Move> = {
  w: "forward", arrowup: "forward", s: "back", arrowdown: "back", a: "left", arrowleft: "left", d: "right", arrowright: "right",
}
const WALK_SPEED = 1.2 // m/s
// The server's stepping limits, in the player's own frame.
const X_LIMIT = 1.2
const Z_MIN = -1.0
const Z_MAX = 0.35

type Offset = { x: number; z: number }
const shift = (p: Vec3, o: Offset): Vec3 => [p[0] + o.x, p[1], p[2] + o.z]

export function ArenaPreview({ onExit }: { onExit?: () => void } = {}) {
  const frameRef = useRef<ArenaFrame | null>(null)
  const flashRef = useRef<ImpactFlash | null>(null)
  const [view, setView] = useState<PlayerSlot>(1)
  const viewRef = useRef<PlayerSlot>(1)
  viewRef.current = view
  const held = useRef(new Set<Move>())
  const offsets = useRef<Record<PlayerSlot, Offset>>({ 1: { x: 0, z: 0 }, 2: { x: 0, z: 0 } })

  // A hit on the chest of the given slot, so the hit reaction and flash can be checked on demand.
  const hit = (slot: PlayerSlot) => {
    flashRef.current = { kind: "hit", at: toWorld(shift(body()[11], offsets.current[slot]), slot), startedMs: performance.now() }
  }

  // Walk the viewed fighter with WASD / arrow keys; the shoulder camera follows.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const move = KEY_MOVES[e.key.toLowerCase()]
      if (!move) return
      e.preventDefault()
      held.current.add(move)
    }
    const up = (e: KeyboardEvent) => {
      const move = KEY_MOVES[e.key.toLowerCase()]
      if (move) held.current.delete(move)
    }
    const blur = () => held.current.clear()
    window.addEventListener("blur", blur)
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    return () => {
      window.removeEventListener("blur", blur)
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
    }
  }, [])

  useEffect(() => {
    let raf = 0
    const start = performance.now()
    let last = start
    let flashed = -1
    const tick = () => {
      const now = performance.now()
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      const t = (now - start) / 1000

      const me = offsets.current[viewRef.current]
      const h = held.current
      me.x = Math.max(-X_LIMIT, Math.min(X_LIMIT, me.x + ((h.has("right") ? 1 : 0) - (h.has("left") ? 1 : 0)) * WALK_SPEED * dt))
      me.z = Math.max(Z_MIN, Math.min(Z_MAX, me.z + ((h.has("forward") ? 1 : 0) - (h.has("back") ? 1 : 0)) * WALK_SPEED * dt))

      // A slash every 2 s sweeping from out right to across the body.
      const phase = (t % 2) / 2
      const angle = phase < 0.5 ? 60 : 60 - 150 * Math.min(1, (phase - 0.5) / 0.15)
      const a = (angle * Math.PI) / 180
      const j1 = body().map((p) => shift(p, offsets.current[1]))
      const j2 = body().map((p) => shift(p, offsets.current[2]))
      frameRef.current = {
        players: [
          { slot: 1, joints: j1.map((p) => toWorld(p, 1)), blade: blade(1, j1[16], [Math.sin(a), 0, Math.cos(a)]), swinging: phase > 0.5 && phase < 0.65 },
          { slot: 2, joints: j2.map((p) => toWorld(p, 2)), blade: blade(2, shift([-0.455, -0.05, 0.336], offsets.current[2]), [0, 1, 0]), swinging: false },
        ],
      }
      const cycle = Math.floor(t / 2)
      if (phase > 0.55 && flashed !== cycle) {
        flashed = cycle
        flashRef.current = { kind: "blocked", at: [-0.45, 1.25, 0.96], startedMs: performance.now() }
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [])

  const pad = (move: Move, label: string) => (
    <button
      type="button"
      className="arena-pad-key"
      data-move={move}
      aria-label={`Walk ${move}`}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); held.current.add(move) }}
      onPointerUp={() => held.current.delete(move)}
      onPointerCancel={() => held.current.delete(move)}
      onLostPointerCapture={() => held.current.delete(move)}
    >
      {label}
    </button>
  )

  return (
    <main className="arena-duel">
      <ArenaScene frameRef={frameRef} flashRef={flashRef} mySlot={view} />
      <div className="arena-hud">
        <p className="arena-note">{onExit ? "Playground: walk with WASD / arrow keys or the pad. Synthetic fighters with your saved avatar on the viewing player. Not a match." : "Dev preview: synthetic fighters. Your avatar is translucent; the rival uses the default look. Walk with WASD or the pad. Not a match."}</p>
        <div className="arena-tools">
          {onExit && (
            <button type="button" className="arena-leave" onClick={onExit}>
              Back to cockpit
            </button>
          )}
          <button type="button" className="arena-leave" onClick={() => setView(view === 1 ? 2 : 1)}>
            View as slot {view === 1 ? 2 : 1}
          </button>
          <button type="button" className="arena-leave" onClick={() => hit(view)}>
            Hit me
          </button>
          <button type="button" className="arena-leave" onClick={() => hit(view === 1 ? 2 : 1)}>
            Hit rival
          </button>
        </div>
        <div className="arena-pad" role="group" aria-label="Walk">
          {pad("forward", "▲")}
          {pad("left", "◀")}
          {pad("back", "▼")}
          {pad("right", "▶")}
        </div>
      </div>
    </main>
  )
}
