import { describe, expect, it } from "vitest"
import { COOLDOWN_MS, FIST_STABLE_MS, HELD_GESTURE_LOSS_GRACE_MS, MAX_HELD_MS, PALM_HOLD_MS } from "./constants"
import { createGestureMachine, tickGestureMachine, type GestureMachineState } from "./gestureMachine"
import type { BattleCommandName, Intent } from "./types"

const session = { sessionId: "pilot-a", matchId: "match-1" }

function tick(state: GestureMachineState, nowMs: number, intent: Intent, blockPressed = false) {
  return tickGestureMachine(state, { nowMs, intent, blockPressed, ...session })
}

function names(commands: { name: BattleCommandName }[]) {
  return commands.map((command) => command.name)
}

function holdOpen(now = 0) {
  let state = createGestureMachine(now)
  state = tick(state, now, "palm").state
  const lifted = tick(state, now + PALM_HOLD_MS, "palm")
  return lifted
}

describe("gesture machine", () => {
  it("starts idle and ignores a resting fist", () => {
    const state = createGestureMachine(0)
    const next = tick(state, 20, "fist")
    expect(next.state.phase).toBe("IDLE")
    expect(next.commands).toEqual([])
  })

  it("does not lift until the palm has been held for 500ms", () => {
    let state = createGestureMachine(0)
    state = tick(state, 0, "palm").state
    expect(state.phase).toBe("CHARGING")
    const early = tick(state, PALM_HOLD_MS - 1, "palm")
    expect(early.state.phase).toBe("CHARGING")
    expect(early.commands).toEqual([])
    const lifted = tick(early.state, PALM_HOLD_MS, "palm")
    expect(lifted.state.phase).toBe("HELD")
    expect(names(lifted.commands)).toEqual(["startLift"])
  })

  it("drops a palm that opens before the hold completes", () => {
    let state = createGestureMachine(0)
    state = tick(state, 0, "palm").state
    const dropped = tick(state, 200, "none")
    expect(dropped.state.phase).toBe("IDLE")
    expect(dropped.commands).toEqual([])
  })

  it("does not launch when a fist replaces a charge", () => {
    let state = createGestureMachine(0)
    state = tick(state, 0, "palm").state
    const punched = tick(state, 250, "fist")
    expect(punched.state.phase).toBe("IDLE")
    expect(names(punched.commands)).not.toContain("startLift")
    expect(names(punched.commands)).not.toContain("releaseRock")
  })

  it("releases only after the fist is stable, and only once", () => {
    const lifted = holdOpen(0)
    const early = tick(lifted.state, PALM_HOLD_MS, "fist")
    const almost = tick(early.state, PALM_HOLD_MS + FIST_STABLE_MS - 1, "fist")
    expect(almost.state.phase).toBe("HELD")
    expect(almost.commands).toEqual([])
    const released = tick(almost.state, PALM_HOLD_MS + FIST_STABLE_MS, "fist")
    expect(released.state.phase).toBe("COOLDOWN")
    expect(names(released.commands)).toEqual(["releaseRock"])
    const again = tick(released.state, PALM_HOLD_MS + FIST_STABLE_MS + 40, "fist")
    expect(names(again.commands)).not.toContain("releaseRock")
  })

  it("cancels a held rock when tracking is lost and does not launch", () => {
    const lifted = holdOpen(0)
    const lost = tick(lifted.state, PALM_HOLD_MS + 30, "lost")
    expect(lost.state.phase).toBe("IDLE")
    expect(names(lost.commands)).toEqual(["cancelLift"])
    const stillLost = tick(lost.state, PALM_HOLD_MS + 60, "lost")
    expect(stillLost.commands).toEqual([])
  })

  it("cancels immediately when own-hand selection becomes ambiguous", () => {
    const lifted = holdOpen(0)
    const paused = tick(lifted.state, PALM_HOLD_MS + 10, "ambiguous")
    expect(names(paused.commands)).toEqual(["cancelLift"])
    expect(paused.state.phase).toBe("IDLE")
  })

  it("waits through a short gesture dropout, then cancels instead of launching", () => {
    const lifted = holdOpen(0)
    const flicker = tick(lifted.state, PALM_HOLD_MS + 20, "none")
    expect(flicker.state.phase).toBe("HELD")
    expect(flicker.commands).toEqual([])
    const gone = tick(flicker.state, PALM_HOLD_MS + 20 + HELD_GESTURE_LOSS_GRACE_MS, "none")
    expect(gone.state.phase).toBe("IDLE")
    expect(names(gone.commands)).toEqual(["cancelLift"])
  })

  it("cancels when the hold lasts too long without a fist", () => {
    const lifted = holdOpen(0)
    const expired = tick(lifted.state, PALM_HOLD_MS + MAX_HELD_MS, "palm")
    expect(expired.state.phase).toBe("IDLE")
    expect(names(expired.commands)).toEqual(["cancelLift"])
  })

  it("prefers a stable fist over the hold timeout on the same tick", () => {
    const lifted = holdOpen(0)
    const started = tick(lifted.state, PALM_HOLD_MS + MAX_HELD_MS - FIST_STABLE_MS, "fist")
    const released = tick(started.state, PALM_HOLD_MS + MAX_HELD_MS, "fist")
    expect(names(released.commands)).toEqual(["releaseRock"])
    expect(released.state.phase).toBe("COOLDOWN")
  })

  it("blocks a second lift until cooldown ends", () => {
    const lifted = holdOpen(0)
    const armed = tick(lifted.state, PALM_HOLD_MS, "fist")
    const released = tick(armed.state, PALM_HOLD_MS + FIST_STABLE_MS, "fist")
    const during = tick(released.state, released.state.phaseEnteredAtMs + COOLDOWN_MS - 1, "palm")
    expect(during.state.phase).toBe("COOLDOWN")
    expect(during.commands).toEqual([])
    const after = tick(during.state, released.state.phaseEnteredAtMs + COOLDOWN_MS, "palm")
    expect(after.state.phase).toBe("CHARGING")
    expect(names(after.commands)).not.toContain("startLift")
  })

  it("emits one block per press and still allows block while a gesture is ambiguous", () => {
    let state = createGestureMachine(0)
    const first = tick(state, 0, "ambiguous", true)
    const held = tick(first.state, 16, "ambiguous", true)
    const up = tick(held.state, 32, "ambiguous", false)
    const second = tick(up.state, 48, "palm", true)
    expect(names(first.commands)).toEqual(["block"])
    expect(held.commands).toEqual([])
    expect(names(second.commands)).toEqual(["block"])
    expect(new Set([first.commands[0].commandId, second.commands[0].commandId]).size).toBe(2)
  })

  it("gives every command a unique id and the caller's session", () => {
    const lifted = holdOpen(10)
    const lost = tick(lifted.state, 20 + PALM_HOLD_MS, "lost")
    const ids = [...lifted.commands, ...lost.commands].map((command) => command.commandId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(lost.commands[0]).toMatchObject({
      name: "cancelLift",
      sessionId: "pilot-a",
      matchId: "match-1",
      sentAtMs: 20 + PALM_HOLD_MS,
    })
  })

  it("does not charge while tracking is already lost", () => {
    const state = createGestureMachine(0)
    const lost = tick(state, 50, "lost")
    expect(lost.state.phase).toBe("IDLE")
    expect(lost.commands).toEqual([])
  })
})
