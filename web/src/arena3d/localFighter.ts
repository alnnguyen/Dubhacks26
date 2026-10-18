import type { ArenaFrame, Hand, PlayerSlot, Vec3 } from "../../../server/src/contracts"
import { phoneInBody } from "./setupWizard"

/**
 * Your own fighter drawn from this laptop's own data instead of the server's
 * echo: your smoothed body from the camera and your phone's latest reading,
 * placed where the server has you standing. It skips the round trip and the
 * server tick, so your blade moves the moment your phone does. Display only;
 * the server still judges with its own copy.
 */
export type LocalFighter = {
  /** Your body in your own frame (stabilized), 33 joints. */
  joints: Vec3[]
  /** Your phone's top edge (Earth frame). */
  top: Vec3
  forward: [number, number]
  mirror: boolean
  hand: Hand
}

const LEFT_WRIST = 15
const RIGHT_WRIST = 16
const LEFT_HIP = 23
const RIGHT_HIP = 24

/** Same turn as the server's directionToWorld: body frame to world, facing (x, z). */
export const turn = (v: Vec3, facing: [number, number]): Vec3 => {
  const [fx, fz] = facing
  return [v[0] * fz + v[2] * fx, v[1], -v[0] * fx + v[2] * fz]
}
const mid = (a: Vec3, b: Vec3): Vec3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]

/**
 * Replaces your fighter in the frame with the local version. Only when the
 * server shows you with a body and a blade, so setup gating and tracking loss
 * still look the same as the server sees them.
 */
export function withLocalFighter(
  frame: ArenaFrame,
  slot: PlayerSlot,
  local: LocalFighter | null,
  /** Where your own step glide has you (world x, z), ahead of the server's frames; else the server's hips. */
  root?: [number, number],
): ArenaFrame {
  const me = frame.players.find((p) => p.slot === slot)
  if (!local || !me?.joints || !me.blade) return frame

  // Stand the local body at your predicted spot (or where the server has your hips), facing down the lane.
  const serverHips = mid(me.joints[LEFT_HIP], me.joints[RIGHT_HIP])
  const worldHips: Vec3 = root ? [root[0], serverHips[1], root[1]] : serverHips
  const facing = me.facing
  const bodyHips = mid(local.joints[LEFT_HIP], local.joints[RIGHT_HIP])
  const place = (j: Vec3): Vec3 => {
    const t = turn([j[0] - bodyHips[0], j[1] - bodyHips[1], j[2] - bodyHips[2]], facing)
    return [worldHips[0] + t[0], worldHips[1] + t[1], worldHips[2] + t[2]]
  }
  const joints = local.joints.map(place)

  const hilt = joints[local.hand === "left" ? LEFT_WRIST : RIGHT_WRIST]
  const dir = turn(phoneInBody(local.top, local.forward, local.mirror), facing)
  const dirLength = Math.hypot(...dir) || 1
  const bladeLength = Math.hypot(me.blade.tip[0] - me.blade.hilt[0], me.blade.tip[1] - me.blade.hilt[1], me.blade.tip[2] - me.blade.hilt[2])
  const s = bladeLength / dirLength
  const blade = { hilt, tip: [hilt[0] + dir[0] * s, hilt[1] + dir[1] * s, hilt[2] + dir[2] * s] as Vec3 }

  return { ...frame, players: frame.players.map((p) => (p.slot === slot ? { ...p, facing, joints, blade } : p)) }
}
