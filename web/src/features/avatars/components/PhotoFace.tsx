import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { FACE_ASPECT, type FaceCrop } from '../types/avatar';
import { clampCrop, defaultCrop, panCrop } from '../utils/faceCrop';
import { autoCrop, canvasToPng, captureFrame, loadPhoto, renderFace } from '../utils/faceProcessing';

type Step = { kind: 'camera' } | { kind: 'adjust'; source: HTMLCanvasElement; crop: FaceCrop; detected: boolean };

export interface PhotoFaceEditorProps {
  /** Start straight in the selfie camera, or with a picked file. */
  start: 'camera' | File;
  /** Live preview on the 3D avatar while adjusting (null = back to saved face). */
  onPreview: (face: HTMLCanvasElement | null) => void;
  onConfirm: (face: HTMLCanvasElement, png: Blob) => Promise<void>;
  onCancel: () => void;
}

const STAGE_W = 300;
const STAGE_H = Math.round(STAGE_W * FACE_ASPECT);
/** Fraction of the stage width the face oval occupies. */
const OVAL = 0.72;

function SelfieCamera({ onCapture, onError }: { onCapture: (frame: HTMLCanvasElement) => void; onError: (message: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play();
          setReady(true);
        }
      } catch (error) {
        const name = (error as { name?: string }).name;
        onError(
          name === 'NotAllowedError'
            ? 'Camera permission was denied. Allow it in your browser settings, or upload a photo instead.'
            : 'No camera is available here. Upload a photo instead.',
        );
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onError]);

  return (
    <div className="face-editor__camera">
      <div className="face-editor__stage face-editor__stage--video">
        <video ref={video} playsInline muted aria-label="Selfie camera preview" />
        <div className="face-editor__oval" aria-hidden />
      </div>
      <p className="face-editor__hint">Line your face up with the oval.</p>
      <button type="button" className="av-btn av-btn--primary" disabled={!ready} onClick={() => video.current && onCapture(captureFrame(video.current))}>
        {ready ? 'Take photo' : 'Starting camera…'}
      </button>
    </div>
  );
}

/** Take or upload a photo, then crop it into the helmet oval. Everything stays on this device. */
export function PhotoFaceEditor({ start, onPreview, onConfirm, onCancel }: PhotoFaceEditorProps) {
  const [step, setStep] = useState<Step | null>(start === 'camera' ? { kind: 'camera' } : null);
  const [busy, setBusy] = useState<string | null>(start === 'camera' ? null : 'Reading photo…');
  const [error, setError] = useState<string | null>(null);
  const stage = useRef<HTMLCanvasElement>(null);
  const preview = useRef<HTMLCanvasElement | null>(null);
  const drag = useRef<{ x: number; y: number; id: number } | null>(null);
  const onPreviewRef = useRef(onPreview);
  onPreviewRef.current = onPreview;

  const beginAdjust = useCallback(async (source: HTMLCanvasElement) => {
    setBusy('Finding your face…');
    const { crop, detected } = await autoCrop(source);
    setStep({ kind: 'adjust', source, crop, detected });
    setBusy(null);
  }, []);

  useEffect(() => {
    if (start === 'camera') return;
    loadPhoto(start)
      .then(beginAdjust)
      .catch(() => {
        setBusy(null);
        setError('That file could not be read as an image. Try a JPG or PNG.');
      });
  }, [beginAdjust, start]);

  // Draw the stage and push a live preview to the avatar on every crop change.
  useEffect(() => {
    if (step?.kind !== 'adjust' || !stage.current) return;
    const { source, crop } = step;
    const g = stage.current.getContext('2d')!;
    const scale = (STAGE_W * OVAL) / crop.width;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#05111b';
    g.fillRect(0, 0, STAGE_W, STAGE_H);
    g.translate(STAGE_W / 2, STAGE_H / 2);
    g.rotate((-crop.rotation * Math.PI) / 180);
    g.scale(scale, scale);
    g.drawImage(source, -crop.cx, -crop.cy);
    g.setTransform(1, 0, 0, 1, 0, 0);
    // Dim everything outside the oval.
    g.fillStyle = 'rgba(3, 10, 18, 0.62)';
    g.beginPath();
    g.rect(0, 0, STAGE_W, STAGE_H);
    g.ellipse(STAGE_W / 2, STAGE_H / 2, (STAGE_W * OVAL) / 2, (STAGE_W * OVAL * FACE_ASPECT) / 2, 0, 0, Math.PI * 2);
    g.fill('evenodd');
    g.strokeStyle = '#5fe1ff';
    g.lineWidth = 2;
    g.setLineDash([6, 5]);
    g.beginPath();
    g.ellipse(STAGE_W / 2, STAGE_H / 2, (STAGE_W * OVAL) / 2, (STAGE_W * OVAL * FACE_ASPECT) / 2, 0, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);

    preview.current = renderFace(source, crop, 256, preview.current ?? undefined);
    onPreviewRef.current(preview.current);
  }, [step]);

  // Back to the saved face if the editor closes without confirming.
  useEffect(() => () => onPreviewRef.current(null), []);

  const setCrop = (next: Partial<FaceCrop>) =>
    setStep((s) => (s?.kind === 'adjust' ? { ...s, crop: clampCrop({ ...s.crop, ...next }, s.source.width, s.source.height) } : s));

  const scale = step?.kind === 'adjust' ? (STAGE_W * OVAL) / step.crop.width : 1;
  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drag.current || drag.current.id !== e.pointerId || step?.kind !== 'adjust') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const k = STAGE_W / rect.width; // CSS px → stage px
    const dx = (e.clientX - drag.current.x) * k;
    const dy = (e.clientY - drag.current.y) * k;
    drag.current = { ...drag.current, x: e.clientX, y: e.clientY };
    setCrop(panCrop(step.crop, dx, dy, scale));
  };
  const onPointerUp = () => {
    drag.current = null;
  };
  const onWheel = (e: React.WheelEvent) => {
    if (step?.kind !== 'adjust') return;
    setCrop({ width: step.crop.width * Math.exp(e.deltaY * 0.0012) });
  };

  const confirm = async () => {
    if (step?.kind !== 'adjust') return;
    setBusy('Saving face…');
    try {
      const face = renderFace(step.source, step.crop);
      await onConfirm(face, await canvasToPng(face));
    } catch {
      setError('Could not save the face on this device (storage may be full or disabled).');
      setBusy(null);
    }
  };

  return (
    <div className="face-editor" role="group" aria-label="Photo face editor">
      {error && (
        <p className="face-editor__error" role="alert">
          {error}
        </p>
      )}
      {busy && <p className="face-editor__busy">{busy}</p>}

      {step?.kind === 'camera' && !error && <SelfieCamera onCapture={beginAdjust} onError={setError} />}

      {step?.kind === 'adjust' && (
        <>
          <canvas
            ref={stage}
            className="face-editor__stage"
            width={STAGE_W}
            height={STAGE_H}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
            aria-label="Drag to position your face inside the oval"
          />
          <p className="face-editor__hint">
            {step.detected ? 'Face found. Drag to fine-tune.' : 'No face detected. Drag and resize to fit your face in the oval.'}
          </p>
          <label className="av-slider">
            <span>Size</span>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.01}
              value={Math.log(defaultCrop(step.source.width, step.source.height).width / step.crop.width) / Math.log(3)}
              onChange={(e) => setCrop({ width: defaultCrop(step.source.width, step.source.height).width / Math.pow(3, Number(e.target.value)) })}
            />
          </label>
          <label className="av-slider">
            <span>Tilt</span>
            <input type="range" min={-45} max={45} step={1} value={step.crop.rotation} onChange={(e) => setCrop({ rotation: Number(e.target.value) })} />
          </label>
          <div className="av-row">
            <button type="button" className="av-btn" onClick={() => beginAdjust(step.source)} disabled={!!busy}>
              Auto-detect
            </button>
            <button type="button" className="av-btn" onClick={() => setStep({ kind: 'camera' })} disabled={!!busy}>
              Retake
            </button>
          </div>
        </>
      )}

      <div className="av-row av-row--end">
        <button type="button" className="av-btn av-btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        {step?.kind === 'adjust' && (
          <button type="button" className="av-btn av-btn--primary" onClick={confirm} disabled={!!busy}>
            Use this face
          </button>
        )}
      </div>
    </div>
  );
}
