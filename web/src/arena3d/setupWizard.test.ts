import { describe, expect, it } from "vitest"
import type { Vec3 } from "../../../server/src/contracts"
import {
  applyCameraFix,
  calibrationOf,
  CAMERA_GIVE_UP_MS,
  createWizard,
  tickWizard,
  type WizardInput,
  type WizardState,
} from "./setupWizard"

// A standing body (body frame), arms down; overrides move joints.
function body(overrides: Record<number, Vec3> = {}): Vec3[] {
  const j: Vec3[] = Array.from({ length: 33 }, () => [0, 0, 0] as Vec3)
  j[0] = [0, 0.75, 0.05]
  j[11] = [-0.2, 0.5, 0]
  j[12] = [0.2, 0.5, 0]
  j[15] = [-0.25, 0, 0.05]
  j[16] = [0.25, 0, 0.05]
  for (const [i, v] of Object.entries(overrides)) j[Number(i)] = v
  return j
}

const placement = { hipX: 0.5, torso: 0.3 }
// Phone readings in the Earth frame, with the screen to the north.
const LEVEL_AT_SCREEN: Vec3 = [0, 1, 0]
const UP: Vec3 = [0, 0, 1]
const EAST: Vec3 = [1, 0, 0]

type Input = Omit<WizardInput, "nowMs">

/** Feed the same input for `ms` at ~30 fps. */
function holdFor(state: WizardState, input: Input, startMs: number, ms: number): [WizardState, number] {
  let now = startMs
  for (; now <= startMs + ms; now += 33) state = tickWizard(state, { ...input, nowMs: now })
  return [state, now]
}

/** Walk through setup; each pose arg says what the devices see at that step. */
function runSetup(poses: {
  upright: Vec3[]
  right: { body: Vec3[]; top: Vec3 }
  reach: Vec3[]
}) {
  let s = createWizard(0)
  let t = 0
  ;[s, t] = holdFor(s, { body: body(), placement, phone: { top: UP, rate: 0 } }, t, 50)
  expect(s.step).toBe("stand")
  ;[s, t] = holdFor(s, { body: body(), placement, phone: null }, t, 700)
  expect(s.step).toBe("upright")
  ;[s, t] = holdFor(s, { body: poses.upright, placement, phone: { top: UP, rate: 5 } }, t, 600)
  expect(s.step).toBe("right")
  ;[s, t] = holdFor(s, { body: poses.right.body, placement, phone: { top: poses.right.top, rate: 5 } }, t, 600)
  expect(s.step).toBe("reach")
  ;[s, t] = holdFor(s, { body: poses.reach, placement, phone: { top: LEVEL_AT_SCREEN, rate: 5 } }, t, 500)
  return s
}

const rightHandUpright = body({ 16: [0.2, 0.4, 0.3] })
const rightHandOut = body({ 16: [0.8, 0.4, 0.1] })
const rightHandForward = body({ 16: [0.25, 0.4, 0.6] })

describe("setup wizard", () => {
  it("measures the spot, heading and saber hand when both devices read correctly", () => {
    const s = runSetup({ upright: rightHandUpright, right: { body: rightHandOut, top: EAST }, reach: rightHandForward })
    expect(s.step).toBe("done")
    expect(s.baseline).toEqual(placement)
    expect(calibrationOf(s)).toEqual({ forward: [0, 1], hand: "right", mirror: false, done: true })
    expect(s.cameraFix).toEqual({ mirrorX: false, flipZ: false })
    expect(s.notes).toEqual([])
  })

  it("finds a left-handed player from the higher wrist", () => {
    const s = runSetup({
      upright: body({ 15: [-0.2, 0.4, 0.3] }),
      right: { body: body({ 15: [0.3, 0.4, 0.3] }), top: EAST },
      reach: body({ 15: [-0.25, 0.4, 0.6] }),
    })
    expect(s.hand).toBe("left")
  })

  it("detects a phone that reads right as left", () => {
    const s = runSetup({ upright: rightHandUpright, right: { body: rightHandOut, top: [-1, 0, 0] }, reach: rightHandForward })
    expect(s.step).toBe("done")
    expect(s.mirrorAim).toBe(true)
    expect(s.forward).toEqual([0, 1])
  })

  it("detects a mirrored camera and swaps the hand it picked", () => {
    // Mirrored: the upright right hand is labeled left, and it moves to the player's "left".
    const s = runSetup({
      upright: body({ 15: [-0.2, 0.4, 0.3] }),
      right: { body: body({ 15: [-0.8, 0.4, 0.1] }), top: EAST },
      // From here the duel page applies the fix, so the saber hand arrives as the right wrist.
      reach: body({ 16: [0.25, 0.4, 0.6] }),
    })
    expect(s.cameraFix.mirrorX).toBe(true)
    expect(s.hand).toBe("right")
  })

  it("detects reversed camera depth", () => {
    const s = runSetup({ upright: rightHandUpright, right: { body: rightHandOut, top: EAST }, reach: body({ 16: [0.25, 0.4, -0.6] }) })
    expect(s.cameraFix.flipZ).toBe(true)
  })

  it("skips the phone step when the phone is already live", () => {
    const s = tickWizard(createWizard(0), { nowMs: 0, body: body(), placement, phone: { top: UP, rate: 0 } })
    expect(s.step).toBe("stand")
  })

  it("won't take a thrust that points the same way as right", () => {
    let s: WizardState = { ...createWizard(0), step: "reach", hand: "right", rightTop: EAST, forward: [0, 1] }
    ;[s] = holdFor(s, { body: rightHandForward, placement, phone: { top: EAST, rate: 5 } }, 0, 2000)
    expect(s.step).toBe("reach")
  })

  it("won't read a pose mid-swing", () => {
    let s: WizardState = { ...createWizard(0), step: "upright" }
    ;[s] = holdFor(s, { body: rightHandUpright, placement, phone: { top: UP, rate: 300 } }, 0, 2000)
    expect(s.step).toBe("upright")
  })

  it("assumes the right hand, with a note, when the camera can't tell which hand is up", () => {
    let s: WizardState = { ...createWizard(0), step: "upright" }
    ;[s] = holdFor(s, { body: body(), placement, phone: { top: UP, rate: 0 } }, 0, CAMERA_GIVE_UP_MS + 600)
    expect(s.step).toBe("right")
    expect(s.hand).toBe("right")
    expect(s.notes).toHaveLength(1)
  })

  it("sends a calibration as soon as there is a heading, marked done only at the end", () => {
    const s = { ...createWizard(0), step: "reach" as const, forward: [0, 1] as [number, number] }
    expect(calibrationOf(s)).toEqual({ forward: [0, 1], hand: "right", mirror: false, done: false })
    expect(calibrationOf(createWizard(0))).toBeNull()
  })
})

describe("applyCameraFix", () => {
  it("mirroring negates x and swaps left and right joints", () => {
    const fixed = applyCameraFix(body({ 16: [0.5, 0.2, 0.3] }), { mirrorX: true, flipZ: false })
    expect(fixed[15]).toEqual([-0.5, 0.2, 0.3])
    expect(fixed[16]).toEqual([0.25, 0, 0.05])
  })

  it("flipping depth negates z", () => {
    expect(applyCameraFix(body(), { mirrorX: false, flipZ: true })[0]).toEqual([0, 0.75, -0.05])
  })
})
