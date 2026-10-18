import { describe, expect, it, vi } from "vitest"
import {
  CameraStartError,
  openRearCamera,
  preferWideZoom,
  REAR_CAMERA_CONSTRAINTS,
  REAR_WIDE_CAMERA_CONSTRAINTS,
  type CameraDevices,
  type CameraTrack,
} from "./openRearCamera"

function devices(getUserMedia: CameraDevices["getUserMedia"]): CameraDevices {
  return { getUserMedia }
}

describe("preferWideZoom", () => {
  it("applies the minimum zoom from track capabilities", async () => {
    const applyConstraints = vi.fn(async () => undefined)
    const track: CameraTrack = {
      kind: "video",
      stop: () => undefined,
      getCapabilities: () => ({ zoom: { min: 0.5, max: 10 } }),
      applyConstraints,
    }
    await expect(preferWideZoom(track)).resolves.toBe(true)
    expect(applyConstraints).toHaveBeenCalled()
  })

  it("returns false when zoom is unsupported", async () => {
    const track: CameraTrack = { kind: "video", stop: () => undefined }
    await expect(preferWideZoom(track)).resolves.toBe(false)
  })
})

describe("openRearCamera", () => {
  it("refuses an insecure page without calling getUserMedia", async () => {
    const getUserMedia = vi.fn()
    await expect(openRearCamera(devices(getUserMedia), false)).rejects.toMatchObject({ code: "insecure" })
    expect(getUserMedia).not.toHaveBeenCalled()
  })

  it("prefers wide constraints then falls back to plain rear", async () => {
    const stop = vi.fn()
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("no zoom", "OverconstrainedError"))
      .mockResolvedValueOnce({ getTracks: () => [{ kind: "video", stop }] })
    const session = await openRearCamera(devices(getUserMedia), true)
    expect(getUserMedia).toHaveBeenNthCalledWith(1, REAR_WIDE_CAMERA_CONSTRAINTS)
    expect(getUserMedia).toHaveBeenNthCalledWith(2, REAR_CAMERA_CONSTRAINTS)
    expect(session.wide).toBe(false)
    expect(session.note).toContain("Wide lens unavailable")
    session.stop()
    expect(stop).toHaveBeenCalledOnce()
  })

  it("marks wide when min zoom applies on the track", async () => {
    const applyConstraints = vi.fn(async () => undefined)
    const getUserMedia = vi.fn(async () => ({
      getTracks: () => [
        {
          kind: "video",
          stop: () => undefined,
          getCapabilities: () => ({ zoom: { min: 0.5, max: 5 } }),
          applyConstraints,
        },
      ],
    }))
    const session = await openRearCamera(devices(getUserMedia), true)
    expect(session.wide).toBe(true)
    expect(session.note).toMatch(/0\.5/)
    expect(applyConstraints).toHaveBeenCalled()
  })

  it("maps a denied permission", async () => {
    const error = new DOMException("no", "NotAllowedError")
    await expect(openRearCamera(devices(async () => { throw error }), true)).rejects.toBeInstanceOf(CameraStartError)
    await expect(openRearCamera(devices(async () => { throw error }), true)).rejects.toMatchObject({ code: "denied" })
  })

  it("maps a missing camera when both constraint attempts fail", async () => {
    const getUserMedia = vi.fn(async () => {
      throw new DOMException("none", "OverconstrainedError")
    })
    await expect(openRearCamera(devices(getUserMedia), true)).rejects.toMatchObject({ code: "missing" })
    expect(getUserMedia).toHaveBeenCalledTimes(2)
  })

  it("maps an unknown failure", async () => {
    await expect(openRearCamera(devices(async () => { throw new Error("boom") }), true)).rejects.toMatchObject({
      code: "unsupported",
    })
  })
})
