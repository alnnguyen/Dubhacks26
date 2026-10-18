import { describe, expect, it } from "vitest"
import type { Vec3 } from "../../../server/src/contracts"
import { createStabilizer, stabilize, type StabilizerState } from "./bodyStabilizer"
import { oneEuro } from "./oneEuro"

// Deterministic jitter, so the steadiness test can't pass or fail by luck.
let seed = 1
const noise = () => {
  seed = (seed * 16807) % 2147483647
  return seed / 2147483647 - 0.5
}

function raw(jitter = 0, overrides: Record<number, Vec3> = {}): Vec3[] {
  const j: Vec3[] = Array.from({ length: 33 }, () => [9, 9, 9] as Vec3)
  const n = () => noise() * jitter
  j[0] = [n(), 0.75 + n(), 0.05]
  j[11] = [-0.2 + n(), 0.5 + n(), 0]
  j[12] = [0.2 + n(), 0.5 + n(), 0]
  j[13] = [-0.3, 0.3, 0.1]
  j[14] = [0.3, 0.3, 0.1]
  j[15] = [-0.25 + n(), 0.2 + n(), 0.3]
  j[16] = [0.25 + n(), 0.2 + n(), 0.3]
  j[23] = [-0.12, 0, 0]
  j[24] = [0.12, 0, 0]
  // Legs as MediaPipe guesses them out of frame: wild.
  j[27] = [0.8, -0.2, 1.4]
  for (const [i, v] of Object.entries(overrides)) j[Number(i)] = v
  return j
}

const visible = Array.from({ length: 33 }, () => 0.9)

describe("stabilize", () => {
  it("ignores tracked legs and stands a fixed lower body under the hips", () => {
    const { joints } = stabilize(createStabilizer(), raw(), visible, 0)
    expect(joints[27]).toEqual([-0.12, -0.9, 0])
    expect(joints[28]).toEqual([0.12, -0.9, 0])
  })

  it("steadies a jittery wrist held still", () => {
    seed = 1
    let state: StabilizerState = createStabilizer()
    const xs: number[] = []
    for (let i = 0; i < 90; i++) {
      const r = stabilize(state, raw(0.04), visible, i * 33)
      state = r.state
      if (i > 30) xs.push(r.joints[16][0])
    }
    const spread = Math.max(...xs) - Math.min(...xs)
    expect(spread).toBeLessThan(0.02)
  })

  it("still follows a fast swing closely", () => {
    let state = createStabilizer()
    for (let i = 0; i < 10; i++) state = stabilize(state, raw(), visible, i * 33).state
    let joints: Vec3[] = []
    for (let i = 0; i < 4; i++) ({ state, joints } = stabilize(state, raw(0, { 16: [0.25 + 0.15 * (i + 1), 0.2, 0.3] }), visible, 330 + i * 33))
    // Moved 0.6 m in ~130 ms; the filtered wrist keeps most of it.
    expect(joints[16][0]).toBeGreaterThan(0.6)
  })

  it("places hips under the shoulders when they leave the frame", () => {
    const hidden = visible.map((v, i) => (i === 23 || i === 24 ? 0.1 : v))
    const { joints } = stabilize(createStabilizer(), raw(0, { 23: [3, 3, 3], 24: [3, 3, 3] }), hidden, 0)
    expect(joints[23][1]).toBeCloseTo(0)
    expect(joints[24][0]).toBeCloseTo(0.12)
  })
})

it("oneEuro passes the first value through and then smooths", () => {
  const p = { minCutoff: 1, beta: 0, dCutoff: 1 }
  const first = oneEuro(null, 1, 0, p)
  expect(first!.value).toBe(1)
  const next = oneEuro(first, 2, 33, p)
  expect(next!.value).toBeGreaterThan(1)
  expect(next!.value).toBeLessThan(2)
})
