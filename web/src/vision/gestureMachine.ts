import {
  COOLDOWN_MS,
  FIST_STABLE_MS,
  GUN_AIM_STABLE_MS,
  GUN_POSE_LOSS_GRACE_MS,
  MAX_HELD_MS,
  SOFT_RELEASE_CANCEL_MS,
  THROW_FLING_SPEED,
  THROW_SPEED_MIN,
} from "./constants"
import type { BattleCommand, BattleCommandName, Intent, Phase } from "./types"

export type GestureMachineState = {
  phase: Phase
  phaseEnteredAtMs: number
  fistSinceMs: number | null
  gunSinceMs: number | null
  gunPoseLostSinceMs: number | null
  emptySinceMs: number | null
  softOpenSinceMs: number | null
  gunActiveEmitted: boolean
  /** Fist cocked the hammer — next trigger pose may fire once. */
  gunShotReady: boolean
  blockHeld: boolean
  commandSeq: number
}

export type GestureTick = {
  nowMs: number
  intent: Intent
  blockPressed: boolean
  /** Screen-space speed for throw gating. */
  handSpeed: number
  /** Screen Y velocity; negative is upward. */
  handVy: number
  /** Recent upward travel (last.y - first.y); negative is up. */
  handUpDelta: number
  /** Touch Throw: always release when held. */
  forceThrow: boolean
  /** Server / button active weapon. */
  weapon: "rock" | "gun"
  sessionId: string
  matchId: string
}

export function createGestureMachine(nowMs: number): GestureMachineState {
  return {
    phase: "IDLE",
    phaseEnteredAtMs: nowMs,
    fistSinceMs: null,
    gunSinceMs: null,
    gunPoseLostSinceMs: null,
    emptySinceMs: null,
    softOpenSinceMs: null,
    gunActiveEmitted: false,
    gunShotReady: false,
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
    gunSinceMs: null,
    gunPoseLostSinceMs: null,
    emptySinceMs: null,
    softOpenSinceMs: null,
    gunActiveEmitted: phase === "GUN_AIM" ? state.gunActiveEmitted : false,
    gunShotReady: phase === "GUN_AIM" ? state.gunShotReady : false,
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

/** Fist grip while Gun is selected — hold the handle. */
function gunFistHold(tick: GestureTick): boolean {
  return tick.weapon === "gun" && tick.intent === "fist"
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
  } else if (!tick.blockPressed && state.blockHeld) {
    const emitted = emit(next, "endBlock", tick)
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
      return { state: next, commands }
    }
    if (next.phase === "CHARGING") {
      next = enter(next, "IDLE", tick.nowMs)
      return { state: next, commands }
    }
    if (next.phase === "GUN_AIM") {
      if (tick.weapon !== "gun") {
        const lostSince = next.gunPoseLostSinceMs ?? tick.nowMs
        next = { ...next, gunPoseLostSinceMs: lostSince }
        if (tick.nowMs - lostSince >= GUN_POSE_LOSS_GRACE_MS) {
          next = enter(next, "IDLE", tick.nowMs)
        }
      }
      return { state: next, commands }
    }
    return { state: next, commands }
  }

  // --- GUN_AIM: fist holds / cocks; index+middle trigger fires once per cock ---
  if (next.phase === "GUN_AIM") {
    if (tick.intent === "fist" || tick.intent === "gun" || tick.weapon === "gun") {
      next = { ...next, gunPoseLostSinceMs: null }
    } else {
      const lostSince = next.gunPoseLostSinceMs ?? tick.nowMs
      next = { ...next, gunPoseLostSinceMs: lostSince }
      if (tick.nowMs - lostSince >= GUN_POSE_LOSS_GRACE_MS) {
        next = enter(next, "IDLE", tick.nowMs)
        return { state: next, commands }
      }
    }

    const gunSinceMs = next.gunSinceMs ?? tick.nowMs
    next = { ...next, gunSinceMs }

    if (tick.weapon === "gun" && !next.gunActiveEmitted) {
      next = { ...next, gunActiveEmitted: true }
    }
    if (!next.gunActiveEmitted && tick.nowMs - gunSinceMs >= GUN_AIM_STABLE_MS) {
      const emitted = emit(next, "gunActive", tick)
      next = { ...emitted.state, gunActiveEmitted: true }
      commands.push(emitted.command)
    }

    // Fist = grip the handle and cock for the next shot.
    if (tick.intent === "fist") {
      next = { ...next, gunShotReady: true, fistSinceMs: next.fistSinceMs ?? tick.nowMs }
      return { state: next, commands }
    }

    // Trigger = pointer + middle extended (handgun CV pose) after a fist cock.
    if (tick.intent === "gun" && next.gunActiveEmitted && next.gunShotReady) {
      const emitted = emit(next, "fireGun", tick)
      next = enter(emitted.state, "COOLDOWN", tick.nowMs)
      next = { ...next, gunShotReady: false }
      commands.push(emitted.command)
      return { state: next, commands }
    }

    return { state: next, commands }
  }

  // --- HELD (fist grab): throw on fling-open or touch Throw ---
  if (next.phase === "HELD") {
    if (tick.weapon === "gun") {
      const emitted = emit(next, "cancelLift", tick)
      next = enter(emitted.state, "GUN_AIM", tick.nowMs)
      next = { ...next, gunSinceMs: tick.nowMs, gunShotReady: tick.intent === "fist" }
      commands.push(emitted.command)
      return { state: next, commands }
    }

    if (tick.nowMs - next.phaseEnteredAtMs >= MAX_HELD_MS) {
      const emitted = emit(next, "cancelLift", tick)
      next = enter(emitted.state, "IDLE", tick.nowMs)
      commands.push(emitted.command)
      return { state: next, commands }
    }

    const flingThrow = tick.handSpeed >= THROW_FLING_SPEED
    const openThrow =
      tick.intent !== "fist" && tick.intent !== "gun" && tick.handSpeed >= THROW_SPEED_MIN
    if (tick.forceThrow || flingThrow || openThrow) {
      const emitted = emit(next, "releaseRock", tick)
      next = enter(emitted.state, "COOLDOWN", tick.nowMs)
      commands.push(emitted.command)
      return { state: next, commands }
    }

    if (tick.intent === "fist") {
      next = { ...next, softOpenSinceMs: null, emptySinceMs: null, fistSinceMs: next.fistSinceMs ?? tick.nowMs }
      return { state: next, commands }
    }

    if (tick.intent === "palm" || tick.intent === "none" || tick.intent === "release") {
      const softOpenSinceMs = next.softOpenSinceMs ?? tick.nowMs
      next = { ...next, softOpenSinceMs, fistSinceMs: null }
      if (tick.nowMs - softOpenSinceMs >= SOFT_RELEASE_CANCEL_MS) {
        const emitted = emit(next, "cancelLift", tick)
        next = enter(emitted.state, "IDLE", tick.nowMs)
        commands.push(emitted.command)
      }
      return { state: next, commands }
    }

    return { state: next, commands }
  }

  // --- CHARGING (palm): fist grabs rock, or switches to gun grip when Gun is selected ---
  if (next.phase === "CHARGING") {
    if (gunFistHold(tick)) {
      next = enter(next, "GUN_AIM", tick.nowMs)
      next = { ...next, gunSinceMs: tick.nowMs, gunShotReady: true }
      return { state: next, commands }
    }
    if (tick.weapon === "gun" && tick.intent === "gun") {
      next = enter(next, "GUN_AIM", tick.nowMs)
      next = { ...next, gunSinceMs: tick.nowMs, gunShotReady: false }
      return { state: next, commands }
    }
    if (tick.intent === "release") {
      const emitted = emit(next, "startLift", tick)
      next = enter(emitted.state, "HELD", tick.nowMs)
      commands.push(emitted.command)
      return { state: next, commands }
    }
    if (tick.intent === "none") {
      next = enter(next, "IDLE", tick.nowMs)
      return { state: next, commands }
    }
    if (tick.intent === "fist") {
      const fistSinceMs = next.fistSinceMs ?? tick.nowMs
      next = { ...next, fistSinceMs }
      if (tick.nowMs - fistSinceMs >= FIST_STABLE_MS) {
        const emitted = emit(next, "startLift", tick)
        next = enter(emitted.state, "HELD", tick.nowMs)
        commands.push(emitted.command)
      }
      return { state: next, commands }
    }
    next = { ...next, fistSinceMs: null }
    return { state: next, commands }
  }

  // --- IDLE ---
  if (gunFistHold(tick)) {
    next = enter(next, "GUN_AIM", tick.nowMs)
    next = { ...next, gunSinceMs: tick.nowMs, gunShotReady: true }
    if (tick.weapon === "gun") next = { ...next, gunActiveEmitted: true }
    return { state: next, commands }
  }

  // Gun button selected: stay in aim overlay without requiring a fist yet (touch Fire still works).
  if (tick.weapon === "gun") {
    next = enter(next, "GUN_AIM", tick.nowMs)
    next = { ...next, gunSinceMs: tick.nowMs, gunActiveEmitted: true, gunShotReady: false }
    return { state: next, commands }
  }

  if (tick.intent === "palm") {
    next = enter(next, "CHARGING", tick.nowMs)
    return { state: next, commands }
  }

  return { state: next, commands }
}
