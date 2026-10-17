import { describe, expect, it, vi } from "vitest"
import { CameraStartError } from "./openRearCamera"
import { openDebugCamera } from "./openDebugCamera"

describe("openDebugCamera", () => {
  it("uses the environment camera when available", async () => {
    const stop = vi.fn()
    const getUserMedia = vi.fn(async () => ({ getTracks: () => [{ kind: "video", stop }] }))
    const session = await openDebugCamera({ getUserMedia }, true)
    expect(session.kind).toBe("environment")
    expect(getUserMedia).toHaveBeenCalledOnce()
  })

  it("falls back to the user camera when the rear lens is missing", async () => {
    const stop = vi.fn()
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("none", "OverconstrainedError"))
      .mockResolvedValueOnce({ getTracks: () => [{ kind: "video", stop }] })
    const session = await openDebugCamera({ getUserMedia }, true)
    expect(session.kind).toBe("user")
    expect(session.note.toLowerCase()).toContain("laptop")
    expect(getUserMedia).toHaveBeenCalledTimes(2)
  })

  it("does not fall back when permission is denied", async () => {
    const getUserMedia = vi.fn(async () => {
      throw new DOMException("no", "NotAllowedError")
    })
    await expect(openDebugCamera({ getUserMedia }, true)).rejects.toBeInstanceOf(CameraStartError)
    await expect(openDebugCamera({ getUserMedia }, true)).rejects.toMatchObject({ code: "denied" })
    expect(getUserMedia).toHaveBeenCalledTimes(2) // two attempts of the same failing start call
  })

  it("refuses insecure contexts", async () => {
    const getUserMedia = vi.fn()
    await expect(openDebugCamera({ getUserMedia }, false)).rejects.toMatchObject({ code: "insecure" })
    expect(getUserMedia).not.toHaveBeenCalled()
  })
})
