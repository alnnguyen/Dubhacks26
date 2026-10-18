import { observeHand } from "./landmarks"
import type { HandTrack, Point } from "./types"

export const CALIBRATE_MS = 2_000
export const LOCK_LOSS_MS = 450
/** Only consider hands in the lower portion of the frame (Y grows downward). */
export const CALIBRATE_MIN_CENTER_Y = 0.45
export const LOCK_MATCH_DISTANCE = 0.28

export type HandLockHint = {
  center: Point
  minSpan: number
}

export type HandLockPhase = "calibrating" | "locked" | "lost"

export type HandLockState = {
  phase: HandLockPhase
  calibrateStartedAtMs: number | null
  hint: HandLockHint | null
  lostSinceMs: number | null
  progress01: number
}

export function createHandLock(): HandLockState {
  return {
    phase: "calibrating",
    calibrateStartedAtMs: null,
    hint: null,
    lostSinceMs: null,
    progress01: 0,
  }
}

export function resetHandLock(): HandLockState {
  return createHandLock()
}

function centerOf(hand: HandTrack): Point | null {
  const observed = observeHand(hand)
  if (!observed) return null
  return { x: hand.landmarks[0].x, y: observed.centerY }
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Best candidate for the player's near hand: largest span in the lower frame. */
export function pickCalibrationCandidate(hands: HandTrack[]): { handId: string; hint: HandLockHint } | null {
  const lower = hands
    .map((hand) => {
      const observed = observeHand(hand)
      if (!observed || observed.centerY < CALIBRATE_MIN_CENTER_Y) return null
      return { hand, observed }
    })
    .filter((row): row is { hand: HandTrack; observed: NonNullable<ReturnType<typeof observeHand>> } => row != null)

  if (lower.length === 0) return null
  lower.sort((a, b) => b.observed.palmSpan - a.observed.palmSpan)
  const best = lower[0]
  return {
    handId: best.hand.id,
    hint: {
      center: { x: best.hand.landmarks[0].x, y: best.observed.centerY },
      minSpan: best.observed.palmSpan * 0.55,
    },
  }
}

/**
 * Prefer the hand closest to the calibration hint that is still large enough.
 * Does not steal a distant/small opponent hand when the lock is lost.
 */
export function selectLockedHand(
  hands: HandTrack[],
  hint: HandLockHint | null,
): { status: "ok"; handId: string } | { status: "none" } {
  if (!hint || hands.length === 0) return { status: "none" }

  let bestId: string | null = null
  let bestScore = Number.POSITIVE_INFINITY
  for (const hand of hands) {
    const observed = observeHand(hand)
    const center = centerOf(hand)
    if (!observed || !center) continue
    if (observed.palmSpan < hint.minSpan * 0.7) continue
    const d = distance(center, hint.center)
    if (d > LOCK_MATCH_DISTANCE) continue
    // Prefer closer + larger.
    const score = d - observed.palmSpan * 0.15
    if (score < bestScore) {
      bestScore = score
      bestId = hand.id
    }
  }

  return bestId ? { status: "ok", handId: bestId } : { status: "none" }
}

export type HandLockTick = {
  nowMs: number
  hands: HandTrack[]
}

export function tickHandLock(state: HandLockState, tick: HandLockTick): HandLockState {
  if (state.phase === "calibrating") {
    const started = state.calibrateStartedAtMs ?? tick.nowMs
    const candidate = pickCalibrationCandidate(tick.hands)
    if (!candidate) {
      return {
        ...state,
        calibrateStartedAtMs: null,
        progress01: 0,
        phase: "calibrating",
        hint: null,
        lostSinceMs: null,
      }
    }
    const elapsed = tick.nowMs - started
    const progress01 = Math.min(1, elapsed / CALIBRATE_MS)
    if (elapsed >= CALIBRATE_MS) {
      return {
        phase: "locked",
        calibrateStartedAtMs: null,
        hint: candidate.hint,
        lostSinceMs: null,
        progress01: 1,
      }
    }
    return {
      phase: "calibrating",
      calibrateStartedAtMs: started,
      hint: candidate.hint,
      lostSinceMs: null,
      progress01,
    }
  }

  // locked or lost — try to track
  const selected = selectLockedHand(tick.hands, state.hint)
  if (selected.status === "ok") {
    const hand = tick.hands.find((row) => row.id === selected.handId)
    const observed = hand ? observeHand(hand) : null
    const center = hand ? centerOf(hand) : null
    const hint =
      observed && center
        ? {
            center: {
              x: state.hint!.center.x * 0.7 + center.x * 0.3,
              y: state.hint!.center.y * 0.7 + center.y * 0.3,
            },
            minSpan: Math.min(state.hint!.minSpan, observed.palmSpan * 0.55),
          }
        : state.hint
    return {
      phase: "locked",
      calibrateStartedAtMs: null,
      hint,
      lostSinceMs: null,
      progress01: 1,
    }
  }

  const lostSinceMs = state.lostSinceMs ?? tick.nowMs
  if (tick.nowMs - lostSinceMs >= LOCK_LOSS_MS) {
    return {
      phase: "lost",
      calibrateStartedAtMs: null,
      hint: state.hint,
      lostSinceMs,
      progress01: 1,
    }
  }
  return {
    ...state,
    phase: "locked",
    lostSinceMs,
  }
}
