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
 * People mask for compositing real players into the arena, from PoseLandmarker
 * segmentation (no extra model). Masks of all tracked people are merged,
 * downsampled to a small R8 texture, temporally smoothed, and faded out when
 * nobody is tracked.
 */
export class PersonMask {
  width = TARGET_WIDTH
  height = 1
  data = new Uint8Array(TARGET_WIDTH)
  private smooth = new Float32Array(TARGET_WIDTH)
  private pose = new Float32Array(TARGET_WIDTH)
  readonly texture: THREE.DataTexture
  /** 0..1 how present people are (fades when tracking is lost). */
  presence = 0
  /** True once pose-mask readback has failed repeatedly (e.g. unsupported GPU). */
  failed = false
  /** Total masks consumed (for diagnostics). */
  updates = 0
  private failures = 0
  private lastUpdateMs = 0
  private lastTickMs = 0

  constructor() {
    this.texture = new THREE.DataTexture(this.data, this.width, this.height, THREE.RedFormat, THREE.UnsignedByteType)
    this.texture.magFilter = THREE.LinearFilter
    this.texture.minFilter = THREE.LinearFilter
    this.texture.flipY = false
    this.texture.needsUpdate = true
  }

  private ensureSize(srcW: number, srcH: number) {
    const w = TARGET_WIDTH
    const h = Math.max(1, Math.round((srcH / srcW) * w))
    if (w === this.width && h === this.height) return
    this.width = w
    this.height = h
    const n = w * h
    this.data = new Uint8Array(n)
    this.smooth = new Float32Array(n)
    this.pose = new Float32Array(n)
    this.texture.image = { data: this.data, width: w, height: h }
    this.texture.dispose() // re-allocate at the new size
    this.texture.needsUpdate = true
  }

  /** Nearest-neighbour downsample of a srcW×srcH source into `dst` via `read(index)`. */
  private sample(dst: Float32Array, srcW: number, srcH: number, read: (i: number) => number) {
    const sx = srcW / this.width
    const sy = srcH / this.height
    for (let y = 0; y < this.height; y++) {
      const row = Math.min(srcH - 1, Math.floor((y + 0.5) * sy)) * srcW
      for (let x = 0; x < this.width; x++) {
        dst[y * this.width + x] = read(row + Math.min(srcW - 1, Math.floor((x + 0.5) * sx)))
      }
    }
  }

  private compose(nowMs: number) {
    for (let i = 0; i < this.data.length; i++) {
      const v = this.pose[i]
      // Asymmetric smoothing: grow fast (no lag on movement), shrink slower (no flicker).
      const k = v > this.smooth[i] ? 0.75 : 0.45
      this.smooth[i] += (v - this.smooth[i]) * k
      this.data[i] = this.smooth[i] * 255
    }
    this.texture.needsUpdate = true
    this.lastUpdateMs = nowMs
    this.presence = 1
    this.updates++
  }

  /** Pose segmentation masks (one per tracked person). Closes them. Never throws. */
  update(masks: MaskLike[] | undefined, nowMs: number) {
    try {
      const first = masks?.[0]
      if (!first || !masks) return
      this.ensureSize(first.width, first.height)
      const sources = masks.map((m) => m.getAsFloat32Array())
      this.sample(this.pose, first.width, first.height, (j) => {
        let v = sources[0][j]
        for (let k = 1; k < sources.length; k++) if (sources[k][j] > v) v = sources[k][j]
        return v
      })
      this.failures = 0
      this.compose(nowMs)
    } catch (err) {
      if (++this.failures >= 5 && !this.failed) {
        this.failed = true
        console.warn('Person segmentation unavailable; showing the camera instead.', err)
      }
    } finally {
      masks?.forEach((m) => m.close())
    }
  }

  /**
   * Call every frame. The mask is held while someone is tracked (masks arrive
   * at inference rate, which can be slow on weak devices); it fades when
   * nobody is tracked or nothing has arrived for 3 s.
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
