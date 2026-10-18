import { classifyGesture, observeHand } from "./landmarks"
import { createGestureMachine, tickGestureMachine, type GestureMachineState } from "./gestureMachine"
import { selectLockedHand, type HandLockHint } from "./handLock"
import { selectOwnHand, type HandSelection } from "./selectOwnHand"
import type { BattleCommand, Gesture, HandTrack, Intent, Phase, TouchInput } from "./types"

export type BattleInputState = {
  machine: GestureMachineState
}

export type BattleStep = {
  nowMs: number
  hands: HandTrack[]
  touch: TouchInput | null
  sessionId: string
  matchId: string
  /** When set, prefer the calibrated near hand over heuristic own-hand pick. */
  lockHint?: HandLockHint | null
  /** When true, camera gestures pause (lock lost / calibrating) but touch still works. */
  gesturesPaused?: boolean
}

export type BattleStepResult = {
  state: BattleInputState
  commands: BattleCommand[]
  phase: Phase
  selection: HandSelection
  gesture: Gesture
  intent: Intent
  ownHandId: string | null
}

export function createBattleInput(nowMs: number): BattleInputState {
  return { machine: createGestureMachine(nowMs) }
}

export function resolveIntent(selection: HandSelection, gesture: Gesture, touch: TouchInput | null): Intent {
  if (touch?.cancel) return "lost"
  if (touch?.throw) return "fist"
  if (touch?.lift) return "palm"
  if (selection.status === "none") return "lost"
  if (selection.status === "ambiguous") return "ambiguous"
  if (gesture === "palm" || gesture === "fist") return gesture
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

export function stepBattleInput(state: BattleInputState, step: BattleStep): BattleStepResult {
  const selection = resolveSelection(step.hands, step.lockHint)
  const own = step.hands.find((hand) => hand.id === (selection.status === "ok" ? selection.handId : ""))
  const gesture = own && !step.gesturesPaused ? classifyGesture(own.landmarks) : "none"
  const effectiveSelection: HandSelection = step.gesturesPaused ? { status: "ambiguous" } : selection
  const intent = resolveIntent(effectiveSelection, gesture, step.touch)
  const ticked = tickGestureMachine(state.machine, {
    nowMs: step.nowMs,
    intent,
    blockPressed: step.touch?.block ?? false,
    sessionId: step.sessionId,
    matchId: step.matchId,
  })

  return {
    state: { machine: ticked.state },
    commands: ticked.commands,
    phase: ticked.state.phase,
    selection: effectiveSelection,
    gesture,
    intent,
    ownHandId: !step.gesturesPaused && selection.status === "ok" ? selection.handId : null,
  }
}
