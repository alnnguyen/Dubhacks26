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

export type OverlayDrawOptions = {
  /** When false, skip full hand skeletons (duel presentation). Default true. */
  showLandmarks?: boolean
  /** Rival health 0–100 for pose-anchored bar. Default 100. */
  rivalHealth?: number
  /** Slightly larger rock for duel readability. */
  rockScale?: number
}

export function drawRock(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  point: Point,
  scale = 1,
) {
  const x = point.x * width
  const y = point.y * height
  const radius = Math.max(14, Math.min(width, height) * 0.035) * scale
  const gradient = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, radius * 0.2, x, y, radius)
  gradient.addColorStop(0, "#e8d4b0")
  gradient.addColorStop(0.45, "#c49a5c")
  gradient.addColorStop(0.75, "#8a6a45")
  gradient.addColorStop(1, "#2a1a0c")
  ctx.beginPath()
  ctx.fillStyle = gradient
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = "rgba(255, 236, 180, 0.65)"
  ctx.lineWidth = 2.5 * scale
  ctx.stroke()
  // Soft glow for readability on bright camera frames.
  ctx.beginPath()
  ctx.strokeStyle = "rgba(255, 180, 80, 0.35)"
  ctx.lineWidth = 6 * scale
  ctx.arc(x, y, radius + 3 * scale, 0, Math.PI * 2)
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
  options: OverlayDrawOptions = {},
) {
  const showLandmarks = options.showLandmarks !== false
  const rivalHealth = Math.max(0, Math.min(100, options.rivalHealth ?? 100))
  const rockScale = options.rockScale ?? 1

  ctx.clearRect(0, 0, width, height)

  if (showLandmarks) {
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
  } else {
    // Duel: only a soft ring on the selected own hand so the rock stays readable.
    const own = hands.find((hand) => hand.id === ownHandId)
    if (own?.landmarks[9]) {
      const p = own.landmarks[9]
      const x = p.x * width
      const y = p.y * height
      ctx.beginPath()
      ctx.strokeStyle = "rgba(61, 255, 154, 0.55)"
      ctx.lineWidth = 2
      ctx.arc(x, y, Math.max(18, Math.min(width, height) * 0.04), 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  if (pose) {
    const anchor = healthAnchor(pose.leftShoulder, pose.rightShoulder)
    if (anchor) {
      const x = anchor.x * width
      const y = anchor.y * height - 28
      const barW = 120
      const barH = 14
      const fill = (rivalHealth / 100) * (barW - 4)
      ctx.fillStyle = "rgba(0, 0, 0, 0.65)"
      ctx.fillRect(x - barW / 2, y - 10, barW, barH + 4)
      ctx.fillStyle = rivalHealth > 35 ? "#4ade80" : rivalHealth > 15 ? "#f5bb65" : "#ff6b6b"
      ctx.fillRect(x - barW / 2 + 2, y - 8, fill, barH)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)"
      ctx.lineWidth = 1
      ctx.strokeRect(x - barW / 2, y - 10, barW, barH + 4)
    }
  }

  if (rockAt) drawRock(ctx, width, height, rockAt, rockScale)
}
