import { afterEach, describe, expect, it, vi } from "vitest"
import { createSaberClient } from "./saberClient"

type Ack = (err: Error | null, reply: unknown) => void

/** Records emits and lets each test play the server's side. */
class FakeSocket {
  connected = false
  listeners = new Map<string, ((...args: any[]) => void)[]>()
  acks: { event: string; payload: any; ack: Ack }[] = []
  volatileSent: { event: string; payload: any }[] = []
  volatile = { emit: (event: string, payload: unknown) => void this.volatileSent.push({ event, payload }) }
  on(event: string, listener: (...args: any[]) => void) {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener])
  }
  timeout(_ms: number) {
    return {
      emit: (event: string, payload: unknown, ack: Ack) => {
        this.acks.push({ event, payload, ack })
        if (event === "saberStep") this.stepAcks.push({ payload, ack })
      },
    }
  }
  stepAcks: { payload: any; ack: Ack }[] = []
  emit() {}
  disconnect() {
    this.connected = false
  }
  fire(event: string, ...args: unknown[]) {
    if (event === "connect") this.connected = true
    this.listeners.get(event)?.forEach((listener) => listener(...args))
  }
}

function setup() {
  const socket = new FakeSocket()
  const client = createSaberClient("ABC234", () => socket)
  return { socket, client }
}

const aim = { tracked: true, top: [0, 0, 1] as [number, number, number], rate: 0 }

afterEach(() => vi.unstubAllEnvs())

describe("saber client", () => {
  it("pairs on the same configured shared server as the laptop", () => {
    vi.stubEnv("VITE_GAME_SERVER_URL", "https://shared.example")
    const socket = new FakeSocket()
    const createSocket = vi.fn(() => socket)
    const client = createSaberClient("ABC234", createSocket)
    expect(createSocket).toHaveBeenCalledWith("https://shared.example")
    socket.fire("connect")
    expect(socket.acks[0]).toMatchObject({ event: "pairSaber", payload: { code: "ABC234" } })
    client.close()
  })

  it("pairs with its code on connect, then streams aims", () => {
    const { socket, client } = setup()
    expect(client.connection()).toBe("connecting")
    socket.fire("connect")
    expect(socket.acks[0]).toMatchObject({ event: "pairSaber", payload: { code: "ABC234" } })
    socket.acks[0].ack(null, { ok: true, status: { callsign: "NOVA", match: null } })
    expect(client.connection()).toBe("paired")
    expect(client.status()?.callsign).toBe("NOVA")
    client.sendAim(aim)
    expect(socket.volatileSent).toHaveLength(1)
  })

  it("sends a thumb swipe as a step with a fresh id and returns the server's reply", async () => {
    const { socket, client } = setup()
    expect(await client.step("forward")).toEqual({ status: "offline" })
    socket.fire("connect")
    socket.acks[0].ack(null, { ok: true, status: { callsign: "NOVA", match: null } })
    const reply = client.step("left")
    const sent = socket.stepAcks[0]
    expect(sent.payload.direction).toBe("left")
    sent.ack(null, { commandId: sent.payload.stepId, status: "rejected", reason: "blocked" })
    expect(await reply).toMatchObject({ status: "rejected", reason: "blocked" })
    void client.step("left")
    expect(socket.stepAcks[1].payload.stepId).not.toBe(sent.payload.stepId)
  })

  it("doesn't send aims before pairing", () => {
    const { socket, client } = setup()
    socket.fire("connect")
    client.sendAim(aim)
    expect(socket.volatileSent).toHaveLength(0)
  })

  it("reports an unreachable server instead of spinning on connecting", () => {
    const { socket, client } = setup()
    socket.fire("connect_error", new Error("xhr poll error"))
    expect(client.connection()).toBe("offline")
    expect(client.error()).toBe("xhr poll error")
    // Socket.IO retries by itself; a later connect clears the error.
    socket.fire("connect")
    expect(client.error()).toBeNull()
  })

  it("reports an unknown code and a server that never answers", () => {
    const { socket, client } = setup()
    socket.fire("connect")
    socket.acks[0].ack(null, { ok: false, reason: "invalid_code" })
    expect(client.connection()).toBe("invalid_code")
    socket.fire("connect")
    socket.acks[1].ack(new Error("timeout"), undefined)
    expect(client.connection()).toBe("offline")
    expect(client.error()).toMatch(/didn't answer/)
  })

  it("re-pairs after a reconnect", () => {
    const { socket } = setup()
    socket.fire("connect")
    socket.fire("disconnect")
    socket.fire("connect")
    expect(socket.acks.filter((a) => a.event === "pairSaber")).toHaveLength(2)
  })
})
