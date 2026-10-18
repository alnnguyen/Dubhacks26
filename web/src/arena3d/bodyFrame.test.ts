import { describe, expect, it } from "vitest"
import { placement, stepOffset, worldToBody } from "./bodyFrame"

describe("worldToBody", () => {
  it("turns camera-frame meters into the player's frame", () => {
    // The player's right wrist shows on the image's left (−x), raised (−y), reaching toward the camera (−z).
    expect(worldToBody({ x: -0.3, y: -0.2, z: -0.4 })).toEqual([0.3, 0.2, 0.4])
  })
})

function landmarks(hipX: number, torso: number) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5 }))
  lm[11] = { x: hipX - 0.05, y: 0.6 - torso }
  lm[12] = { x: hipX + 0.05, y: 0.6 - torso }
  lm[23] = { x: hipX - 0.04, y: 0.6 }
  lm[24] = { x: hipX + 0.04, y: 0.6 }
  return lm
}

describe("stepOffset", () => {
  const base = placement(landmarks(0.5, 0.25), 1)!

  it("is zero on the calibrated spot", () => {
    expect(stepOffset(base, base, 1)).toEqual({ x: -0, z: 0 })
  })

  it("moving to the image's left is stepping to the player's right", () => {
    const moved = stepOffset(base, placement(landmarks(0.4, 0.25), 1)!, 1)
    // 0.1 image heights at 0.5 m per 0.25 image heights.
    expect(moved.x).toBeCloseTo(0.2)
  })

  it("looking bigger is stepping toward the screen", () => {
    // Twice as big: half the distance, so a 1 m step from 2 m.
    expect(stepOffset(base, placement(landmarks(0.5, 0.5), 1)!, 1).z).toBeCloseTo(1)
    expect(stepOffset(base, placement(landmarks(0.5, 0.2), 1)!, 1).z).toBeLessThan(0)
  })

  it("needs shoulders and hips", () => {
    expect(placement(landmarks(0.5, 0.25).slice(0, 20), 1)).toBeNull()
  })
})
