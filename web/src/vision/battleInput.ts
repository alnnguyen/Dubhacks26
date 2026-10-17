import { classifyGesture, observeHand } from "./landmarks"
import { createGestureMachine, tickGestureMachine, type GestureMachineState } from "./gestureMachine"
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

export function stepBattleInput(state: BattleInputState, step: BattleStep): BattleStepResult {
  const observations = step.hands.flatMap((hand) => {
    const observed = observeHand(hand)
    return observed ? [observed] : []
  })
  const selection = selectOwnHand(observations)
  const own = step.hands.find((hand) => hand.id === (selection.status === "ok" ? selection.handId : ""))
  const gesture = own ? classifyGesture(own.landmarks) : "none"
  const intent = resolveIntent(selection, gesture, step.touch)
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
    selection,
    gesture,
    intent,
    ownHandId: selection.status === "ok" ? selection.handId : null,
  }
}
