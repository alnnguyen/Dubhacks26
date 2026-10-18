import { gameAudio } from '../../audio/gameAudio';
type OscillatorShape = OscillatorType;

export class PlanetarySound {
  private timeouts = new Set<number>();
  private voices = new Set<() => void>();

  unlock(): Promise<boolean> { return gameAudio.unlock(); }

  activation() {
    this.sweep(105, 480, 0.48, 'sine', 0.045);
    this.sweep(235, 720, 0.36, 'triangle', 0.018);
  }

  tick() {
    this.sweep(1450, 930, 0.042, 'square', 0.008);
  }

  lock() {
    this.sweep(440, 660, 0.42, 'sine', 0.035);
    this.sweep(88, 55, 0.54, 'triangle', 0.038);
    const timeout = window.setTimeout(() => {
      this.timeouts.delete(timeout);
      this.sweep(660, 880, 0.32, 'sine', 0.02);
    }, 110);
    this.timeouts.add(timeout);
  }

  engine() {
    this.sweep(142, 42, 0.5, 'sawtooth', 0.022);
    this.sweep(64, 31, 0.55, 'sine', 0.035);
  }

  dispose() {
    this.timeouts.forEach((timeout) => window.clearTimeout(timeout));
    this.timeouts.clear();
    this.voices.forEach(stop => stop());
    this.voices.clear();
  }

  private sweep(startHz: number, endHz: number, duration: number, shape: OscillatorShape, volume: number) {
    const mix = gameAudio.synthesisOutput();
    if (!mix || document.visibilityState === 'hidden') return;
    const { context, output } = mix;

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = shape;
    oscillator.frequency.setValueAtTime(startHz, now);
    oscillator.frequency.exponentialRampToValueAtTime(endHz, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + Math.min(0.025, duration * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(output);
    const stop = () => { try { oscillator.stop(); } catch { /* Already ended. */ } };
    this.voices.add(stop);
    oscillator.onended = () => {
      this.voices.delete(stop);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }
}
