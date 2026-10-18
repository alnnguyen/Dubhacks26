import { describe, expect, it } from "vitest"
import { analyzeTipSwing, isSwingSlash } from "./swingDetect"
import type { HandSample } from "./throwPhysics"

function samples(points: { x: number; y: number }[], startMs = 0, step = 20): HandSample[] {
  return points.map((point, i) => ({ atMs: startMs + i * step, point }))
}

describe("analyzeTipSwing", () => {
  it("detects a horizontal cut", () => {
    const analysis = analyzeTipSwing(
      samples([
        { x: 0.3, y: 0.5 },
        { x: 0.4, y: 0.5 },
        { x: 0.5, y: 0.51 },
        { x: 0.65, y: 0.5 },
      ]),
      80,
      160,
    )
    expect(analysis.axis).toBe("horizontal")
    expect(analysis.pathLen).toBeGreaterThan(0.2)
    expect(isSwingSlash(analysis, { pathMin: 0.07, speedMin: 0.5 })).toBe(true)
  })

  it("detects a vertical cut", () => {
    const analysis = analyzeTipSwing(
      samples([
        { x: 0.5, y: 0.3 },
        { x: 0.5, y: 0.4 },
        { x: 0.51, y: 0.55 },
        { x: 0.5, y: 0.7 },
      ]),
      80,
      160,
    )
    expect(analysis.axis).toBe("vertical")
    expect(isSwingSlash(analysis, { pathMin: 0.07, speedMin: 0.5 })).toBe(true)
  })

  it("rejects tiny jitter", () => {
    const analysis = analyzeTipSwing(
      samples([
        { x: 0.5, y: 0.5 },
        { x: 0.502, y: 0.501 },
        { x: 0.499, y: 0.5 },
        { x: 0.501, y: 0.499 },
      ]),
      80,
      160,
    )
    expect(isSwingSlash(analysis, { pathMin: 0.07, speedMin: 0.9 })).toBe(false)
  })
})
