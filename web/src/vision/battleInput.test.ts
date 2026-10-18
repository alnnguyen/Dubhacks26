import { describe, expect, it } from "vitest"
import { FIST_STABLE_MS, PALM_HOLD_MS } from "./constants"
import { createBattleInput, resolveIntent, stepBattleInput, type BattleInputState } from "./battleInput"
import { synthesizeHand } from "./syntheticHands"
import type { HandTrack, TouchInput } from "./types"

const ids = { sessionId: "s", matchId: "m" }
const idleTouch: TouchInput = { lift: false, throw: false, block: false, cancel: false }

function ownAndOpponent(own: "palm" | "fist" | "relaxed" | "gun") {
  return [
    synthesizeHand(own, { id: "own", scale: 1.8, origin: { x: 0.55, y: 0.84 } }),
    synthesizeHand("palm", { id: "opponent", scale: 0.7, origin: { x: 0.4, y: 0.25 } }),
  ]
}

function step(
  state: BattleInputState,
  nowMs: number,
  own: "palm" | "fist" | "relaxed" | "gun" | "none",
  touch: TouchInput | null = null,
  origin = { x: 0.55, y: 0.84 },
  weapon: "rock" | "gun" = "rock",
) {
  const hands: HandTrack[] =
    own === "none" ? ownAndOpponent("palm").slice(1) : ownAndOpponent(own).map((hand, index) =>
      index === 0 ? synthesizeHand(own, { id: "own", scale: 1.8, origin }) : hand,
    )
  return stepBattleInput(state, { nowMs, hands, touch, weapon, ...ids })
}

describe("resolveIntent", () => {
  it("lets touch override camera, including throw as release", () => {
    expect(resolveIntent({ status: "none" }, "none", { ...idleTouch, lift: true })).toBe("palm")
    expect(resolveIntent({ status: "ambiguous" }, "fist", { ...idleTouch, throw: true })).toBe("release")
    expect(resolveIntent({ status: "ok", handId: "own" }, "palm", { ...idleTouch, cancel: true })).toBe("lost")
    expect(resolveIntent({ status: "ok", handId: "own" }, "gun", null)).toBe("gun")
  })
})

describe("stepBattleInput", () => {
  it("lifts from the player's palm and grabs on fist", () => {
    let state = createBattleInput(0)
    const charging = step(state, 0, "palm")
    expect(charging.phase).toBe("CHARGING")
    state = charging.state
    state = step(state, PALM_HOLD_MS, "palm").state
    state = step(state, PALM_HOLD_MS, "fist").state
    const grabbed = step(state, PALM_HOLD_MS + FIST_STABLE_MS, "fist")
    expect(grabbed.commands.map((command) => command.name)).toEqual(["startLift"])
    expect(grabbed.phase).toBe("HELD")
  })

  it("throws when the fist opens while the hand is moving", () => {
    let state = createBattleInput(0)
    const base = PALM_HOLD_MS + FIST_STABLE_MS
    state = step(state, 0, "palm", null, { x: 0.5, y: 0.85 }).state
    state = step(state, PALM_HOLD_MS, "palm", null, { x: 0.5, y: 0.85 }).state
    state = step(state, PALM_HOLD_MS, "fist", null, { x: 0.5, y: 0.85 }).state
    state = step(state, base, "fist", null, { x: 0.5, y: 0.85 }).state
    // Keep the fist still, then open with a clear fling.
    state = step(state, base + 40, "fist", null, { x: 0.5, y: 0.85 }).state
    state = step(state, base + 80, "fist", null, { x: 0.5, y: 0.84 }).state
    const thrown = step(state, base + 140, "palm", null, { x: 0.5, y: 0.55 })
    expect(thrown.commands.map((command) => command.name)).toEqual(["releaseRock"])
  })

  it("does not launch when tracking is lost while held", () => {
    let state = createBattleInput(0)
    state = step(state, 0, "palm").state
    state = step(state, PALM_HOLD_MS, "fist").state
    state = step(state, PALM_HOLD_MS + FIST_STABLE_MS, "fist").state
    const lost = stepBattleInput(state, {
      nowMs: PALM_HOLD_MS + FIST_STABLE_MS + 20,
      hands: [],
      touch: null,
      ...ids,
    })
    expect(lost.commands.some((command) => command.name === "releaseRock")).toBe(false)
    expect(lost.commands.map((command) => command.name)).toEqual(["cancelLift"])
  })

  it("uses touch Lift then Throw to grab and release", () => {
    let state = createBattleInput(0)
    state = step(state, 0, "none", { ...idleTouch, lift: true }).state
    expect(state.machine.phase).toBe("CHARGING")
    const grabbed = step(state, FIST_STABLE_MS, "none", { ...idleTouch, throw: true })
    expect(grabbed.commands.map((command) => command.name)).toEqual(["startLift"])
    const thrown = step(grabbed.state, FIST_STABLE_MS + 40, "none", { ...idleTouch, throw: true })
    expect(thrown.commands.map((command) => command.name)).toEqual(["releaseRock"])
  })

  it("fires after a fist cock then index+middle trigger", () => {
    let state = createBattleInput(0)
    state = step(state, 0, "fist", null, { x: 0.5, y: 0.7 }, "gun").state
    expect(state.machine.phase).toBe("GUN_AIM")
    state = step(state, 40, "fist", null, { x: 0.5, y: 0.7 }, "gun").state
    const fired = step(state, 120, "gun", null, { x: 0.5, y: 0.7 }, "gun")
    expect(fired.commands.map((command) => command.name)).toContain("fireGun")
  })

  it("requires a fist cock before the trigger fires with Gun selected", () => {
    let state = createBattleInput(0)
    const aimed = stepBattleInput(state, {
      nowMs: 0,
      hands: [synthesizeHand("palm", { id: "own", scale: 1.8, origin: { x: 0.5, y: 0.72 } })],
      touch: null,
      weapon: "gun",
      ...ids,
    })
    expect(aimed.phase).toBe("GUN_AIM")
    state = aimed.state
    const dry = stepBattleInput(state, {
      nowMs: 80,
      hands: [synthesizeHand("gun", { id: "own", scale: 1.8, origin: { x: 0.5, y: 0.72 } })],
      touch: null,
      weapon: "gun",
      ...ids,
    })
    expect(dry.commands.map((command) => command.name)).not.toContain("fireGun")
    state = stepBattleInput(dry.state, {
      nowMs: 120,
      hands: [synthesizeHand("fist", { id: "own", scale: 1.8, origin: { x: 0.5, y: 0.72 } })],
      touch: null,
      weapon: "gun",
      ...ids,
    }).state
    const fired = stepBattleInput(state, {
      nowMs: 200,
      hands: [synthesizeHand("gun", { id: "own", scale: 1.8, origin: { x: 0.5, y: 0.72 } })],
      touch: null,
      weapon: "gun",
      ...ids,
    })
    expect(fired.commands.map((command) => command.name)).toContain("fireGun")
  })

  it("sends block then cancel for touch block + cancel", () => {
    let state = createBattleInput(0)
    state = step(state, 0, "palm").state
    state = step(state, PALM_HOLD_MS, "fist").state
    state = step(state, PALM_HOLD_MS + FIST_STABLE_MS, "fist").state
    const blocked = step(state, PALM_HOLD_MS + FIST_STABLE_MS + 10, "fist", {
      ...idleTouch,
      block: true,
      cancel: true,
    })
    expect(blocked.commands.map((command) => command.name)).toEqual(["block", "cancelLift"])
  })
})
