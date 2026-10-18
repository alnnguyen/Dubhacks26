import { healthAnchor, smoothPoint } from "./rockArc"
import {
  estimateHandVelocity,
  pushHandSample,
  sampleBallistic,
  throwImpulse,
  type FlightState,
  type HandSample,
} from "./throwPhysics"
import type { BattleCommand, HandTrack, Phase, Point } from "../vision/types"
import { WRIST, MIDDLE_MCP, LANDMARK_COUNT } from "../vision/landmarks"

/** Local Earth-window stand-in until B owns gravity in the snapshot. */
export const DEBUG_FLIGHT_SECONDS = 0.8
export const PICKUP_DISTANCE = 0.26
/** Lower-third ground band for first-person near hand (Y grows downward). */
export const GROUND_Y = 0.82
/** Held rock reads larger when the palm fills the lower frame. */
export const HELD_ROCK_SCALE = 1.4
/** Default aim toward upper-center opponent body when pose shoulders are missing. */
export const DEFAULT_AIM: Point = { x: 0.5, y: 0.28 }
export const THROW_LOFT = -0.72

export type RockVisualMode = "ground" | "lifting" | "held" | "flying"

export type DrawRock = {
  id: string
  point: Point
  scale: number
  /** 0..1 how lifted off the "ground" for shadow placement. */
  lift: number
  kind: "ground" | "active"
}

export type GroundRock = {
  id: string
  point: Point
  available: boolean
}

export type RockVisualState = {
  mode: RockVisualMode
  ground: GroundRock[]
  activeId: string | null
  smoothedHand: Point | null
  liftFrom: Point | null
  liftStartedAtMs: number | null
  handSamples: HandSample[]
  flight: FlightState | null
  flightSeconds: number
}

export type RockDrawState = {
  rocks: DrawRock[]
  active: DrawRock | null
}

function spawnGround(seed = 0): GroundRock[] {
  // Cluster in the lower third where the first-person hand lives.
  const offsets = [-0.24, -0.06, 0.12, 0.28]
  return offsets.map((dx, index) => ({
    id: `ground-${index}-${seed}`,
    point: { x: 0.5 + dx, y: GROUND_Y + (index % 2) * 0.035 },
    available: true,
  }))
}

export function createRockVisual(flightSeconds = DEBUG_FLIGHT_SECONDS): RockVisualState {
  return {
    mode: "ground",
    ground: spawnGround(0),
    activeId: null,
    smoothedHand: null,
    liftFrom: null,
    liftStartedAtMs: null,
    handSamples: [],
    flight: null,
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
    y: (wrist.y + mid.y) / 2 - 0.06,
  }
}

export function opponentTarget(pose: {
  leftShoulder: Point | null
  rightShoulder: Point | null
} | null): Point {
  return healthAnchor(pose?.leftShoulder ?? null, pose?.rightShoulder ?? null) ?? DEFAULT_AIM
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function nearestAvailable(ground: GroundRock[], hand: Point): GroundRock | null {
  let best: GroundRock | null = null
  let bestDist = Number.POSITIVE_INFINITY
  for (const rock of ground) {
    if (!rock.available) continue
    const d = distance(rock.point, hand)
    if (d < bestDist) {
      best = rock
      bestDist = d
    }
  }
  return best && bestDist <= PICKUP_DISTANCE ? best : null
}

function markTaken(ground: GroundRock[], id: string): GroundRock[] {
  return ground.map((rock) => (rock.id === id ? { ...rock, available: false } : rock))
}

function respawnIfEmpty(ground: GroundRock[], seed: number): GroundRock[] {
  if (ground.some((rock) => rock.available)) return ground
  return spawnGround(seed)
}

export type RockVisualTick = {
  nowMs: number
  phase: Phase
  commands: BattleCommand[]
  ownHand: HandTrack | null
  target: Point | null
  /** Open palm from classifier — enables proximity pickup without waiting for HELD. */
  palmOpen: boolean
  /** When "gun", ground/held rocks are hidden; only an in-flight rock can finish. */
  weapon?: "rock" | "gun" | "saber"
}

export type RockVisualFrame = {
  state: RockVisualState
  draw: RockDrawState
  /** Back-compat single point for older callers. */
  drawAt: Point | null
}

function groundDrawList(state: RockVisualState, activePoint: Point | null, scale = 1, lift = 0): RockDrawState {
  const rocks: DrawRock[] = state.ground
    .filter((rock) => rock.available)
    .map((rock) => ({
      id: rock.id,
      point: rock.point,
      scale: 0.95,
      lift: 0,
      kind: "ground" as const,
    }))
  const active =
    activePoint && state.activeId
      ? {
          id: state.activeId,
          point: activePoint,
          scale,
          lift,
          kind: "active" as const,
        }
      : null
  if (active) rocks.push(active)
  return { rocks, active }
}

/**
 * Screen-space AR POC: rocks on a fake ground plane, palm pickup, hand-locked hold,
 * velocity throw with perspective scale. Not ARKit depth.
 */
export function tickRockVisual(state: RockVisualState, tick: RockVisualTick): RockVisualFrame {
  const names = new Set(tick.commands.map((command) => command.name))
  const hand = handFloatPoint(tick.ownHand)
  let next: RockVisualState = { ...state, ground: [...state.ground.map((rock) => ({ ...rock }))] }

  if (hand) {
    next = {
      ...next,
      smoothedHand: smoothPoint(next.smoothedHand, hand, 0.45),
      handSamples: pushHandSample(next.handSamples, tick.nowMs, hand),
    }
  }

  // Gun mode: hide every rock except a throw already in the air.
  if ((tick.weapon === "gun" || tick.weapon === "saber") && next.mode !== "flying") {
    const cleared: RockVisualState = {
      ...createRockVisual(state.flightSeconds),
      smoothedHand: next.smoothedHand,
      handSamples: next.handSamples,
      ground: [],
    }
    return { state: cleared, draw: { rocks: [], active: null }, drawAt: null }
  }

  // Coming back from gun: restore ground rocks if the field was cleared.
  if (tick.weapon !== "gun" && tick.weapon !== "saber" && next.ground.length === 0 && next.mode === "ground") {
    next = { ...next, ground: spawnGround(tick.nowMs) }
  }

  if (names.has("cancelLift")) {
    const reset = createRockVisual(state.flightSeconds)
    reset.ground = respawnIfEmpty(spawnGround(tick.nowMs), tick.nowMs)
    return {
      state: reset,
      draw: groundDrawList(reset, null),
      drawAt: null,
    }
  }

  // --- flying ---
  if (next.mode === "flying" && next.flight) {
    const sample = sampleBallistic(next.flight, tick.nowMs)
    if (sample.done) {
      const landed = createRockVisual(state.flightSeconds)
      landed.ground = respawnIfEmpty(
        [
          ...next.ground.filter((rock) => rock.available),
          {
            id: next.activeId ?? `landed-${tick.nowMs}`,
            point: { x: Math.min(0.92, Math.max(0.08, sample.point.x)), y: GROUND_Y },
            available: true,
          },
        ],
        tick.nowMs,
      )
      return {
        state: landed,
        draw: groundDrawList(landed, null),
        drawAt: null,
      }
    }
    const draw = groundDrawList(next, sample.point, sample.scale, Math.min(1, sample.height * 3))
    return { state: next, draw, drawAt: sample.point }
  }

  if (names.has("releaseRock") && (next.mode === "held" || next.mode === "lifting")) {
    const from = next.smoothedHand ?? hand
    if (!from) {
      const reset = createRockVisual(state.flightSeconds)
      return { state: reset, draw: groundDrawList(reset, null), drawAt: null }
    }
    const aim = tick.target ?? DEFAULT_AIM
    const velocity = throwImpulse(estimateHandVelocity(next.handSamples, tick.nowMs), aim, from)
    const flight: FlightState = {
      origin: from,
      velocity,
      launchedAtMs: tick.nowMs,
      loft: THROW_LOFT,
      gravity: 2.4,
      aim,
      durationSec: state.flightSeconds,
    }
    next = {
      ...next,
      mode: "flying",
      flight,
      liftFrom: null,
      liftStartedAtMs: null,
    }
    const sample = sampleBallistic(flight, tick.nowMs)
    const draw = groundDrawList(next, sample.point, sample.scale, 0.7)
    return { state: next, draw, drawAt: sample.point }
  }

  // --- held: stick to hand ---
  if (next.mode === "held" || tick.phase === "HELD" || names.has("startLift")) {
    const follow = next.smoothedHand ?? hand
    if (!follow) {
      return { state: next, draw: groundDrawList(next, null), drawAt: null }
    }
    if (!next.activeId) {
      const claim =
        nearestAvailable(next.ground, follow) ?? next.ground.find((rock) => rock.available) ?? null
      if (claim) {
        next = {
          ...next,
          activeId: claim.id,
          ground: markTaken(next.ground, claim.id),
        }
      }
    }
    next = {
      ...next,
      mode: "held",
      flight: null,
      liftFrom: null,
      liftStartedAtMs: null,
    }
    const draw = groundDrawList(next, follow, HELD_ROCK_SCALE, 0.85)
    return { state: next, draw, drawAt: follow }
  }

  // --- start lifting from ground (command, phase charge, or palm proximity) ---
  const wantPickup =
    names.has("startLift") ||
    tick.phase === "CHARGING" ||
    (tick.palmOpen && Boolean(hand))

  if (wantPickup && hand && (next.mode === "ground" || next.mode === "lifting")) {
    if (next.mode === "ground") {
      const forced = names.has("startLift") || tick.phase === "CHARGING"
      const targetRock = forced
        ? nearestAvailable(next.ground, hand) ?? next.ground.find((rock) => rock.available) ?? null
        : nearestAvailable(next.ground, hand)
      if (targetRock) {
        next = {
          ...next,
          mode: "lifting",
          activeId: targetRock.id,
          ground: markTaken(next.ground, targetRock.id),
          liftFrom: { ...targetRock.point },
          liftStartedAtMs: tick.nowMs,
          flight: null,
        }
      }
    }

    if (next.mode === "lifting" && next.liftFrom && next.liftStartedAtMs != null) {
      const follow = next.smoothedHand ?? hand
      const t = Math.min(1, (tick.nowMs - next.liftStartedAtMs) / 280)
      const point = {
        x: next.liftFrom.x + (follow.x - next.liftFrom.x) * t,
        y: next.liftFrom.y + (follow.y - next.liftFrom.y) * t,
      }
      if (t >= 1 || names.has("startLift")) {
        next = { ...next, mode: "held", liftFrom: null, liftStartedAtMs: null }
        const draw = groundDrawList(next, follow, HELD_ROCK_SCALE, 0.85)
        return { state: next, draw, drawAt: follow }
      }
      const draw = groundDrawList(next, point, 1 + t * (HELD_ROCK_SCALE - 1), t * 0.85)
      return { state: next, draw, drawAt: point }
    }
  }

  // idle ground
  next = {
    ...next,
    mode: "ground",
    activeId: null,
    flight: null,
    liftFrom: null,
    liftStartedAtMs: null,
    ground: respawnIfEmpty(next.ground, tick.nowMs),
  }
  const draw = groundDrawList(next, null)
  return { state: next, draw, drawAt: null }
}
