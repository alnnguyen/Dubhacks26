import type { HandTrack, Point } from "../vision/types"
import type { PoseOverlay } from "./mediapipeVision"
import type { DrawTracer } from "../overlay/bulletTracer"
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
  /** Gun bolt progress 0..1 toward the opponent anchor. Null hides it. */
  bolt?: { progress: number; to: Point; from?: Point } | null
  /** Live forward tracers (preferred over a single bolt). */
  tracers?: DrawTracer[]
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

/** Screen-space bolt. Damage stays on the server; this only shows travel. */
export function drawBolt(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  progress: number,
  to: Point,
  from: Point = { x: 0.5, y: 0.78 },
) {
  const t = Math.min(1, Math.max(0, progress))
  const ease = 1 - (1 - t) * (1 - t)
  const tip = {
    x: from.x + (to.x - from.x) * ease,
    y: from.y + (to.y - from.y) * ease,
  }
  const trail = 0.1 + 0.1 * (1 - ease)
  const tailT = Math.max(0, ease - trail)
  const tail = {
    x: from.x + (to.x - from.x) * tailT,
    y: from.y + (to.y - from.y) * tailT,
  }
  drawTracer(ctx, width, height, {
    tip,
    tail,
    scale: 1.35 - 1.05 * ease,
    alpha: 1,
    progress: ease,
  })
}

/** First-person tracer: streak + tip that shrink as they travel into the scene. */
export function drawTracer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  tracer: DrawTracer,
) {
  const x0 = tracer.tail.x * width
  const y0 = tracer.tail.y * height
  const x1 = tracer.tip.x * width
  const y1 = tracer.tip.y * height
  const a = Math.max(0, Math.min(1, tracer.alpha))
  const lineW = Math.max(2, 7 * tracer.scale)

  ctx.save()
  ctx.globalAlpha = a
  ctx.lineCap = "round"

  // Soft outer glow — reads as energy travel into depth.
  const glow = ctx.createLinearGradient(x0, y0, x1, y1)
  glow.addColorStop(0, "rgba(80, 180, 255, 0)")
  glow.addColorStop(0.45, "rgba(90, 210, 255, 0.35)")
  glow.addColorStop(1, "rgba(230, 250, 255, 0.9)")
  ctx.beginPath()
  ctx.strokeStyle = glow
  ctx.lineWidth = lineW * 2.4
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()

  // Hot core streak.
  const core = ctx.createLinearGradient(x0, y0, x1, y1)
  core.addColorStop(0, "rgba(120, 220, 255, 0.15)")
  core.addColorStop(0.55, "rgba(180, 240, 255, 0.85)")
  core.addColorStop(1, "#ffffff")
  ctx.beginPath()
  ctx.strokeStyle = core
  ctx.lineWidth = lineW
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()

  // Tip bloom (large near muzzle, tiny at impact).
  const tipR = Math.max(2.5, 11 * tracer.scale)
  const tipGlow = ctx.createRadialGradient(x1, y1, 0, x1, y1, tipR * 2.2)
  tipGlow.addColorStop(0, "rgba(255, 255, 255, 0.95)")
  tipGlow.addColorStop(0.35, "rgba(160, 230, 255, 0.7)")
  tipGlow.addColorStop(1, "rgba(80, 180, 255, 0)")
  ctx.beginPath()
  ctx.fillStyle = tipGlow
  ctx.arc(x1, y1, tipR * 2.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.fillStyle = "#f4fcff"
  ctx.arc(x1, y1, tipR * 0.55, 0, Math.PI * 2)
  ctx.fill()

  // Muzzle flash while the round is still leaving the hand.
  if (tracer.progress < 0.12) {
    const mx = tracer.tail.x * width
    const my = tracer.tail.y * height
    const flash = 1 - tracer.progress / 0.12
    ctx.beginPath()
    ctx.fillStyle = `rgba(255, 230, 160, ${0.55 * flash * a})`
    ctx.arc(mx, my, 10 + 18 * flash, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
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
  if (options.tracers?.length) {
    for (const tracer of options.tracers) drawTracer(ctx, width, height, tracer)
  } else if (options.bolt) {
    drawBolt(ctx, width, height, options.bolt.progress, options.bolt.to, options.bolt.from)
  }
}
