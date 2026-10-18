import { describe, expect, it } from "vitest"
import { orbitStep } from "../../../server/src/game/grid"
import { cellToWorld } from "./gridBoard"
import { glideRoot, onOwnStep, reconcile } from "./ownGlide"

const SIZE = 0.65
const STEP_MS = 110
const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]))

describe("own glide", () => {
  it("starts gliding the moment a step is accepted and lands on the new cell's center", () => {
    const start = reconcile(null, { q: 0, r: -2 }, SIZE, 0)
    close(glideRoot(start, SIZE, STEP_MS, 0), [0, -1.3])
    const stepping = onOwnStep(start, { q: 0, r: -1 }, SIZE, STEP_MS, 1000)
    const partway = glideRoot(stepping, SIZE, STEP_MS, 1050)[1]
    expect(partway).toBeGreaterThan(-1.3)
    expect(partway).toBeLessThan(-0.65)
    close(glideRoot(stepping, SIZE, STEP_MS, 1000 + STEP_MS), cellToWorld({ q: 0, r: -1 }, SIZE))
  })

  it("uses the server's orbit center to follow the same circular arc", () => {
    const start = { q: 0, r: -1 }
    const rival = { q: 0, r: 1 }
    const target = orbitStep(start, rival, "right")!
    const g = onOwnStep(reconcile(null, start, SIZE, 0), target, SIZE, STEP_MS, 1000, [0, SIZE])
    for (let ms = 0; ms <= STEP_MS; ms += 10) {
      const [x, z] = glideRoot(g, SIZE, STEP_MS, 1000 + ms)
      expect(Math.hypot(x, z - SIZE)).toBeCloseTo(1.3, 9)
    }
    close(glideRoot(g, SIZE, STEP_MS, 1110), cellToWorld(target, SIZE))
  })

  it("a step during a glide continues from where you're drawn, without a jump", () => {
    let g = onOwnStep(reconcile(null, { q: 0, r: -2 }, SIZE, 0), { q: 0, r: -1 }, SIZE, STEP_MS, 1000)
    const drawn = glideRoot(g, SIZE, STEP_MS, 1075)
    g = onOwnStep(g, { q: 1, r: -1 }, SIZE, STEP_MS, 1075)
    close(glideRoot(g, SIZE, STEP_MS, 1075), drawn)
  })

  it("lagging frames don't undo a fresh step; frames that keep disagreeing win", () => {
    const g = onOwnStep(reconcile(null, { q: 0, r: -2 }, SIZE, 0), { q: 0, r: -1 }, SIZE, STEP_MS, 1000)
    expect(reconcile(g, { q: 0, r: -2 }, SIZE, 1100)).toBe(g)
    expect(reconcile(g, { q: 0, r: -2 }, SIZE, 1600).cell).toEqual({ q: 0, r: -2 })
  })
})
