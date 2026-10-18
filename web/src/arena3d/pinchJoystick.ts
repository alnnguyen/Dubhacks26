import type { HandTrack, Point } from "../vision/types"
import { oneEuro, type OneEuro } from "./oneEuro"

/**
 * Pinch-and-nudge: the free hand pinches thumb to index to grab a tiny
 * joystick, and nudging the pinched hand a few centimeters sets which way to
 * walk; releasing stops. Measured in hand widths so it works at any distance
 * from the laptop. Nothing moves unless pinched, so a relaxed hand never walks.
 */

const WRIST = 0
const THUMB_TIP = 4
const INDEX_TIP = 8
const MIDDLE_MCP = 9

/** Per-player numbers from the movement setup steps. */
export type MoveCalibration = {
  /** Thumb-index gap over hand size with the hand open... */
  open: number
  /** ...and pinched. */
  pinch: number
  /** How far (in hand sizes) this player nudges for full walking speed. */
  nudge: number
}

export const DEFAULT_MOVE_CALIBRATION: MoveCalibration = { open: 0.9, pinch: 0.15, nudge: 0.6 }

/** Nudges smaller than this share of the full nudge are ignored as jitter. */
export const DEADZONE = 0.25

export type JoystickState = {
  pinched: boolean
  /** Where the pinch started (normalized image, x scaled by aspect). */
  anchor: Point | null
  filters: { x: OneEuro; y: OneEuro }
}

export function createJoystick(): JoystickState {
  return { pinched: false, anchor: null, filters: { x: null, y: null } }
}

const PINCH_FILTER = { minCutoff: 1.2, beta: 0.8, dCutoff: 1.0 }

/** Hand size: wrist to middle knuckle, in image-height units. */
export function handSize(hand: HandTrack, aspect: number): number {
  const a = hand.landmarks[WRIST]
  const b = hand.landmarks[MIDDLE_MCP]
  return Math.hypot((a.x - b.x) * aspect, a.y - b.y)
}

/** Thumb-index gap in hand sizes: about 1 open, near 0 pinched. */
export function pinchRatio(hand: HandTrack, aspect: number): number {
  const t = hand.landmarks[THUMB_TIP]
  const i = hand.landmarks[INDEX_TIP]
  return Math.hypot((t.x - i.x) * aspect, t.y - i.y) / Math.max(1e-6, handSize(hand, aspect))
}

/** Where the pinch is: between thumb and index tips, x scaled by aspect. */
function pinchPoint(hand: HandTrack, aspect: number): Point {
  const t = hand.landmarks[THUMB_TIP]
  const i = hand.landmarks[INDEX_TIP]
  return { x: ((t.x + i.x) / 2) * aspect, y: (t.y + i.y) / 2 }
}

/** Grab below this ratio, let go above the higher one, so a borderline pinch doesn't flicker. */
export function pinchThresholds(c: MoveCalibration): { grab: number; release: number } {
  return { grab: c.pinch + 0.35 * (c.open - c.pinch), release: c.pinch + 0.6 * (c.open - c.pinch) }
}

/**
 * One frame. hand is the free hand (null when not seen); mirrorX comes from
 * setup (a mirrored camera flips which image direction is the player's right).
 * Returns a walking intent in the player's frame: x right, z toward the rival
 * (nudging up), each -1..1.
 */
export function tickJoystick(
  state: JoystickState,
  hand: HandTrack | null,
  aspect: number,
  calibration: MoveCalibration,
  mirrorX: boolean,
  nowMs: number,
): { state: JoystickState; move: { x: number; z: number }; offset: Point | null } {
  const still = { x: 0, z: 0 }
  if (!hand || hand.landmarks.length < 21) return { state: createJoystick(), move: still, offset: null }

  const ratio = pinchRatio(hand, aspect)
  const { grab, release } = pinchThresholds(calibration)
  const pinched = state.pinched ? ratio < release : ratio < grab
  if (!pinched) return { state: createJoystick(), move: still, offset: null }

  const raw = pinchPoint(hand, aspect)
  const fx = oneEuro(state.filters.x, raw.x, nowMs, PINCH_FILTER)
  const fy = oneEuro(state.filters.y, raw.y, nowMs, PINCH_FILTER)
  const point = { x: fx!.value, y: fy!.value }
  const anchor = state.anchor ?? point
  const size = Math.max(1e-6, handSize(hand, aspect))
  // In hand sizes. The camera isn't mirrored, so the player's right is the image's left.
  const right = ((anchor.x - point.x) / size) * (mirrorX ? -1 : 1)
  const up = (anchor.y - point.y) / size
  const next: JoystickState = { pinched: true, anchor, filters: { x: fx, y: fy } }

  const distance = Math.hypot(right, up)
  const dead = DEADZONE * calibration.nudge
  if (distance < dead) return { state: next, move: still, offset: { x: right, y: up } }
  const strength = Math.min(1, (distance - dead) / Math.max(1e-6, calibration.nudge - dead))
  return { state: next, move: { x: (right / distance) * strength, z: (up / distance) * strength }, offset: { x: right, y: up } }
}

/**
 * The free hand among the detected hands: the one whose wrist is closest to
 * where the body tracker sees the free wrist (normalized image coordinates).
 */
export function pickFreeHand(hands: HandTrack[], freeWrist: Point | null, maxDistance = 0.15): HandTrack | null {
  if (!freeWrist) return null
  let best: HandTrack | null = null
  let bestDistance = maxDistance
  for (const hand of hands) {
    const w = hand.landmarks[WRIST]
    if (!w) continue
    const d = Math.hypot(w.x - freeWrist.x, w.y - freeWrist.y)
    if (d < bestDistance) {
      best = hand
      bestDistance = d
    }
  }
  return best
}
