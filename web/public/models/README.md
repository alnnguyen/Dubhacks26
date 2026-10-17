# Vision models (role C)

The debug harness currently loads MediaPipe `.task` models from Google’s public model storage and wasm from the `@mediapipe/tasks-vision@1.1.1` CDN so phones do not need a separate download step during the framing gate.

To vendor offline later, place:

- `hand_landmarker.task`
- `pose_landmarker_lite.task`

here and point `HAND_MODEL_URL` / `POSE_MODEL_URL` in `src/camera/mediapipeVision.ts` at `/models/...`.

MediaPipe hand/pose tracking is not the Perceptron sponsor integration.
