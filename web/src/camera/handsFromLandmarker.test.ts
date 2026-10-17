import { describe, expect, it } from "vitest"
import { handsFromLandmarker, poseFromLandmarker } from "./mediapipeVision"

describe("MediaPipe result adapters", () => {
  it("maps hand landmark arrays into battle HandTrack rows", () => {
    const points = Array.from({ length: 21 }, (_, i) => ({ x: i / 20, y: 0.5, z: 0 }))
    const hands = handsFromLandmarker({ landmarks: [points] })
    expect(hands).toHaveLength(1)
    expect(hands[0].id).toBe("hand-0")
    expect(hands[0].landmarks).toHaveLength(21)
    expect(hands[0].landmarks[3]).toEqual({ x: 3 / 20, y: 0.5, z: 0 })
  })

  it("reads shoulder anchors from a pose result and rejects short lists", () => {
    const points = Array.from({ length: 33 }, (_, i) => ({ x: i * 0.01, y: i * 0.02, z: 0 }))
    const pose = poseFromLandmarker({ landmarks: [points] })
    expect(pose?.leftShoulder).toEqual({ x: 0.11, y: 0.22 })
    expect(pose?.rightShoulder).toEqual({ x: 0.12, y: 0.24 })
    expect(poseFromLandmarker({ landmarks: [] })).toBeNull()
    expect(poseFromLandmarker({ landmarks: [points.slice(0, 5)] })).toBeNull()
  })
})
