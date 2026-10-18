export type CameraFailureCode = "insecure" | "denied" | "missing" | "unsupported"

export class CameraStartError extends Error {
  readonly code: CameraFailureCode

  constructor(code: CameraFailureCode, message: string) {
    super(message)
    this.name = "CameraStartError"
    this.code = code
  }
}

export type CameraTrackCapabilities = {
  zoom?: { min?: number; max?: number; step?: number }
}

export type CameraTrack = {
  kind: string
  stop: () => void
  getCapabilities?: () => CameraTrackCapabilities
  applyConstraints?: (constraints: MediaTrackConstraints) => Promise<void>
  getSettings?: () => { zoom?: number; facingMode?: string }
}

export type CameraStream = { getTracks: () => CameraTrack[] }

export type CameraDevices = {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<CameraStream>
}

export const REAR_CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: { facingMode: { ideal: "environment" } },
}

/** Prefer a wide / low-zoom rear lens when the UA exposes zoom constraints. */
export const REAR_WIDE_CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: "environment" },
    // zoom is a non-standard MediaTrackConstraintKey on Chromium / Safari.
    advanced: [{ zoom: 0.5 } as MediaTrackConstraintSet],
  },
}

export type RearCameraSession = {
  stream: CameraStream
  stop: () => void
  /** True when we successfully biased toward ultra-wide / min zoom. */
  wide: boolean
  note: string
}

function failureCode(error: unknown): CameraFailureCode {
  const name = error instanceof DOMException || error instanceof Error ? error.name : ""
  if (name === "NotAllowedError" || name === "SecurityError") return "denied"
  if (name === "NotFoundError" || name === "OverconstrainedError") return "missing"
  return "unsupported"
}

function videoTracks(stream: CameraStream): CameraTrack[] {
  return stream.getTracks().filter((track) => track.kind === "video")
}

/**
 * Pull zoom toward the device minimum (often 0.5× ultra-wide on multi-lens phones).
 * Returns whether a wide bias was applied.
 */
export async function preferWideZoom(track: CameraTrack): Promise<boolean> {
  const caps = track.getCapabilities?.()
  const zoom = caps?.zoom
  if (!zoom || typeof zoom.min !== "number" || !track.applyConstraints) return false
  try {
    await track.applyConstraints({ advanced: [{ zoom: zoom.min } as MediaTrackConstraintSet] })
    return true
  } catch {
    try {
      await track.applyConstraints({ zoom: zoom.min } as MediaTrackConstraints)
      return true
    } catch {
      return false
    }
  }
}

/** Opens the rear camera. Callers must pass a real secure-context flag from the page. */
export async function openRearCamera(devices: CameraDevices, isSecureContext: boolean): Promise<RearCameraSession> {
  if (!isSecureContext) {
    throw new CameraStartError("insecure", "Rear camera requires an HTTPS page.")
  }

  let stream: CameraStream
  try {
    stream = await devices.getUserMedia(REAR_WIDE_CAMERA_CONSTRAINTS)
  } catch (wideError) {
    // Permission denial should not retry; overconstrained wide zoom falls back to default rear.
    if (failureCode(wideError) === "denied") {
      throw new CameraStartError("denied", "Camera permission was denied.")
    }
    try {
      stream = await devices.getUserMedia(REAR_CAMERA_CONSTRAINTS)
    } catch (error) {
      const code = failureCode(error)
      throw new CameraStartError(code, code === "denied" ? "Camera permission was denied." : "Rear camera is unavailable.")
    }
  }

  let wide = false
  for (const track of videoTracks(stream)) {
    if (await preferWideZoom(track)) wide = true
  }

  const note = wide
    ? "Rear / environment · wide zoom preferred (~0.5× when the device offers it)"
    : "Wide lens unavailable — default rear"

  return {
    stream,
    wide,
    note,
    stop() {
      for (const track of stream.getTracks()) track.stop()
    },
  }
}
