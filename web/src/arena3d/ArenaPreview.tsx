import { destinationFromWorld } from '../destinations/config';
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

// Mirrors the server's placement when engaged: both at the front line, 1.3 m apart along z, slot 2 turned around.
function toWorld(p: Vec3, slot: PlayerSlot): Vec3 {
  return slot === 1 ? [p[0], p[1] + 1, p[2] - 0.65] : [-p[0], p[1] + 1, 0.65 - p[2]]
}

function blade(slot: PlayerSlot, hand: Vec3, dir: Vec3): { hilt: Vec3; tip: Vec3 } {
  const hilt = toWorld(hand, slot)
  const d = slot === 1 ? dir : ([-dir[0], dir[1], -dir[2]] as Vec3)
  return { hilt, tip: [hilt[0] + d[0] * 0.9, hilt[1] + d[1] * 0.9, hilt[2] + d[2] * 0.9] }
}

export function ArenaPreview() {
  const frameRef = useRef<ArenaFrame | null>(null)
  const flashRef = useRef<ImpactFlash | null>(null)
  const [view, setView] = useState<PlayerSlot>(1)

  useEffect(() => {
    let raf = 0
    const start = performance.now()
    let flashed = -1
    const tick = () => {
      const t = (performance.now() - start) / 1000
      // A slash every 2 s sweeping from out right to across the body.
      const phase = (t % 2) / 2
      const angle = phase < 0.5 ? 60 : 60 - 150 * Math.min(1, (phase - 0.5) / 0.15)
      const a = (angle * Math.PI) / 180
      const j = body()
      frameRef.current = {
        serverMs: performance.now(),
        engaged: true,
        players: [
          { slot: 1, cell: { q: 0, r: -1 }, facing: [0, 1], joints: j.map((p) => toWorld(p, 1)), blade: blade(1, j[16], [Math.sin(a), 0, Math.cos(a)]), swinging: phase > 0.5 && phase < 0.65, stamina: 100, winded: false, stunned: false },
          { slot: 2, cell: { q: 0, r: 1 }, facing: [0, -1], joints: j.map((p) => toWorld(p, 2)), blade: blade(2, [-0.455, -0.05, 0.336], [0, 1, 0]), swinging: false, stamina: 100, winded: false, stunned: false },
        ],
      }
      const cycle = Math.floor(t / 2)
      if (phase > 0.55 && flashed !== cycle) {
        flashed = cycle
        flashRef.current = { kind: "blocked", at: [-0.45, 1.25, 0.31], startedMs: performance.now() }
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <main className="arena-duel">
      <ArenaScene destination={destinationFromWorld(new URLSearchParams(location.search).get("destination")??"mars")} getFrame={() => frameRef.current} flashRef={flashRef} mySlot={view} board={{ cellSize: 0.65, rows: 3 }} />
      <div className="arena-hud">
        <p className="arena-note">Dev preview: synthetic fighters (blue = the viewing player). Not a match.</p>
        <button type="button" className="arena-leave" onClick={() => setView(view === 1 ? 2 : 1)}>
          View as slot {view === 1 ? 2 : 1}
        </button>
      </div>
    </main>
  )
}
