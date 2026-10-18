/**
 * Lightsaber sound on the phone in the player's hand: a hum that rises with
 * swing speed, plus clash / hit / block cues from the supplied samples (synth
 * fallback if a file cannot load). iOS has no vibration API in the browser, so
 * sound carries the feel.
 */
export interface SaberAudio {
  /** Call from a tap: iOS only starts audio inside a user gesture. */
  start(): Promise<void>
  /** Angular speed in degrees/s from devicemotion. */
  setSpeed(degPerSec: number): void
  clash(): void
  hit(): void
  block(): void
  /** Finishing knockout blow. */
  ko(): void
  /** A setup step passed. */
  chime(): void
  /** A swipe was sent: a quick step. */
  whoosh(): void
  /** A step was refused: the center line or the back of your side. */
  thud(): void
  hurt(): void
  /** Silences every sound until unmuted, e.g. on the result screen while a rematch is still possible. */
  setMuted(muted: boolean): void
  /** Silences the hum and releases the audio hardware for good. */
  stop(): void
}

type SampleId = "clash" | "hit" | "block" | "ko"

const SAMPLE_FILES: Record<SampleId, string> = {
  clash: "saber_clash_c",
  hit: "saber_hit_b",
  block: "saber_block_a",
  ko: "saber_ko_hit",
}

export function createSaberAudio(): SaberAudio {
  let ctx: AudioContext | null = null
  let hum: { a: OscillatorNode; b: OscillatorNode; filter: BiquadFilterNode; gain: GainNode } | null = null
  let muted = false
  const samples = new Map<SampleId, AudioBuffer>()

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

  function playSample(id: SampleId, volume: number) {
    if (!ctx || muted) return false
    const buffer = samples.get(id)
    if (!buffer) return false
    const source = ctx.createBufferSource()
    const gain = ctx.createGain()
    source.buffer = buffer
    gain.gain.value = volume
    source.connect(gain).connect(ctx.destination)
    source.start()
    return true
  }

  async function loadSamples(c: AudioContext) {
    const base = `${import.meta.env.BASE_URL}sfx/impact/`
    await Promise.all((Object.keys(SAMPLE_FILES) as SampleId[]).map(async (id) => {
      if (samples.has(id)) return
      for (const ext of ["mp3", "webm"] as const) {
        try {
          const response = await fetch(`${base}${SAMPLE_FILES[id]}.${ext}`)
          if (!response.ok) continue
          samples.set(id, await c.decodeAudioData(await response.arrayBuffer()))
          return
        } catch { /* try the other container */ }
      }
    }))
  }

  return {
    async start() {
      ctx ??= new AudioContext()
      await ctx.resume()
      await loadSamples(ctx)
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
      gain.gain.value = muted ? 0 : 0.12
      a.connect(filter)
      b.connect(filter)
      filter.connect(gain).connect(ctx.destination)
      a.start()
      b.start()
      hum = { a, b, filter, gain }
    },
    setSpeed(degPerSec) {
      if (!ctx || !hum || muted) return
      const s = Math.min(1, degPerSec / 600)
      const t = ctx.currentTime
      hum.a.frequency.setTargetAtTime(85 * (1 + 0.5 * s), t, 0.03)
      hum.b.frequency.setTargetAtTime(87.5 * (1 + 0.5 * s), t, 0.03)
      hum.filter.frequency.setTargetAtTime(420 + 2600 * s, t, 0.03)
      hum.gain.gain.setTargetAtTime(0.12 + 0.3 * s, t, 0.03)
    },
    clash() {
      if (!ctx || muted) return
      if (!playSample("clash", 0.7)) {
        noiseBurst(ctx, 0.18, 3200, 0.9)
        tone(ctx, 1900, 900, 0.25, 0.25, "square")
      }
    },
    hit() {
      if (!ctx || muted) return
      // Hit + clash together: damage and blade contact.
      const hadHit = playSample("hit", 0.75)
      playSample("clash", 0.4)
      if (!hadHit) {
        noiseBurst(ctx, 0.25, 900, 0.7)
        tone(ctx, 220, 70, 0.3, 0.4, "sawtooth")
      }
    },
    block() {
      if (!ctx || muted) return
      if (!playSample("block", 0.72)) {
        noiseBurst(ctx, 0.14, 2400, 0.7)
        tone(ctx, 1400, 700, 0.2, 0.22, "square")
      }
    },
    ko() {
      if (!ctx || muted) return
      if (!playSample("ko", 0.85)) {
        noiseBurst(ctx, 0.4, 600, 0.85)
        tone(ctx, 180, 45, 0.55, 0.55, "sawtooth")
      }
    },
    hurt() {
      if (!ctx || muted) return
      if (!playSample("hit", 0.55)) tone(ctx, 140, 50, 0.4, 0.5, "sine")
    },
    chime() {
      if (!ctx || muted) return
      tone(ctx, 880, 1320, 0.18, 0.3, "sine")
    },
    whoosh() {
      if (!ctx || muted) return
      noiseBurst(ctx, 0.12, 1400, 0.35)
    },
    thud() {
      if (!ctx || muted) return
      tone(ctx, 110, 60, 0.18, 0.5, "triangle")
    },
    setMuted(next) {
      muted = next
      if (!ctx || !hum) return
      // The next setSpeed brings the hum back to its swing level.
      hum.gain.gain.setTargetAtTime(muted ? 0 : 0.12, ctx.currentTime, 0.03)
    },
    stop() {
      void ctx?.close()
      ctx = null
      hum = null
      samples.clear()
    },
  }
}
