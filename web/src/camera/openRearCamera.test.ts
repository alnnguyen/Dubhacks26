import { describe, expect, it, vi } from "vitest"
import { CameraStartError, openRearCamera, REAR_CAMERA_CONSTRAINTS, type CameraDevices } from "./openRearCamera"

function devices(getUserMedia: CameraDevices["getUserMedia"]): CameraDevices {
  return { getUserMedia }
}

describe("openRearCamera", () => {
  it("refuses an insecure page without calling getUserMedia", async () => {
    const getUserMedia = vi.fn()
    await expect(openRearCamera(devices(getUserMedia), false)).rejects.toMatchObject({ code: "insecure" })
    expect(getUserMedia).not.toHaveBeenCalled()
  })

  it("requests the rear camera with audio off", async () => {
    const stop = vi.fn()
    const getUserMedia = vi.fn(async () => ({ getTracks: () => [{ kind: "video", stop }] }))
    const session = await openRearCamera(devices(getUserMedia), true)
    expect(getUserMedia).toHaveBeenCalledWith(REAR_CAMERA_CONSTRAINTS)
    expect(REAR_CAMERA_CONSTRAINTS.audio).toBe(false)
    expect(REAR_CAMERA_CONSTRAINTS.video).toEqual({ facingMode: { ideal: "environment" } })
    session.stop()
    expect(stop).toHaveBeenCalledOnce()
  })

  it("maps a denied permission", async () => {
    const error = new DOMException("no", "NotAllowedError")
    await expect(openRearCamera(devices(async () => { throw error }), true)).rejects.toBeInstanceOf(CameraStartError)
    await expect(openRearCamera(devices(async () => { throw error }), true)).rejects.toMatchObject({ code: "denied" })
  })

  it("maps a missing or overconstrained camera and does not swap to the front lens", async () => {
    const getUserMedia = vi.fn(async () => {
      throw new DOMException("none", "OverconstrainedError")
    })
    await expect(openRearCamera(devices(getUserMedia), true)).rejects.toMatchObject({ code: "missing" })
    expect(getUserMedia).toHaveBeenCalledTimes(1)
  })

  it("maps an unknown failure", async () => {
    await expect(openRearCamera(devices(async () => { throw new Error("boom") }), true)).rejects.toMatchObject({
      code: "unsupported",
    })
  })
})
