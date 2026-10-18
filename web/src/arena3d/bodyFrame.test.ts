import { describe, expect, it } from "vitest"
import { placement, worldToBody } from "./bodyFrame"

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

describe("placement", () => {
  it("finds the hip center and torso length", () => {
    const p = placement(landmarks(0.4, 0.25), 1)!
    expect(p.hipX).toBeCloseTo(0.4)
    expect(p.torso).toBeCloseTo(0.25)
  })

  it("needs shoulders and hips", () => {
    expect(placement(landmarks(0.5, 0.25).slice(0, 20), 1)).toBeNull()
  })
})
