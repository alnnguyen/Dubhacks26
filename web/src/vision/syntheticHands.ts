import type { HandTrack, Landmark, Point } from "./types"

function blank(origin: Point): Landmark[] {
  return Array.from({ length: 21 }, () => ({ x: origin.x, y: origin.y }))
}

function place(landmarks: Landmark[], index: number, origin: Point, x: number, y: number, scale: number) {
  landmarks[index] = { x: origin.x + x * scale, y: origin.y + y * scale }
}

/** Synthetic MediaPipe-style hand. Y grows downward, so fingertips use negative Y. */
export function synthesizeHand(
  kind: "palm" | "fist" | "relaxed" | "gun",
  options: { scale?: number; origin?: Point; id?: string } = {},
): HandTrack {
  const scale = options.scale ?? 1
  const origin = options.origin ?? { x: 0.5, y: 0.8 }
  const landmarks = blank(origin)

  place(landmarks, 5, origin, -0.05, -0.08, scale)
  place(landmarks, 9, origin, -0.02, -0.09, scale)
  place(landmarks, 13, origin, 0.02, -0.08, scale)
  place(landmarks, 17, origin, 0.05, -0.06, scale)

  // Default thumb resting beside the palm.
  place(landmarks, 2, origin, -0.08, -0.02, scale)
  place(landmarks, 3, origin, -0.1, -0.04, scale)
  place(landmarks, 4, origin, -0.11, -0.05, scale)

  if (kind === "palm") {
    place(landmarks, 6, origin, -0.06, -0.14, scale)
    place(landmarks, 8, origin, -0.07, -0.22, scale)
    place(landmarks, 10, origin, -0.02, -0.16, scale)
    place(landmarks, 12, origin, -0.02, -0.26, scale)
    place(landmarks, 14, origin, 0.03, -0.15, scale)
    place(landmarks, 16, origin, 0.04, -0.24, scale)
    place(landmarks, 18, origin, 0.06, -0.12, scale)
    place(landmarks, 20, origin, 0.08, -0.2, scale)
  } else if (kind === "fist") {
    place(landmarks, 6, origin, -0.05, -0.1, scale)
    place(landmarks, 8, origin, -0.04, -0.03, scale)
    place(landmarks, 10, origin, -0.02, -0.11, scale)
    place(landmarks, 12, origin, -0.01, -0.03, scale)
    place(landmarks, 14, origin, 0.02, -0.1, scale)
    place(landmarks, 16, origin, 0.02, -0.02, scale)
    place(landmarks, 18, origin, 0.05, -0.09, scale)
    place(landmarks, 20, origin, 0.04, -0.02, scale)
  } else if (kind === "gun") {
    // Thumb up (tip above IP), index + middle forward, ring + pinky curled.
    place(landmarks, 2, origin, -0.06, -0.04, scale)
    place(landmarks, 3, origin, -0.07, -0.1, scale)
    place(landmarks, 4, origin, -0.08, -0.18, scale)
    place(landmarks, 6, origin, -0.08, -0.05, scale)
    place(landmarks, 8, origin, -0.16, -0.06, scale)
    place(landmarks, 10, origin, -0.06, -0.06, scale)
    place(landmarks, 12, origin, -0.14, -0.08, scale)
    place(landmarks, 14, origin, 0.02, -0.1, scale)
    place(landmarks, 16, origin, 0.02, -0.02, scale)
    place(landmarks, 18, origin, 0.05, -0.09, scale)
    place(landmarks, 20, origin, 0.04, -0.02, scale)
  } else {
    // Relaxed: two fingers out, thumb tucked (not a gun).
    place(landmarks, 2, origin, -0.05, 0.01, scale)
    place(landmarks, 3, origin, -0.04, 0.03, scale)
    place(landmarks, 4, origin, -0.03, 0.05, scale)
    place(landmarks, 6, origin, -0.06, -0.14, scale)
    place(landmarks, 8, origin, -0.07, -0.22, scale)
    place(landmarks, 10, origin, -0.02, -0.16, scale)
    place(landmarks, 12, origin, -0.02, -0.26, scale)
    place(landmarks, 14, origin, 0.02, -0.1, scale)
    place(landmarks, 16, origin, 0.02, -0.02, scale)
    place(landmarks, 18, origin, 0.05, -0.09, scale)
    place(landmarks, 20, origin, 0.04, -0.02, scale)
  }

  return { id: options.id ?? kind, landmarks }
}
