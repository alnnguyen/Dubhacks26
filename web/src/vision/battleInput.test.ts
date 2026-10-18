import { describe, expect, it } from "vitest"
import { createBattleInput, resolveIntent, stepBattleInput, type BattleInputState } from "./battleInput"
import { FIST_STABLE_MS, PALM_HOLD_MS } from "./constants"
import { synthesizeHand } from "./syntheticHands"
import type { TouchInput } from "./types"

const ids = { sessionId: "pilot-a", matchId: "match-9" }
const idleTouch: TouchInput = { lift: false, throw: false, block: false, cancel: false }

function ownAndOpponent(own: "palm" | "fist" | "relaxed") {
  return [
    synthesizeHand(own, { id: "own", scale: 1.8, origin: { x: 0.55, y: 0.84 } }),
    synthesizeHand("palm", { id: "opponent", scale: 0.7, origin: { x: 0.4, y: 0.25 } }),
  ]
}

function step(state: BattleInputState, nowMs: number, own: "palm" | "fist" | "relaxed" | "none", touch: TouchInput | null = null) {
  const hands = own === "none" ? [] : ownAndOpponent(own)
  return stepBattleInput(state, { nowMs, hands, touch, ...ids })
}

describe("resolveIntent", () => {
  it("lets touch override a lost or ambiguous camera", () => {
    expect(resolveIntent({ status: "none" }, "none", { ...idleTouch, lift: true })).toBe("palm")
    expect(resolveIntent({ status: "ambiguous" }, "fist", { ...idleTouch, throw: true })).toBe("fist")
    expect(resolveIntent({ status: "ok", handId: "own" }, "palm", { ...idleTouch, cancel: true })).toBe("lost")
  })
})

describe("battle input", () => {
  it("lifts from the player's palm and ignores the smaller distant hand", () => {
    let state = createBattleInput(0)
    const charging = step(state, 0, "palm")
    expect(charging.ownHandId).toBe("own")
    expect(charging.selection.status).toBe("ok")
    expect(charging.phase).toBe("CHARGING")
    const lifted = step(charging.state, PALM_HOLD_MS, "palm")
    expect(lifted.commands.map((command) => command.name)).toEqual(["startLift"])
    expect(lifted.commands[0].commandId).toBe("pilot-a:match-9:1")
    state = lifted.state
  })

  it("throws on a stable fist and then refuses a second throw during cooldown", () => {
    let state = createBattleInput(0)
    state = step(state, 0, "palm").state
    state = step(state, PALM_HOLD_MS, "palm").state
    const early = step(state, PALM_HOLD_MS, "fist")
    const thrown = step(early.state, PALM_HOLD_MS + FIST_STABLE_MS, "fist")
    expect(thrown.commands.map((command) => command.name)).toEqual(["releaseRock"])
    const repeat = step(thrown.state, PALM_HOLD_MS + FIST_STABLE_MS + 30, "fist")
    expect(repeat.commands).toEqual([])
    expect(repeat.phase).toBe("COOLDOWN")
  })

  it("cancels instead of throwing when the hand leaves the frame", () => {
    let state = createBattleInput(0)
    state = step(state, 0, "palm").state
    state = step(state, PALM_HOLD_MS, "palm").state
    const lost = step(state, PALM_HOLD_MS + 40, "none")
    expect(lost.intent).toBe("lost")
    expect(lost.commands.map((command) => command.name)).toEqual(["cancelLift"])
    expect(lost.commands.some((command) => command.name === "releaseRock")).toBe(false)
  })

  it("pauses when both hands are a similar size, and touch lift still charges", () => {
    const hands = [
      synthesizeHand("palm", { id: "a", scale: 1, origin: { x: 0.4, y: 0.7 } }),
      synthesizeHand("fist", { id: "b", scale: 1.05, origin: { x: 0.6, y: 0.72 } }),
    ]
    const paused = stepBattleInput(createBattleInput(0), { nowMs: 0, hands, touch: null, ...ids })
    expect(paused.intent).toBe("ambiguous")
    expect(paused.commands).toEqual([])
    const touched = stepBattleInput(paused.state, {
      nowMs: 0,
      hands,
      touch: { ...idleTouch, lift: true },
      ...ids,
    })
    expect(touched.phase).toBe("CHARGING")
  })

  it("uses touch throw as the same release, even with no camera hand", () => {
    let state = createBattleInput(0)
    state = step(state, 0, "none", { ...idleTouch, lift: true }).state
    state = step(state, PALM_HOLD_MS, "none", { ...idleTouch, lift: true }).state
    state = step(state, PALM_HOLD_MS, "none", { ...idleTouch, throw: true }).state
    const thrown = step(state, PALM_HOLD_MS + FIST_STABLE_MS, "none", { ...idleTouch, throw: true })
    expect(thrown.commands.map((command) => command.name)).toEqual(["releaseRock"])
  })

  it("sends one block command for a held button plus a cancel for touch cancel", () => {
    let state = createBattleInput(0)
    state = step(state, 0, "palm").state
    state = step(state, PALM_HOLD_MS, "palm").state
    const blocked = step(state, PALM_HOLD_MS + 10, "palm", { ...idleTouch, block: true, cancel: true })
    expect(blocked.commands.map((command) => command.name)).toEqual(["block", "cancelLift"])
    const heldDown = step(blocked.state, PALM_HOLD_MS + 20, "palm", { ...idleTouch, block: true })
    expect(heldDown.commands).toEqual([])
  })

  it("ignores a landmark list that is too short to classify", () => {
    const broken = synthesizeHand("palm", { id: "broken", scale: 2, origin: { x: 0.5, y: 0.9 } })
    broken.landmarks = broken.landmarks.slice(0, 4)
    const result = stepBattleInput(createBattleInput(0), {
      nowMs: 0,
      hands: [broken],
      touch: null,
      ...ids,
    })
    expect(result.intent).toBe("lost")
    expect(result.phase).toBe("IDLE")
  })

  it("prefers the locked near hand over a larger distant opponent hand", () => {
    const own = synthesizeHand("palm", { id: "own", scale: 1.5, origin: { x: 0.55, y: 0.84 } })
    const other = synthesizeHand("palm", { id: "other", scale: 2.2, origin: { x: 0.4, y: 0.28 } })
    const hint = { center: { x: 0.55, y: 0.84 }, minSpan: 0.08 }
    const result = stepBattleInput(createBattleInput(0), {
      nowMs: 0,
      hands: [other, own],
      touch: null,
      lockHint: hint,
      ...ids,
    })
    expect(result.ownHandId).toBe("own")
    expect(result.phase).toBe("CHARGING")
  })

  it("pauses camera gestures while calibrating but still accepts touch lift", () => {
    const hands = ownAndOpponent("palm")
    const paused = stepBattleInput(createBattleInput(0), {
      nowMs: 0,
      hands,
      touch: null,
      gesturesPaused: true,
      ...ids,
    })
    expect(paused.intent).toBe("ambiguous")
    expect(paused.commands).toEqual([])
    const touched = stepBattleInput(paused.state, {
      nowMs: 0,
      hands,
      touch: { ...idleTouch, lift: true },
      gesturesPaused: true,
      ...ids,
    })
    expect(touched.phase).toBe("CHARGING")
  })
})
