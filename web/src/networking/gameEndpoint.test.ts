import { afterEach, describe, expect, it, vi } from "vitest"
import { gameServerUrl, saberControllerUrl } from "./gameEndpoint"

afterEach(() => vi.unstubAllEnvs())

describe("shared game routing", () => {
  it("keeps same-origin development when shared URLs are unset", () => {
    vi.stubEnv("VITE_GAME_SERVER_URL", "")
    vi.stubEnv("VITE_SABER_CONTROLLER_URL", "")
    expect(gameServerUrl()).toBeUndefined()
    expect(saberControllerUrl("ABC234", "https://localhost:5173")).toBe("https://localhost:5173/?saber=ABC234")
  })
  it("uses the public controller frontend instead of the laptop's localhost", () => {
    vi.stubEnv("VITE_SABER_CONTROLLER_URL", "https://shared.example/")
    expect(saberControllerUrl("ABC234", "https://localhost:5173")).toBe("https://shared.example/?saber=ABC234")
  })
  it("creates a fresh controller URL without copying unrelated query parameters", () => {
    vi.stubEnv("VITE_SABER_CONTROLLER_URL", "https://shared.example/old?dev=arena")
    expect(saberControllerUrl("ABC234", "https://localhost:5173")).toBe("https://shared.example/?saber=ABC234")
  })
})
