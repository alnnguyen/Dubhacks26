import type { HandTrack, Point } from "../vision/types"
import type { PoseOverlay } from "./mediapipeVision"
import { healthAnchor } from "../overlay/rockArc"
import type { DrawRock } from "../overlay/rockVisual"

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

export function drawRock3d(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  rock: DrawRock,
) {
  const x = rock.point.x * width
  const y = rock.point.y * height
  const base = Math.max(18, Math.min(width, height) * 0.048)
  const radius = base * rock.scale

  // Contact shadow on the fake ground plane — offset grows as the rock lifts.
  const shadowY = Math.min(height * 0.93, y + radius * 0.35 + rock.lift * height * 0.04)
  const shadowW = radius * (1.35 - rock.lift * 0.55)
  const shadowH = radius * (0.38 - rock.lift * 0.18)
  ctx.beginPath()
  ctx.fillStyle = `rgba(0, 0, 0, ${0.35 - rock.lift * 0.18})`
  ctx.ellipse(x, shadowY, Math.max(4, shadowW), Math.max(2, shadowH), 0, 0, Math.PI * 2)
  ctx.fill()

  const gradient = ctx.createRadialGradient(
    x - radius * 0.35,
    y - radius * 0.4,
    radius * 0.15,
    x,
    y,
    radius,
  )
  gradient.addColorStop(0, "#e6d3b0")
  gradient.addColorStop(0.45, "#a07a48")
  gradient.addColorStop(1, "#3a2716")
  ctx.beginPath()
  ctx.fillStyle = gradient
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = rock.kind === "active" ? "rgba(255, 230, 160, 0.7)" : "rgba(255, 255, 255, 0.3)"
  ctx.lineWidth = rock.kind === "active" ? 3 : 2
  ctx.stroke()
}

/** @deprecated prefer drawRock3d */
export function drawRock(ctx: CanvasRenderingContext2D, width: number, height: number, point: Point) {
  drawRock3d(ctx, width, height, {
    id: "legacy",
    point,
    scale: 1,
    lift: 0.5,
    kind: "active",
  })
}

export function drawCameraOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  hands: HandTrack[],
  ownHandId: string | null,
  pose: PoseOverlay | null,
  rocks: DrawRock[] = [],
) {
  ctx.clearRect(0, 0, width, height)

  // Soft ground band so the "terrain" read is obvious on a phone.
  const bandTop = height * 0.82
  const ground = ctx.createLinearGradient(0, bandTop, 0, height)
  ground.addColorStop(0, "rgba(40, 28, 16, 0)")
  ground.addColorStop(0.45, "rgba(55, 38, 20, 0.35)")
  ground.addColorStop(1, "rgba(20, 14, 8, 0.55)")
  ctx.fillStyle = ground
  ctx.fillRect(0, bandTop, width, height - bandTop)

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

  // Draw ground rocks first, then the active rock on top.
  const ordered = [...rocks].sort((a, b) => (a.kind === "active" ? 1 : 0) - (b.kind === "active" ? 1 : 0))
  for (const rock of ordered) drawRock3d(ctx, width, height, rock)
}
