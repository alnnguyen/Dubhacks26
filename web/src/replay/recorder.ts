export interface RecordedReplay { video: Blob; duration: number }
export const MAX_DURATION = 45;
const MAX_BYTES = 8 * 1024 * 1024;
const READY_TIMEOUT_MS = 3000;
const TIMESLICE_MS = 250;

/** Silent, unmirrored, 640×360 local recording. Never requests another camera. */
export function createReplayRecorder(onClip: (clip: RecordedReplay) => void, onStatus: (message: string) => void, onStarted?: (atMs: number) => void) {
  let started = false;
  let disposed = false;
  let stop = () => {};
  return {
    start(video: HTMLVideoElement): () => void {
      if (started || disposed) return () => {};
      if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) {
        onStatus('Replay recording is unavailable in this browser.'); return () => {};
      }
      const mime = ['video/webm;codecs=vp8', 'video/mp4', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t));
      if (!mime) { onStatus('This browser has no supported replay video format.'); return () => {}; }

      let cancelled = false;
      let waiting = false;
      let waitTimer: ReturnType<typeof setTimeout> | undefined;
      const cancelWait = () => {
        if (!waiting) return;
        waiting = false;
        clearTimeout(waitTimer);
        video.removeEventListener('loadeddata', onReady);
        video.removeEventListener('canplay', onReady);
      };
      const onReady = () => { if (video.readyState >= 2) begin(); };

      function begin() {
        if (cancelled || disposed || started) return;
        cancelWait();
        const canvas = document.createElement('canvas');
        canvas.width = 640; canvas.height = 360;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          onStatus('Replay recording could not start; the duel is unaffected.');
          return;
        }
        let stream: MediaStream | undefined;
        try {
          stream = canvas.captureStream(15);
          const recorder = new MediaRecorder(stream, { mimeType: mime!, videoBitsPerSecond: 700_000 });
          const chunks: Blob[] = [];
          let bytes = 0, raf = 0, timer: ReturnType<typeof setTimeout> | undefined;
          let tooLarge = false, broken = false, stopped = false, elapsed = 0;
          const startAt = performance.now();
          function draw() {
            if (stopped) return;
            // Letterbox; grounding uses these exact pixels, not CSS-mirrored webcam pixels.
            ctx!.fillStyle = '#000'; ctx!.fillRect(0, 0, 640, 360);
            if (video.videoWidth && video.videoHeight) {
              const scale = Math.min(640 / video.videoWidth, 360 / video.videoHeight);
              const w = video.videoWidth * scale, h = video.videoHeight * scale;
              ctx!.drawImage(video, (640 - w) / 2, (360 - h) / 2, w, h);
            }
            raf = requestAnimationFrame(draw);
          }
          const cleanup = () => { cancelAnimationFrame(raf); clearTimeout(timer); stream?.getTracks().forEach(t => t.stop()); };
          stop = () => {
            cancelled = true;
            cancelWait();
            if (stopped) return;
            if (!started) return;
            stopped = true;
            elapsed = Math.min(MAX_DURATION, (performance.now() - startAt) / 1000);
            cancelAnimationFrame(raf); clearTimeout(timer);
            if (recorder.state === 'recording') {
              try { recorder.requestData(); } catch { /* older engines may omit requestData */ }
              recorder.stop();
            } else cleanup();
          };
          recorder.ondataavailable = e => {
            bytes += e.data.size;
            if (bytes > MAX_BYTES) { tooLarge = true; chunks.length = 0; stop(); }
            else if (!tooLarge && e.data.size) chunks.push(e.data);
          };
          recorder.onerror = () => { broken = true; onStatus('Replay recording failed; the duel is unaffected.'); stop(); cleanup(); };
          recorder.onstop = () => {
            cleanup();
            started = false;
            if (broken) return;
            if (tooLarge) { onStatus('Replay exceeded the local size limit and was discarded.'); return; }
            if (!chunks.length) {
              onStatus(elapsed < 0.5
                ? 'Replay was too short to save. Keep recording on through a longer exchange.'
                : 'Replay encoder produced no video. Try Chrome or Edge, or re-enable recording and fight again.');
              return;
            }
            if (elapsed < 0.5) {
              onStatus('Replay was too short to save. Keep recording on through a longer exchange.');
              return;
            }
            onClip({ video: new Blob(chunks, { type: recorder.mimeType || mime }), duration: elapsed });
            onStatus(`Replay ready (${Math.round(elapsed)}s). Press Play cinematic reel — the webcam follows when the arena plays.`);
          };
          recorder.start(TIMESLICE_MS);
          started = true;
          onStarted?.(startAt);
          draw();
          timer = setTimeout(stop, MAX_DURATION * 1000);
          onStatus('Recording locally · first 45 seconds · no audio');
        } catch {
          stream?.getTracks().forEach(t => t.stop());
          onStatus('Replay recording could not start; the duel is unaffected.');
        }
      }

      if (video.readyState >= 2) begin();
      else {
        waiting = true;
        onStatus('Waiting for camera for replay…');
        video.addEventListener('loadeddata', onReady);
        video.addEventListener('canplay', onReady);
        waitTimer = setTimeout(() => {
          if (cancelled || disposed || started) return;
          cancelWait();
          onStatus('Replay recording could not start; the camera feed never became ready.');
        }, READY_TIMEOUT_MS);
      }

      return () => {
        cancelled = true;
        cancelWait();
        stop();
      };
    },
    dispose() { disposed = true; stop(); },
  };
}
