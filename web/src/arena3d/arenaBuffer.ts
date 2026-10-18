import type { ArenaBlade, ArenaFrame, ArenaPlayer, Vec3 } from "../../../server/src/contracts"

/**
 * Smooth playback of the server's 30 Hz arena frames on a 60+ fps screen.
 * Frames are drawn a little in the past (RENDER_DELAY_MS) and blended between
 * the two around that moment, timed by the server's own clock so network
 * jitter doesn't show. Display only; the server still judges every hit.
 */

/** About two server ticks: enough to always have a frame on each side. */
export const RENDER_DELAY_MS = 70
const KEEP_MS = 1000

export type ArenaBuffer = {
  frames: ArenaFrame[]
  /** Local arrival time minus server time, tracking the fastest recent arrival. */
  offset: number | null
}

export function createArenaBuffer(): ArenaBuffer {
  return { frames: [], offset: null }
}

export function pushFrame(buffer: ArenaBuffer, frame: ArenaFrame, receivedMs: number): ArenaBuffer {
  const sample = receivedMs - frame.serverMs
  // The quickest arrival is closest to the true offset; creep up 1 ms per frame so a slower route is adopted.
  const offset = buffer.offset === null ? sample : Math.min(sample, buffer.offset + 1)
  // Socket.IO volatile frames can arrive out of order: keep them sorted by server time, once each.
  if (buffer.frames.some((f) => f.serverMs === frame.serverMs)) return { frames: buffer.frames, offset }
  const frames = [...buffer.frames, frame].sort((a, b) => a.serverMs - b.serverMs)
  const newest = frames[frames.length - 1].serverMs
  return { frames: frames.filter((f) => newest - f.serverMs <= KEEP_MS), offset }
}

/** The arena as it was RENDER_DELAY_MS ago, blended; null before any frame. */
export function sampleFrame(buffer: ArenaBuffer, nowMs: number, delayMs = RENDER_DELAY_MS): ArenaFrame | null {
  const { frames, offset } = buffer
  if (frames.length === 0 || offset === null) return null
  const t = nowMs - offset - delayMs
  if (t <= frames[0].serverMs) return frames[0]
  const last = frames[frames.length - 1]
  // Frames stopped coming: hold the last one rather than guess ahead.
  if (t >= last.serverMs) return last
  let i = 1
  while (frames[i].serverMs < t) i++
  const a = frames[i - 1]
  const b = frames[i]
  return blendFrames(a, b, (t - a.serverMs) / (b.serverMs - a.serverMs))
}

const lerp = (a: Vec3, b: Vec3, u: number): Vec3 => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]

export function blendFrames(a: ArenaFrame, b: ArenaFrame, u: number): ArenaFrame {
  return {
    serverMs: a.serverMs + (b.serverMs - a.serverMs) * u,
    engaged: b.engaged,
    saberStart: b.saberStart,
    players: b.players.map((pb) => {
      const pa = a.players.find((p) => p.slot === pb.slot)
      return pa ? blendPlayer(pa, pb, u) : pb
    }),
  }
}

function blendPlayer(a: ArenaPlayer, b: ArenaPlayer, u: number): ArenaPlayer {
  const joints = a.joints && b.joints ? b.joints.map((j, i) => lerp(a.joints![i], j, u)) : b.joints
  const blade = a.blade && b.blade ? blendBlade(a.blade, b.blade, u) : b.blade
  // Facing turns smoothly if it ever changes between frames.
  const fx = a.facing[0] + (b.facing[0] - a.facing[0]) * u
  const fz = a.facing[1] + (b.facing[1] - a.facing[1]) * u
  const fl = Math.hypot(fx, fz) || 1
  return { slot: b.slot, cell: b.cell, facing: [fx / fl, fz / fl], joints, blade, swinging: b.swinging, stamina: b.stamina, winded: b.winded, stunned: b.stunned }
}

/**
 * Hilts move in a straight line; the blade turns from one direction to the
 * other, keeping its length, so a fast swing sweeps an arc instead of
 * shrinking through the middle.
 */
export function blendBlade(a: ArenaBlade, b: ArenaBlade, u: number): ArenaBlade {
  const hilt = lerp(a.hilt, b.hilt, u)
  const da = sub(a.tip, a.hilt)
  const db = sub(b.tip, b.hilt)
  const la = norm(da)
  const lb = norm(db)
  const dir = slerp(scale(da, 1 / la), scale(db, 1 / lb), u)
  const length = la + (lb - la) * u
  return { hilt, tip: [hilt[0] + dir[0] * length, hilt[1] + dir[1] * length, hilt[2] + dir[2] * length] }
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]
const norm = (a: Vec3) => Math.hypot(a[0], a[1], a[2]) || 1
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** Rotate unit vector a toward unit vector b by fraction u. */
export function slerp(a: Vec3, b: Vec3, u: number): Vec3 {
  const cos = Math.max(-1, Math.min(1, dot(a, b)))
  const angle = Math.acos(cos)
  if (angle < 1e-4) return lerp(a, b, u)
  const s = Math.sin(angle)
  const wa = Math.sin((1 - u) * angle) / s
  const wb = Math.sin(u * angle) / s
  return [a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb, a[2] * wa + b[2] * wb]
}
