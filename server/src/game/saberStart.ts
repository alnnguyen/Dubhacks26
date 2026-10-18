import type { SaberStart } from "../contracts.js";

export const SABER_COUNTDOWN_MS = 3000;

/** Once combat opens, temporary tracking loss pauses swings without replaying the intro. */
export function advanceSaberStart(state: SaberStart, bothReady: boolean, nowMs: number): SaberStart {
  if (state.unlocked) return state;
  if (!bothReady) return state.startsAtMs === null ? state : { startsAtMs: null, unlocked: false };
  if (state.startsAtMs === null) return { startsAtMs: nowMs + SABER_COUNTDOWN_MS, unlocked: false };
  return nowMs >= state.startsAtMs ? { ...state, unlocked: true } : state;
}
