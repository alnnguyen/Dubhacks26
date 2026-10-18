import { describe, expect, it } from "vitest"
import {
  COOLDOWN_MS,
  FIST_STABLE_MS,
  GUN_POSE_LOSS_GRACE_MS,
  PALM_HOLD_MS,
  SABER_RECOVER_MS,
  SOFT_RELEASE_CANCEL_MS,
  THROW_SPEED_MIN,
} from "./constants"
import { createGestureMachine, tickGestureMachine, type GestureMachineState, type GestureTick } from "./gestureMachine"
import type { BattleCommandName, Intent } from "./types"

const session = { sessionId: "pilot-a", matchId: "match-1" }

function tick(
  state: GestureMachineState,
  nowMs: number,
  intent: Intent,
  options: Partial<
    Pick<
      GestureTick,
      | "blockPressed"
      | "handSpeed"
      | "handVx"
      | "handVy"
      | "handUpDelta"
      | "forceThrow"
      | "weapon"
      | "tipSwing"
      | "tipSwingDx"
      | "tipSwingDy"
      | "tipSpeed"
    >
  > = {},
) {
  return tickGestureMachine(state, {
    nowMs,
    intent,
    blockPressed: options.blockPressed ?? false,
    handSpeed: options.handSpeed ?? 0,
    handVx: options.handVx ?? 0,
    handVy: options.handVy ?? 0,
    handUpDelta: options.handUpDelta ?? 0,
    tipSwing: options.tipSwing ?? false,
    tipSwingDx: options.tipSwingDx ?? 0,
    tipSwingDy: options.tipSwingDy ?? 0,
    tipSpeed: options.tipSpeed ?? 0,
    forceThrow: options.forceThrow ?? false,
    weapon: options.weapon ?? "rock",
    ...session,
  })
}

function names(commands: { name: BattleCommandName }[]) {
  return commands.map((command) => command.name)
}

function chargeAndGrab(now = 0) {
  let state = createGestureMachine(now)
  state = tick(state, now, "palm").state
  state = tick(state, now + PALM_HOLD_MS, "palm").state
  state = tick(state, now + PALM_HOLD_MS, "fist").state
  return tick(state, now + PALM_HOLD_MS + FIST_STABLE_MS, "fist")
}

describe("gesture machine — rock grab then fling", () => {
  it("starts idle and ignores a resting fist", () => {
    const state = createGestureMachine(0)
    const next = tick(state, 0, "fist")
    expect(next.state.phase).toBe("IDLE")
    expect(next.commands).toEqual([])
  })

  it("charges on palm then grabs on a stable fist", () => {
    const grabbed = chargeAndGrab(0)
    expect(grabbed.state.phase).toBe("HELD")
    expect(names(grabbed.commands)).toEqual(["startLift"])
  })

  it("throws on open hand with speed", () => {
    const grabbed = chargeAndGrab(0)
    const flung = tick(grabbed.state, grabbed.state.phaseEnteredAtMs + 20, "palm", {
      handSpeed: THROW_SPEED_MIN,
    })
    expect(names(flung.commands)).toEqual(["releaseRock"])
    expect(flung.state.phase).toBe("COOLDOWN")
  })

  it("throws on touch Throw while held", () => {
    const grabbed = chargeAndGrab(0)
    const thrown = tick(grabbed.state, grabbed.state.phaseEnteredAtMs + 20, "fist", { forceThrow: true })
    expect(names(thrown.commands)).toEqual(["releaseRock"])
  })

  it("cancels a soft open without a fling", () => {
    const grabbed = chargeAndGrab(0)
    const soft = tick(grabbed.state, grabbed.state.phaseEnteredAtMs + 20, "palm", { handSpeed: 0 })
    const cancelled = tick(soft.state, soft.state.softOpenSinceMs! + SOFT_RELEASE_CANCEL_MS, "palm")
    expect(names(cancelled.commands)).toEqual(["cancelLift"])
    expect(cancelled.state.phase).toBe("IDLE")
  })

  it("blocks a second throw until cooldown ends", () => {
    const grabbed = chargeAndGrab(0)
    const thrown = tick(grabbed.state, grabbed.state.phaseEnteredAtMs + 20, "palm", {
      handSpeed: THROW_SPEED_MIN,
    })
    const during = tick(thrown.state, thrown.state.phaseEnteredAtMs + COOLDOWN_MS - 1, "palm")
    expect(during.state.phase).toBe("COOLDOWN")
    const after = tick(during.state, thrown.state.phaseEnteredAtMs + COOLDOWN_MS, "palm")
    expect(after.state.phase).toBe("CHARGING")
  })
})

describe("gesture machine — fist hold then trigger fire", () => {
  it("cocks on fist then fires when index+middle extend", () => {
    let state = createGestureMachine(0)
    state = tick(state, 0, "fist", { weapon: "gun" }).state
    expect(state.phase).toBe("GUN_AIM")
    expect(state.gunShotReady).toBe(true)
    expect(state.gunActiveEmitted).toBe(true)
    const holding = tick(state, 40, "fist", { weapon: "gun" })
    expect(names(holding.commands)).toEqual([])
    const fired = tick(holding.state, 80, "gun", { weapon: "gun" })
    expect(names(fired.commands)).toEqual(["fireGun"])
    expect(fired.state.phase).toBe("COOLDOWN")
  })

  it("does not fire from the trigger until a fist cocks the shot", () => {
    let state = createGestureMachine(0)
    state = tick(state, 0, "none", { weapon: "gun" }).state
    expect(state.phase).toBe("GUN_AIM")
    expect(state.gunShotReady).toBe(false)
    const dry = tick(state, 40, "gun", { weapon: "gun" })
    expect(names(dry.commands)).toEqual([])
    state = tick(dry.state, 80, "fist", { weapon: "gun" }).state
    const fired = tick(state, 120, "gun", { weapon: "gun" })
    expect(names(fired.commands)).toEqual(["fireGun"])
  })

  it("keeps aim briefly when the fist grip flickers", () => {
    let state = createGestureMachine(0)
    state = tick(state, 0, "fist", { weapon: "gun" }).state
    const flicker = tick(state, 40, "none", { weapon: "gun" })
    expect(flicker.state.phase).toBe("GUN_AIM")
  })

  it("leaves gun aim after the pose-loss grace when Rock is selected", () => {
    let state = createGestureMachine(0)
    state = tick(state, 0, "fist", { weapon: "gun" }).state
    const mid = tick(state, 40, "none", { weapon: "rock" })
    expect(mid.state.phase).toBe("GUN_AIM")
    const left = tick(mid.state, 40 + GUN_POSE_LOSS_GRACE_MS, "none", { weapon: "rock" })
    expect(left.state.phase).toBe("IDLE")
  })

  it("switches from palm charge into gun aim on fist while Gun is selected", () => {
    let state = createGestureMachine(0)
    state = tick(state, 0, "palm", { weapon: "gun" }).state
    const switched = tick(state, 100, "fist", { weapon: "gun" })
    expect(switched.state.phase).toBe("GUN_AIM")
    expect(switched.state.gunShotReady).toBe(true)
  })
})

describe("gesture machine — saber tip swing", () => {
  it("slashes on tipSwing without a fist cock", () => {
    let state = createGestureMachine(0)
    state = tick(state, 0, "none", { weapon: "saber" }).state
    expect(state.phase).toBe("GUN_AIM")
    expect(state.gunShotReady).toBe(false)
    const slashed = tick(state, 40, "none", {
      weapon: "saber",
      tipSwing: true,
      tipSwingDx: 0.2,
      tipSwingDy: 0.01,
    })
    expect(names(slashed.commands)).toEqual(["slash"])
    expect(slashed.state.phase).toBe("SABER_RECOVER")
    expect(slashed.state.lastSwingDx).toBe(0.2)
  })

  it("returns to aim after a short recover, not a 3s cooldown", () => {
    let state = createGestureMachine(0)
    state = tick(state, 0, "none", { weapon: "saber" }).state
    const slashed = tick(state, 40, "none", { weapon: "saber", tipSwing: true, tipSwingDx: 0.15 })
    expect(slashed.state.phase).toBe("SABER_RECOVER")
    const mid = tick(slashed.state, 40 + SABER_RECOVER_MS - 10, "none", { weapon: "saber" })
    expect(mid.state.phase).toBe("SABER_RECOVER")
    const back = tick(mid.state, 40 + SABER_RECOVER_MS, "none", { weapon: "saber" })
    expect(back.state.phase).toBe("GUN_AIM")
  })

  it("slashes from the touch Slash backup while saber is aimed", () => {
    let state = createGestureMachine(0)
    state = tick(state, 0, "none", { weapon: "saber" }).state
    const slashed = tick(state, 40, "fist", { weapon: "saber", forceThrow: true })
    expect(names(slashed.commands)).toEqual(["slash"])
    expect(slashed.state.phase).toBe("SABER_RECOVER")
  })
})

describe("gesture machine — block hold", () => {
  it("emits block then endBlock around a held press", () => {
    let state = createGestureMachine(0)
    const first = tick(state, 0, "ambiguous", { blockPressed: true })
    const held = tick(first.state, 16, "ambiguous", { blockPressed: true })
    const up = tick(held.state, 32, "ambiguous", { blockPressed: false })
    expect(names(first.commands)).toEqual(["block"])
    expect(held.commands).toEqual([])
    expect(names(up.commands)).toEqual(["endBlock"])
  })
})
