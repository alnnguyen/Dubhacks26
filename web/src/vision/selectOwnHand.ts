import { OWN_HAND_LOWER_MARGIN, OWN_HAND_SPAN_RATIO } from "./constants"

export type HandObservation = {
  id: string
  palmSpan: number
  /** 0 is the top of the frame, 1 is the bottom. */
  centerY: number
}

export type HandSelection =
  | { status: "none" }
  | { status: "ambiguous" }
  | { status: "ok"; handId: string }

/**
 * The player's hand is the large shape at the bottom of the rear camera.
 * Similar sizes, or a large shape high in the frame, pause gestures.
 */
export function selectOwnHand(hands: HandObservation[]): HandSelection {
  if (hands.length === 0) return { status: "none" }
  if (hands.length === 1) return { status: "ok", handId: hands[0].id }

  const sorted = [...hands].sort((a, b) => b.palmSpan - a.palmSpan)
  const nearest = sorted[0]
  const second = sorted[1]
  const spanRatio = nearest.palmSpan / Math.max(second.palmSpan, 1e-6)
  const clearlyLarger = spanRatio >= OWN_HAND_SPAN_RATIO
  const clearlyLower = nearest.centerY > second.centerY + OWN_HAND_LOWER_MARGIN

  if (clearlyLarger && clearlyLower) return { status: "ok", handId: nearest.id }
  return { status: "ambiguous" }
}
