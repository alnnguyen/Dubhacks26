export type CameraFailureCode = "insecure" | "denied" | "missing" | "unsupported"

export class CameraStartError extends Error {
  readonly code: CameraFailureCode

  constructor(code: CameraFailureCode, message: string) {
    super(message)
    this.name = "CameraStartError"
    this.code = code
  }
}

export type CameraTrack = { kind: string; stop: () => void }

export type CameraStream = { getTracks: () => CameraTrack[] }

export type CameraDevices = {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<CameraStream>
}

export const REAR_CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: { facingMode: { ideal: "environment" } },
}

export type RearCameraSession = {
  stream: CameraStream
  stop: () => void
}

function failureCode(error: unknown): CameraFailureCode {
  const name = error instanceof DOMException || error instanceof Error ? error.name : ""
  if (name === "NotAllowedError" || name === "SecurityError") return "denied"
  if (name === "NotFoundError" || name === "OverconstrainedError") return "missing"
  return "unsupported"
}

/** Opens the rear camera. Callers must pass a real secure-context flag from the page. */
export async function openRearCamera(devices: CameraDevices, isSecureContext: boolean): Promise<RearCameraSession> {
  if (!isSecureContext) {
    throw new CameraStartError("insecure", "Rear camera requires an HTTPS page.")
  }

  let stream: CameraStream
  try {
    stream = await devices.getUserMedia(REAR_CAMERA_CONSTRAINTS)
  } catch (error) {
    const code = failureCode(error)
    throw new CameraStartError(code, code === "denied" ? "Camera permission was denied." : "Rear camera is unavailable.")
  }

  return {
    stream,
    stop() {
      for (const track of stream.getTracks()) track.stop()
    },
  }
}
