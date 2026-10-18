import { describe, expect, it } from "vitest"
import { hexToWorld } from "./hexBoard"
import { glideRoot, onOwnStep, reconcile } from "./ownGlide"

const SIZE = 1.3 / Math.sqrt(3)
const STEP_MS = 110
const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]))

describe("own glide", () => {
  it("starts gliding the moment a step is accepted and lands on the new hex's center", () => {
    const start = reconcile(null, { q: 0, r: -1 }, SIZE, 0)
    close(glideRoot(start, SIZE, STEP_MS, 0), [0, -1.3])
    const stepping = onOwnStep(start, { q: 0, r: 0 }, SIZE, STEP_MS, 1000)
    const partway = glideRoot(stepping, SIZE, STEP_MS, 1050)[1]
    expect(partway).toBeGreaterThan(-1.3)
    expect(partway).toBeLessThan(0)
    close(glideRoot(stepping, SIZE, STEP_MS, 1000 + STEP_MS), hexToWorld({ q: 0, r: 0 }, SIZE))
  })

  it("a step during a glide continues from where you're drawn, without a jump", () => {
    let g = onOwnStep(reconcile(null, { q: 0, r: -1 }, SIZE, 0), { q: 0, r: 0 }, SIZE, STEP_MS, 1000)
    const drawn = glideRoot(g, SIZE, STEP_MS, 1075)
    g = onOwnStep(g, { q: 1, r: 0 }, SIZE, STEP_MS, 1075)
    close(glideRoot(g, SIZE, STEP_MS, 1075), drawn)
  })

  it("lagging frames don't undo a fresh step; frames that keep disagreeing win", () => {
    const g = onOwnStep(reconcile(null, { q: 0, r: -1 }, SIZE, 0), { q: 0, r: 0 }, SIZE, STEP_MS, 1000)
    expect(reconcile(g, { q: 0, r: -1 }, SIZE, 1100)).toBe(g)
    expect(reconcile(g, { q: 0, r: -1 }, SIZE, 1600).cell).toEqual({ q: 0, r: -1 })
  })
})
