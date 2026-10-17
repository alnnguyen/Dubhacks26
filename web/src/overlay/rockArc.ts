import type { Point } from "../vision/types"

export function smoothPoint(previous: Point | null, next: Point, alpha = 0.35): Point {
  const blend = Math.min(1, Math.max(0, alpha))
  if (!previous) return { x: next.x, y: next.y }
  return {
    x: previous.x + (next.x - previous.x) * blend,
    y: previous.y + (next.y - previous.y) * blend,
  }
}

/** Shoulder midpoint for a health bar. Missing either shoulder hides the anchor. */
export function healthAnchor(leftShoulder: Point | null, rightShoulder: Point | null): Point | null {
  if (!leftShoulder || !rightShoulder) return null
  return {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2,
  }
}

export function rockProgress(elapsedMs: number, flightSeconds: number): number {
  if (!Number.isFinite(flightSeconds) || flightSeconds <= 0) return 1
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0
  return Math.min(1, elapsedMs / (flightSeconds * 1000))
}

/**
 * Screen-space arc. Y grows downward, so the lift subtracts from the straight chord.
 * Duration comes from the server; this does not recompute NASA gravity.
 */
export function sampleRockArc(progress: number, from: Point, to: Point, lift = 0.18): Point {
  const t = Math.min(1, Math.max(0, progress))
  if (t === 0) return { x: from.x, y: from.y }
  if (t === 1) return { x: to.x, y: to.y }
  const chordY = from.y + (to.y - from.y) * t
  return {
    x: from.x + (to.x - from.x) * t,
    y: chordY - Math.sin(Math.PI * t) * lift,
  }
}
