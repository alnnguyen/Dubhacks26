import { describe, expect, it } from "vitest"
import { angularSpeed, topEdgeDirection } from "./aimMath"
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

it("angularSpeed combines rotationRate axes", () => {
  expect(angularSpeed({ alpha: 3, beta: 4, gamma: 0 })).toBe(5)
  expect(angularSpeed(null)).toBe(0)
})
