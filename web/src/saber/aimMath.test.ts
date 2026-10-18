import { describe, expect, it } from "vitest"
import { angularSpeed, smoothDirection, topEdgeDirection, type DirectionFilter } from "./aimMath"
import { phoneInBody } from "../arena3d/setupWizard"

const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]))

describe("topEdgeDirection", () => {
  it("is north when flat with alpha 0, up when stood upright", () => {
    close(topEdgeDirection(0, 0), [0, 1, 0])
    close(topEdgeDirection(0, 90), [0, 0, 1])
    // alpha turns counter-clockwise seen from above: 90° points west.
    close(topEdgeDirection(90, 0), [-1, 0, 0])
  })

  it("turning clockwise from the calibrated heading reads as right in the body frame", () => {
    // Calibrated pointing west at the screen; turning to north is a clockwise turn.
    close(phoneInBody(topEdgeDirection(0, 0), [-1, 0], false), [1, 0, 0])
    close(phoneInBody(topEdgeDirection(90, 0), [-1, 0], false), [0, 0, 1])
  })
})

describe("smoothDirection", () => {
  it("steadies a jittery direction held still, and stays unit length", () => {
    let filter: DirectionFilter | null = null
    const ys: number[] = []
    for (let i = 0; i < 120; i++) {
      const r = smoothDirection(filter, [0.02 * Math.sin(i * 2.7), 1, 0.02 * Math.cos(i * 3.1)], i * 16)
      filter = r.filter
      if (i > 30) ys.push(r.top[0])
      expect(Math.hypot(...r.top)).toBeCloseTo(1)
    }
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(0.02)
  })

  it("keeps up with a fast swing", () => {
    let filter: DirectionFilter | null = null
    let top = topEdgeDirection(0, 0)
    for (let i = 0; i < 10; i++) ({ filter, top } = smoothDirection(filter, topEdgeDirection(0, 0), i * 16))
    // A 90° turn in 100 ms (900°/s), then held for one more reading.
    for (let i = 1; i <= 7; i++) ({ filter, top } = smoothDirection(filter, topEdgeDirection(-90 * Math.min(1, i / 6), 0), 160 + i * 16))
    expect(top[0]).toBeGreaterThan(0.8)
  })
})

it("angularSpeed combines rotationRate axes", () => {
  expect(angularSpeed({ alpha: 3, beta: 4, gamma: 0 })).toBe(5)
  expect(angularSpeed(null)).toBe(0)
})
