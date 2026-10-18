import { describe, expect, it } from "vitest"
import { classifyGesture, handCenterY, palmSpan } from "./landmarks"
import { synthesizeHand } from "./syntheticHands"

describe("classifyGesture", () => {
  it("reads an open palm", () => {
    expect(classifyGesture(synthesizeHand("palm").landmarks)).toBe("palm")
  })

  it("reads a fist", () => {
    expect(classifyGesture(synthesizeHand("fist").landmarks)).toBe("fist")
  })

  it("reads a handgun pose", () => {
    expect(classifyGesture(synthesizeHand("gun").landmarks)).toBe("gun")
  })

  it("ignores a relaxed hand", () => {
    expect(classifyGesture(synthesizeHand("relaxed").landmarks)).toBe("none")
  })

  it("rejects empty landmark lists", () => {
    expect(classifyGesture(null)).toBe("none")
    expect(classifyGesture(undefined)).toBe("none")
    expect(classifyGesture(synthesizeHand("palm").landmarks.slice(0, 10))).toBe("none")
  })
})

describe("palmSpan / handCenterY", () => {
  it("grows the palm span with scale and keeps a lower hand lower in the frame", () => {
    const near = synthesizeHand("palm", { scale: 1.8, origin: { x: 0.5, y: 0.82 } })
    const far = synthesizeHand("palm", { scale: 0.7, origin: { x: 0.4, y: 0.3 } })
    expect(palmSpan(near.landmarks)).toBeGreaterThan(palmSpan(far.landmarks) * 1.35)
    expect(handCenterY(near.landmarks)).toBeGreaterThan(handCenterY(far.landmarks))
  })

  it("returns zero for an empty list", () => {
    expect(palmSpan([])).toBe(0)
  })
})
