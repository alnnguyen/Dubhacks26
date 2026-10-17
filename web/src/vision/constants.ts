/**
 * Starting combat timings from PLAN.md.
 * B owns the frozen values once contracts are agreed. These are the client
 * gates that keep a gesture from emitting a command early.
 */
export const PALM_HOLD_MS = 500
export const MAX_HELD_MS = 4_000
export const COOLDOWN_MS = 3_000
export const FIST_STABLE_MS = 100
export const HELD_GESTURE_LOSS_GRACE_MS = 200

/** Nearer hand should be clearly larger and lower in the frame. */
export const OWN_HAND_SPAN_RATIO = 1.35
export const OWN_HAND_LOWER_MARGIN = 0.08
