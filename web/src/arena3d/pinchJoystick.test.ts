import { describe, expect, it } from "vitest"
import type { HandTrack } from "../vision/types"
import { createJoystick, DEFAULT_MOVE_CALIBRATION, pickFreeHand, tickJoystick, type JoystickState } from "./pinchJoystick"

/** Hand 0.1 image heights tall; thumb and index tips `gap` apart; whole hand shifted by dx, dy. */
function hand(gap: number, dx = 0, dy = 0): HandTrack {
  const lm = Array.from({ length: 21 }, () => ({ x: 0.3 + dx, y: 0.5 + dy }))
  lm[0] = { x: 0.3 + dx, y: 0.6 + dy }
  lm[9] = { x: 0.3 + dx, y: 0.5 + dy }
  lm[4] = { x: 0.3 + dx - gap / 2, y: 0.45 + dy }
  lm[8] = { x: 0.3 + dx + gap / 2, y: 0.45 + dy }
  return { id: "h", landmarks: lm }
}

const cal = { open: 0.9, pinch: 0.1, nudge: 0.4 }
const OPEN = 0.09
const PINCHED = 0.01

/** Pinch at rest, then hold the hand shifted; returns the final move. */
function nudge(dx: number, dy: number, mirrorX = false) {
  let state: JoystickState = createJoystick()
  let t = 0
  for (let i = 0; i < 5; i++) state = tickJoystick(state, hand(PINCHED), 1, cal, mirrorX, (t += 33)).state
  let move = { x: 0, z: 0 }
  for (let i = 0; i < 30; i++) ({ state, move } = tickJoystick(state, hand(PINCHED, dx, dy), 1, cal, mirrorX, (t += 33)))
  return { state, move }
}

describe("tickJoystick", () => {
  it("an open hand never walks", () => {
    let state = createJoystick()
    for (let i = 0; i < 10; i++) {
      const r = tickJoystick(state, hand(OPEN, i * 0.01), 1, cal, false, i * 33)
      state = r.state
      expect(r.move).toEqual({ x: 0, z: 0 })
    }
  })

  it("pinch, nudge toward the player's right (image left): walk right; up: walk forward", () => {
    const right = nudge(-0.04, 0).move
    expect(right.x).toBeCloseTo(1, 1)
    expect(Math.abs(right.z)).toBeLessThan(0.05)
    const forward = nudge(0, -0.04).move
    expect(forward.z).toBeCloseTo(1, 1)
    expect(nudge(0, 0.04).move.z).toBeLessThan(-0.9)
  })

  it("a mirrored camera flips left and right", () => {
    expect(nudge(-0.04, 0, true).move.x).toBeLessThan(-0.9)
  })

  it("tiny jitter inside the dead zone doesn't walk; a half nudge walks at partial speed", () => {
    expect(nudge(0.005, 0).move).toEqual({ x: 0, z: 0 })
    const half = nudge(0, -0.025).move.z
    expect(half).toBeGreaterThan(0.2)
    expect(half).toBeLessThan(0.8)
  })

  it("releasing stops, and the next pinch starts a new joystick where it is", () => {
    let { state } = nudge(-0.04, 0)
    state = tickJoystick(state, hand(OPEN, -0.04), 1, cal, false, 5000).state
    expect(state.pinched).toBe(false)
    const again = tickJoystick(state, hand(PINCHED, -0.04), 1, cal, false, 5033)
    expect(again.move).toEqual({ x: 0, z: 0 })
  })

  it("a borderline pinch doesn't flicker on and off", () => {
    // Between the grab and release thresholds: stays pinched once grabbed.
    let state = nudge(0, 0).state
    const between = (0.4 + 0.65) / 2 * 0.1
    for (let i = 0; i < 5; i++) state = tickJoystick(state, hand(between), 1, cal, false, 9000 + i * 33).state
    expect(state.pinched).toBe(true)
    expect(tickJoystick(createJoystick(), hand(between), 1, cal, false, 0).state.pinched).toBe(false)
  })

  it("losing the hand stops walking", () => {
    const { state } = nudge(-0.04, 0)
    expect(tickJoystick(state, null, 1, DEFAULT_MOVE_CALIBRATION, false, 9999).move).toEqual({ x: 0, z: 0 })
  })
})

describe("pickFreeHand", () => {
  it("takes the detected hand nearest the body tracker's free wrist", () => {
    const near = { ...hand(OPEN), id: "near" }
    const far = { ...hand(OPEN, 0.4), id: "far" }
    expect(pickFreeHand([far, near], { x: 0.31, y: 0.6 })?.id).toBe("near")
    expect(pickFreeHand([far], { x: 0.31, y: 0.6 })).toBeNull()
    expect(pickFreeHand([near], null)).toBeNull()
  })
})
