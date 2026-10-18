import type { Hand, SaberCalibration, SetupStep, Vec3 } from "../../../server/src/contracts"
import type { BodyPlacement } from "./bodyFrame"

/**
 * Guided setup that ties a laptop camera to a phone saber. Each step asks for
 * a pose and advances once both devices agree for a moment, measuring along
 * the way: the step spot, the saber
 * hand (held upright), which way "right" and "toward the screen" are for the
 * phone, and whether the camera or the phone reads left/right (or the camera
 * forward/back) backwards. Pure: the duel screen feeds it every frame.
 */

export type CameraFix = {
  /** Camera frames come in mirrored: negate x and swap left/right joints. */
  mirrorX: boolean
  /** Camera depth comes in reversed: negate z. */
  flipZ: boolean
}

export type PhoneReading = { top: Vec3; rate: number }

export type WizardInput = {
  nowMs: number
  /** Body-frame joints with the current camera fix applied; null when not tracked. */
  body: Vec3[] | null
  placement: BodyPlacement | null
  /** The phone's latest fresh, tracked reading. */
  phone: PhoneReading | null
}

export type WizardState = {
  step: SetupStep
  /** When the current pose started being held; null while it isn't. */
  holdSinceMs: number | null
  progress: number
  stepStartedMs: number
  /** The placement when the hold started, to check stillness. */
  holdPlacement: BodyPlacement | null
  baseline: BodyPlacement | null
  /** The phone's horizontal heading when pointed to the player's right. */
  rightTop: Vec3 | null
  forward: [number, number] | null
  hand: Hand | null
  mirrorAim: boolean
  cameraFix: CameraFix
  /** Something setup had to assume, shown to the player. */
  notes: string[]
}

export const STEP_ORDER: SetupStep[] = ["phone", "stand", "upright", "right", "reach", "done"]

/** How long each pose must be held. */
export const HOLD_MS: Record<SetupStep, number> = {
  phone: 0,
  stand: 600,
  upright: 500,
  right: 500,
  reach: 400,
  done: 0,
}

/** After this long with the phone right but the camera unsure, accept and note what was assumed. */
export const CAMERA_GIVE_UP_MS = 2500

/** Turning slower than this (degrees/s), the saber counts as held in a pose. */
const STEADY_RATE = 120
/** The saber hand's wrist is at least this much higher than the other (meters). */
const RAISED_BY = 0.1

const LEFT_SHOULDER = 11
const RIGHT_SHOULDER = 12
const LEFT_WRIST = 15
const RIGHT_WRIST = 16

export function createWizard(nowMs: number): WizardState {
  return {
    step: "phone",
    holdSinceMs: null,
    progress: 0,
    stepStartedMs: nowMs,
    holdPlacement: null,
    baseline: null,
    rightTop: null,
    forward: null,
    hand: null,
    mirrorAim: false,
    cameraFix: { mirrorX: false, flipZ: false },
    notes: [],
  }
}

/** What the server needs, once there is a forward heading. done only after every step. */
export function calibrationOf(state: WizardState): SaberCalibration | null {
  if (!state.forward) return null
  return { forward: state.forward, hand: state.hand ?? "right", mirror: state.mirrorAim, done: state.step === "done" }
}

/** Same as the server's: the phone's top edge in the body frame for a heading. */
export function phoneInBody(top: Vec3, forward: [number, number], mirror: boolean): Vec3 {
  const [fx, fy] = forward
  const sideways = top[0] * fy - top[1] * fx
  return [mirror ? -sideways : sideways, top[2], top[0] * fx + top[1] * fy]
}

// MediaPipe left/right joint pairs, swapped when the camera is mirrored.
const PAIRS: [number, number][] = [
  [1, 4], [2, 5], [3, 6], [7, 8], [9, 10], [11, 12], [13, 14], [15, 16], [17, 18],
  [19, 20], [21, 22], [23, 24], [25, 26], [27, 28], [29, 30], [31, 32],
]

/** Which raw MediaPipe joint holds joint `i` once a mirror fix swaps left and right. */
export function mirrorIndex(i: number, mirrorX: boolean): number {
  if (!mirrorX) return i
  const pair = PAIRS.find(([a, b]) => a === i || b === i)
  return pair ? (pair[0] === i ? pair[1] : pair[0]) : i
}

export function applyCameraFix(joints: Vec3[], fix: CameraFix): Vec3[] {
  let out = joints.map((j) => [fix.mirrorX ? -j[0] : j[0], j[1], fix.flipZ ? -j[2] : j[2]] as Vec3)
  if (fix.mirrorX && out.length === 33) {
    const swapped = [...out]
    for (const [a, b] of PAIRS) {
      swapped[a] = out[b]
      swapped[b] = out[a]
    }
    out = swapped
  }
  return out
}

function advance(state: WizardState, nowMs: number, patch: Partial<WizardState>): WizardState {
  const next = STEP_ORDER[STEP_ORDER.indexOf(state.step) + 1] ?? "done"
  return { ...state, ...patch, step: next, holdSinceMs: null, progress: 0, stepStartedMs: nowMs, holdPlacement: null }
}

/** Hold logic: progress while `holding`, reset when not; true once held long enough. */
function hold(state: WizardState, nowMs: number, holding: boolean, extra: Partial<WizardState> = {}): [WizardState, boolean] {
  if (!holding) return [{ ...state, holdSinceMs: null, progress: 0, holdPlacement: null }, false]
  const since = state.holdSinceMs ?? nowMs
  const needed = HOLD_MS[state.step]
  const progress = needed > 0 ? Math.min(1, (nowMs - since) / needed) : 1
  return [{ ...state, ...extra, holdSinceMs: since, progress }, progress >= 1]
}

export function tickWizard(state: WizardState, input: WizardInput): WizardState {
  const { nowMs, body, placement, phone } = input
  const waited = nowMs - state.stepStartedMs
  const giveUp = waited > CAMERA_GIVE_UP_MS
  // Poses are read once the saber has settled, not mid-swing.
  const steady = phone !== null && phone.rate < STEADY_RATE
  const level = steady && Math.abs(phone.top[2]) < 0.5

  switch (state.step) {
    case "phone": {
      // Moves on as soon as the phone streams; an already-live phone skips straight past.
      const [held, done] = hold(state, nowMs, phone !== null)
      return done ? advance(held, nowMs, {}) : held
    }

    case "stand": {
      // Body in view and standing still, so the spot is a fair baseline.
      const start = state.holdPlacement ?? placement
      const still =
        Boolean(body && placement && start) &&
        Math.abs(placement!.hipX - start!.hipX) < 0.04 &&
        Math.abs(placement!.torso / start!.torso - 1) < 0.1
      const [held, done] = hold(state, nowMs, still, { holdPlacement: start })
      return done ? advance(held, nowMs, { baseline: placement }) : held
    }

    case "upright": {
      // Saber held upright in front, ready stance; the camera sees which hand holds it higher.
      const phoneUp = steady && phone.top[2] > 0.8
      const raised = body ? raisedHand(body) : null
      const [held, done] = hold(state, nowMs, phoneUp && (raised !== null || giveUp))
      if (!done) return held
      if (raised) return advance(held, nowMs, { hand: raised })
      return advance(held, nowMs, {
        hand: "right",
        notes: [...state.notes, "Couldn't tell which hand holds the saber — assuming your right."],
      })
    }

    case "right": {
      // Saber out to the right, level: this is the phone's "right", and the
      // camera's view of the saber wrist should say right too. If it says left,
      // the camera reads left/right backwards.
      const camera = body && state.hand ? wristSideways(body, state.hand) : null
      const cameraSure = camera !== null && Math.abs(camera) > 0.12
      const [held, done] = hold(state, nowMs, level && (cameraSure || giveUp))
      if (!done || !phone) return held
      const h = Math.hypot(phone.top[0], phone.top[1])
      const rightTop: Vec3 = [phone.top[0] / h, phone.top[1] / h, 0]
      // Provisional heading, a quarter turn left of "right", so the blade shows now; the thrust refines it.
      const patch: Partial<WizardState> = { rightTop, forward: [-rightTop[1], rightTop[0]], mirrorAim: false }
      if (cameraSure && camera! < 0) {
        // Mirrored camera: left and right joints were swapped, so was the hand we picked.
        patch.cameraFix = { ...state.cameraFix, mirrorX: !state.cameraFix.mirrorX }
        patch.hand = state.hand === "left" ? "right" : "left"
      } else if (!cameraSure) {
        patch.notes = [...state.notes, "Couldn't see your arm go right — keeping the camera's left/right as is."]
      }
      return advance(held, nowMs, patch)
    }

    case "reach": {
      // Saber thrust at the screen, level and square to "right"; the wrist
      // should come forward of the shoulders. Its heading is "toward the screen".
      const h = phone ? Math.hypot(phone.top[0], phone.top[1]) : 0
      const right = state.rightTop
      const across = phone && right && h > 0 ? Math.abs(phone.top[0] * right[0] + phone.top[1] * right[1]) / h : 1
      const reach = body && state.hand ? wristForward(body, state.hand) : null
      const cameraSure = reach !== null && Math.abs(reach) > 0.25
      const [held, done] = hold(state, nowMs, level && across < 0.5 && (cameraSure || giveUp))
      if (!done || !phone || !right) return held
      const forward: [number, number] = [phone.top[0] / h, phone.top[1] / h]
      // "Right" read as left of the thrust means the phone mirrors its sideways axis.
      const patch: Partial<WizardState> = { forward, mirrorAim: phoneInBody(right, forward, false)[0] < 0 }
      if (cameraSure && reach! < 0) patch.cameraFix = { ...state.cameraFix, flipZ: !state.cameraFix.flipZ }
      else if (!cameraSure) patch.notes = [...state.notes, "Couldn't see your reach — keeping the camera's depth as is."]
      return advance(held, nowMs, patch)
    }

    case "done":
      return state
  }
}

/** The wrist clearly higher than the other, holding the saber up; null when neither is. */
function raisedHand(body: Vec3[]): Hand | null {
  const lift = body[RIGHT_WRIST][1] - body[LEFT_WRIST][1]
  if (Math.abs(lift) < RAISED_BY) return null
  return lift > 0 ? "right" : "left"
}

/** How far the saber wrist is to the player's right of their shoulders' middle (meters). */
function wristSideways(body: Vec3[], hand: Hand): number {
  const mid = (body[LEFT_SHOULDER][0] + body[RIGHT_SHOULDER][0]) / 2
  return body[hand === "left" ? LEFT_WRIST : RIGHT_WRIST][0] - mid
}

/** How far the saber wrist is in front of the shoulders, toward the screen (meters). */
function wristForward(body: Vec3[], hand: Hand): number {
  const shoulders = (body[LEFT_SHOULDER][2] + body[RIGHT_SHOULDER][2]) / 2
  return body[hand === "left" ? LEFT_WRIST : RIGHT_WRIST][2] - shoulders
}

/** What the player is asked to do at each step (the phone shows it too). */
export const INSTRUCTIONS: Record<SetupStep, string> = {
  phone: "Scan the QR code with your phone, then tap Ignite saber.",
  stand: "Stand on your spot facing the laptop, whole upper body in view, and hold still.",
  upright: "Hold your phone straight out in front of you, standing upright.",
  right: "Point your phone out to your right.",
  reach: "Point your phone at the screen.",
  done: "Setup complete. Swipe on your phone with your thumb to move: ↑ toward your rival, ↓ away, ← → to circle.",
}
