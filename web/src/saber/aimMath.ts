import type { Vec3 } from "../../../server/src/contracts"

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

/** Angular speed from devicemotion's rotationRate (degrees/s), for the hum. */
export function angularSpeed(rate: { alpha: number | null; beta: number | null; gamma: number | null } | null): number {
  if (!rate) return 0
  return Math.hypot(rate.alpha ?? 0, rate.beta ?? 0, rate.gamma ?? 0)
}
