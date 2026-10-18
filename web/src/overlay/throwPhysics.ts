import type { Point } from "../vision/types"

export type HandSample = { atMs: number; point: Point }

export type Velocity = { vx: number; vy: number }

/** Screen units per second from recent hand samples. */
export function estimateHandVelocity(samples: HandSample[], nowMs: number, windowMs = 180): Velocity {
  if (samples.length < 2) return { vx: 0, vy: 0 }
  const cutoff = nowMs - windowMs
  const recent = samples.filter((sample) => sample.atMs >= cutoff)
  const use = recent.length >= 2 ? recent : samples.slice(-2)
  const first = use[0]
  const last = use[use.length - 1]
  const dt = Math.max(1, last.atMs - first.atMs) / 1000
  return {
    vx: (last.point.x - first.point.x) / dt,
    vy: (last.point.y - first.point.y) / dt,
  }
}

export function pushHandSample(samples: HandSample[], atMs: number, point: Point, max = 12): HandSample[] {
  const next = [...samples, { atMs, point }]
  return next.length > max ? next.slice(next.length - max) : next
}

export type FlightState = {
  origin: Point
  velocity: Velocity
  launchedAtMs: number
  /** Extra loft (negative Y impulse) so weak throws still arc. */
  loft: number
  gravity: number
  /** Soft aim bias toward a target (normalized / second²-ish). */
  aim: Point | null
  /** Server flight window. When set, the arc ends at this many seconds. */
  durationSec?: number
}

/**
 * Screen-space ballistic step. Y grows downward; gravity is positive.
 * Scale shrinks as the rock "moves away" for a cheap 3D read.
 */
export function sampleBallistic(
  flight: FlightState,
  nowMs: number,
): { point: Point; scale: number; done: boolean; height: number } {
  const t = Math.max(0, (nowMs - flight.launchedAtMs) / 1000)
  const aimPull = flight.aim
    ? {
        x: (flight.aim.x - flight.origin.x) * 0.55 * t,
        y: (flight.aim.y - flight.origin.y) * 0.35 * t,
      }
    : { x: 0, y: 0 }

  const x = flight.origin.x + flight.velocity.vx * t + aimPull.x
  const y =
    flight.origin.y +
    flight.velocity.vy * t +
    flight.loft * t +
    0.5 * flight.gravity * t * t +
    aimPull.y

  const height = Math.max(0, flight.origin.y - y)
  const travel = Math.hypot(x - flight.origin.x, y - flight.origin.y)
  const scale = Math.max(0.35, 1 - travel * 0.85 - t * 0.25)
  const offscreen = x < -0.15 || x > 1.15 || y < -0.2 || y > 1.15
  const grounded = y >= 0.94 && t > 0.12
  const timedOut = flight.durationSec != null && t >= flight.durationSec
  return { point: { x, y }, scale, done: offscreen || grounded || timedOut || t > 2.4, height }
}

export function throwImpulse(velocity: Velocity, toward: Point | null, from: Point): Velocity {
  let vx = velocity.vx
  let vy = velocity.vy
  const speed = Math.hypot(vx, vy)
  if (speed < 0.35 && toward) {
    // Short near-hand flicks still arc toward upper-center / opponent body.
    vx = (toward.x - from.x) * 1.55
    vy = (toward.y - from.y) * 1.15 - 0.7
  } else {
    // Boost a real swipe so the throw reads on a phone; extra loft for short FP arcs.
    vx *= 1.2
    vy = vy * 1.2 - 0.4
  }
  const capped = Math.min(3.0, Math.hypot(vx, vy))
  const current = Math.hypot(vx, vy) || 1
  return { vx: (vx / current) * capped, vy: (vy / current) * capped }
}
