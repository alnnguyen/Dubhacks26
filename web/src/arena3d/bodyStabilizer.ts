import type { Vec3 } from "../../../server/src/contracts"
import { oneEuro, type OneEuro, type OneEuroParams } from "./oneEuro"

/**
 * Only the head, shoulders, hips, elbows and wrists are tracked; everything
 * else is drawn from a fixed standing pose under the hips. At laptop distance
 * the legs are usually out of frame, and MediaPipe's guesses for them were
 * most of the avatar's shaking. Tracked joints are One Euro filtered, which
 * also steadies the saber hilt (the wrist). Hips that leave the frame are
 * placed below the shoulders at the torso length last seen.
 */

const NOSE = 0
const LEFT_SHOULDER = 11
const RIGHT_SHOULDER = 12
const LEFT_ELBOW = 13
const RIGHT_ELBOW = 14
const LEFT_WRIST = 15
const RIGHT_WRIST = 16
const LEFT_HIP = 23
const RIGHT_HIP = 24

export const TRACKED = [NOSE, LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_ELBOW, RIGHT_ELBOW, LEFT_WRIST, RIGHT_WRIST, LEFT_HIP, RIGHT_HIP]

// Body joints move slowly at rest; wrists need to keep up with a swing.
const STEADY: OneEuroParams = { minCutoff: 1.0, beta: 0.4, dCutoff: 1.0 }
const HANDS: OneEuroParams = { minCutoff: 1.5, beta: 1.2, dCutoff: 1.0 }

/** Hips count as seen when MediaPipe is at least this sure they're in frame. */
export const HIP_VISIBILITY = 0.5
const DEFAULT_TORSO = 0.5
const HIP_HALF_WIDTH = 0.12

export type StabilizerState = {
  filters: Map<number, [OneEuro, OneEuro, OneEuro]>
  /** Shoulder midpoint to hip midpoint, from frames where the hips were seen. */
  torso: number
}

export function createStabilizer(): StabilizerState {
  return { filters: new Map(), torso: DEFAULT_TORSO }
}

/**
 * raw: 33 body-frame joints (camera fix applied); visibility: per-joint image
 * visibility. Returns a full 33-joint body the server and avatar can use.
 */
export function stabilize(
  state: StabilizerState,
  raw: Vec3[],
  visibility: number[],
  nowMs: number,
): { state: StabilizerState; joints: Vec3[] } {
  const filters = new Map(state.filters)
  const smooth = (i: number, p: Vec3): Vec3 => {
    const params = i === LEFT_WRIST || i === RIGHT_WRIST ? HANDS : STEADY
    const prev = filters.get(i) ?? [null, null, null]
    const next = [0, 1, 2].map((k) => oneEuro(prev[k], p[k], nowMs, params)) as [OneEuro, OneEuro, OneEuro]
    filters.set(i, next)
    return [next[0]!.value, next[1]!.value, next[2]!.value]
  }

  const shoulders = [smooth(LEFT_SHOULDER, raw[LEFT_SHOULDER]), smooth(RIGHT_SHOULDER, raw[RIGHT_SHOULDER])]
  const mid: Vec3 = [(shoulders[0][0] + shoulders[1][0]) / 2, (shoulders[0][1] + shoulders[1][1]) / 2, (shoulders[0][2] + shoulders[1][2]) / 2]

  let torso = state.torso
  let leftHip: Vec3
  let rightHip: Vec3
  if ((visibility[LEFT_HIP] ?? 0) >= HIP_VISIBILITY && (visibility[RIGHT_HIP] ?? 0) >= HIP_VISIBILITY) {
    leftHip = smooth(LEFT_HIP, raw[LEFT_HIP])
    rightHip = smooth(RIGHT_HIP, raw[RIGHT_HIP])
    const hipMid = [(leftHip[0] + rightHip[0]) / 2, (leftHip[1] + rightHip[1]) / 2, (leftHip[2] + rightHip[2]) / 2]
    // Slowly follow the measured torso so one bad frame can't stretch it.
    torso += (Math.hypot(mid[0] - hipMid[0], mid[1] - hipMid[1], mid[2] - hipMid[2]) - torso) * 0.05
  } else {
    // Hips out of frame: straight down from the shoulders, and forget their filters.
    filters.delete(LEFT_HIP)
    filters.delete(RIGHT_HIP)
    leftHip = [mid[0] - HIP_HALF_WIDTH, mid[1] - torso, mid[2]]
    rightHip = [mid[0] + HIP_HALF_WIDTH, mid[1] - torso, mid[2]]
  }

  const nose = smooth(NOSE, raw[NOSE])
  const joints: Vec3[] = standingPose(leftHip, rightHip, nose)
  joints[LEFT_SHOULDER] = shoulders[0]
  joints[RIGHT_SHOULDER] = shoulders[1]
  for (const i of [LEFT_ELBOW, RIGHT_ELBOW, LEFT_WRIST, RIGHT_WRIST]) joints[i] = smooth(i, raw[i])
  // Pose's hand points (pinky, index, thumb) follow their wrist.
  for (const i of [17, 19, 21]) joints[i] = joints[LEFT_WRIST]
  for (const i of [18, 20, 22]) joints[i] = joints[RIGHT_WRIST]
  return { state: { filters, torso }, joints }
}

/** A fixed standing lower body under the hips, and the face points on the nose. */
function standingPose(leftHip: Vec3, rightHip: Vec3, nose: Vec3): Vec3[] {
  const j: Vec3[] = Array.from({ length: 33 }, () => nose)
  const below = (hip: Vec3, down: number, forward: number): Vec3 => [hip[0], hip[1] - down, hip[2] + forward]
  j[LEFT_HIP] = leftHip
  j[RIGHT_HIP] = rightHip
  j[25] = below(leftHip, 0.45, 0.02)
  j[26] = below(rightHip, 0.45, 0.02)
  j[27] = below(leftHip, 0.9, 0)
  j[28] = below(rightHip, 0.9, 0)
  j[29] = below(leftHip, 0.95, -0.05)
  j[30] = below(rightHip, 0.95, -0.05)
  j[31] = below(leftHip, 0.95, 0.12)
  j[32] = below(rightHip, 0.95, 0.12)
  return j
}
