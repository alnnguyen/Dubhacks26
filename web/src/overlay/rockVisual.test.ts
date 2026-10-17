import { describe, expect, it } from "vitest"
import { synthesizeHand } from "../vision/syntheticHands"
import type { BattleCommand } from "../vision/types"
import { createRockVisual, handFloatPoint, tickRockVisual, DEBUG_FLIGHT_SECONDS } from "./rockVisual"

function command(name: BattleCommand["name"], sentAtMs = 0): BattleCommand {
  return {
    name,
    commandId: `${name}-${sentAtMs}`,
    sessionId: "s",
    matchId: "m",
    sentAtMs,
  }
}

describe("handFloatPoint", () => {
  it("sits above the palm and rejects short landmark lists", () => {
    const hand = synthesizeHand("palm", { id: "own", origin: { x: 0.5, y: 0.8 } })
    const point = handFloatPoint(hand)
    expect(point).not.toBeNull()
    expect(point!.y).toBeLessThan(0.8)
    hand.landmarks = hand.landmarks.slice(0, 4)
    expect(handFloatPoint(hand)).toBeNull()
  })
})

describe("tickRockVisual", () => {
  const hand = synthesizeHand("palm", { id: "own", scale: 1.8, origin: { x: 0.55, y: 0.84 } })
  const target = { x: 0.35, y: 0.3 }

  it("hides until HELD, then follows the hand", () => {
    let state = createRockVisual()
    const charging = tickRockVisual(state, {
      nowMs: 0,
      phase: "CHARGING",
      commands: [],
      ownHand: hand,
      target,
    })
    expect(charging.drawAt).toBeNull()
    expect(charging.state.mode).toBe("hidden")

    const held = tickRockVisual(charging.state, {
      nowMs: 500,
      phase: "HELD",
      commands: [command("startLift", 500)],
      ownHand: hand,
      target,
    })
    expect(held.state.mode).toBe("held")
    expect(held.drawAt).not.toBeNull()
    state = held.state
  })

  it("flies on releaseRock and clears when flight ends", () => {
    let frame = tickRockVisual(createRockVisual(), {
      nowMs: 0,
      phase: "HELD",
      commands: [command("startLift")],
      ownHand: hand,
      target,
    })
    frame = tickRockVisual(frame.state, {
      nowMs: 10,
      phase: "COOLDOWN",
      commands: [command("releaseRock", 10)],
      ownHand: hand,
      target,
    })
    expect(frame.state.mode).toBe("flying")
    expect(frame.drawAt).toEqual(frame.state.from)

    const mid = tickRockVisual(frame.state, {
      nowMs: 10 + (DEBUG_FLIGHT_SECONDS * 1000) / 2,
      phase: "COOLDOWN",
      commands: [],
      ownHand: hand,
      target,
    })
    expect(mid.state.mode).toBe("flying")
    expect(mid.drawAt!.y).toBeLessThan(((frame.state.from!.y + frame.state.to!.y) / 2) + 0.01)

    const done = tickRockVisual(mid.state, {
      nowMs: 10 + DEBUG_FLIGHT_SECONDS * 1000,
      phase: "COOLDOWN",
      commands: [],
      ownHand: hand,
      target,
    })
    expect(done.state.mode).toBe("hidden")
    expect(done.drawAt).toBeNull()
  })

  it("removes the rock immediately on cancelLift and never keeps a flight", () => {
    let frame = tickRockVisual(createRockVisual(), {
      nowMs: 0,
      phase: "HELD",
      commands: [command("startLift")],
      ownHand: hand,
      target,
    })
    frame = tickRockVisual(frame.state, {
      nowMs: 20,
      phase: "IDLE",
      commands: [command("cancelLift", 20)],
      ownHand: null,
      target,
    })
    expect(frame.state.mode).toBe("hidden")
    expect(frame.drawAt).toBeNull()
  })

  it("falls back to an upward target when pose shoulders are missing", () => {
    const held = tickRockVisual(createRockVisual(), {
      nowMs: 0,
      phase: "HELD",
      commands: [command("startLift")],
      ownHand: hand,
      target: null,
    })
    const thrown = tickRockVisual(held.state, {
      nowMs: 5,
      phase: "COOLDOWN",
      commands: [command("releaseRock", 5)],
      ownHand: hand,
      target: null,
    })
    expect(thrown.state.mode).toBe("flying")
    expect(thrown.state.to!.y).toBeLessThan(thrown.state.from!.y)
  })
})
