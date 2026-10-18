# Models (role C)

## Vision (MediaPipe)

The saber arena loads the MediaPipe pose model (`pose_landmarker_full.task`) from Google’s public model storage and wasm from the `@mediapipe/tasks-vision@1.1.1` CDN, so laptops do not need a separate download step.

To vendor offline later, place `pose_landmarker_full.task` here and point `POSE_MODEL_URL` in `src/arena3d/ArenaDuel.tsx` at `/models/...` (and `WASM_ROOT` in `src/camera/mediapipeVision.ts` for the wasm).

MediaPipe pose tracking is not the Perceptron sponsor integration.
