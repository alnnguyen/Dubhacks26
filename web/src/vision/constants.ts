/**
 * Client gates that keep a gesture from emitting a command early.
 * Tuned loose for phone CV QA — server cooldowns still own combat timing.
 */
export const PALM_HOLD_MS = 350
export const MAX_HELD_MS = 5_000
export const COOLDOWN_MS = 3_000
export const FIST_STABLE_MS = 70
export const HELD_GESTURE_LOSS_GRACE_MS = 280
/** Soft open without a fling cancels the grab after this grace. */
export const SOFT_RELEASE_CANCEL_MS = 650
/** Open + speed (screen units / s) required to throw from a fist grab. */
export const THROW_SPEED_MIN = 0.28
/** Big fling throws even if the fist is still partially closed. */
export const THROW_FLING_SPEED = 0.85
export const GUN_AIM_STABLE_MS = 80
/** Keep aiming briefly when the fist grip flickers. */
export const GUN_POSE_LOSS_GRACE_MS = 400
/** Unused by fire path (kept for sample windows / HUD). */
export const GUN_FLICK_VY = -0.1
export const GUN_FLICK_DELTA_Y = -0.028
export const GUN_VELOCITY_WINDOW_MS = 220

/** Nearer hand should be clearly larger and lower in the frame. */
export const OWN_HAND_SPAN_RATIO = 1.35
export const OWN_HAND_LOWER_MARGIN = 0.08
