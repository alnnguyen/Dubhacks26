/**
 * NASA MOLA elevation (see public/arena/mars/jezero_mola.json) plus documented
 * procedural detail. One CPU height function drives the terrain mesh, rock
 * placement and obstacle grounding so everything sits on the same surface.
 */

export interface MolaMeta {
  outputSize: number
  spanKm: number
  elevationMinM: number
  elevationMaxM: number
  centerLatDeg: number
  centerLonDegE: number
  spanDeg: number
}

export interface MolaGrid {
  meta: MolaMeta
  size: number
  /** Elevation in meters relative to the Mars areoid, row 0 = north. */
  elevation: Float32Array
}

const BASE = '/arena/mars/'

/** Decodes the 16-bit grayscale PNG written by scripts/mars/crop_mola.py (filter type 0 rows). */
async function decodePng16(buf: ArrayBuffer): Promise<{ width: number; height: number; values: Uint16Array }> {
  const bytes = new Uint8Array(buf)
  const view = new DataView(buf)
  let pos = 8
  let width = 0
  let height = 0
  const idat: Uint8Array[] = []
  while (pos < bytes.length) {
    const len = view.getUint32(pos)
    const type = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8))
    const body = bytes.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      width = view.getUint32(pos + 8)
      height = view.getUint32(pos + 12)
      if (body[8] !== 16 || body[9] !== 0) throw new Error('Expected 16-bit grayscale PNG')
    } else if (type === 'IDAT') idat.push(body)
    else if (type === 'IEND') break
    pos += 12 + len
  }
  const stream = new Blob(idat as BlobPart[]).stream().pipeThrough(new DecompressionStream('deflate'))
  const raw = new Uint8Array(await new Response(stream).arrayBuffer())
  const values = new Uint16Array(width * height)
  const stride = width * 2 + 1
  for (let y = 0; y < height; y++) {
    if (raw[y * stride] !== 0) throw new Error('Unsupported PNG row filter')
    for (let x = 0; x < width; x++) {
      const i = y * stride + 1 + x * 2
      values[y * width + x] = (raw[i] << 8) | raw[i + 1]
    }
  }
  return { width, height, values }
}

let molaPromise: Promise<MolaGrid> | null = null

export function loadMola(): Promise<MolaGrid> {
  molaPromise ??= (async () => {
    const [meta, png] = await Promise.all([
      fetch(BASE + 'jezero_mola.json').then((r) => {
        if (!r.ok) throw new Error(`Mars metadata request failed: ${r.status}`)
        return r.json() as Promise<MolaMeta>
      }),
      fetch(BASE + 'jezero_mola.png').then((r) => {
        if (!r.ok) throw new Error(`Mars heightmap request failed: ${r.status}`)
        return r.arrayBuffer()
      }).then(decodePng16),
    ])
    const range = meta.elevationMaxM - meta.elevationMinM
    const elevation = new Float32Array(png.values.length)
    for (let i = 0; i < elevation.length; i++) elevation[i] = meta.elevationMinM + (png.values[i] / 65535) * range
    return { meta, size: png.width, elevation }
  })()
  return molaPromise
}

// ---------------------------------------------------------------------------
// Scene mapping
// ---------------------------------------------------------------------------

/**
 * Horizontal scale: real meters → scene meters for the distant MOLA terrain.
 * Angular size is preserved (heights scale equally), so the crater rim sits
 * on the horizon at the true viewing angle while the scene stays small.
 */
export const MOLA_SCALE = 1 / 40
/** Mild vertical exaggeration of the MOLA relief, documented in docs/mars-arena.md. */
export const VERTICAL_EXAGGERATION = 2.6
/** Player spawn: Perseverance landing site, Octavia E. Butler Landing (18.4447 N, 77.4508 E). */
export const SPAWN = { latDeg: 18.4447, lonDegE: 77.4508 }

/** Procedural detail fades out beyond this radius (scene meters). */
const DETAIL_RADIUS = 90
/** Keeps the duel floor gently rolling rather than steep. */
const ARENA_FLAT_RADIUS = 9

function hash2(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}

function valueNoise(x: number, y: number) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const a = hash2(xi, yi)
  const b = hash2(xi + 1, yi)
  const c = hash2(xi, yi + 1)
  const d = hash2(xi + 1, yi + 1)
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1
}

export function fbm(x: number, y: number, octaves = 5) {
  let sum = 0
  let amp = 0.5
  let f = 1
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * f, y * f)
    f *= 2.03
    amp *= 0.5
  }
  return sum
}

/** Ridged noise for eroded, wind-carved ridges (yardang-like). */
function ridged(x: number, y: number) {
  let sum = 0
  let amp = 0.5
  let f = 1
  for (let i = 0; i < 4; i++) {
    const n = 1 - Math.abs(valueNoise(x * f, y * f))
    sum += amp * n * n
    f *= 2.1
    amp *= 0.5
  }
  return sum
}

/** The embedded combat platform: walkable top radius and the regolith berm that buries its rim. */
export const MARS_PLATFORM = { radius: 12, bermWidth: 14 }

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

export interface TerrainSampler {
  /** Walkable scene height (meters) at x (east), z (south); the platform floor inside its radius. */
  heightAt(x: number, z: number): number
  /** Height of the regolith surface itself (dips under the platform); used for the terrain mesh. */
  groundAt(x: number, z: number): number
  /** Height of the platform's central fighting floor. */
  floorY: number
  /** True when (x, z) is inside the MOLA crop. */
  inBounds(x: number, z: number): boolean
  /** Scene half-extent of the MOLA terrain. */
  halfExtent: number
}

export function createTerrainSampler(grid: MolaGrid): TerrainSampler {
  const { meta, size, elevation } = grid
  const pxPerDeg = size / meta.spanDeg
  const kmPerDeg = (meta.spanKm / meta.spanDeg)
  const scenePerPx = ((kmPerDeg * 1000) / pxPerDeg) * MOLA_SCALE
  // Pixel coordinates of the spawn point (row 0 = north edge, col 0 = west edge).
  const spawnCol = (SPAWN.lonDegE - (meta.centerLonDegE - meta.spanDeg / 2)) * pxPerDeg
  const spawnRow = (meta.centerLatDeg + meta.spanDeg / 2 - SPAWN.latDeg) * pxPerDeg

  const sampleRaw = (col: number, row: number) => {
    const c = Math.min(Math.max(col, 0), size - 1.001)
    const r = Math.min(Math.max(row, 0), size - 1.001)
    const c0 = Math.floor(c)
    const r0 = Math.floor(r)
    const tc = c - c0
    const tr = r - r0
    const i = r0 * size + c0
    const top = elevation[i] * (1 - tc) + elevation[i + 1] * tc
    const bot = elevation[i + size] * (1 - tc) + elevation[i + size + 1] * tc
    return top * (1 - tr) + bot * tr
  }
  const spawnElevation = sampleRaw(spawnCol, spawnRow)
  const halfExtent = (size / 2) * scenePerPx

  const molaHeight = (x: number, z: number) => {
    const col = spawnCol + x / scenePerPx
    const row = spawnRow + z / scenePerPx
    return (sampleRaw(col, row) - spawnElevation) * MOLA_SCALE * VERTICAL_EXAGGERATION
  }

  const natural = (x: number, z: number) => {
    const r = Math.hypot(x, z)
    // Procedural (non-NASA) detail: rolling regolith, small ridges, sand swales.
    const near = Math.max(0, 1 - r / DETAIL_RADIUS)
    const flatten = Math.min(1, Math.max(0.25, (r - 2) / ARENA_FLAT_RADIUS))
    const rolling = fbm(x * 0.045, z * 0.045, 5) * 2.6
    const ridges = (ridged(x * 0.018 + 4.1, z * 0.03 - 2.7) - 0.35) * 3.2
    const fine = fbm(x * 0.35, z * 0.35, 3) * 0.12
    const detail = (rolling + ridges * near) * flatten + fine
    // Mid-distance hills fill the gap between the arena and the MOLA rim.
    const mid = Math.max(0, (r - 40) / 160)
    const hills = Math.min(mid, 1) * (fbm(x * 0.006 + 9, z * 0.006 - 3, 4) + 0.35) * 22
    return molaHeight(x, z) + detail + hills
  }
  const floorY = natural(0, 0)
  const R = MARS_PLATFORM.radius
  // Outside the platform: a drift of regolith piled against the rim, easing back into the real terrain.
  const surrounding = (x: number, z: number, r: number) => {
    const berm = floorY + 0.55 * Math.exp(-(((r - (R + 0.9)) / 1.5) ** 2)) + (fbm(x * 0.4, z * 0.4, 2) * 0.12)
    return berm + (natural(x, z) - berm) * smooth(R + 1.2, R + MARS_PLATFORM.bermWidth, r)
  }

  return {
    halfExtent,
    floorY,
    groundAt(x, z) {
      const r = Math.hypot(x, z)
      return r < R - 0.4 ? floorY - 1.2 : surrounding(x, z, Math.max(r, R))
    },
    inBounds(x, z) {
      const col = spawnCol + x / scenePerPx
      const row = spawnRow + z / scenePerPx
      return col >= 0 && row >= 0 && col < size && row < size
    },
    heightAt(x, z) {
      const r = Math.hypot(x, z)
      return r <= R ? floorY : surrounding(x, z, r)
    },
  }
}
