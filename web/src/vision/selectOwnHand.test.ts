import { describe, expect, it } from "vitest"
import { selectOwnHand } from "./selectOwnHand"
import { observeHand } from "./landmarks"
import { synthesizeHand } from "./syntheticHands"

function observed(kind: "palm" | "fist", id: string, scale: number, y: number) {
  const hand = observeHand(synthesizeHand(kind, { id, scale, origin: { x: 0.5, y } }))
  if (!hand) throw new Error("expected landmarks")
  return hand
}

describe("selectOwnHand", () => {
  it("reports no hand", () => {
    expect(selectOwnHand([])).toEqual({ status: "none" })
  })

  it("accepts the only visible hand", () => {
    expect(selectOwnHand([observed("palm", "only", 1, 0.8)])).toEqual({ status: "ok", handId: "only" })
  })

  it("picks the larger hand that sits lower in the frame", () => {
    const own = observed("palm", "own", 1.8, 0.82)
    const opponent = observed("palm", "opponent", 0.7, 0.28)
    expect(selectOwnHand([opponent, own])).toEqual({ status: "ok", handId: "own" })
  })

  it("pauses when two hands are a similar size", () => {
    const left = observed("palm", "a", 1, 0.8)
    const right = observed("palm", "b", 1.05, 0.55)
    expect(selectOwnHand([left, right])).toEqual({ status: "ambiguous" })
  })

  it("pauses when the larger hand is high in the frame", () => {
    const reached = observed("fist", "reached", 2, 0.2)
    const own = observed("palm", "own", 1, 0.84)
    expect(selectOwnHand([own, reached])).toEqual({ status: "ambiguous" })
  })
})
