import type { HandTrack, Point } from "../vision/types"
import type { PoseOverlay } from "./mediapipeVision"
import { healthAnchor } from "../overlay/rockArc"

const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
]

export function drawRock(ctx: CanvasRenderingContext2D, width: number, height: number, point: Point) {
  const x = point.x * width
  const y = point.y * height
  const radius = Math.max(14, Math.min(width, height) * 0.035)
  const gradient = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, radius * 0.2, x, y, radius)
  gradient.addColorStop(0, "#d9c4a0")
  gradient.addColorStop(0.55, "#8a6a45")
  gradient.addColorStop(1, "#3d2a18")
  ctx.beginPath()
  ctx.fillStyle = gradient
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)"
  ctx.lineWidth = 2
  ctx.stroke()
}

export function drawCameraOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  hands: HandTrack[],
  ownHandId: string | null,
  pose: PoseOverlay | null,
  rockAt: Point | null = null,
) {
  ctx.clearRect(0, 0, width, height)

  for (const hand of hands) {
    const isOwn = hand.id === ownHandId
    ctx.strokeStyle = isOwn ? "#3dff9a" : "#ffb347"
    ctx.fillStyle = ctx.strokeStyle
    ctx.lineWidth = isOwn ? 3 : 2
    for (const [a, b] of HAND_CONNECTIONS) {
      const pa = hand.landmarks[a]
      const pb = hand.landmarks[b]
      if (!pa || !pb) continue
      ctx.beginPath()
      ctx.moveTo(pa.x * width, pa.y * height)
      ctx.lineTo(pb.x * width, pb.y * height)
      ctx.stroke()
    }
    for (const point of hand.landmarks) {
      ctx.beginPath()
      ctx.arc(point.x * width, point.y * height, isOwn ? 4 : 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  if (pose) {
    const anchor = healthAnchor(pose.leftShoulder, pose.rightShoulder)
    if (anchor) {
      const x = anchor.x * width
      const y = anchor.y * height - 28
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)"
      ctx.fillRect(x - 54, y - 10, 108, 16)
      ctx.fillStyle = "#4ade80"
      ctx.fillRect(x - 52, y - 8, 104, 12)
      ctx.strokeStyle = "#ffffff"
      ctx.lineWidth = 1
      ctx.strokeRect(x - 54, y - 10, 108, 16)
    }
  }

  if (rockAt) drawRock(ctx, width, height, rockAt)
}
