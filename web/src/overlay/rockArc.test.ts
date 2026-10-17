import { describe, expect, it } from "vitest"
import { healthAnchor, rockProgress, sampleRockArc, smoothPoint } from "./rockArc"

describe("smoothPoint", () => {
  it("snaps to the first point and then moves partway without changing the inputs", () => {
    const next = { x: 10, y: 10 }
    expect(smoothPoint(null, next)).toEqual({ x: 10, y: 10 })
    const previous = { x: 0, y: 0 }
    expect(smoothPoint(previous, next, 0.5)).toEqual({ x: 5, y: 5 })
    expect(previous).toEqual({ x: 0, y: 0 })
    expect(smoothPoint(previous, next, 4)).toEqual(next)
  })
})

describe("healthAnchor", () => {
  it("uses the shoulder midpoint and hides when a shoulder is missing", () => {
    expect(healthAnchor({ x: 0.2, y: 0.4 }, { x: 0.6, y: 0.5 })).toEqual({ x: 0.4, y: 0.45 })
    expect(healthAnchor(null, { x: 0.6, y: 0.5 })).toBeNull()
    expect(healthAnchor({ x: 0.2, y: 0.4 }, null)).toBeNull()
  })
})

describe("rock flight", () => {
  const from = { x: 0.7, y: 0.8 }
  const to = { x: 0.3, y: 0.3 }

  it("maps server flight time onto 0..1", () => {
    expect(rockProgress(0, 0.8)).toBe(0)
    expect(rockProgress(400, 0.8)).toBeCloseTo(0.5)
    expect(rockProgress(800, 0.8)).toBe(1)
    expect(rockProgress(2_000, 0.8)).toBe(1)
    expect(rockProgress(100, 0)).toBe(1)
    expect(rockProgress(-10, 0.8)).toBe(0)
  })

  it("starts on the hand, ends on the target, and arcs upward in screen space", () => {
    expect(sampleRockArc(0, from, to)).toEqual(from)
    expect(sampleRockArc(1, from, to)).toEqual(to)
    expect(sampleRockArc(-1, from, to)).toEqual(from)
    expect(sampleRockArc(2, from, to)).toEqual(to)
    const mid = sampleRockArc(0.5, from, to, 0.2)
    expect(mid.x).toBeCloseTo(0.5)
    expect(mid.y).toBeLessThan((from.y + to.y) / 2)
  })
})
