import { describe, expect, it } from "vitest"
import { estimateHandVelocity, sampleBallistic, throwImpulse } from "./throwPhysics"

describe("throwPhysics", () => {
  it("estimates swipe velocity from hand samples", () => {
    const velocity = estimateHandVelocity(
      [
        { atMs: 0, point: { x: 0.6, y: 0.7 } },
        { atMs: 100, point: { x: 0.4, y: 0.45 } },
      ],
      100,
    )
    expect(velocity.vx).toBeCloseTo(-2, 0)
    expect(velocity.vy).toBeLessThan(0)
  })

  it("boosts a weak throw toward the aim point", () => {
    const impulse = throwImpulse({ vx: 0, vy: 0 }, { x: 0.3, y: 0.3 }, { x: 0.7, y: 0.75 })
    expect(impulse.vx).toBeLessThan(0)
    expect(Math.hypot(impulse.vx, impulse.vy)).toBeGreaterThan(0.3)
  })

  it("arcs with gravity and shrinks for a depth cue", () => {
    const flight = {
      origin: { x: 0.7, y: 0.7 },
      velocity: { vx: -0.8, vy: -1.2 },
      launchedAtMs: 0,
      loft: -0.4,
      gravity: 2.4,
      aim: { x: 0.3, y: 0.35 },
    }
    const early = sampleBallistic(flight, 80)
    const mid = sampleBallistic(flight, 400)
    expect(early.scale).toBeGreaterThan(mid.scale)
    expect(mid.point.y).toBeGreaterThan(early.point.y - 0.5)
    expect(early.done).toBe(false)
  })
})
