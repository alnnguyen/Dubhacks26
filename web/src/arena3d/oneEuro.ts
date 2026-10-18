/**
 * One Euro filter (Casiez et al., CHI 2012): smooths hard when a signal is
 * still and barely at all when it moves fast, so tracking stops jittering
 * without lagging a quick swing. One filter per number.
 */
export type OneEuroParams = {
  /** Smoothing at rest, in Hz: lower is steadier. */
  minCutoff: number
  /** How quickly smoothing relaxes as speed rises: higher is snappier. */
  beta: number
  /** Cutoff for the speed estimate itself. */
  dCutoff: number
}

export type OneEuro = { value: number; speed: number; atMs: number } | null

const alpha = (cutoffHz: number, dtSec: number) => {
  const tau = 1 / (2 * Math.PI * cutoffHz)
  return 1 / (1 + tau / dtSec)
}

export function oneEuro(state: OneEuro, value: number, nowMs: number, p: OneEuroParams): OneEuro {
  if (!state) return { value, speed: 0, atMs: nowMs }
  const dt = Math.max(1e-3, (nowMs - state.atMs) / 1000)
  const rawSpeed = (value - state.value) / dt
  const speed = state.speed + alpha(p.dCutoff, dt) * (rawSpeed - state.speed)
  const cutoff = p.minCutoff + p.beta * Math.abs(speed)
  return { value: state.value + alpha(cutoff, dt) * (value - state.value), speed, atMs: nowMs }
}
