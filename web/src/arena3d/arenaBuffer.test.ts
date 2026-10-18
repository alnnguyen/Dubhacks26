import { describe, expect, it } from "vitest"
import type { ArenaFrame, Vec3 } from "../../../server/src/contracts"
import { blendBlade, createArenaBuffer, pushFrame, RENDER_DELAY_MS, sampleFrame, slerp } from "./arenaBuffer"

function frame(serverMs: number, x: number, angleDeg = 0): ArenaFrame {
  const a = (angleDeg * Math.PI) / 180
  const hilt: Vec3 = [x, 1, 0]
  return {
    serverMs,
    engaged: true,
    players: [
      {
        slot: 1,
        cell: { q: 0, r: 0 },
        facing: [0, 1],
        joints: Array.from({ length: 33 }, () => [x, 1, 0] as Vec3),
        blade: { hilt, tip: [x + Math.cos(a) * 0.9, 1 + Math.sin(a) * 0.9, 0] },
        swinging: false,
        stamina: 100,
        winded: false,
        stunned: false,
      },
    ],
  }
}

const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]))

describe("arena buffer", () => {
  it("draws a moment in the past, blended between the frames around it", () => {
    let buffer = createArenaBuffer()
    // Server ticks at 0, 33, 66 ms arrive 20 ms later each.
    buffer = pushFrame(buffer, frame(0, 0), 20)
    buffer = pushFrame(buffer, frame(33, 1), 53)
    buffer = pushFrame(buffer, frame(66, 2), 86)
    // Local time minus the 20 ms offset and the render delay is server time 16.5: halfway between 0 and 33.
    const f = sampleFrame(buffer, 20 + 16.5 + RENDER_DELAY_MS)!
    expect(f.players[0].joints![0][0]).toBeCloseTo(0.5)
  })

  it("isn't thrown by a late or out-of-order frame", () => {
    let buffer = createArenaBuffer()
    buffer = pushFrame(buffer, frame(0, 0), 20)
    buffer = pushFrame(buffer, frame(66, 2), 86)
    buffer = pushFrame(buffer, frame(33, 1), 140) // overtaken and late
    buffer = pushFrame(buffer, frame(33, 1), 141) // duplicate
    // The late arrival doesn't drag the clock offset.
    expect(buffer.offset).toBeLessThanOrEqual(22)
    expect(buffer.frames.map((f) => f.serverMs)).toEqual([0, 33, 66])
  })

  it("holds the last frame when frames stop, and is empty before any", () => {
    expect(sampleFrame(createArenaBuffer(), 0)).toBeNull()
    const buffer = pushFrame(createArenaBuffer(), frame(0, 3), 10)
    expect(sampleFrame(buffer, 10_000)!.players[0].joints![0][0]).toBe(3)
  })

  it("turns a blade through an arc, keeping its length", () => {
    const a = frame(0, 0, 0).players[0].blade!
    const b = frame(0, 0, 90).players[0].blade!
    const mid = blendBlade(a, b, 0.5)
    const d = [mid.tip[0] - mid.hilt[0], mid.tip[1] - mid.hilt[1], mid.tip[2] - mid.hilt[2]]
    expect(Math.hypot(...d)).toBeCloseTo(0.9)
    close(d, [0.9 * Math.SQRT1_2, 0.9 * Math.SQRT1_2, 0])
  })

  it("slerp handles nearly identical directions", () => {
    close(slerp([1, 0, 0], [1, 0, 0], 0.5), [1, 0, 0])
  })
})
