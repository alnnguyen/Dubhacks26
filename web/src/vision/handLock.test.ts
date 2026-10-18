import { describe, expect, it } from "vitest"
import { synthesizeHand } from "./syntheticHands"
import {
  CALIBRATE_MS,
  LOCK_LOSS_MS,
  createHandLock,
  pickCalibrationCandidate,
  selectLockedHand,
  tickHandLock,
} from "./handLock"

describe("pickCalibrationCandidate", () => {
  it("prefers the large lower hand over a small upper hand", () => {
    const own = synthesizeHand("palm", { id: "own", scale: 1.8, origin: { x: 0.55, y: 0.82 } })
    const other = synthesizeHand("palm", { id: "other", scale: 0.7, origin: { x: 0.4, y: 0.25 } })
    const pick = pickCalibrationCandidate([other, own])
    expect(pick?.handId).toBe("own")
  })

  it("ignores hands that sit too high in the frame", () => {
    const high = synthesizeHand("palm", { id: "high", scale: 2, origin: { x: 0.5, y: 0.2 } })
    expect(pickCalibrationCandidate([high])).toBeNull()
  })
})

describe("selectLockedHand", () => {
  it("tracks the locked near hand and ignores a distant opponent hand", () => {
    const own = synthesizeHand("palm", { id: "own", scale: 1.8, origin: { x: 0.55, y: 0.8 } })
    const other = synthesizeHand("fist", { id: "other", scale: 1.2, origin: { x: 0.35, y: 0.3 } })
    const hint = pickCalibrationCandidate([own])!.hint
    expect(selectLockedHand([other, own], hint)).toEqual({ status: "ok", handId: "own" })
    expect(selectLockedHand([other], hint).status).toBe("none")
  })
})

describe("tickHandLock", () => {
  it("locks after a sustained lower-hand calibration", () => {
    const own = synthesizeHand("palm", { id: "own", scale: 1.8, origin: { x: 0.5, y: 0.84 } })
    let state = createHandLock()
    state = tickHandLock(state, { nowMs: 0, hands: [own] })
    expect(state.phase).toBe("calibrating")
    expect(state.progress01).toBe(0)
    state = tickHandLock(state, { nowMs: CALIBRATE_MS - 1, hands: [own] })
    expect(state.phase).toBe("calibrating")
    state = tickHandLock(state, { nowMs: CALIBRATE_MS, hands: [own] })
    expect(state.phase).toBe("locked")
    expect(state.hint).not.toBeNull()
  })

  it("marks lost after the lock timeout without stealing another hand", () => {
    const own = synthesizeHand("palm", { id: "own", scale: 1.8, origin: { x: 0.5, y: 0.84 } })
    const other = synthesizeHand("palm", { id: "other", scale: 1.5, origin: { x: 0.4, y: 0.28 } })
    let state = createHandLock()
    state = tickHandLock(state, { nowMs: 0, hands: [own] })
    state = tickHandLock(state, { nowMs: CALIBRATE_MS, hands: [own] })
    expect(state.phase).toBe("locked")
    state = tickHandLock(state, { nowMs: CALIBRATE_MS + 10, hands: [other] })
    state = tickHandLock(state, { nowMs: CALIBRATE_MS + 10 + LOCK_LOSS_MS, hands: [other] })
    expect(state.phase).toBe("lost")
  })

  it("resets calibration progress when the hand leaves", () => {
    const own = synthesizeHand("palm", { id: "own", scale: 1.8, origin: { x: 0.5, y: 0.84 } })
    let state = createHandLock()
    state = tickHandLock(state, { nowMs: 0, hands: [own] })
    state = tickHandLock(state, { nowMs: 800, hands: [own] })
    expect(state.progress01).toBeGreaterThan(0)
    state = tickHandLock(state, { nowMs: 900, hands: [] })
    expect(state.progress01).toBe(0)
    expect(state.calibrateStartedAtMs).toBeNull()
  })
})
