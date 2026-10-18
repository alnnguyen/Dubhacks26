import type { Gesture, HandTrack, Landmark, Point } from "./types"

export const WRIST = 0
export const THUMB_IP = 3
export const THUMB_TIP = 4
export const INDEX_MCP = 5
export const MIDDLE_MCP = 9
export const PINKY_MCP = 17
export const LANDMARK_COUNT = 21

const FINGERS = [
  { tip: 8, pip: 6 },
  { tip: 12, pip: 10 },
  { tip: 16, pip: 14 },
  { tip: 20, pip: 18 },
] as const

export function distance(a: Point, b: Point): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}

export function palmSpan(landmarks: Landmark[]): number {
  if (landmarks.length < LANDMARK_COUNT) return 0
  return distance(landmarks[INDEX_MCP], landmarks[PINKY_MCP])
}

export function handCenterY(landmarks: Landmark[]): number {
  if (landmarks.length < LANDMARK_COUNT) return 0
  return (landmarks[WRIST].y + landmarks[MIDDLE_MCP].y) / 2
}

export function handCenter(landmarks: Landmark[]): Point | null {
  if (landmarks.length < LANDMARK_COUNT) return null
  return {
    x: (landmarks[WRIST].x + landmarks[MIDDLE_MCP].x) / 2,
    y: (landmarks[WRIST].y + landmarks[MIDDLE_MCP].y) / 2,
  }
}

function fingerExtended(landmarks: Landmark[], tip: number, pip: number, ratio = 1.12): boolean {
  const wrist = landmarks[WRIST]
  return distance(landmarks[tip], wrist) > distance(landmarks[pip], wrist) * ratio
}

/** Thumb tip sits above the IP joint (screen Y grows downward). */
function thumbUp(landmarks: Landmark[]): boolean {
  return landmarks[THUMB_TIP].y < landmarks[THUMB_IP].y - 0.008
}

/**
 * Open palm ≈ three+ fingers out. Fist ≈ zero or one finger out (gun grip).
 * Gun trigger = thumb up + index/middle out + ring/pinky curled.
 */
export function classifyGesture(landmarks: Landmark[] | null | undefined): Gesture {
  if (!landmarks || landmarks.length < LANDMARK_COUNT) return "none"
  const indexOut = fingerExtended(landmarks, 8, 6)
  const middleOut = fingerExtended(landmarks, 12, 10)
  const ringOut = fingerExtended(landmarks, 16, 14)
  const pinkyOut = fingerExtended(landmarks, 20, 18)
  const extended = [indexOut, middleOut, ringOut, pinkyOut].filter(Boolean).length

  // Trigger pose first so fist→extend reads as fire, not palm.
  if (thumbUp(landmarks) && indexOut && middleOut && !ringOut && !pinkyOut) {
    return "gun"
  }
  if (extended >= 3) return "palm"
  if (extended <= 1) return "fist"
  return "none"
}

export function observeHand(track: HandTrack): { id: string; palmSpan: number; centerY: number } | null {
  if (track.landmarks.length < LANDMARK_COUNT) return null
  return {
    id: track.id,
    palmSpan: palmSpan(track.landmarks),
    centerY: handCenterY(track.landmarks),
  }
}
