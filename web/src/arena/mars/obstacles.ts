import type { RockShape } from './rockGeometry'

/**
 * A Martian formation placed in the arena. Positions are relative to the
 * player at the origin: azimuth 0° = straight ahead (toward the opponent),
 * clockwise; distance in scene meters. These are approximations from a 2D
 * camera scan, not measurements.
 */
export interface ArenaObstacle {
  id: string
  shape: RockShape
  /** Degrees clockwise from forward. */
  azimuthDeg: number
  distanceM: number
  /** Overall size multiplier in meters (roughly the formation's width). */
  sizeM: number
  /** Which real object this replaced, if any (shown in the scan summary). */
  sourceLabel?: string
  source: 'scan' | 'default'
}

/** Where the real opponent is expected to stand, straight ahead. */
export const OPPONENT_DISTANCE_M = 3.6

/** Hand-placed Jezero-style layout used when scanning is unavailable or finds nothing. */
export const DEFAULT_LAYOUT: ArenaObstacle[] = [
  { id: 'd-mesa-l', shape: 'mesa', azimuthDeg: -48, distanceM: 6.5, sizeM: 2.6, source: 'default' },
  { id: 'd-ridge-r', shape: 'ridge', azimuthDeg: 52, distanceM: 7.5, sizeM: 2.8, source: 'default' },
  { id: 'd-boulder-l', shape: 'boulder', azimuthDeg: -22, distanceM: 9, sizeM: 1.4, source: 'default' },
  { id: 'd-spire-r', shape: 'spire', azimuthDeg: 28, distanceM: 11, sizeM: 1.3, source: 'default' },
  { id: 'd-angular-b', shape: 'angular', azimuthDeg: 120, distanceM: 5, sizeM: 1.2, source: 'default' },
  { id: 'd-slab-b', shape: 'slab', azimuthDeg: -135, distanceM: 6, sizeM: 2.2, source: 'default' },
]

/** Scene position for an obstacle (player at origin, forward = -z). */
export function obstaclePosition(o: Pick<ArenaObstacle, 'azimuthDeg' | 'distanceM'>): [number, number] {
  const a = (o.azimuthDeg * Math.PI) / 180
  return [Math.sin(a) * o.distanceM, -Math.cos(a) * o.distanceM]
}
