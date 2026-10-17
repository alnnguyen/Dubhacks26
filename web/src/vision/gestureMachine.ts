import {
  COOLDOWN_MS,
  FIST_STABLE_MS,
  HELD_GESTURE_LOSS_GRACE_MS,
  MAX_HELD_MS,
  PALM_HOLD_MS,
} from "./constants"
import type { BattleCommand, BattleCommandName, Intent, Phase } from "./types"

export type GestureMachineState = {
  phase: Phase
  phaseEnteredAtMs: number
  fistSinceMs: number | null
  emptySinceMs: number | null
  blockHeld: boolean
  commandSeq: number
}

export type GestureTick = {
  nowMs: number
  intent: Intent
  blockPressed: boolean
  sessionId: string
  matchId: string
}

export function createGestureMachine(nowMs: number): GestureMachineState {
  return {
    phase: "IDLE",
    phaseEnteredAtMs: nowMs,
    fistSinceMs: null,
    emptySinceMs: null,
    blockHeld: false,
    commandSeq: 0,
  }
}

function enter(state: GestureMachineState, phase: Phase, nowMs: number): GestureMachineState {
  return {
    ...state,
    phase,
    phaseEnteredAtMs: nowMs,
    fistSinceMs: null,
    emptySinceMs: null,
  }
}

function emit(
  state: GestureMachineState,
  name: BattleCommandName,
  tick: GestureTick,
): { state: GestureMachineState; command: BattleCommand } {
  const commandSeq = state.commandSeq + 1
  return {
    state: { ...state, commandSeq },
    command: {
      name,
      commandId: `${tick.sessionId}:${tick.matchId}:${commandSeq}`,
      sessionId: tick.sessionId,
      matchId: tick.matchId,
      sentAtMs: tick.nowMs,
    },
  }
}

export function tickGestureMachine(
  state: GestureMachineState,
  tick: GestureTick,
): { state: GestureMachineState; commands: BattleCommand[] } {
  const commands: BattleCommand[] = []
  let next = state

  if (tick.blockPressed && !state.blockHeld) {
    const emitted = emit(next, "block", tick)
    next = emitted.state
    commands.push(emitted.command)
  }
  next = { ...next, blockHeld: tick.blockPressed }

  if (next.phase === "COOLDOWN" && tick.nowMs - next.phaseEnteredAtMs < COOLDOWN_MS) {
    return { state: next, commands }
  }
  if (next.phase === "COOLDOWN") {
    next = enter(next, "IDLE", tick.nowMs)
  }

  if (tick.intent === "lost" || tick.intent === "ambiguous") {
    if (next.phase === "HELD") {
      const emitted = emit(next, "cancelLift", tick)
      next = enter(emitted.state, "IDLE", tick.nowMs)
      commands.push(emitted.command)
    } else if (next.phase === "CHARGING") {
      next = enter(next, "IDLE", tick.nowMs)
    }
    return { state: next, commands }
  }

  if (tick.intent === "none") {
    if (next.phase === "CHARGING") {
      next = enter(next, "IDLE", tick.nowMs)
    } else if (next.phase === "HELD") {
      const emptySinceMs = next.emptySinceMs ?? tick.nowMs
      next = { ...next, emptySinceMs, fistSinceMs: null }
      if (tick.nowMs - emptySinceMs >= HELD_GESTURE_LOSS_GRACE_MS) {
        const emitted = emit(next, "cancelLift", tick)
        next = enter(emitted.state, "IDLE", tick.nowMs)
        commands.push(emitted.command)
      }
    }
    return { state: next, commands }
  }

  next = { ...next, emptySinceMs: null }

  if (tick.intent === "fist") {
    const fistSinceMs = next.fistSinceMs ?? tick.nowMs
    const fistStable = tick.nowMs - fistSinceMs >= FIST_STABLE_MS
    next = { ...next, fistSinceMs }
    if (next.phase === "HELD" && fistStable) {
      const emitted = emit(next, "releaseRock", tick)
      next = enter(emitted.state, "COOLDOWN", tick.nowMs)
      commands.push(emitted.command)
      return { state: next, commands }
    }
    if (next.phase === "HELD" && tick.nowMs - next.phaseEnteredAtMs >= MAX_HELD_MS) {
      const emitted = emit(next, "cancelLift", tick)
      next = enter(emitted.state, "IDLE", tick.nowMs)
      commands.push(emitted.command)
      return { state: next, commands }
    }
    if (next.phase === "CHARGING") {
      next = enter(next, "IDLE", tick.nowMs)
    }
    return { state: next, commands }
  }

  next = { ...next, fistSinceMs: null }
  if (next.phase === "IDLE") {
    next = enter(next, "CHARGING", tick.nowMs)
    return { state: next, commands }
  }
  if (next.phase === "CHARGING" && tick.nowMs - next.phaseEnteredAtMs >= PALM_HOLD_MS) {
    const emitted = emit(next, "startLift", tick)
    next = enter(emitted.state, "HELD", tick.nowMs)
    commands.push(emitted.command)
    return { state: next, commands }
  }
  if (next.phase === "HELD" && tick.nowMs - next.phaseEnteredAtMs >= MAX_HELD_MS) {
    const emitted = emit(next, "cancelLift", tick)
    next = enter(emitted.state, "IDLE", tick.nowMs)
    commands.push(emitted.command)
  }
  return { state: next, commands }
}
