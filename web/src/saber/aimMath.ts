import type { Vec3 } from "../../../server/src/contracts"
import { oneEuro, type OneEuro } from "../arena3d/oneEuro"

/**
 * Phone orientation for the saber. The blade comes out of the phone's top edge,
 * like holding a hilt. The phone reports that direction in the Earth frame; the
 * laptop's guided setup measures how it maps onto the player's body.
 */

const DEG = Math.PI / 180

/**
 * The phone's top edge in the Earth frame (x east, y north, z up) from
 * deviceorientation's alpha/beta/gamma (Z-X'-Y'' Tait-Bryan, degrees). It's the
 * device y axis rotated by Rz(α)·Rx(β)·Ry(γ); γ (roll about the top edge)
 * doesn't move it. iOS's alpha has an arbitrary zero, which setup absorbs.
 */
export function topEdgeDirection(alphaDeg: number, betaDeg: number): Vec3 {
  const a = alphaDeg * DEG
  const b = betaDeg * DEG
  return [-Math.sin(a) * Math.cos(b), Math.cos(a) * Math.cos(b), Math.sin(b)]
}

/**
 * Light smoothing of the top-edge direction: steadies sensor jitter when held
 * still, keeps up with a fast swing. Renormalized so it stays a direction.
 */
export type DirectionFilter = [OneEuro, OneEuro, OneEuro]

const DIRECTION_FILTER = { minCutoff: 3, beta: 1, dCutoff: 1 }

export function smoothDirection(filter: DirectionFilter | null, top: Vec3, nowMs: number): { filter: DirectionFilter; top: Vec3 } {
  const next = [0, 1, 2].map((k) => oneEuro(filter?.[k] ?? null, top[k], nowMs, DIRECTION_FILTER)) as DirectionFilter
  const v: Vec3 = [next[0]!.value, next[1]!.value, next[2]!.value]
  const length = Math.hypot(...v) || 1
  return { filter: next, top: [v[0] / length, v[1] / length, v[2] / length] }
}

/** Angular speed from devicemotion's rotationRate (degrees/s), for the hum. */
export function angularSpeed(rate: { alpha: number | null; beta: number | null; gamma: number | null } | null): number {
  if (!rate) return 0
  return Math.hypot(rate.alpha ?? 0, rate.beta ?? 0, rate.gamma ?? 0)
}
