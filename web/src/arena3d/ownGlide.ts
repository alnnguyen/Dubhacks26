import { interpolateStep } from "../../../server/src/game/grid"
import type { GridCell } from "../../../server/src/contracts"
import { cellToWorld } from "./gridBoard"

/**
 * Your own step, drawn the moment the server accepts it: a local glide from
 * where your fighter is drawn to the new cell, on this laptop's clock and with
 * the server's easing, instead of waiting for the next arena frame and the
 * smooth-playback delay. Frames that disagree for a while (a reconnect, a
 * missed event) win.
 */
export type OwnGlide = {
  orbitCenter?: [number, number]
  cell: GridCell
  from: [number, number]
  startedAtMs: number
  /** When this laptop last heard of an accepted step of yours. */
  lastStepMs: number
}

/** Frames may lag a step by the playback delay plus a tick; disagreeing longer than this means we're wrong. */
export const RECONCILE_MS = 500

export function glideRoot(glide: OwnGlide, cellSize: number, stepMs: number, nowMs: number): [number, number] {
  const to = cellToWorld(glide.cell, cellSize)
  const t = Math.max(0, Math.min(1, (nowMs - glide.startedAtMs) / stepMs))
  // Same ease-out cubic as the server: most of the step happens in the first few frames.
  const eased = 1 - (1 - t) ** 3
  return interpolateStep(glide.from, to, eased, glide.orbitCenter)
}

/** An accepted step of yours: glide from wherever you're drawn now. */
export function onOwnStep(glide: OwnGlide | null, cell: GridCell, cellSize: number, stepMs: number, nowMs: number, orbitCenter?: [number, number]): OwnGlide {
  const from = glide ? glideRoot(glide, cellSize, stepMs, nowMs) : cellToWorld(cell, cellSize)
  return { cell, from, orbitCenter, startedAtMs: nowMs, lastStepMs: nowMs }
}

/** What the server's frames say your cell is: adopt it at first, or when they've disagreed past a step's worth of lag. */
export function reconcile(glide: OwnGlide | null, frameCell: GridCell, cellSize: number, nowMs: number): OwnGlide {
  const same = glide && glide.cell.q === frameCell.q && glide.cell.r === frameCell.r
  if (glide && (same || nowMs - glide.lastStepMs < RECONCILE_MS)) return glide
  return { cell: frameCell, from: cellToWorld(frameCell, cellSize), startedAtMs: 0, lastStepMs: glide?.lastStepMs ?? 0 }
}
