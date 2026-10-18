/**
 * Lightsaber sound on the phone in the player's hand: a hum that rises with
 * swing speed, plus clash and hit cues. Synthesized with Web Audio, no files.
 * iOS has no vibration API in the browser, so sound carries the feel.
 */
export interface SaberAudio {
  /** Call from a tap: iOS only starts audio inside a user gesture. */
  start(): Promise<void>
  /** Angular speed in degrees/s from devicemotion. */
  setSpeed(degPerSec: number): void
  clash(): void
  hit(): void
  /** A setup step passed. */
  chime(): void
  /** A swipe was sent: a quick step. */
  whoosh(): void
  /** A step was refused: the center line or the back of your side. */
  thud(): void
  hurt(): void
}

export function createSaberAudio(): SaberAudio {
  let ctx: AudioContext | null = null
  let hum: { a: OscillatorNode; b: OscillatorNode; filter: BiquadFilterNode; gain: GainNode } | null = null

  function noiseBurst(c: AudioContext, seconds: number, freq: number, peak: number) {
    const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
    const source = c.createBufferSource()
    source.buffer = buffer
    const band = c.createBiquadFilter()
    band.type = "bandpass"
    band.frequency.value = freq
    const gain = c.createGain()
    gain.gain.value = peak
    source.connect(band).connect(gain).connect(c.destination)
    source.start()
  }

  function tone(c: AudioContext, from: number, to: number, seconds: number, peak: number, type: OscillatorType) {
    const osc = c.createOscillator()
    osc.type = type
    const gain = c.createGain()
    const t = c.currentTime
    osc.frequency.setValueAtTime(from, t)
    osc.frequency.exponentialRampToValueAtTime(to, t + seconds)
    gain.gain.setValueAtTime(peak, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + seconds)
    osc.connect(gain).connect(c.destination)
    osc.start(t)
    osc.stop(t + seconds)
  }

  return {
    async start() {
      ctx ??= new AudioContext()
      await ctx.resume()
      if (hum) return
      const a = ctx.createOscillator()
      const b = ctx.createOscillator()
      a.type = "sawtooth"
      b.type = "sawtooth"
      a.frequency.value = 85
      b.frequency.value = 87.5
      const filter = ctx.createBiquadFilter()
      filter.type = "lowpass"
      filter.frequency.value = 420
      const gain = ctx.createGain()
      gain.gain.value = 0.12
      a.connect(filter)
      b.connect(filter)
      filter.connect(gain).connect(ctx.destination)
      a.start()
      b.start()
      hum = { a, b, filter, gain }
    },
    setSpeed(degPerSec) {
      if (!ctx || !hum) return
      const s = Math.min(1, degPerSec / 600)
      const t = ctx.currentTime
      hum.a.frequency.setTargetAtTime(85 * (1 + 0.5 * s), t, 0.03)
      hum.b.frequency.setTargetAtTime(87.5 * (1 + 0.5 * s), t, 0.03)
      hum.filter.frequency.setTargetAtTime(420 + 2600 * s, t, 0.03)
      hum.gain.gain.setTargetAtTime(0.12 + 0.3 * s, t, 0.03)
    },
    clash() {
      if (!ctx) return
      noiseBurst(ctx, 0.18, 3200, 0.9)
      tone(ctx, 1900, 900, 0.25, 0.25, "square")
    },
    hit() {
      if (!ctx) return
      noiseBurst(ctx, 0.25, 900, 0.7)
      tone(ctx, 220, 70, 0.3, 0.4, "sawtooth")
    },
    hurt() {
      if (!ctx) return
      tone(ctx, 140, 50, 0.4, 0.5, "sine")
    },
    chime() {
      if (!ctx) return
      tone(ctx, 880, 1320, 0.18, 0.3, "sine")
    },
    whoosh() {
      if (!ctx) return
      noiseBurst(ctx, 0.12, 1400, 0.35)
    },
    thud() {
      if (!ctx) return
      tone(ctx, 110, 60, 0.18, 0.5, "triangle")
    },
  }
}
