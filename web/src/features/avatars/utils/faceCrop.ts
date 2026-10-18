import { FACE_ASPECT, type FaceCrop } from '../types/avatar';

/** Face box from a detector, in source pixels. */
export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Detector boxes hug eyebrows-to-chin; widen and lift so the oval includes hairline and cheeks. */
export function cropFromDetection(box: FaceBox, imageWidth: number, imageHeight: number): FaceCrop {
  const width = Math.max(box.width, box.height / FACE_ASPECT) * 1.45;
  return clampCrop(
    { cx: box.x + box.width / 2, cy: box.y + box.height / 2 - box.height * 0.1, width, rotation: 0 },
    imageWidth,
    imageHeight,
  );
}

/** Centered guess for photos where no face was found. */
export function defaultCrop(imageWidth: number, imageHeight: number): FaceCrop {
  return { cx: imageWidth / 2, cy: imageHeight * 0.45, width: Math.min(imageWidth, imageHeight / FACE_ASPECT) * 0.6, rotation: 0 };
}

/** Keeps the crop a sensible size with its center on the image. */
export function clampCrop(crop: FaceCrop, imageWidth: number, imageHeight: number): FaceCrop {
  const minWidth = Math.min(imageWidth, imageHeight) * 0.05;
  const maxWidth = Math.max(imageWidth, imageHeight) * 1.5;
  const rotation = ((((crop.rotation + 180) % 360) + 360) % 360) - 180;
  return {
    cx: Math.min(Math.max(crop.cx, 0), imageWidth),
    cy: Math.min(Math.max(crop.cy, 0), imageHeight),
    width: Math.min(Math.max(crop.width, minWidth), maxWidth),
    rotation,
  };
}

/** Moves the crop by a drag in a view where the crop is drawn `scale` px per source px and rotated by -rotation. */
export function panCrop(crop: FaceCrop, dx: number, dy: number, scale: number): FaceCrop {
  const r = (crop.rotation * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  // Dragging the image right moves the crop window left over the source.
  return { ...crop, cx: crop.cx - (dx * cos - dy * sin) / scale, cy: crop.cy - (dx * sin + dy * cos) / scale };
}
