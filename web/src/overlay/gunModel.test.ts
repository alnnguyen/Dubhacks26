import { describe, expect, it } from "vitest"
import { gunPoseFromLandmarks, handBasisFromPose, yawFromPose } from "./gunModel"
import { synthesizeHand } from "../vision/syntheticHands"

describe("gunPoseFromLandmarks", () => {
  it("builds a grip→muzzle pose from a gun hand", () => {
    const hand = synthesizeHand("gun", { origin: { x: 0.55, y: 0.8 }, scale: 1.6 })
    const pose = gunPoseFromLandmarks(hand.landmarks)
    expect(pose).not.toBeNull()
    expect(pose!.grip.x).toBeGreaterThan(0.4)
    expect(pose!.muzzle.x).not.toBe(pose!.grip.x)
    expect(pose!.across.x).not.toBe(0)
    expect(pose!.span).toBeGreaterThan(0.04)
  })

  it("rejects incomplete landmarks", () => {
    expect(gunPoseFromLandmarks(null)).toBeNull()
    expect(gunPoseFromLandmarks([])).toBeNull()
  })
})

describe("handBasisFromPose", () => {
  const base = {
    grip: { x: 0.5, y: 0.7 },
    muzzle: { x: 0.5, y: 0.45 },
    across: { x: 0.12, y: 0 },
    palmForward: { x: 0, y: -0.2 },
    span: 0.12,
  }

  it("yaws left and right without pitching", () => {
    const left = handBasisFromPose({ ...base, muzzle: { x: 0.32, y: 0.5 } })
    const right = handBasisFromPose({ ...base, muzzle: { x: 0.68, y: 0.5 } })
    expect(left.yaw).toBeLessThan(0)
    expect(right.yaw).toBeGreaterThan(0)
    expect(left.forward.y).toBeCloseTo(0, 5)
    expect(right.forward.y).toBeCloseTo(0, 5)
    expect(left.up).toEqual({ x: 0, y: 1, z: 0 })
  })

  it("ignores palm roll — up stays world vertical", () => {
    const flat = handBasisFromPose(base)
    const twisted = handBasisFromPose({ ...base, across: { x: 0.04, y: -0.25 } })
    expect(twisted.up.y).toBe(1)
    expect(twisted.forward.y).toBeCloseTo(0, 5)
    expect(Math.abs(flat.up.y - twisted.up.y)).toBe(0)
  })

  it("clamps extreme horizontal aim", () => {
    const yaw = yawFromPose({ ...base, muzzle: { x: 0.05, y: 0.5 } })
    expect(Math.abs(yaw)).toBeLessThanOrEqual(0.7 + 1e-6)
  })
})
