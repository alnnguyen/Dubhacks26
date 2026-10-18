import type { Point } from "../vision/types"

export type TracerShot = {
  id: string
  from: Point
  to: Point
  startedAtMs: number
  durationMs: number
}

export type DrawTracer = {
  tip: Point
  tail: Point
  /** Near→far depth cue; shrinks as the round travels “into” the scene. */
  scale: number
  alpha: number
  progress: number
}

export const DEFAULT_MUZZLE: Point = { x: 0.55, y: 0.82 }

/** Ease-out so the tip decelerates into the target (reads as depth travel). */
function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t)
}

export function createTracerShot(
  from: Point,
  to: Point,
  nowMs: number,
  durationMs: number,
  id?: string,
): TracerShot {
  return {
    id: id ?? `tracer-${nowMs}`,
    from: { ...from },
    to: { ...to },
    startedAtMs: nowMs,
    durationMs: Math.max(1, durationMs),
  }
}

/**
 * Sample a first-person tracer: large near the muzzle, small at the rival.
 * Returns null once the shot has fully faded.
 */
export function sampleTracer(shot: TracerShot, nowMs: number): DrawTracer | null {
  const raw = (nowMs - shot.startedAtMs) / shot.durationMs
  if (raw < 0) return null
  // Brief glow after impact so the hit reads.
  if (raw > 1.18) return null

  const progress = Math.min(1, raw)
  const ease = easeOutQuad(progress)
  const tip = {
    x: shot.from.x + (shot.to.x - shot.from.x) * ease,
    y: shot.from.y + (shot.to.y - shot.from.y) * ease,
  }
  // Longer streak early (closer / faster read), shortens as it reaches the target.
  const trail = 0.1 + 0.1 * (1 - ease)
  const tailT = Math.max(0, ease - trail)
  const tail = {
    x: shot.from.x + (shot.to.x - shot.from.x) * tailT,
    y: shot.from.y + (shot.to.y - shot.from.y) * tailT,
  }
  const scale = 1.35 - 1.05 * ease
  const alpha = raw <= 1 ? 1 : Math.max(0, 1 - (raw - 1) / 0.18)
  return { tip, tail, scale, alpha, progress: ease }
}

export function tickTracers(shots: TracerShot[], nowMs: number): { shots: TracerShot[]; draw: DrawTracer[] } {
  const draw: DrawTracer[] = []
  const next: TracerShot[] = []
  for (const shot of shots) {
    const sample = sampleTracer(shot, nowMs)
    if (!sample) continue
    next.push(shot)
    draw.push(sample)
  }
  return { shots: next, draw }
}

/** Index fingertip when present; otherwise wrist/palm center. */
export function muzzleFromHand(landmarks: Point[] | null | undefined): Point | null {
  if (!landmarks || landmarks.length < 21) return null
  const tip = landmarks[8]
  const mid = landmarks[9]
  const wrist = landmarks[0]
  if (tip) return { x: tip.x, y: tip.y }
  if (mid && wrist) {
    return { x: (mid.x + wrist.x) / 2, y: (mid.y + wrist.y) / 2 }
  }
  return null
}
