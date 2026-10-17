class MicrophonePCM extends AudioWorkletProcessor {
  constructor() {
    super(); this.active = false; this.phase = 0; this.sum = 0; this.count = 0; this.samples = [];
    this.port.onmessage = ({ data }) => {
      if (data === 'start') { this.samples = []; this.phase = 0; this.sum = 0; this.count = 0; this.active = true; }
      if (data === 'stop') { this.active = false; this.flush(); this.port.postMessage({ stopped: true }); }
    };
  }
  flush() {
    if (!this.samples.length) return;
    const buffer = new ArrayBuffer(this.samples.length * 2), view = new DataView(buffer);
    this.samples.forEach((v, i) => view.setInt16(i * 2, Math.max(-32768, Math.min(32767, Math.round(v * 32767))), true));
    this.port.postMessage({ pcm: buffer }, [buffer]); this.samples = [];
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (this.active && input) for (const value of input) {
      this.sum += value; this.count++; this.phase += 24000 / sampleRate;
      if (this.phase >= 1) { this.phase -= 1; this.samples.push(this.sum / this.count); this.sum = 0; this.count = 0; }
      if (this.samples.length >= 480) this.flush();
    }
    return true;
  }
}
registerProcessor('microphone-pcm', MicrophonePCM);
