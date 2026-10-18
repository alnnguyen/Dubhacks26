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

export type OverlayDrawOptions = {
  /** When false, skip full hand skeletons (duel presentation). Default true. */
  showLandmarks?: boolean
  /** Rival health 0–100 for pose-anchored bar. Default 100. */
  rivalHealth?: number
  /** Slightly larger rock for duel readability. */
  rockScale?: number
}

export function drawRock3d(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  rock: DrawRock,
  scaleMultiplier = 1,
) {
  const x = rock.point.x * width
  const y = rock.point.y * height
  const base = Math.max(18, Math.min(width, height) * 0.048)
  const radius = base * rock.scale * scaleMultiplier

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
  ctx.lineWidth = (rock.kind === "active" ? 3 : 2) * scaleMultiplier
  ctx.stroke()
  if (rock.kind === "active") {
    ctx.beginPath()
    ctx.strokeStyle = "rgba(255, 180, 80, 0.35)"
    ctx.lineWidth = 6 * scaleMultiplier
    ctx.arc(x, y, radius + 3 * scaleMultiplier, 0, Math.PI * 2)
    ctx.stroke()
  }
}

/** @deprecated prefer drawRock3d */
export function drawRock(ctx: CanvasRenderingContext2D, width: number, height: number, point: Point, scale = 1) {
  drawRock3d(ctx, width, height, {
    id: "legacy",
    point,
    scale,
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
  options: OverlayDrawOptions = {},
) {
  const showLandmarks = options.showLandmarks !== false
  const rivalHealth = Math.max(0, Math.min(100, options.rivalHealth ?? 100))
  const rockScale = options.rockScale ?? 1

  ctx.clearRect(0, 0, width, height)

  const bandTop = height * 0.82
  const ground = ctx.createLinearGradient(0, bandTop, 0, height)
  ground.addColorStop(0, "rgba(40, 28, 16, 0)")
  ground.addColorStop(0.45, "rgba(55, 38, 20, 0.35)")
  ground.addColorStop(1, "rgba(20, 14, 8, 0.55)")
  ctx.fillStyle = ground
  ctx.fillRect(0, bandTop, width, height - bandTop)

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

  const ordered = [...rocks].sort(
    (a, b) => (a.kind === "active" ? 1 : 0) - (b.kind === "active" ? 1 : 0),
  )
  for (const rock of ordered) drawRock3d(ctx, width, height, rock, rockScale)
}
