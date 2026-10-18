import * as THREE from 'three'

/** Minimal shape of MediaPipe's MPMask (avoid coupling to the class). */
export interface MaskLike {
  width: number
  height: number
  getAsFloat32Array(): Float32Array
  close(): void
}

const TARGET_WIDTH = 192

/**
 * Opponent mask for compositing the real person into the arena.
 * Fed from PoseLandmarker segmentation (no extra model). Downsampled to a
 * small R8 texture, temporally smoothed, and faded out when tracking drops.
 */
export class PersonMask {
  width = TARGET_WIDTH
  height = 1
  data = new Uint8Array(TARGET_WIDTH)
  private smooth = new Float32Array(TARGET_WIDTH)
  readonly texture: THREE.DataTexture
  /** 0..1 how present the person is (fades when pose is lost). */
  presence = 0
  private lastUpdateMs = 0

  constructor() {
    this.texture = this.makeTexture()
  }

  private makeTexture() {
    const t = new THREE.DataTexture(this.data, this.width, this.height, THREE.RedFormat, THREE.UnsignedByteType)
    t.magFilter = THREE.LinearFilter
    t.minFilter = THREE.LinearFilter
    t.flipY = false
    t.needsUpdate = true
    return t
  }

  private resize(w: number, h: number) {
    this.width = w
    this.height = h
    this.data = new Uint8Array(w * h)
    this.smooth = new Float32Array(w * h)
    this.texture.image = { data: this.data, width: w, height: h }
    this.texture.dispose() // forces re-allocation at the new size
    this.texture.needsUpdate = true
  }

  /** Consume (and close) masks from a PoseLandmarker result. */
  update(masks: MaskLike[] | undefined, nowMs: number) {
    const mask = masks?.[0]
    try {
      if (!mask) return
      const w = TARGET_WIDTH
      const h = Math.max(1, Math.round((mask.height / mask.width) * w))
      if (w !== this.width || h !== this.height) this.resize(w, h)
      const src = mask.getAsFloat32Array()
      const sx = mask.width / w
      const sy = mask.height / h
      for (let y = 0; y < h; y++) {
        const row = Math.min(mask.height - 1, Math.floor((y + 0.5) * sy)) * mask.width
        for (let x = 0; x < w; x++) {
          const v = src[row + Math.min(mask.width - 1, Math.floor((x + 0.5) * sx))]
          const i = y * w + x
          // Asymmetric smoothing: grow fast (no lag on movement), shrink a bit slower (no flicker).
          const k = v > this.smooth[i] ? 0.75 : 0.45
          this.smooth[i] += (v - this.smooth[i]) * k
          this.data[i] = this.smooth[i] * 255
        }
      }
      this.texture.needsUpdate = true
      this.lastUpdateMs = nowMs
      this.presence = 1
    } finally {
      masks?.forEach((m) => m.close())
    }
  }

  private lastTickMs = 0

  /**
   * Call every frame. The last mask is held while pose still tracks the person
   * (masks arrive at the pose rate, which can be slow on weak devices); it
   * fades when tracking is lost or nothing has arrived for 3 s.
   */
  tick(nowMs: number, personTracked: boolean) {
    const dt = this.lastTickMs ? Math.min(0.1, (nowMs - this.lastTickMs) / 1000) : 0
    this.lastTickMs = nowMs
    const stale = nowMs - this.lastUpdateMs > 3000
    if (!personTracked || stale) this.presence = Math.max(0, this.presence - dt * 2.5)
  }

  dispose() {
    this.texture.dispose()
  }
}
