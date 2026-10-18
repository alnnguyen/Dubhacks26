import { estimateHandVelocity, pushHandSample, type HandSample } from "../overlay/throwPhysics"
import { analyzeTipSwing, isSwingSlash, tipPointFromLandmarks } from "../overlay/swingDetect"
import {
  GUN_VELOCITY_WINDOW_MS,
  SWING_PATH_MIN,
  SWING_SPEED_MIN,
  SWING_WINDOW_MS,
} from "./constants"
import { classifyGesture, handCenter, observeHand } from "./landmarks"
import { createGestureMachine, tickGestureMachine, type GestureMachineState } from "./gestureMachine"
import { selectLockedHand, type HandLockHint } from "./handLock"
import { selectOwnHand, type HandSelection } from "./selectOwnHand"
import type { BattleCommand, Gesture, HandTrack, Intent, Phase, TouchInput, WeaponChoice } from "./types"

export type BattleInputState = {
  machine: GestureMachineState
  handSamples: HandSample[]
  tipSamples: HandSample[]
}

export type BattleStep = {
  nowMs: number
  hands: HandTrack[]
  touch: TouchInput | null
  sessionId: string
  matchId: string
  lockHint?: HandLockHint | null
  gesturesPaused?: boolean
  weapon?: WeaponChoice
}

export type BattleStepResult = {
  state: BattleInputState
  commands: BattleCommand[]
  phase: Phase
  selection: HandSelection
  gesture: Gesture
  intent: Intent
  ownHandId: string | null
  handSpeed: number
  handVx: number
  handVy: number
  handUpDelta: number
  tipSpeed: number
  swingDx: number
  swingDy: number
}

export function createBattleInput(nowMs: number): BattleInputState {
  return { machine: createGestureMachine(nowMs), handSamples: [], tipSamples: [] }
}

export function resolveIntent(selection: HandSelection, gesture: Gesture, touch: TouchInput | null): Intent {
  if (touch?.cancel) return "lost"
  if (touch?.throw) return "release"
  if (touch?.lift) return "palm"
  if (selection.status === "none") return "lost"
  if (selection.status === "ambiguous") return "ambiguous"
  if (gesture === "palm" || gesture === "fist" || gesture === "gun") return gesture
  return "none"
}

function resolveSelection(hands: HandTrack[], lockHint: HandLockHint | null | undefined): HandSelection {
  if (lockHint) {
    const locked = selectLockedHand(hands, lockHint)
    if (locked.status === "ok") return { status: "ok", handId: locked.handId }
    return { status: "ambiguous" }
  }
  const observations = hands.flatMap((hand) => {
    const observed = observeHand(hand)
    return observed ? [observed] : []
  })
  return selectOwnHand(observations)
}

function handUpDelta(samples: HandSample[], nowMs: number, windowMs: number): number {
  if (samples.length < 2) return 0
  const cutoff = nowMs - windowMs
  const recent = samples.filter((sample) => sample.atMs >= cutoff)
  const use = recent.length >= 2 ? recent : samples.slice(-2)
  return use[use.length - 1].point.y - use[0].point.y
}

export function stepBattleInput(state: BattleInputState, step: BattleStep): BattleStepResult {
  const selection = resolveSelection(step.hands, step.lockHint)
  const own = step.hands.find((hand) => hand.id === (selection.status === "ok" ? selection.handId : ""))
  const gesture = own && !step.gesturesPaused ? classifyGesture(own.landmarks) : "none"
  const effectiveSelection: HandSelection = step.gesturesPaused ? { status: "ambiguous" } : selection
  const intent = resolveIntent(effectiveSelection, gesture, step.touch)
  const weapon = step.weapon ?? "rock"

  let handSamples = state.handSamples
  let tipSamples = state.tipSamples
  const center = own && !step.gesturesPaused ? handCenter(own.landmarks) : null
  const tip = own && !step.gesturesPaused ? tipPointFromLandmarks(own.landmarks) : null
  if (center) {
    handSamples = pushHandSample(handSamples, step.nowMs, center)
  } else if (step.touch?.throw || step.touch?.lift) {
    handSamples = state.handSamples
  } else {
    handSamples = []
  }
  if (tip && weapon === "saber") {
    tipSamples = pushHandSample(tipSamples, step.nowMs, tip, 16)
  } else if (weapon !== "saber") {
    tipSamples = []
  }

  const velocity = estimateHandVelocity(handSamples, step.nowMs, GUN_VELOCITY_WINDOW_MS)
  const handSpeed = Math.hypot(velocity.vx, velocity.vy)
  const upDelta = handUpDelta(handSamples, step.nowMs, GUN_VELOCITY_WINDOW_MS)
  const swing = analyzeTipSwing(tipSamples, step.nowMs, SWING_WINDOW_MS)
  const tipSwing =
    weapon === "saber" &&
    state.machine.phase === "GUN_AIM" &&
    isSwingSlash(swing, { pathMin: SWING_PATH_MIN, speedMin: SWING_SPEED_MIN })

  const aimingSaber =
    weapon === "saber" &&
    (state.machine.phase === "GUN_AIM" || state.machine.phase === "SABER_RECOVER")
  const forceThrow = Boolean(
    step.touch?.throw && (state.machine.phase === "HELD" || aimingSaber),
  )

  const ticked = tickGestureMachine(state.machine, {
    nowMs: step.nowMs,
    intent,
    blockPressed: step.touch?.block ?? false,
    handSpeed: forceThrow ? Math.max(handSpeed, THROW_TOUCH_SPEED) : handSpeed,
    handVx: velocity.vx,
    handVy: velocity.vy,
    handUpDelta: upDelta,
    tipSwing,
    tipSwingDx: swing.dx,
    tipSwingDy: swing.dy,
    tipSpeed: swing.peakSpeed,
    forceThrow,
    weapon,
    sessionId: step.sessionId,
    matchId: step.matchId,
  })

  return {
    state: { machine: ticked.state, handSamples, tipSamples },
    commands: ticked.commands,
    phase: ticked.state.phase,
    selection: effectiveSelection,
    gesture,
    intent,
    ownHandId: !step.gesturesPaused && selection.status === "ok" ? selection.handId : null,
    handSpeed,
    handVx: velocity.vx,
    handVy: velocity.vy,
    handUpDelta: upDelta,
    tipSpeed: swing.peakSpeed,
    swingDx: ticked.state.lastSwingDx || swing.dx,
    swingDy: ticked.state.lastSwingDy || swing.dy,
  }
}

const THROW_TOUCH_SPEED = 1.2
