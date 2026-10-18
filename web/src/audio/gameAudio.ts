/** Shared browser mixer. No provider keys, server calls, or combat decisions. */
export const AUDIO_FILES = {
  onboarding: { path: 'menu_music/menu_synthwave_calm', volume: .45 },
  cockpit: { path: 'menu_music/menu_outer_space_loop', volume: .34 },
  battle: { path: 'battle_music/battle_space_city_115bpm', volume: .24 },
  cockpitHum: { path: 'ambience/cockpit_hum_loop', volume: .22 },
  marsWind: { path: 'ambience/mars_wind_loop', volume: .16 },
  introJump: { path: 'travel/hyperspace_jump_long', volume: .42 },
  jump: { path: 'travel/hyperspace_jump_short', volume: .44 },
  arrive: { path: 'travel/hyperspace_arrive', volume: .40 },
  charge: { path: 'travel/hyperdrive_charge', volume: .25 },
  flyby: { path: 'travel/flyby_engine_a', volume: .28 },
  engine: { path: 'travel/engine_thrust_loop', volume: .20 },
  clash: { path: 'impact/vs_slam_a', volume: .38 },
  impact: { path: 'impact/impact_boom', volume: .25 },
  /** Live saber outcomes (blade contact). */
  saberClash: { path: 'impact/saber_clash_c', volume: .55 },
  saberHit: { path: 'impact/saber_hit_b', volume: .58 },
  saberBlock: { path: 'impact/saber_block_a', volume: .52 },
  saberKo: { path: 'impact/saber_ko_hit', volume: .72 },
  hover: { path: 'ui/ui_tap_b', volume: .22 },
  click: { path: 'ui/click_f', volume: .5 },
  /** Stronger confirm for Radar / Enter Hyperspace. */
  commit: { path: 'ui/click_j', volume: .55 },
  back: { path: 'ui/click_h', volume: .5 },
  /** Soft hologram chime when opening LYRA. */
  lyraHello: { path: 'ui/lyra_hello', volume: .48 },
} as const;
export type SoundId = keyof typeof AUDIO_FILES;
export type AudioScene = 'onboarding' | 'cockpit' | 'travel' | 'briefing' | 'battle' | 'result';
export type AudioBus = 'master' | 'music' | 'ambience' | 'effects';
export interface AudioSettings { muted: boolean; master: number; music: number; ambience: number; effects: number }
export interface AudioSnapshot { settings: AudioSettings; unlocked: boolean; unavailable: boolean; loops: SoundId[]; lastCue: SoundId | null; error: string | null }
type Playing = { id: SoundId; source: AudioBufferSourceNode; gain: GainNode; cancel: () => void };
type Slot = 'music' | 'ambience' | 'engine';
const STORAGE_KEY = 'sd.audio.v1';
const DEFAULTS: AudioSettings = { muted: false, master: .72, music: .5, ambience: .35, effects: .6 };
const clamp = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
const BASE = `${import.meta.env.BASE_URL}sfx/`;

export class GameAudio {
  private context: AudioContext | null = null;
  private buses: Record<AudioBus, GainNode> | null = null;
  private snapshot: AudioSnapshot = { settings: { ...DEFAULTS }, unlocked: false, unavailable: false, loops: [], lastCue: null, error: null };
  private listeners = new Set<() => void>();
  private buffers = new Map<SoundId, Promise<AudioBuffer>>();
  private loops = new Map<Slot, Playing>();
  private loopVersions: Record<Slot, number> = { music: 0, ambience: 0, engine: 0 };
  private loopRequests = new Map<Slot, SoundId>();
  private stops = new Set<() => void>();
  private recent = new Map<SoundId, number>();
  private ducks = new Set<symbol>();
  private hidden = false;
  private scene: AudioScene | null = null;
  private sceneLease = 0;
  private engineOn = false;
  private epoch = 0;

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(next: Partial<AudioSnapshot>) {
    this.snapshot = { ...this.snapshot, ...next };
    this.listeners.forEach(listener => listener());
  }
  restoreSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
      const settings = { ...DEFAULTS };
      for (const bus of ['master', 'music', 'ambience', 'effects'] as const) {
        if (typeof saved?.[bus] === 'number' && Number.isFinite(saved[bus])) settings[bus] = clamp(saved[bus]);
      }
      if (typeof saved?.muted === 'boolean') settings.muted = saved.muted;
      this.publish({ settings }); this.applyVolumes();
    } catch { /* Storage is optional. */ }
  }
  setVolume(bus: AudioBus, value: number) {
    this.changeSettings({ ...this.snapshot.settings, [bus]: clamp(value) });
  }
  setMuted(muted: boolean) {
    this.epoch++;
    if (muted) this.stops.forEach(stop => stop());
    this.changeSettings({ ...this.snapshot.settings, muted });
    this.refresh();
  }
  private changeSettings(settings: AudioSettings) {
    this.publish({ settings }); this.applyVolumes();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* Private browsing. */ }
  }
  private gain(node: GainNode, value: number, seconds = .12) {
    const context = this.context;
    if (!context) return;
    node.gain.cancelScheduledValues(context.currentTime);
    node.gain.setTargetAtTime(value, context.currentTime, Math.max(.005, seconds / 3));
  }
  private applyVolumes() {
    if (!this.buses) return;
    const s = this.snapshot.settings;
    this.gain(this.buses.master, s.muted || this.hidden ? 0 : s.master, .04);
    this.gain(this.buses.music, s.music * (this.ducks.size ? .22 : 1), .25);
    this.gain(this.buses.ambience, s.ambience * (this.ducks.size ? .35 : 1), .25);
    this.gain(this.buses.effects, s.effects);
  }
  async unlock(): Promise<boolean> {
    try {
      if (!this.context) {
        const Type = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Type) throw new Error('Web Audio unavailable');
        this.context = new Type();
        const master = this.context.createGain(); master.connect(this.context.destination);
        const music = this.context.createGain(); music.connect(master);
        const ambience = this.context.createGain(); ambience.connect(master);
        const effects = this.context.createGain(); effects.connect(master);
        this.buses = { master, music, ambience, effects };
        this.context.onstatechange = () => {
          if (this.context?.state !== 'running') this.publish({unlocked: false});
        };
        this.applyVolumes();
      }
      // Called directly from an explicit click/key; buffers can finish loading later.
      await this.context.resume();
      const unlocked = this.context.state === 'running';
      this.publish({ unlocked, unavailable: !unlocked });
      if (unlocked) this.refresh();
      return unlocked;
    } catch { this.publish({ unlocked: false, unavailable: true }); return false; }
  }
  /** Separate callers hold separate leases: closing an old screen cannot stop its replacement. */
  enterScene(scene: AudioScene) {
    const lease = ++this.sceneLease;
    this.scene = scene; this.refresh();
    return () => { if (lease === this.sceneLease) { this.scene = null; this.refresh(); } };
  }
  setEngine(active: boolean) { this.engineOn = active; this.refresh(); }
  duck() {
    const lease = Symbol(); this.ducks.add(lease); this.applyVolumes();
    return () => { this.ducks.delete(lease); this.applyVolumes(); };
  }
  setHidden(hidden: boolean) {
    if (this.hidden === hidden) return;
    this.hidden = hidden; this.epoch++;
    this.stops.forEach(stop => stop());
    this.applyVolumes(); this.refresh();
  }
  private allowed() {
    return !!this.context && this.context.state === 'running' && this.snapshot.unlocked && !this.snapshot.settings.muted && !this.hidden;
  }
  private async buffer(id: SoundId, transient = false): Promise<AudioBuffer> {
    let request = this.buffers.get(id);
    if (!request) {
      request = (async () => {
        let failure: unknown;
        for (const ext of ['mp3', 'webm']) {
          try {
            const response = await fetch(`${BASE}${AUDIO_FILES[id].path}.${ext}`);
            if (!response.ok) throw new Error(`Audio HTTP ${response.status}`);
            return await this.context!.decodeAudioData(await response.arrayBuffer());
          } catch (error) { failure = error; }
        }
        throw failure;
      })();
      this.buffers.set(id, request);
    }
    try { return await request; }
    finally {
      // Long tracks are held only by active/fading sources; no permanent decoded music cache.
      if (transient && this.buffers.get(id) === request) this.buffers.delete(id);
      void request.catch(() => { if (this.buffers.get(id) === request) this.buffers.delete(id); });
    }
  }
  play(id: SoundId, volume = 1): () => void {
    let cancelled = false, source: AudioBufferSourceNode | null = null;
    const stop = () => { cancelled = true; this.stops.delete(stop); if (source) { try { source.stop(); } catch { /* Already ended. */ } } };
    if (!this.allowed()) return stop;
    const now = performance.now();
    if (now - (this.recent.get(id) ?? -Infinity) < 70 || this.stops.size >= 12) return stop;
    this.recent.set(id, now); this.stops.add(stop);
    const epoch = this.epoch;
    void this.buffer(id).then(buffer => {
      if (cancelled || epoch !== this.epoch || !this.allowed()) { stop(); return; }
      const context = this.context!;
      source = context.createBufferSource(); const gain = context.createGain();
      source.buffer = buffer; gain.gain.value = AUDIO_FILES[id].volume * clamp(volume);
      source.connect(gain); gain.connect(this.buses!.effects);
      source.onended = () => { this.stops.delete(stop); source?.disconnect(); gain.disconnect(); };
      source.start(); this.publish({ lastCue: id, error: null });
    }).catch(() => { stop(); if (!cancelled || epoch === this.epoch) this.publish({error: `Could not load ${id} audio.`}); });
    return stop;
  }
  private refresh() {
    const allowed = this.allowed();
    const scene = allowed ? this.scene : null;
    const music: SoundId | null = scene === 'onboarding' ? 'onboarding' : scene === 'cockpit' || scene === 'travel' ? 'cockpit' : scene ? 'battle' : null;
    const ambience: SoundId | null = scene === 'cockpit' ? 'cockpitHum' : scene === 'briefing' || scene === 'battle' || scene === 'result' ? 'marsWind' : null;
    this.loop('music', music, scene === 'travel' ? .22 : scene === 'briefing' ? .55 : 1);
    this.loop('ambience', ambience);
    this.loop('engine', allowed && this.engineOn ? 'engine' : null);
  }
  private loop(slot: Slot, id: SoundId | null, scale = 1) {
    const previous = this.loops.get(slot);
    if (id && previous?.id === id) { this.gain(previous.gain, AUDIO_FILES[id].volume * scale, .6); return; }
    if (id && this.loopRequests.get(slot) === id) return;
    const version = ++this.loopVersions[slot];
    this.loopRequests.delete(slot);
    if (previous) { this.loops.delete(slot); previous.cancel(); this.publish({ loops: [...this.loops.values()].map(loop => loop.id) }); }
    if (!id) return;
    this.loopRequests.set(slot, id);
    void this.buffer(id, slot === 'music').then(buffer => {
      if (version !== this.loopVersions[slot] || !this.allowed()) return;
      this.loopRequests.delete(slot);
      const context = this.context!, source = context.createBufferSource(), gain = context.createGain();
      source.buffer = buffer; source.loop = true; source.connect(gain);
      gain.gain.value = 0; gain.connect(slot === 'music' ? this.buses!.music : this.buses!.ambience);
      source.onended = () => { source.disconnect(); gain.disconnect(); };
      let cancelled = false;
      this.loops.set(slot, { id, source, gain, cancel: () => {
        if (cancelled) return; cancelled = true;
        this.gain(gain, 0, .25); source.stop(context.currentTime + .3);
      } });
      source.start(); this.gain(gain, AUDIO_FILES[id].volume * scale, .7);
      this.publish({ loops: [...this.loops.values()].map(loop => loop.id), error: null });
    }).catch(() => { if (version === this.loopVersions[slot]) { this.loopRequests.delete(slot); this.publish({error: `Could not load ${id} audio.`}); } });
  }
  /** Lets the existing wheel keep its exact synthesized tick/lock through this mixer. */
  synthesisOutput(): { context: AudioContext; output: GainNode } | null {
    return this.allowed() && this.context && this.buses ? { context: this.context, output: this.buses.effects } : null;
  }
}
export const gameAudio = new GameAudio();
