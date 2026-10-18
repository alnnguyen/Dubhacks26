import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createReplayRecorder } from './recorder';

let now = 0;
const stopTrack = vi.fn();
const stream = { getTracks: () => [{ stop: stopTrack }] };
class FakeCanvas {
  width = 0; height = 0;
  captureStream() { return stream; }
  getContext() { return { fillRect() {}, drawImage() {}, fillStyle: '' }; }
}
class FakeRecorder {
  static latest: FakeRecorder | undefined;
  static isTypeSupported(type: string) { return type.includes('webm'); }
  state = 'inactive'; mimeType = 'video/webm';
  timeslice: number | undefined;
  requestDataCalls = 0;
  onstop?: () => void;
  onerror?: () => void;
  ondataavailable?: (event: { data: Blob }) => void;
  constructor() { FakeRecorder.latest = this; }
  start(timeslice?: number) { this.timeslice = timeslice; this.state = 'recording'; }
  requestData() {
    this.requestDataCalls += 1;
    this.ondataavailable?.({ data: new Blob(['flushed']) });
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['final chunk']) });
    this.onstop?.();
  }
}
function makeVideo(readyState = 4) {
  const listeners = new Map<string, Set<() => void>>();
  return {
    readyState,
    videoWidth: 640,
    videoHeight: 360,
    addEventListener(type: string, fn: () => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener(type: string, fn: () => void) { listeners.get(type)?.delete(fn); },
    emit(type: string) { listeners.get(type)?.forEach(fn => fn()); },
  };
}
let video = makeVideo();
beforeEach(() => {
  now = 0; stopTrack.mockClear(); FakeRecorder.latest = undefined; video = makeVideo(); vi.useFakeTimers();
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('HTMLCanvasElement', FakeCanvas);
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  vi.stubGlobal('document', { createElement: () => new FakeCanvas() });
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('caps recording at 45 seconds and releases capture tracks exactly once', () => {
  const clip = vi.fn(); const recorder = createReplayRecorder(clip, vi.fn());
  recorder.start(video as unknown as HTMLVideoElement);
  const first = FakeRecorder.latest;
  expect(first!.timeslice).toBe(250);
  recorder.start(video as unknown as HTMLVideoElement);
  expect(FakeRecorder.latest).toBe(first);
  now = 45_000; vi.advanceTimersByTime(45_000);
  expect(clip).toHaveBeenCalledTimes(1);
  expect(clip.mock.calls[0][0].duration).toBe(45);
  expect(clip.mock.calls[0][0].video.type).toBe('video/webm');
  expect(stopTrack).toHaveBeenCalledTimes(1);
  recorder.dispose();
  expect(stopTrack).toHaveBeenCalledTimes(1);
});
it('disposal stops recording but keeps a finished clip when the encoder flushes data', () => {
  const clip = vi.fn(); const recorder = createReplayRecorder(clip, vi.fn());
  recorder.start(video as unknown as HTMLVideoElement); now = 2000; recorder.dispose();
  expect(FakeRecorder.latest!.state).toBe('inactive');
  expect(stopTrack).toHaveBeenCalledTimes(1);
  expect(clip).toHaveBeenCalledTimes(1);
  expect(clip.mock.calls[0][0].duration).toBe(2);
});
it('oversized recordings are discarded locally before upload', () => {
  const clip = vi.fn(), status = vi.fn(); const recorder = createReplayRecorder(clip, status);
  recorder.start(video as unknown as HTMLVideoElement); now = 2000;
  FakeRecorder.latest!.ondataavailable?.({data: new Blob([new Uint8Array(8 * 1024 * 1024 + 1)])});
  expect(clip).not.toHaveBeenCalled();
  expect(status).toHaveBeenLastCalledWith('Replay exceeded the local size limit and was discarded.');
  expect(stopTrack).toHaveBeenCalledTimes(1);
});
it('waits for camera frames before starting when the video is not ready yet', () => {
  video = makeVideo(0);
  const clip = vi.fn(), status = vi.fn();
  const recorder = createReplayRecorder(clip, status);
  const halt = recorder.start(video as unknown as HTMLVideoElement);
  expect(status).toHaveBeenLastCalledWith('Waiting for camera for replay…');
  expect(FakeRecorder.latest).toBeUndefined();
  video.readyState = 4;
  video.emit('loadeddata');
  expect(status).toHaveBeenLastCalledWith('Recording locally · first 45 seconds · no audio');
  expect(FakeRecorder.latest).toBeDefined();
  now = 2000;
  halt();
  expect(clip).toHaveBeenCalledTimes(1);
});
it('reports when the camera never becomes ready for replay', () => {
  video = makeVideo(0);
  const status = vi.fn();
  createReplayRecorder(vi.fn(), status).start(video as unknown as HTMLVideoElement);
  vi.advanceTimersByTime(3000);
  expect(status).toHaveBeenLastCalledWith('Replay recording could not start; the camera feed never became ready.');
});
it('flushes requestData before stop so a prior timeslice chunk is kept', () => {
  const clip = vi.fn();
  const recorder = createReplayRecorder(clip, vi.fn());
  const halt = recorder.start(video as unknown as HTMLVideoElement);
  const fake = FakeRecorder.latest!;
  fake.ondataavailable?.({ data: new Blob(['prior']) });
  now = 2000;
  halt();
  expect(fake.requestDataCalls).toBe(1);
  expect(clip).toHaveBeenCalledTimes(1);
  expect(clip.mock.calls[0][0].video.size).toBeGreaterThan(0);
});
it('allows a second start after a clean stop for rematch recording', () => {
  const clip = vi.fn();
  const recorder = createReplayRecorder(clip, vi.fn());
  const halt = recorder.start(video as unknown as HTMLVideoElement);
  now = 2000;
  halt();
  expect(clip).toHaveBeenCalledTimes(1);
  const first = FakeRecorder.latest;
  now = 0;
  const haltAgain = recorder.start(video as unknown as HTMLVideoElement);
  expect(FakeRecorder.latest).not.toBe(first);
  expect(FakeRecorder.latest!.state).toBe('recording');
  now = 3000;
  haltAgain();
  expect(clip).toHaveBeenCalledTimes(2);
  expect(clip.mock.calls[1][0].duration).toBe(3);
});
