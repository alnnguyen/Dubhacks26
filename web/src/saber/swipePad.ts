import type { StepDirection } from "../../../server/src/contracts"

/**
 * Thumb swipes on the saber phone: the thumb already rests on the screen while
 * holding it like a hilt. A swipe fires the moment the thumb has travelled far
 * enough along one clear axis, without waiting for it to lift, so movement is
 * instant. One step per touch; lifting re-arms. Screen up is toward the rival.
 */

/** Travel (CSS px) along the main axis that makes a swipe... */
export const SWIPE_PX = 18
/** ...or this little, if the thumb is flicking fast (px per ms since touching down). */
export const FLICK_PX = 10
export const FLICK_SPEED = 0.5
/** The main axis must clearly win: this many times the other. */
export const DOMINANCE = 1.3

export type SwipeState = {
  /** The tracked touch and where it started; null when no single touch is down. */
  touch: { id: number; x: number; y: number; t: number } | null
  /** Already fired for this touch: wait for lift-off. */
  fired: boolean
}

export function createSwipe(): SwipeState {
  return { touch: null, fired: false }
}

type TouchPoint = { id: number; x: number; y: number; t: number }

/** A finger went down. A second finger cancels the swipe (a grip, not a gesture). */
export function swipeStart(state: SwipeState, touch: TouchPoint, touchesDown: number): SwipeState {
  if (touchesDown > 1) return { touch: null, fired: true }
  return { touch: { id: touch.id, x: touch.x, y: touch.y, t: touch.t }, fired: false }
}

/** The finger moved: returns a direction the first time it has travelled far enough. */
export function swipeMove(state: SwipeState, touch: TouchPoint): { state: SwipeState; step: StepDirection | null } {
  if (!state.touch || state.fired || touch.id !== state.touch.id) return { state, step: null }
  const dx = touch.x - state.touch.x
  const dy = touch.y - state.touch.y
  const fast = Math.hypot(dx, dy) / Math.max(1, touch.t - state.touch.t) >= FLICK_SPEED
  const far = (d: number) => d >= SWIPE_PX || (fast && d >= FLICK_PX)
  let step: StepDirection | null = null
  if (far(Math.abs(dx)) && Math.abs(dx) >= Math.abs(dy) * DOMINANCE) step = dx > 0 ? "right" : "left"
  else if (far(Math.abs(dy)) && Math.abs(dy) >= Math.abs(dx) * DOMINANCE) step = dy < 0 ? "forward" : "back"
  return step ? { state: { ...state, fired: true }, step } : { state, step: null }
}

/** All fingers up: ready for the next swipe. */
export function swipeEnd(touchesDown: number): SwipeState {
  return touchesDown === 0 ? createSwipe() : { touch: null, fired: true }
}
