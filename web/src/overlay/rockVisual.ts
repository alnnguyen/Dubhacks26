import { healthAnchor, rockProgress, sampleRockArc, smoothPoint } from "./rockArc"
import type { BattleCommand, HandTrack, Phase, Point } from "../vision/types"
import { WRIST, MIDDLE_MCP, LANDMARK_COUNT } from "../vision/landmarks"

/** Local Earth-window stand-in until B owns gravity in the snapshot. */
export const DEBUG_FLIGHT_SECONDS = 0.8

export type RockVisualMode = "hidden" | "held" | "flying"

export type RockVisualState = {
  mode: RockVisualMode
  smoothedHand: Point | null
  from: Point | null
  to: Point | null
  launchedAtMs: number | null
  flightSeconds: number
}

export function createRockVisual(flightSeconds = DEBUG_FLIGHT_SECONDS): RockVisualState {
  return {
    mode: "hidden",
    smoothedHand: null,
    from: null,
    to: null,
    launchedAtMs: null,
    flightSeconds,
  }
}

/** Float point slightly above the palm center (screen Y grows downward). */
export function handFloatPoint(hand: HandTrack | null | undefined): Point | null {
  if (!hand || hand.landmarks.length < LANDMARK_COUNT) return null
  const wrist = hand.landmarks[WRIST]
  const mid = hand.landmarks[MIDDLE_MCP]
  return {
    x: (wrist.x + mid.x) / 2,
    y: (wrist.y + mid.y) / 2 - 0.08,
  }
}

export function opponentTarget(pose: {
  leftShoulder: Point | null
  rightShoulder: Point | null
} | null): Point | null {
  return healthAnchor(pose?.leftShoulder ?? null, pose?.rightShoulder ?? null)
}

export type RockVisualTick = {
  nowMs: number
  phase: Phase
  commands: BattleCommand[]
  ownHand: HandTrack | null
  target: Point | null
}

export type RockVisualFrame = {
  state: RockVisualState
  /** Normalized screen point to draw, or null when hidden. */
  drawAt: Point | null
}

/**
 * Screen-space rock only. Cancel removes it. Release starts an arc; there is no catch.
 */
export function tickRockVisual(state: RockVisualState, tick: RockVisualTick): RockVisualFrame {
  const names = new Set(tick.commands.map((command) => command.name))

  if (names.has("cancelLift")) {
    return { state: createRockVisual(state.flightSeconds), drawAt: null }
  }

  if (names.has("releaseRock")) {
    const from = handFloatPoint(tick.ownHand) ?? state.smoothedHand
    const to = tick.target ?? (from ? { x: from.x - 0.25, y: from.y - 0.35 } : null)
    if (!from || !to) {
      return { state: createRockVisual(state.flightSeconds), drawAt: null }
    }
    const flying: RockVisualState = {
      mode: "flying",
      smoothedHand: from,
      from,
      to,
      launchedAtMs: tick.nowMs,
      flightSeconds: state.flightSeconds,
    }
    return { state: flying, drawAt: sampleRockArc(0, from, to) }
  }

  if (state.mode === "flying" && state.from && state.to && state.launchedAtMs != null) {
    const progress = rockProgress(tick.nowMs - state.launchedAtMs, state.flightSeconds)
    if (progress >= 1) {
      return { state: createRockVisual(state.flightSeconds), drawAt: null }
    }
    return { state, drawAt: sampleRockArc(progress, state.from, state.to) }
  }

  if (tick.phase === "HELD") {
    const raw = handFloatPoint(tick.ownHand)
    const smoothedHand = raw ? smoothPoint(state.smoothedHand, raw) : state.smoothedHand
    const held: RockVisualState = {
      ...state,
      mode: "held",
      smoothedHand,
      from: null,
      to: null,
      launchedAtMs: null,
    }
    return { state: held, drawAt: smoothedHand }
  }

  return { state: createRockVisual(state.flightSeconds), drawAt: null }
}
