import { FACE_ASPECT, type FaceCrop } from '../types/avatar';
import { cropFromDetection, defaultCrop, type FaceBox } from './faceCrop';

/**
 * Local photo processing for the helmet face. Images never leave the browser:
 * detection runs in MediaPipe's wasm (only the model file is downloaded) and
 * cropping/masking happens on a canvas.
 */

export type FaceSource = HTMLCanvasElement | ImageBitmap;

const MEDIAPIPE_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm';
const FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

/** Longest edge kept from uploads; enough for a crisp 512 px face. */
const MAX_SOURCE_EDGE = 1600;
export const FACE_OUTPUT_WIDTH = 384;

export function sourceSize(source: FaceSource) {
  return { width: source.width, height: source.height };
}

/** Decodes a picked file (respecting EXIF rotation) and downsizes huge photos. */
export async function loadPhoto(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const k = Math.min(1, MAX_SOURCE_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * k);
  canvas.height = Math.round(bitmap.height * k);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

/** Grabs the current camera frame. Mirrored, so the result matches the selfie preview. */
export function captureFrame(video: HTMLVideoElement, mirror = true): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const g = canvas.getContext('2d')!;
  if (mirror) {
    g.translate(canvas.width, 0);
    g.scale(-1, 1);
  }
  g.drawImage(video, 0, 0);
  return canvas;
}

type Detector = { detect: (image: HTMLCanvasElement) => { detections: { boundingBox?: { originX: number; originY: number; width: number; height: number }; categories: { score: number }[] }[] } };
let detectorPromise: Promise<Detector | null> | null = null;

async function getDetector(): Promise<Detector | null> {
  detectorPromise ??= (async () => {
    try {
      const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
      return (await FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: 'CPU' },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.5,
      })) as unknown as Detector;
    } catch (error) {
      console.warn('Face detection unavailable; using manual crop.', error);
      detectorPromise = null; // allow a retry later (e.g. after reconnecting)
      return null;
    }
  })();
  return detectorPromise;
}

/** Largest face in the photo, or null (no face, or detector unavailable/offline). */
export async function detectFace(source: HTMLCanvasElement): Promise<FaceBox | null> {
  const detector = await getDetector();
  if (!detector) return null;
  try {
    const { detections } = detector.detect(source);
    const boxes = detections.flatMap((d) => (d.boundingBox ? [d.boundingBox] : []));
    if (!boxes.length) return null;
    const best = boxes.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
    return { x: best.originX, y: best.originY, width: best.width, height: best.height };
  } catch (error) {
    console.warn('Face detection failed; using manual crop.', error);
    return null;
  }
}

/** Initial crop: detected face if possible, centered guess otherwise. */
export async function autoCrop(source: HTMLCanvasElement): Promise<{ crop: FaceCrop; detected: boolean }> {
  const box = await detectFace(source);
  return box
    ? { crop: cropFromDetection(box, source.width, source.height), detected: true }
    : { crop: defaultCrop(source.width, source.height), detected: false };
}

/**
 * Renders the cropped face into a transparent oval with a soft edge. The photo
 * pixels themselves are untouched apart from scaling: no filters, no redrawing.
 */
export function renderFace(source: FaceSource, crop: FaceCrop, outWidth = FACE_OUTPUT_WIDTH, target?: HTMLCanvasElement): HTMLCanvasElement {
  const outHeight = Math.round(outWidth * FACE_ASPECT);
  const canvas = target ?? document.createElement('canvas');
  if (canvas.width !== outWidth) canvas.width = outWidth;
  if (canvas.height !== outHeight) canvas.height = outHeight;
  const g = canvas.getContext('2d')!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, outWidth, outHeight);

  const k = outWidth / crop.width;
  g.imageSmoothingQuality = 'high';
  g.translate(outWidth / 2, outHeight / 2);
  g.rotate((-crop.rotation * Math.PI) / 180);
  g.scale(k, k);
  g.drawImage(source, -crop.cx, -crop.cy);

  // Soft oval: radial gradient drawn in a vertically stretched space.
  g.setTransform(1, 0, 0, FACE_ASPECT, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  const r = outWidth / 2;
  const mask = g.createRadialGradient(r, r, r * 0.8, r, r, r);
  mask.addColorStop(0, 'rgba(0,0,0,1)');
  mask.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = mask;
  g.fillRect(0, 0, outWidth, outWidth);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  return canvas;
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the face image.'))), 'image/png'),
  );
}
