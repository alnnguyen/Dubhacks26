import type { Vec3 } from "../../../server/src/contracts"

/**
 * From MediaPipe Pose to the player's body frame used by the server (meters,
 * hips at the origin, x right, y up, z forward toward their screen).
 *
 * MediaPipe world landmarks are hip-centered meters in the camera's frame:
 * x to the image's right, y down, z away from the camera. The laptop camera
 * faces the player and its frames aren't mirrored, so the player's right is
 * the image's left, up is −y, and toward the screen is −z.
 */
export function worldToBody(p: { x: number; y: number; z: number }): Vec3 {
  return [-p.x, -p.y, -p.z]
}

const LEFT_SHOULDER = 11
const RIGHT_SHOULDER = 12
const LEFT_HIP = 23
const RIGHT_HIP = 24

/** Assumed real torso length (shoulder midpoint to hip midpoint) and calibration distance. */
export const TORSO_METERS = 0.5
export const CALIBRATION_DISTANCE_METERS = 2

type Point = { x: number; y: number }

/** Where the body sits in the image: hip center and torso length, in image-height units. */
export type BodyPlacement = { hipX: number; torso: number }

export function placement(landmarks: Point[] | undefined, aspect: number): BodyPlacement | null {
  if (!landmarks || landmarks.length <= RIGHT_HIP) return null
  const mid = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
  const shoulders = mid(landmarks[LEFT_SHOULDER], landmarks[RIGHT_SHOULDER])
  const hips = mid(landmarks[LEFT_HIP], landmarks[RIGHT_HIP])
  const torso = Math.hypot((shoulders.x - hips.x) * aspect, shoulders.y - hips.y)
  return torso > 0 ? { hipX: hips.x, torso } : null
}

/**
 * How far the player has stepped since calibration, in meters (x right, z
 * toward the screen). Sideways from how far the hips moved in the image;
 * forward from how much bigger the torso looks (pinhole: distance ∝ 1/size),
 * assuming they calibrated about 2 m away. Approximate, for moving an avatar.
 */
export function stepOffset(baseline: BodyPlacement, now: BodyPlacement, aspect: number): { x: number; z: number } {
  const metersPerImageHeight = TORSO_METERS / now.torso
  return {
    // The player's right is the image's left.
    x: -(now.hipX - baseline.hipX) * aspect * metersPerImageHeight,
    z: CALIBRATION_DISTANCE_METERS * (1 - baseline.torso / now.torso),
  }
}
