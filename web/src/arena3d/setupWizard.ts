import type { Hand, SaberCalibration, SetupStep, Vec3 } from "../../../server/src/contracts"
import type { HandTrack, Point } from "../vision/types"
import type { BodyPlacement } from "./bodyFrame"
import { DEFAULT_MOVE_CALIBRATION, handSize, pinchRatio, pinchThresholds, type MoveCalibration } from "./pinchJoystick"

/**
 * Guided setup that ties a laptop camera to a phone saber. Each step asks for
 * a pose and advances once both devices agree for a moment, measuring along
 * the way: the step spot, which way "toward the screen" is for the phone, the
 * saber hand, whether the camera or the phone reads left/right (or the camera
 * forward/back) backwards, and the free hand's open, pinch and nudge sizes for
 * pinch-and-nudge walking. Pure: the duel screen feeds it every frame.
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
  /** The free (non-saber) hand from the hand tracker, once setup knows the saber hand. */
  freeHand: HandTrack | null
  /** Image width / height. */
  aspect: number
}

export type WizardState = {
  step: SetupStep
  /** When the current pose started being held; null while it isn't. */
  holdSinceMs: number | null
  progress: number
  stepStartedMs: number
  /** The placement or phone reading when the hold started, to check stillness. */
  holdPlacement: BodyPlacement | null
  holdTop: Vec3 | null
  baseline: BodyPlacement | null
  forward: [number, number] | null
  hand: Hand | null
  mirrorAim: boolean
  cameraFix: CameraFix
  /** The free hand's open and pinch ratios and nudge size; null until measured. */
  move: MoveCalibration | null
  /** Partial movement measurements while the steps run. */
  openRatio: number | null
  pinchRatio: number | null
  nudge: { anchor: Point | null; pinchedMs: number; lastMs: number | null; max: number }
  /** Something setup had to assume, shown to the player. */
  notes: string[]
}

export const STEP_ORDER: SetupStep[] = ["stand", "phone", "forward", "up", "right", "reach", "open", "pinch", "nudge", "done"]

/** How long each pose must be held. */
export const HOLD_MS: Record<SetupStep, number> = {
  stand: 1000,
  phone: 300,
  forward: 1000,
  up: 700,
  right: 700,
  reach: 500,
  open: 700,
  pinch: 700,
  // Pinched time spent nudging.
  nudge: 1500,
  done: 0,
}

/** After this long with the phone right but the camera unsure, accept and note what was assumed. */
export const CAMERA_GIVE_UP_MS = 4000
/** Movement steps fall back to defaults after this long without the free hand: walking is optional. */
export const HAND_GIVE_UP_MS = 8000
/** A nudge this big (hand sizes) during the nudge step counts as having nudged. */
const MIN_NUDGE = 0.3

const NOSE = 0
const LEFT_SHOULDER = 11
const RIGHT_SHOULDER = 12
const LEFT_WRIST = 15
const RIGHT_WRIST = 16

export function createWizard(nowMs: number): WizardState {
  return {
    step: "stand",
    holdSinceMs: null,
    progress: 0,
    stepStartedMs: nowMs,
    holdPlacement: null,
    holdTop: null,
    baseline: null,
    forward: null,
    hand: null,
    mirrorAim: false,
    cameraFix: { mirrorX: false, flipZ: false },
    move: null,
    openRatio: null,
    pinchRatio: null,
    nudge: { anchor: null, pinchedMs: 0, lastMs: null, max: 0 },
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

const angleBetween = (a: Vec3, b: Vec3) =>
  Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b) || 1))))

function advance(state: WizardState, nowMs: number, patch: Partial<WizardState>): WizardState {
  const next = STEP_ORDER[STEP_ORDER.indexOf(state.step) + 1] ?? "done"
  return { ...state, ...patch, step: next, holdSinceMs: null, progress: 0, stepStartedMs: nowMs, holdPlacement: null, holdTop: null }
}

/** Hold logic: progress while `holding`, reset when not; true once held long enough. */
function hold(state: WizardState, nowMs: number, holding: boolean, extra: Partial<WizardState> = {}): [WizardState, boolean] {
  if (!holding) return [{ ...state, holdSinceMs: null, progress: 0, holdPlacement: null, holdTop: null }, false]
  const since = state.holdSinceMs ?? nowMs
  const progress = Math.min(1, (nowMs - since) / HOLD_MS[state.step])
  return [{ ...state, ...extra, holdSinceMs: since, progress }, progress >= 1]
}

export function tickWizard(state: WizardState, input: WizardInput): WizardState {
  const { nowMs, body, placement, phone, freeHand, aspect } = input
  const waited = nowMs - state.stepStartedMs

  switch (state.step) {
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

    case "phone": {
      const [held, done] = hold(state, nowMs, phone !== null)
      return done ? advance(held, nowMs, {}) : held
    }

    case "forward": {
      // Phone level, steady, pointing at the screen.
      const start = state.holdTop ?? phone?.top ?? null
      const steady =
        phone !== null && start !== null &&
        Math.abs(phone.top[2]) < 0.4 &&
        phone.rate < 60 &&
        angleBetween(phone.top, start) < (12 * Math.PI) / 180
      const [held, done] = hold(state, nowMs, steady, { holdTop: start })
      if (!done || !phone) return held
      const h = Math.hypot(phone.top[0], phone.top[1])
      return advance(held, nowMs, { forward: [phone.top[0] / h, phone.top[1] / h] })
    }

    case "up": {
      // Saber raised straight up; the camera sees which hand is above the head.
      const phoneUp = phone !== null && phone.top[2] > 0.85
      const raised = body ? raisedHand(body) : null
      const giveUp = phoneUp && waited > CAMERA_GIVE_UP_MS
      const [held, done] = hold(state, nowMs, phoneUp && (raised !== null || giveUp))
      if (!done) return held
      if (raised) return advance(held, nowMs, { hand: raised })
      return advance(held, nowMs, {
        hand: "right",
        notes: [...state.notes, "Couldn't see your raised hand — assuming you hold the saber in your right hand."],
      })
    }

    case "right": {
      // Saber out to the right: the phone's sideways reading and the camera's
      // view of the saber wrist should both say "right". Either saying "left"
      // means that device reads left/right backwards.
      const sideways = phone && state.forward ? phoneInBody(phone.top, state.forward, false)[0] : 0
      const level = phone !== null && Math.abs(phone.top[2]) < 0.5
      const camera = body && state.hand ? wristSideways(body, state.hand) : null
      const cameraSure = camera !== null && Math.abs(camera) > 0.12
      const giveUp = waited > CAMERA_GIVE_UP_MS
      const [held, done] = hold(state, nowMs, level && Math.abs(sideways) > 0.75 && (cameraSure || giveUp))
      if (!done) return held
      const patch: Partial<WizardState> = { mirrorAim: sideways < 0 }
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
      // Saber pushed at the screen: the wrist should come forward of the shoulders.
      const phoneForward = phone !== null && state.forward !== null && phoneInBody(phone.top, state.forward, state.mirrorAim)[2] > 0.6
      const reach = body && state.hand ? wristForward(body, state.hand) : null
      const cameraSure = reach !== null && Math.abs(reach) > 0.25
      const giveUp = waited > CAMERA_GIVE_UP_MS
      const [held, done] = hold(state, nowMs, phoneForward && (cameraSure || giveUp))
      if (!done) return held
      if (cameraSure && reach! < 0) return advance(held, nowMs, { cameraFix: { ...state.cameraFix, flipZ: !state.cameraFix.flipZ } })
      if (!cameraSure) {
        return advance(held, nowMs, { notes: [...state.notes, "Couldn't see your reach — keeping the camera's depth as is."] })
      }
      return advance(held, nowMs, {})
    }

    case "open": {
      // Free hand open and steady: its thumb-index gap with the hand open.
      const ratio = freeHand ? pinchRatio(freeHand, aspect) : null
      if (ratio === null && waited > HAND_GIVE_UP_MS) return skipMovement(state, nowMs)
      const start = state.openRatio ?? ratio
      const steady = ratio !== null && start !== null && ratio > 0.5 && Math.abs(ratio - start) < 0.15
      const [held, done] = hold(state, nowMs, steady, { openRatio: start })
      return done ? advance(held, nowMs, { openRatio: ratio }) : { ...held, openRatio: steady ? start : null }
    }

    case "pinch": {
      // Thumb touching index: the gap pinched.
      const ratio = freeHand ? pinchRatio(freeHand, aspect) : null
      if (ratio === null && waited > HAND_GIVE_UP_MS) return skipMovement(state, nowMs)
      const open = state.openRatio ?? DEFAULT_MOVE_CALIBRATION.open
      const [held, done] = hold(state, nowMs, ratio !== null && ratio < open * 0.5)
      return done ? advance(held, nowMs, { pinchRatio: Math.max(0.02, ratio!) }) : held
    }

    case "nudge": {
      // Pinched, nudging the hand a little: how far this player nudges.
      const open = state.openRatio ?? DEFAULT_MOVE_CALIBRATION.open
      const pinch = state.pinchRatio ?? DEFAULT_MOVE_CALIBRATION.pinch
      const ratio = freeHand ? pinchRatio(freeHand, aspect) : null
      if (ratio === null && waited > HAND_GIVE_UP_MS) return skipMovement(state, nowMs)
      const pinched = ratio !== null && ratio < pinchThresholds({ open, pinch, nudge: 1 }).release
      const nudge = state.nudge
      if (!pinched || !freeHand) {
        return { ...state, nudge: { ...nudge, anchor: null, lastMs: null } }
      }
      const point = pinchPoint(freeHand, aspect)
      const anchor = nudge.anchor ?? point
      const size = Math.max(1e-6, handSize(freeHand, aspect))
      const distance = Math.hypot(point.x - anchor.x, point.y - anchor.y) / size
      const pinchedMs = nudge.pinchedMs + (nudge.lastMs === null ? 0 : nowMs - nudge.lastMs)
      const max = Math.max(nudge.max, distance)
      const progress = Math.min(1, pinchedMs / HOLD_MS.nudge, max / MIN_NUDGE)
      const next = { ...state, progress, nudge: { anchor, pinchedMs, lastMs: nowMs, max } }
      if (progress < 1) return next
      // Full speed a bit short of the biggest nudge, so walking doesn't need the full stretch.
      return advance(next, nowMs, { move: { open, pinch, nudge: Math.min(1.2, Math.max(MIN_NUDGE, max * 0.7)) } })
    }

    case "done":
      return state
  }
}

function pinchPoint(hand: HandTrack, aspect: number): Point {
  const t = hand.landmarks[4]
  const i = hand.landmarks[8]
  return { x: ((t.x + i.x) / 2) * aspect, y: (t.y + i.y) / 2 }
}

/** No free hand in view for the movement steps: use defaults and finish; the keys still work. */
function skipMovement(state: WizardState, nowMs: number): WizardState {
  return {
    ...state,
    step: "done",
    holdSinceMs: null,
    progress: 0,
    stepStartedMs: nowMs,
    move: DEFAULT_MOVE_CALIBRATION,
    notes: [...state.notes, "Couldn't see your free hand — pinch-and-nudge uses default settings. WASD / arrow keys also walk."],
  }
}

/** The wrist raised above the head, or null. Higher wins if both are. */
function raisedHand(body: Vec3[]): Hand | null {
  const head = body[NOSE][1]
  const left = body[LEFT_WRIST][1] - head
  const right = body[RIGHT_WRIST][1] - head
  if (Math.max(left, right) < 0.05) return null
  return right >= left ? "right" : "left"
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

/** What the player is asked to do at each step. */
export const INSTRUCTIONS: Record<SetupStep, string> = {
  stand: "Stand on your spot facing the laptop, whole upper body in view, and hold still.",
  phone: "Scan the QR code with your iPhone and tap Ignite saber.",
  forward: "Hold the saber level and point its top edge straight at the laptop screen. Hold still.",
  up: "Raise your saber straight up above your head.",
  right: "Point your saber out to your right side, level.",
  reach: "Thrust your saber at the screen, arm out in front of you.",
  open: "Hold your free hand up, open, facing the laptop.",
  pinch: "Pinch your free hand: touch your thumb to your index finger, and hold.",
  nudge: "Keep pinching and nudge your hand a little left, right, up and down.",
  done: "Setup complete. To walk, pinch and nudge your free hand; let go to stop.",
}
