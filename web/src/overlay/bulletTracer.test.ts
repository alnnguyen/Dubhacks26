import { describe, expect, it } from "vitest"
import {
  createTracerShot,
  DEFAULT_MUZZLE,
  muzzleFromHand,
  sampleTracer,
  tickTracers,
} from "./bulletTracer"

describe("bulletTracer", () => {
  it("starts large near the muzzle and shrinks toward the target", () => {
    const shot = createTracerShot(DEFAULT_MUZZLE, { x: 0.5, y: 0.3 }, 0, 800)
    const start = sampleTracer(shot, 0)
    const mid = sampleTracer(shot, 400)
    const end = sampleTracer(shot, 800)
    expect(start?.scale).toBeGreaterThan(1)
    expect(mid!.scale).toBeLessThan(start!.scale)
    expect(end!.scale).toBeLessThan(mid!.scale)
    expect(end!.tip.y).toBeLessThan(start!.tip.y)
  })

  it("moves the tip forward along the aim line", () => {
    const from = { x: 0.6, y: 0.85 }
    const to = { x: 0.45, y: 0.28 }
    const shot = createTracerShot(from, to, 0, 1000)
    const a = sampleTracer(shot, 0)!
    const b = sampleTracer(shot, 500)!
    expect(b.tip.y).toBeLessThan(a.tip.y)
    expect(Math.abs(b.tip.x - from.x)).toBeGreaterThan(Math.abs(a.tip.x - from.x))
  })

  it("drops finished shots after the fade", () => {
    const shot = createTracerShot(DEFAULT_MUZZLE, { x: 0.5, y: 0.3 }, 0, 800)
    expect(tickTracers([shot], 0).draw).toHaveLength(1)
    expect(tickTracers([shot], 800).draw).toHaveLength(1)
    expect(tickTracers([shot], 1000).shots).toHaveLength(0)
  })

  it("reads the index tip as the muzzle", () => {
    const landmarks = Array.from({ length: 21 }, (_, i) => ({ x: 0.5, y: 0.5 + i * 0.01 }))
    landmarks[8] = { x: 0.62, y: 0.71 }
    expect(muzzleFromHand(landmarks)).toEqual({ x: 0.62, y: 0.71 })
    expect(muzzleFromHand([])).toBeNull()
  })
})
