import { describe, expect, it } from "vitest"
import { selectOpponentIndex } from "./mediapipeVision"

function body(cx: number, cy: number, w: number, h: number) {
  // 13+ points spanning a w×h box centered at (cx, cy)
  return Array.from({ length: 13 }, (_, i) => ({ x: cx - w / 2 + (w * (i % 4)) / 3, y: cy - h / 2 + (h * Math.floor(i / 4)) / 3 }))
}

describe("selectOpponentIndex", () => {
  it("returns -1 when nobody is detected", () => {
    expect(selectOpponentIndex([], null)).toBe(-1)
  })

  it("picks the most prominent (largest) person", () => {
    const far = body(0.2, 0.4, 0.08, 0.2)
    const near = body(0.6, 0.5, 0.25, 0.7)
    expect(selectOpponentIndex([far, near], null)).toBe(1)
  })

  it("sticks with the tracked opponent against a similar-size bystander", () => {
    const opponent = body(0.5, 0.5, 0.2, 0.6)
    const bystander = body(0.15, 0.5, 0.22, 0.62)
    expect(selectOpponentIndex([bystander, opponent], { x: 0.5, y: 0.5 })).toBe(1)
  })

  it("switches when someone else is clearly more prominent", () => {
    const tracked = body(0.5, 0.5, 0.1, 0.25)
    const closer = body(0.3, 0.55, 0.3, 0.8)
    expect(selectOpponentIndex([tracked, closer], { x: 0.5, y: 0.5 })).toBe(1)
  })
})
