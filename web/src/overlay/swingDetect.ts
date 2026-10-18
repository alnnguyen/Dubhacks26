import type { Point } from "../vision/types"
import type { HandSample } from "./throwPhysics"

/** Tip path metrics for Wii-style swing detection. */
export type SwingAnalysis = {
  pathLen: number
  peakSpeed: number
  /** Dominant axis: horizontal or vertical swing. */
  axis: "horizontal" | "vertical" | "none"
  dx: number
  dy: number
}

/**
 * Analyze recent tip samples. A slash is a coherent horizontal or vertical
 * cut with enough path length and peak tip speed (not jitter).
 */
export function analyzeTipSwing(samples: HandSample[], nowMs: number, windowMs = 160): SwingAnalysis {
  if (samples.length < 3) {
    return { pathLen: 0, peakSpeed: 0, axis: "none", dx: 0, dy: 0 }
  }
  const cutoff = nowMs - windowMs
  const recent = samples.filter((s) => s.atMs >= cutoff)
  const use = recent.length >= 3 ? recent : samples.slice(-Math.min(samples.length, 6))
  if (use.length < 3) {
    return { pathLen: 0, peakSpeed: 0, axis: "none", dx: 0, dy: 0 }
  }

  let pathLen = 0
  let peakSpeed = 0
  for (let i = 1; i < use.length; i++) {
    const a = use[i - 1]!
    const b = use[i]!
    const seg = Math.hypot(b.point.x - a.point.x, b.point.y - a.point.y)
    pathLen += seg
    const dt = Math.max(1, b.atMs - a.atMs) / 1000
    peakSpeed = Math.max(peakSpeed, seg / dt)
  }

  const first = use[0]!
  const last = use[use.length - 1]!
  const dx = last.point.x - first.point.x
  const dy = last.point.y - first.point.y
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  let axis: SwingAnalysis["axis"] = "none"
  if (ax >= ay * 1.15 && ax > 0.02) axis = "horizontal"
  else if (ay >= ax * 1.15 && ay > 0.02) axis = "vertical"
  else if (pathLen > 0.08 && Math.max(ax, ay) > 0.035) {
    axis = ax >= ay ? "horizontal" : "vertical"
  }

  return { pathLen, peakSpeed, axis, dx, dy }
}

export function isSwingSlash(
  analysis: SwingAnalysis,
  opts: { pathMin: number; speedMin: number },
): boolean {
  if (analysis.axis === "none") return false
  return analysis.pathLen >= opts.pathMin && analysis.peakSpeed >= opts.speedMin
}

export function tipPointFromLandmarks(landmarks: { x: number; y: number }[] | null | undefined): Point | null {
  if (!landmarks || landmarks.length < 21) return null
  const tip = landmarks[8]
  if (!tip) return null
  return { x: tip.x, y: tip.y }
}
