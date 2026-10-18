import { FilesetResolver, HandLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision"
import type { HandTrack, Landmark, Point } from "../vision/types"

/** Keep CDN wasm aligned with the installed npm package. */
export const MEDIAPIPE_VERSION = "1.1.1"

export const WASM_ROOT = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`

export const HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"

export const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"

export type VisionBundle = {
  handLandmarker: HandLandmarker
  poseLandmarker: PoseLandmarker
  delegate: "GPU" | "CPU"
  /** True when the pose pass also returns a person segmentation mask. */
  segmentation: boolean
  close: () => void
}

export type VisionOptions = {
  /** Ask PoseLandmarker for person masks (used to composite the opponent into an arena). */
  segmentation?: boolean
}

async function createLandmarkers(
  fileset: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>,
  delegate: "GPU" | "CPU",
  segmentation: boolean,
) {
  const [handLandmarker, poseLandmarker] = await Promise.all([
    HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    }),
    PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputSegmentationMasks: segmentation,
    }),
  ])
  return { handLandmarker, poseLandmarker }
}

export async function createVisionBundle(options: VisionOptions = {}): Promise<VisionBundle> {
  const segmentation = Boolean(options.segmentation)
  const fileset = await FilesetResolver.forVisionTasks(WASM_ROOT)
  let delegate: "GPU" | "CPU" = "GPU"
  let landmarks: Awaited<ReturnType<typeof createLandmarkers>>
  try {
    landmarks = await createLandmarkers(fileset, "GPU", segmentation)
  } catch {
    delegate = "CPU"
    landmarks = await createLandmarkers(fileset, "CPU", segmentation)
  }

  return {
    ...landmarks,
    delegate,
    segmentation,
    close() {
      landmarks.handLandmarker.close()
      landmarks.poseLandmarker.close()
    },
  }
}

function toLandmark(point: { x: number; y: number; z?: number }): Landmark {
  return { x: point.x, y: point.y, z: point.z }
}

export function handsFromLandmarker(
  result: { landmarks: Array<Array<{ x: number; y: number; z?: number }>> },
): HandTrack[] {
  return result.landmarks.map((landmarks, index) => ({
    id: `hand-${index}`,
    landmarks: landmarks.map(toLandmark),
  }))
}

export type PoseOverlay = {
  leftShoulder: Point | null
  rightShoulder: Point | null
  landmarks: Landmark[]
}

const LEFT_SHOULDER = 11
const RIGHT_SHOULDER = 12

export function poseFromLandmarker(
  result: { landmarks: Array<Array<{ x: number; y: number; z?: number }>> },
): PoseOverlay | null {
  const first = result.landmarks[0]
  if (!first || first.length < 13) return null
  return {
    leftShoulder: { x: first[LEFT_SHOULDER].x, y: first[LEFT_SHOULDER].y },
    rightShoulder: { x: first[RIGHT_SHOULDER].x, y: first[RIGHT_SHOULDER].y },
    landmarks: first.map(toLandmark),
  }
}
