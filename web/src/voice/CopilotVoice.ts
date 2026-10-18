import type { GameClient } from '../networking';

export type CopilotPhase = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking';
export interface VoiceCallbacks {
  phase: (value: CopilotPhase) => void;
  text: (value: string) => void;
  userText: (value: string) => void;
  error: (message: string) => void;
  connected: () => void;
  paused: () => void;
}

/** Extra context a screen can give Grok: appended instructions plus read-only tools it answers locally. */
export interface CopilotExtension {
  instructions: string;
  tools: Array<{ type: 'function'; name: string; description: string; parameters: Record<string, unknown> }>;
  handle: (name: string, args: Record<string, unknown>) => unknown;
}

const REASONS: Record<string, string> = {
  unavailable: 'Grok Voice is not configured on this game server.',
  offline: 'The game server is offline.', not_joined: 'Join the live lobby first.',
  rate_limited: 'Wait a few seconds before reconnecting Voice.',
  provider_error: 'Grok Voice could not start. Check the server’s xAI access.',
  no_response: 'This server has not answered the copilot request. Restart it with the latest branch.',
};

/** A small browser Voice client. Provider credentials arrive over the already joined game socket. */
export class CopilotVoice {
  private socket?: WebSocket;
  private audio?: AudioContext;
  private connecting?: Promise<void>;
  private generation = 0;
  private stream?: MediaStream;
  private input?: MediaStreamAudioSourceNode;
  private processor?: AudioWorkletNode;
  private mute?: GainNode;
  private sources = new Set<AudioBufferSourceNode>();
  private analyser?: AnalyserNode;
  private meterData = new Uint8Array(256);
  private nextAudioAt = 0;
  private recordingAt = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private idleTimer?: ReturnType<typeof setTimeout>;
  private outputDone = false;
  private tools: Array<{name: string; call_id: string; arguments: string}> = [];
  private calls = new Set<string>();
  private fullText = '';
  private segment = '';
  private segmentCommitted = false;
  private mutedValue = false;
  get muted() { return this.mutedValue; }
  set muted(value: boolean) {
    this.mutedValue = value;
    if (value) {
      for (const source of this.sources) { try { source.stop(); } catch { /* ended */ } source.disconnect(); }
      this.sources.clear(); this.nextAudioAt = this.audio?.currentTime ?? 0;
      if (this.outputDone) { this.callbacks.phase('idle'); this.armIdle(); }
    }
  }

  /** Measures only scheduled output audio; silent gaps and muted playback return zero. */
  outputLevel(): number {
    if (!this.analyser || !this.sources.size || this.muted || this.audio?.state !== 'running') return 0;
    this.analyser.getByteTimeDomainData(this.meterData);
    let sum = 0;
    for (const value of this.meterData) sum += Math.pow((value - 128) / 128, 2);
    return Math.min(1, Math.sqrt(sum / this.meterData.length) * 6);
  }

  constructor(private game: GameClient, private callbacks: VoiceCallbacks, private extension?: CopilotExtension) {}

  private sessionConfig(session: Record<string, unknown>) {
    if (!this.extension) return session;
    const tools = Array.isArray(session.tools) ? session.tools : [];
    return { ...session, instructions: `${String(session.instructions ?? '')}\n${this.extension.instructions}`, tools: [...tools, ...this.extension.tools] };
  }

  private send(data: unknown) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(data));
  }

  async connect(): Promise<void> {
    if (this.connecting) return this.connecting;
    if (this.socket?.readyState === WebSocket.OPEN) { await this.audio?.resume(); return; }
    const generation = this.generation;
    this.callbacks.phase('connecting');
    // Created during the user's click so mobile browsers can unlock audio.
    this.audio ??= new AudioContext({sampleRate: 24000});
    await this.audio.resume();
    this.connecting = (async () => {
      if (generation !== this.generation) throw new Error('Copilot closed.');
      const result = await this.game.copilotSession();
      if (generation !== this.generation) throw new Error('Copilot closed.');
      if (!result.ok) throw new Error(REASONS[result.reason] ?? 'Copilot connection unavailable.');
      await new Promise<void>((resolve, reject) => {
        const socket = new WebSocket('wss://api.x.ai/v1/realtime?model=grok-voice-latest', [`xai-client-secret.${result.clientSecret}`]);
        this.socket = socket;
        let ready = false;
        const timeout = setTimeout(() => { reject(new Error('Voice connection timed out.')); socket.close(); }, 12000);
        let queue = Promise.resolve();
        socket.onopen = () => this.send({type: 'session.update', session: this.sessionConfig(result.session)});
        socket.onmessage = event => {
          queue = queue.then(async () => {
            if (generation !== this.generation) return;
            const message = JSON.parse(String(event.data));
            if (message.type === 'session.updated' && !ready) {
              ready = true; clearTimeout(timeout); this.callbacks.connected(); resolve();
            }
            await this.receive(message);
          }).catch(() => { reject(new Error('Voice response could not be read.')); this.fail('Voice response interrupted. You can reconnect.'); });
        };
        socket.onerror = () => { if (generation !== this.generation) return; clearTimeout(timeout); reject(new Error('Voice network connection failed.')); if (ready) this.fail('Voice network connection interrupted.'); };
        socket.onclose = () => {
          clearTimeout(timeout);
          if (!ready) reject(new Error('Voice connection closed before it was ready.'));
          if (this.socket === socket) {
            this.socket = undefined;
            if (generation === this.generation) this.fail('Voice disconnected. Ask again to reconnect.');
          }
        };
      });
      if (generation !== this.generation) throw new Error('Copilot closed.');
      this.armIdle();
    })();
    try { await this.connecting; }
    finally { this.connecting = undefined; }
  }

  private armIdle() {
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => { this.close(); this.callbacks.phase('idle'); this.callbacks.paused(); }, 120000);
  }

  private startTurn() {
    clearTimeout(this.idleTimer);
    this.fullText = ''; this.segment = ''; this.segmentCommitted = false; this.outputDone = false;
    this.tools = []; this.calls.clear(); this.callbacks.text('');
  }

  async ask(question: string) {
    const generation = this.generation;
    await this.connect();
    if (generation !== this.generation) return;
    this.startTurn(); this.callbacks.phase('thinking');
    this.send({type: 'conversation.item.create', item: {type: 'message', role: 'user', content: [{type: 'input_text', text: question.slice(0, 1000)}]}});
    this.send({type: 'response.create'});
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.fail('The copilot took too long to answer. Try again.'), 45000);
  }

  private play(base64: string) {
    if (!this.audio || this.muted) return;
    const binary = atob(base64);
    if (binary.length % 2 || binary.length > 1000000) return;
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const data = new DataView(bytes.buffer);
    const buffer = this.audio.createBuffer(1, bytes.length / 2, 24000);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < channel.length; i++) channel[i] = data.getInt16(i * 2, true) / 32768;
    if (!this.analyser) {
      this.analyser = this.audio.createAnalyser(); this.analyser.fftSize = 256;
      this.analyser.connect(this.audio.destination);
    }
    const source = this.audio.createBufferSource(); source.buffer = buffer; source.connect(this.analyser);
    this.sources.add(source); this.callbacks.phase('speaking');
    source.onended = () => { this.sources.delete(source); source.disconnect(); if (this.outputDone && !this.sources.size) { this.callbacks.phase('idle'); this.armIdle(); } };
    this.nextAudioAt = Math.max(this.audio.currentTime + .025, this.nextAudioAt);
    source.start(this.nextAudioAt); this.nextAudioAt += buffer.duration;
  }

  private async receive(event: any) {
    if (event.type === 'response.created') { this.segment = ''; this.segmentCommitted = false; }
    if (['response.output_audio.delta', 'response.audio.delta'].includes(event.type)) this.play(event.delta);
    if (['response.output_audio_transcript.delta', 'response.audio_transcript.delta', 'response.output_text.delta', 'response.text.delta'].includes(event.type)) {
      this.segment += event.delta ?? ''; this.callbacks.text(this.fullText + this.segment);
    }
    if (['response.output_audio_transcript.done', 'response.audio_transcript.done', 'response.output_text.done', 'response.text.done'].includes(event.type) && !this.segmentCommitted) {
      this.fullText += (event.transcript ?? event.text ?? this.segment) + '\n'; this.segment = ''; this.segmentCommitted = true; this.callbacks.text(this.fullText.trim());
    }
    if (event.type === 'conversation.item.input_audio_transcription.completed') this.callbacks.userText(event.transcript);
    if (event.type === 'response.function_call_arguments.done' && !this.calls.has(event.call_id)) { this.calls.add(event.call_id); this.tools.push(event); }
    if (event.type === 'error') { this.fail('Grok could not complete that question. Try reconnecting.'); return; }
    if (event.type !== 'response.done') return;
    if (event.response?.status === 'failed') { this.fail('Grok could not complete that response.'); return; }
    if (this.tools.length) {
      const generation = this.generation;
      const tools = this.tools.splice(0);
      this.callbacks.phase('thinking');
      for (const tool of tools) {
        let output: unknown = {available: false, error: 'Unsupported tool. Do not guess.'};
        try {
          const args = JSON.parse(tool.arguments || '{}');
          const plain = args && typeof args === 'object' && !Array.isArray(args);
          if (tool.name === 'getFlightState' && plain && !Object.keys(args).length) output = await this.game.copilotContext();
          else if (plain && this.extension?.tools.some(t => t.name === tool.name)) output = await this.extension.handle(tool.name, args);
        } catch { /* Only the fixed, read-only tool is permitted. */ }
        if (generation !== this.generation) return;
        this.send({type: 'conversation.item.create', item: {type: 'function_call_output', call_id: tool.call_id, output: JSON.stringify(output)}});
      }
      // Let the previous audio finish before requesting the tool-based continuation.
      const delay = Math.max(0, ((this.audio ? this.nextAudioAt - this.audio.currentTime : 0) * 1000));
      if (delay > 0) await new Promise(resolve => setTimeout(resolve, Math.min(delay, 12000)));
      if (generation === this.generation) this.send({type: 'response.create'});
    } else {
      clearTimeout(this.timer); this.outputDone = true;
      if (!this.sources.size) { this.callbacks.phase('idle'); this.armIdle(); }
    }
  }

  async record() {
    const generation = this.generation;
    await this.connect();
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone needs HTTPS or localhost. Typed questions still work.');
    const stream = await navigator.mediaDevices.getUserMedia({audio: {channelCount: 1, echoCancellation: true}, video: false});
    if (generation !== this.generation) { stream.getTracks().forEach(track => track.stop()); return; }
    this.stream = stream;
    await this.audio!.audioWorklet.addModule(new URL('./mic-worklet.mjs?no-inline', import.meta.url).href);
    if (generation !== this.generation) { stream.getTracks().forEach(track => track.stop()); return; }
    this.startTurn(); this.send({type: 'input_audio_buffer.clear'});
    this.input = this.audio!.createMediaStreamSource(stream);
    this.processor = new AudioWorkletNode(this.audio!, 'microphone-pcm'); this.mute = this.audio!.createGain(); this.mute.gain.value = 0;
    this.input.connect(this.processor).connect(this.mute).connect(this.audio!.destination);
    this.processor.port.onmessage = ({data}) => {
      if (generation !== this.generation) return;
      if (data.pcm) {
        let binary = ''; for (const value of new Uint8Array(data.pcm)) binary += String.fromCharCode(value);
        this.send({type: 'input_audio_buffer.append', audio: btoa(binary)});
      }
      if (data.stopped) {
        const elapsed = performance.now() - this.recordingAt;
        this.releaseMic();
        if (elapsed < 500) { this.send({type: 'input_audio_buffer.clear'}); this.callbacks.phase('idle'); this.callbacks.error('Speak for at least half a second.'); return; }
        this.callbacks.phase('thinking'); this.send({type: 'input_audio_buffer.commit'}); this.send({type: 'response.create'});
        this.timer = setTimeout(() => this.fail('The copilot took too long to answer.'), 45000);
      }
    };
    this.recordingAt = performance.now(); this.processor.port.postMessage('start'); this.callbacks.phase('listening');
    this.timer = setTimeout(() => this.finishRecording(), 20000);
  }

  finishRecording() { clearTimeout(this.timer); this.processor?.port.postMessage('stop'); }
  private releaseMic() {
    this.stream?.getTracks().forEach(track => track.stop()); this.stream = undefined;
    this.input?.disconnect(); this.processor?.disconnect(); this.mute?.disconnect(); this.input = undefined; this.processor = undefined; this.mute = undefined;
  }
  private fail(message: string) { this.close(); this.callbacks.phase('idle'); this.callbacks.error(message); }
  close() {
    this.generation++; clearTimeout(this.timer); clearTimeout(this.idleTimer); this.releaseMic();
    const socket = this.socket; this.socket = undefined; socket?.close();
    for (const source of this.sources) { try { source.stop(); } catch { /* ended */ } source.disconnect(); }
    this.sources.clear(); this.analyser?.disconnect(); this.analyser = undefined; const audio = this.audio; this.audio = undefined; void audio?.close().catch(() => {});
    this.nextAudioAt = 0; this.tools = []; this.calls.clear();
  }
}
