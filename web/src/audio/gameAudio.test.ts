import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameAudio } from './gameAudio';

class Param {
  value = 0;
  target = 0;
  cancelScheduledValues = vi.fn();
  setTargetAtTime(value: number) { this.target = value; }
}
class Gain {
  gain = new Param();
  connect = vi.fn();
  disconnect = vi.fn();
}
class Source {
  buffer: { tag?: string } | null = null;
  loop = false;
  onended: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  connect = vi.fn();
  disconnect = vi.fn();
}
class Context {
  state = 'suspended';
  currentTime = 1;
  destination = {};
  gains: Gain[] = [];
  sources: Source[] = [];
  resume = vi.fn(async () => { this.state = 'running'; });
  createGain() { const gain = new Gain(); this.gains.push(gain); return gain; }
  createBufferSource() { const source = new Source(); this.sources.push(source); return source; }
  decodeAudioData = vi.fn(async (bytes: ArrayBuffer) => ({ tag: new TextDecoder().decode(bytes) }));
}
const settle = async () => { for (let i = 0; i < 24; i++) await Promise.resolve(); };
let context: Context, fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  context = new Context();
  vi.stubGlobal('window', { AudioContext: function () { return context; } });
  vi.stubGlobal('localStorage', { getItem: vi.fn(() => null), setItem: vi.fn() });
  fetchMock = vi.fn(async (url: string) => ({ ok: true, arrayBuffer: async () => new TextEncoder().encode(url).buffer }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('shared game audio lifecycle', () => {
  it('does not fetch or start audio before an explicit unlock', async () => {
    const audio = new GameAudio(); audio.enterScene('onboarding'); audio.play('clash');
    await settle(); expect(fetchMock).not.toHaveBeenCalled(); expect(context.sources).toHaveLength(0);
    expect(await audio.unlock()).toBe(true); await settle();
    expect(audio.getSnapshot().loops).toEqual(['onboarding']);
    expect(context.sources[0].start).toHaveBeenCalledTimes(1);
  });
  it('ignores an old scene cleanup after the next screen has taken over', async () => {
    const audio = new GameAudio(); await audio.unlock();
    const old = audio.enterScene('onboarding'); await settle();
    audio.enterScene('cockpit'); old(); await settle();
    expect(audio.getSnapshot().loops.sort()).toEqual(['cockpit', 'cockpitHum']);
    expect(context.sources[0].stop).toHaveBeenCalledTimes(1);
  });
  it('does not play a delayed cue cancelled by a skipped transition', async () => {
    let resolve!: (value: unknown) => void;
    fetchMock.mockImplementationOnce(() => new Promise(value => { resolve = value; }));
    const audio = new GameAudio(); await audio.unlock();
    const stop = audio.play('jump'); stop();
    resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }); await settle();
    expect(context.sources).toHaveLength(0);
  });
  it('discards a pending old-world loop after a new scene is selected', async () => {
    let resolve!: (value: unknown) => void;
    fetchMock.mockImplementationOnce(() => new Promise(value => { resolve = value; }));
    const audio = new GameAudio(); await audio.unlock(); audio.enterScene('onboarding');
    audio.enterScene('battle'); await settle();
    resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }); await settle();
    expect(audio.getSnapshot().loops.sort()).toEqual(['battle', 'marsWind']);
    expect(context.sources).toHaveLength(2);
  });
  it('mutes every shared bus and stops active effects and loops', async () => {
    const audio = new GameAudio(); await audio.unlock(); audio.enterScene('battle'); audio.play('arrive'); await settle();
    audio.setMuted(true); await settle();
    expect(context.gains[0].gain.target).toBe(0);
    expect(audio.getSnapshot().loops).toEqual([]);
    expect(context.sources.every(source => source.stop.mock.calls.length === 1)).toBe(true);
    audio.setMuted(false); await settle();
    expect(audio.getSnapshot().loops.sort()).toEqual(['battle','marsWind']);
    expect(context.gains[0].gain.target).toBe(.72);
  });
  it('stops background effects and resumes only scene beds when visible', async () => {
    const audio = new GameAudio(); await audio.unlock(); audio.enterScene('cockpit'); audio.play('flyby'); await settle();
    const old = [...context.sources]; audio.setHidden(true); await settle();
    expect(audio.getSnapshot().loops).toEqual([]); expect(context.gains[0].gain.target).toBe(0);
    expect(old.every(source => source.stop.mock.calls.length === 1)).toBe(true);
    audio.setHidden(false); await settle();
    expect(audio.getSnapshot().loops.sort()).toEqual(['cockpit','cockpitHum']);
    expect(context.sources.length - old.length).toBe(2);
  });
  it('keeps ducking until all simultaneous voice leases are released', async () => {
    const audio = new GameAudio(); await audio.unlock();
    const a = audio.duck(), b = audio.duck();
    expect(context.gains[1].gain.target).toBeCloseTo(.5*.22);
    expect(context.gains[3].gain.target).toBe(.6);
    a(); expect(context.gains[1].gain.target).toBeCloseTo(.5*.22);
    b(); expect(context.gains[1].gain.target).toBe(.5);
  });
  it('bounds and saves volume while rejecting malformed saved settings', async () => {
    const audio = new GameAudio();
    vi.mocked(localStorage.getItem).mockReturnValue('{"music":4,"effects":-2,"muted":"false","master":null}');
    audio.restoreSettings();
    expect(audio.getSnapshot().settings).toMatchObject({ music: 1, effects: 0, muted: false, master: .72 });
    audio.setVolume('music', .27); expect(localStorage.setItem).toHaveBeenCalled();
  });
  it('handles missing media and allows a later retry without an unhandled rejection', async () => {
    const audio = new GameAudio(); await audio.unlock();
    fetchMock.mockResolvedValue({ ok: false, status: 404 }); audio.play('clash'); await settle();
    expect(audio.getSnapshot().error).toContain('clash');
    expect(context.sources).toHaveLength(0); expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) });
    // A different cue avoids the deliberate 70ms click-rate limiter.
    audio.play('impact'); await settle(); expect(context.sources).toHaveLength(1);
  });
});
