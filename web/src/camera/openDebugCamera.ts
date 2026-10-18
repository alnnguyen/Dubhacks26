import {
  CameraStartError,
  openRearCamera,
  type CameraDevices,
  type CameraStream,
  type RearCameraSession,
} from "./openRearCamera"

export type DebugCameraKind = "environment" | "user"

export type DebugCameraSession = RearCameraSession & {
  kind: DebugCameraKind
}

const USER_CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: { facingMode: { ideal: "user" } },
}

/**
 * Prefer rear camera for phone framing tests. On a laptop with no environment
 * lens, fall back to the user camera and label the session clearly.
 */
export async function openDebugCamera(
  devices: CameraDevices,
  isSecureContext: boolean,
): Promise<DebugCameraSession> {
  try {
    const session = await openRearCamera(devices, isSecureContext)
    return {
      ...session,
      kind: "environment",
    }
  } catch (error) {
    if (!(error instanceof CameraStartError) || error.code === "insecure" || error.code === "denied") {
      throw error
    }
  }

  if (!isSecureContext) {
    throw new CameraStartError("insecure", "Camera requires an HTTPS page.")
  }

  let stream: CameraStream
  try {
    stream = await devices.getUserMedia(USER_CAMERA_CONSTRAINTS)
  } catch (error) {
    const name = error instanceof DOMException || error instanceof Error ? error.name : ""
    if (name === "NotAllowedError" || name === "SecurityError") {
      throw new CameraStartError("denied", "Camera permission was denied.")
    }
    throw new CameraStartError("missing", "No usable camera found.")
  }

  return {
    stream,
    kind: "user",
    wide: false,
    note: "Laptop fallback — front / user camera (not the phone rear / 0.5× framing setup)",
    stop() {
      for (const track of stream.getTracks()) track.stop()
    },
  }
}
