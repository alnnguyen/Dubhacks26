# Models (role C)

## Vision (MediaPipe)

The debug harness currently loads MediaPipe `.task` models from Google’s public model storage and wasm from the `@mediapipe/tasks-vision@1.1.1` CDN so phones do not need a separate download step during the framing gate.

To vendor offline later, place:

- `hand_landmarker.task`
- `pose_landmarker_lite.task`

here and point `HAND_MODEL_URL` / `POSE_MODEL_URL` in `src/camera/mediapipeVision.ts` at `/models/...`.

MediaPipe hand/pose tracking is not the Perceptron sponsor integration.

## Handgun GLB (duel overlay)

Installed: **`gun.glb`** — X-9 Pulse Laser Blaster from `x-9-pulse-laser-blaster-sci-fi-weapon-model.zip`, textures resized to ≤1024px (~3.2MB) for phone.

The overlay loads `/models/gun.glb` when the active weapon is Gun and a hand is tracked. If the file is missing, the duel still runs (tracers + HUD only).

See `gun.ATTRIBUTION.md` for source notes.

To replace: overwrite `gun.glb` with another self-contained GLB (prefer ≤1k textures). USDZ is not used in the browser path.
