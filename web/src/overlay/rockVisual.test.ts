import { describe, expect, it } from "vitest"
import { synthesizeHand } from "../vision/syntheticHands"
import type { BattleCommand } from "../vision/types"
import {
  createRockVisual,
  handFloatPoint,
  tickRockVisual,
  GROUND_Y,
  HELD_ROCK_SCALE,
  PICKUP_DISTANCE,
} from "./rockVisual"

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
  it("sits above the palm", () => {
    const hand = synthesizeHand("palm", { id: "own", origin: { x: 0.5, y: 0.8 } })
    const point = handFloatPoint(hand)
    expect(point).not.toBeNull()
    expect(point!.y).toBeLessThan(0.8)
  })
})

describe("AR rock POC", () => {
  const lowPalm = synthesizeHand("palm", {
    id: "own",
    scale: 1.8,
    origin: { x: 0.5, y: 0.86 },
  })

  it("spawns visible ground rocks in the lower third", () => {
    const frame = tickRockVisual(createRockVisual(), {
      nowMs: 0,
      phase: "IDLE",
      commands: [],
      ownHand: null,
      target: null,
      palmOpen: false,
    })
    expect(frame.state.mode).toBe("ground")
    expect(frame.draw.rocks.some((rock) => rock.kind === "ground")).toBe(true)
    expect(frame.state.ground.every((rock) => rock.point.y >= 0.67)).toBe(true)
    expect(GROUND_Y).toBeGreaterThanOrEqual(0.75)
    expect(frame.drawAt).toBeNull()
  })

  it("pulls a nearby ground rock toward an open palm", () => {
    const state = createRockVisual()
    const near = {
      ...state,
      ground: state.ground.map((rock, index) =>
        index === 0 ? { ...rock, point: { x: 0.5, y: GROUND_Y } } : rock,
      ),
    }
    const hand = handFloatPoint(lowPalm)!
    expect(Math.hypot(hand.x - near.ground[0].point.x, hand.y - near.ground[0].point.y)).toBeLessThan(
      PICKUP_DISTANCE + 0.05,
    )
    const lifting = tickRockVisual(near, {
      nowMs: 10,
      phase: "IDLE",
      commands: [],
      ownHand: lowPalm,
      target: { x: 0.3, y: 0.3 },
      palmOpen: true,
    })
    expect(lifting.state.mode).toBe("lifting")
    expect(lifting.draw.active).not.toBeNull()
  })

  it("locks to the hand on startLift and throws with velocity on releaseRock", () => {
    let frame = tickRockVisual(createRockVisual(), {
      nowMs: 0,
      phase: "HELD",
      commands: [command("startLift")],
      ownHand: lowPalm,
      target: { x: 0.3, y: 0.3 },
      palmOpen: true,
    })
    expect(frame.state.mode).toBe("held")
    expect(frame.draw.active?.lift).toBeGreaterThan(0.5)
    expect(frame.draw.active?.scale).toBe(HELD_ROCK_SCALE)

    // Swipe samples accumulate while held.
    const swiping = synthesizeHand("fist", { id: "own", scale: 1.8, origin: { x: 0.35, y: 0.55 } })
    frame = tickRockVisual(frame.state, {
      nowMs: 40,
      phase: "HELD",
      commands: [],
      ownHand: swiping,
      target: { x: 0.3, y: 0.3 },
      palmOpen: false,
    })
    frame = tickRockVisual(frame.state, {
      nowMs: 80,
      phase: "COOLDOWN",
      commands: [command("releaseRock", 80)],
      ownHand: swiping,
      target: { x: 0.3, y: 0.3 },
      palmOpen: false,
    })
    expect(frame.state.mode).toBe("flying")
    expect(frame.state.flight).not.toBeNull()
    expect(frame.draw.active?.scale).toBeLessThanOrEqual(1.15)
  })

  it("cancel clears the active rock and restores ground props", () => {
    let frame = tickRockVisual(createRockVisual(), {
      nowMs: 0,
      phase: "HELD",
      commands: [command("startLift")],
      ownHand: lowPalm,
      target: null,
      palmOpen: true,
    })
    frame = tickRockVisual(frame.state, {
      nowMs: 20,
      phase: "IDLE",
      commands: [command("cancelLift", 20)],
      ownHand: null,
      target: null,
      palmOpen: false,
    })
    expect(frame.state.mode).toBe("ground")
    expect(frame.draw.rocks.some((rock) => rock.kind === "ground")).toBe(true)
    expect(frame.draw.active).toBeNull()
  })

  it("hides ground and held rocks while the gun is active", () => {
    let frame = tickRockVisual(createRockVisual(), {
      nowMs: 0,
      phase: "HELD",
      commands: [command("startLift")],
      ownHand: lowPalm,
      target: null,
      palmOpen: true,
      weapon: "rock",
    })
    expect(frame.draw.rocks.length).toBeGreaterThan(0)
    frame = tickRockVisual(frame.state, {
      nowMs: 20,
      phase: "HELD",
      commands: [],
      ownHand: lowPalm,
      target: null,
      palmOpen: true,
      weapon: "gun",
    })
    expect(frame.draw.rocks).toEqual([])
    expect(frame.state.ground).toEqual([])
  })

  it("ends the throw when the server flight window elapses", () => {
    let frame = tickRockVisual(createRockVisual(0.2), {
      nowMs: 0,
      phase: "HELD",
      commands: [command("startLift")],
      ownHand: lowPalm,
      target: { x: 0.5, y: 0.3 },
      palmOpen: true,
    })
    frame = tickRockVisual(frame.state, {
      nowMs: 40,
      phase: "COOLDOWN",
      commands: [command("releaseRock", 40)],
      ownHand: lowPalm,
      target: { x: 0.5, y: 0.3 },
      palmOpen: false,
    })
    expect(frame.state.mode).toBe("flying")
    frame = tickRockVisual(frame.state, {
      nowMs: 250,
      phase: "COOLDOWN",
      commands: [],
      ownHand: null,
      target: { x: 0.5, y: 0.3 },
      palmOpen: false,
    })
    expect(frame.state.mode).not.toBe("flying")
  })
})
