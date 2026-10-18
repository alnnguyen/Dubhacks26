import type { Gesture, HandTrack, Landmark, Point } from "./types"

export const WRIST = 0
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

function fingerExtended(landmarks: Landmark[], tip: number, pip: number): boolean {
  const wrist = landmarks[WRIST]
  return distance(landmarks[tip], wrist) > distance(landmarks[pip], wrist) * 1.2
}

/** Open palm is four extended fingers. A fist is four curled fingers. Anything between is ignored. */
export function classifyGesture(landmarks: Landmark[] | null | undefined): Gesture {
  if (!landmarks || landmarks.length < LANDMARK_COUNT) return "none"
  const extended = FINGERS.filter((finger) => fingerExtended(landmarks, finger.tip, finger.pip)).length
  if (extended === 4) return "palm"
  if (extended === 0) return "fist"
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
