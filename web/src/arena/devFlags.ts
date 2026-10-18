/**
 * Live toggles and stats for the /?dev=mars view. Read every frame by the
 * cutout; written by the dev panel. No effect unless something changes them.
 */
export const arenaDev = {
  /** Paint the raw person mask in red over the camera image. */
  showMask: false,
  /** Show the full camera instead of the Mars cutout. */
  showCamera: false,
  /** Run the DeepLab all-people segmenter (heaviest model; toggle to compare). */
  sceneSegmentation: true,
  stats: {
    renderFps: 0,
    maskFps: 0,
    presence: 0,
    /** People found by pose in the last frame. */
    people: 0,
    segmentation: 'waiting' as 'waiting' | 'ok' | 'failed',
  },
}

/**
 * Immersive view zoom. The camera prefers the 0.5× ultra-wide lens (so the
 * near hand and far opponent both fit), which makes people small. This scales
 * the opponent cutout AND the 2D rock overlay together around the same anchor,
 * so rocks stay aligned. Vision still analyzes the full wide frame.
 */
export const arenaView = {
  zoom: readZoom(),
  /** Zoom anchor in screen space (fraction from left, from top). */
  anchor: { x: 0.5, y: 0.55 },
}

function readZoom() {
  try {
    const v = Number(localStorage.getItem('mars.viewZoom'))
    if (v >= 1 && v <= 2.5) return v
  } catch {
    /* storage unavailable */
  }
  return 1.35
}

export function setArenaZoom(zoom: number) {
  arenaView.zoom = Math.min(2.5, Math.max(1, zoom))
  applyArenaZoomCss()
  try {
    localStorage.setItem('mars.viewZoom', String(arenaView.zoom))
  } catch {
    /* ignore */
  }
}

export function applyArenaZoomCss() {
  const s = document.documentElement.style
  s.setProperty('--mars-zoom', String(arenaView.zoom))
  s.setProperty('--mars-zoom-origin', `${arenaView.anchor.x * 100}% ${arenaView.anchor.y * 100}%`)
}
