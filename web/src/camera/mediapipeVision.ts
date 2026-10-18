import { FilesetResolver, HandLandmarker, ImageSegmenter, PoseLandmarker } from "@mediapipe/tasks-vision"
import type { HandTrack, Landmark, Point } from "../vision/types"

/** Keep CDN wasm aligned with the installed npm package. */
export const MEDIAPIPE_VERSION = "1.1.1"

export const WASM_ROOT = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`

export const HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"

export const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"

/** DeepLab v3 (PASCAL VOC): segments every person in the frame. Category 15 = person. */
export const SCENE_SEGMENTER_URL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/deeplab_v3/float32/1/deeplab_v3.tflite"
export const DEEPLAB_PERSON = 15

export type VisionBundle = {
  handLandmarker: HandLandmarker
  poseLandmarker: PoseLandmarker
  delegate: "GPU" | "CPU"
  /** True when the pose pass also returns a person segmentation mask. */
  segmentation: boolean
  /** Optional scene segmenter for all people in view (immersive arena only). */
  sceneSegmenter: ImageSegmenter | null
  close: () => void
}

export type VisionOptions = {
  /** Ask PoseLandmarker for person masks (used to composite the opponent into an arena). */
  segmentation?: boolean
  /** People to track (default 1). >1 keeps aim stable when bystanders are in view. */
  numPoses?: number
  /** Also load DeepLab to segment every person (pose alone finds ~1 person). */
  sceneSegmentation?: boolean
}

async function createLandmarkers(
  fileset: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>,
  delegate: "GPU" | "CPU",
  segmentation: boolean,
  numPoses: number,
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
      numPoses,
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
  const numPoses = Math.max(1, Math.min(4, options.numPoses ?? 1))
  const fileset = await FilesetResolver.forVisionTasks(WASM_ROOT)
  let delegate: "GPU" | "CPU" = "GPU"
  let landmarks: Awaited<ReturnType<typeof createLandmarkers>>
  try {
    landmarks = await createLandmarkers(fileset, "GPU", segmentation, numPoses)
  } catch {
    delegate = "CPU"
    landmarks = await createLandmarkers(fileset, "CPU", segmentation, numPoses)
  }

  let sceneSegmenter: ImageSegmenter | null = null
  if (options.sceneSegmentation) {
    try {
      sceneSegmenter = await ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: SCENE_SEGMENTER_URL, delegate },
        runningMode: "VIDEO",
        outputCategoryMask: true,
        outputConfidenceMasks: false,
      })
    } catch {
      sceneSegmenter = null // pose masks still work; only multi-person coverage is lost
    }
  }

  return {
    ...landmarks,
    delegate,
    segmentation,
    sceneSegmenter,
    close() {
      landmarks.handLandmarker.close()
      landmarks.poseLandmarker.close()
      sceneSegmenter?.close()
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
  index = 0,
): PoseOverlay | null {
  const first = result.landmarks[index]
  if (!first || first.length < 13) return null
  return {
    leftShoulder: { x: first[LEFT_SHOULDER].x, y: first[LEFT_SHOULDER].y },
    rightShoulder: { x: first[RIGHT_SHOULDER].x, y: first[RIGHT_SHOULDER].y },
    landmarks: first.map(toLandmark),
  }
}

/**
 * With several people in view, pick the opponent: the most prominent person
 * (largest body box), sticking with the previously chosen one unless someone
 * else is clearly more prominent. Returns -1 when nobody is detected.
 */
export function selectOpponentIndex(
  poses: Array<Array<{ x: number; y: number }>>,
  previous: { x: number; y: number } | null,
): number {
  let best = -1
  let bestScore = 0
  poses.forEach((lm, i) => {
    if (lm.length < 13) return
    let minX = 1, maxX = 0, minY = 1, maxY = 0
    for (const p of lm) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
    const area = Math.max(0, maxX - minX) * Math.max(0, maxY - minY)
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    // Stickiness: the previously tracked person gets a strong bonus.
    const near = previous ? Math.hypot(cx - previous.x, cy - previous.y) < 0.15 : false
    const score = area * (near ? 1.8 : 1)
    if (score > bestScore) {
      bestScore = score
      best = i
    }
  })
  return best
}

/** Center of a pose's landmarks, for tracking the chosen opponent between frames. */
export function poseCenter(lm: Array<{ x: number; y: number }>): { x: number; y: number } {
  let x = 0, y = 0
  for (const p of lm) {
    x += p.x
    y += p.y
  }
  return { x: x / lm.length, y: y / lm.length }
}
