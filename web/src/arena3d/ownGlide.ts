import type { HexCell } from "../../../server/src/contracts"
import { hexToWorld } from "./hexBoard"

/**
 * Your own step, drawn the moment the server accepts it: a local glide from
 * where your fighter is drawn to the new hex, on this laptop's clock and with
 * the server's easing, instead of waiting for the next arena frame and the
 * smooth-playback delay. Frames that disagree for a while (a reconnect, a
 * missed event) win.
 */
export type OwnGlide = {
  cell: HexCell
  from: [number, number]
  startedAtMs: number
  /** When this laptop last heard of an accepted step of yours. */
  lastStepMs: number
}

/** Frames may lag a step by the playback delay plus a tick; disagreeing longer than this means we're wrong. */
export const RECONCILE_MS = 500

export function glideRoot(glide: OwnGlide, hexSize: number, stepMs: number, nowMs: number): [number, number] {
  const to = hexToWorld(glide.cell, hexSize)
  const t = Math.max(0, Math.min(1, (nowMs - glide.startedAtMs) / stepMs))
  // Same ease-out cubic as the server: most of the step happens in the first few frames.
  const eased = 1 - (1 - t) ** 3
  return [glide.from[0] + (to[0] - glide.from[0]) * eased, glide.from[1] + (to[1] - glide.from[1]) * eased]
}

/** An accepted step of yours: glide from wherever you're drawn now. */
export function onOwnStep(glide: OwnGlide | null, cell: HexCell, hexSize: number, stepMs: number, nowMs: number): OwnGlide {
  const from = glide ? glideRoot(glide, hexSize, stepMs, nowMs) : hexToWorld(cell, hexSize)
  return { cell, from, startedAtMs: nowMs, lastStepMs: nowMs }
}

/** What the server's frames say your cell is: adopt it at first, or when they've disagreed past a step's worth of lag. */
export function reconcile(glide: OwnGlide | null, frameCell: HexCell, hexSize: number, nowMs: number): OwnGlide {
  const same = glide && glide.cell.q === frameCell.q && glide.cell.r === frameCell.r
  if (glide && (same || nowMs - glide.lastStepMs < RECONCILE_MS)) return glide
  return { cell: frameCell, from: hexToWorld(frameCell, hexSize), startedAtMs: 0, lastStepMs: glide?.lastStepMs ?? 0 }
}
