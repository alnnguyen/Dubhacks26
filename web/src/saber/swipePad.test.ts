import { describe, expect, it } from "vitest"
import { createSwipe, FLICK_PX, swipeEnd, swipeMove, swipeStart, SWIPE_PX } from "./swipePad"

/** Finger down at (100, 100), then moves through the points one frame (16 ms) apart, or `msEach`; returns every step fired. */
function swipe(points: [number, number][], id = 1, msEach = 16) {
  let state = swipeStart(createSwipe(), { id, x: 100, y: 100, t: 0 }, 1)
  const steps: string[] = []
  for (const [i, [x, y]] of points.entries()) {
    const r = swipeMove(state, { id, x, y, t: (i + 1) * msEach })
    state = r.state
    if (r.step) steps.push(r.step)
  }
  return { state, steps }
}

describe("swipe pad", () => {
  it("fires each direction as soon as the thumb has travelled far enough; screen up is forward", () => {
    expect(swipe([[100 + SWIPE_PX, 102]]).steps).toEqual(["right"])
    expect(swipe([[100 - SWIPE_PX, 98]]).steps).toEqual(["left"])
    expect(swipe([[101, 100 - SWIPE_PX]]).steps).toEqual(["forward"])
    expect(swipe([[99, 100 + SWIPE_PX]]).steps).toEqual(["back"])
  })

  it("a quick flick fires after only a few pixels; the same distance slowly doesn't", () => {
    expect(swipe([[100 + FLICK_PX, 100]], 1, 16).steps).toEqual(["right"])
    expect(swipe([[100 + FLICK_PX, 100]], 1, 200).steps).toEqual([])
  })

  it("doesn't wait for the thumb to lift", () => {
    // Still moving, never lifted: already fired at the threshold.
    expect(swipe([[110, 100], [130, 100], [160, 100]]).steps).toEqual(["right"])
  })

  it("small slow jitter and diagonals don't step", () => {
    expect(swipe([[106, 103], [96, 105]], 1, 120).steps).toEqual([])
    expect(swipe([[130, 70]]).steps).toEqual([])
  })

  it("one step per touch; lifting re-arms", () => {
    const first = swipe([[140, 100], [100, 100], [60, 100]])
    expect(first.steps).toEqual(["right"])
    let state = swipeEnd(0)
    state = swipeStart(state, { id: 2, x: 100, y: 100, t: 0 }, 1)
    expect(swipeMove(state, { id: 2, x: 60, y: 100, t: 16 }).step).toBe("left")
  })

  it("a second finger cancels until all fingers lift", () => {
    let state = swipeStart(createSwipe(), { id: 1, x: 100, y: 100, t: 0 }, 1)
    state = swipeStart(state, { id: 2, x: 200, y: 100, t: 5 }, 2)
    expect(swipeMove(state, { id: 1, x: 160, y: 100, t: 16 }).step).toBeNull()
    state = swipeEnd(1)
    expect(swipeMove(state, { id: 1, x: 160, y: 100, t: 32 }).step).toBeNull()
    expect(swipeEnd(0)).toEqual(createSwipe())
  })
})
