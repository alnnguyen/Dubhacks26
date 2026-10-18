import type { SaberStart } from "../contracts.js";

import { RULES } from "./rules.js";

export const SABER_COUNTDOWN_MS = RULES.countdownMs;

/** Once combat opens, temporary tracking loss pauses swings without replaying the intro. */
export function advanceSaberStart(state: SaberStart, bothReady: boolean, nowMs: number): SaberStart {
  if (state.unlocked) return state;
  if (!bothReady) return state.startsAtMs === null ? state : { startsAtMs: null, unlocked: false };
  if (state.startsAtMs === null) return { startsAtMs: nowMs + SABER_COUNTDOWN_MS, unlocked: false };
  return nowMs >= state.startsAtMs ? { ...state, unlocked: true } : state;
}
