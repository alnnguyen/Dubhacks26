import { afterEach, describe, expect, it, vi } from "vitest"
import { createGameClient, REPLY_TIMEOUT_MS, type GameClient, type PlayerView } from "./index"
import type { SocketLike } from "./gameClient"

type Ack = (err: Error | null, reply: any) => void

/** Records emits and lets each test play the server's side. */
class FakeSocket implements SocketLike {
  connected = false
  listeners = new Map<string, ((...args: any[]) => void)[]>()
  sent: { event: string; payload: any; ack: Ack }[] = []

  on(event: string, listener: (...args: any[]) => void) {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener])
  }
  timeout(_ms: number) {
    return { emit: (event: string, payload: unknown, ack: Ack) => this.sent.push({ event, payload, ack }) }
  }
  disconnect() {
    this.connected = false
  }
  fire(event: string, ...args: unknown[]) {
    if (event === "connect") this.connected = true
    if (event === "disconnect") this.connected = false
    this.listeners.get(event)?.forEach((listener) => listener(...args))
  }
  last(event: string) {
    return [...this.sent].reverse().find((s) => s.event === event)!
  }
}

const view = (health: number): PlayerView => {
  const player = (slot: 1 | 2) => ({
    slot,
    connected: true,
    reconnectEndsInMs: null,
    health,
    action: "idle" as const,
    weapon: "rock" as const,
    throwCooldownEndsInMs: null,
    block: { active: false, endsInMs: null, cooldownEndsInMs: null },
    rock: null,
  })
  return { matchId: "demo-match", phase: "active", result: null, you: player(1), rival: player(2) }
}

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial }
  return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v), data }
}

let client: GameClient
let socket: FakeSocket

function setup(storage = memoryStorage()) {
  socket = new FakeSocket()
  client = createGameClient({ storage, createSocket: () => socket, now: () => 5000 })
  return storage
}

function joinOnline() {
  socket.fire("connect")
  socket.last("join").ack(null, { ok: true, slot: 1, view: view(100) })
}

afterEach(() => vi.useRealTimers())

describe("connecting", () => {
  it("joins with a stored playerId and goes online with the server's view", () => {
    setup(memoryStorage({ "jedi.playerId": "stored-player-id" }))
    expect(client.status()).toBe("connecting")
    joinOnline()
    expect(socket.last("join").payload).toEqual({ playerId: "stored-player-id" })
    expect(client.status()).toBe("online")
    expect(client.view()?.you.health).toBe(100)
  })

  it("creates and stores a playerId the first time", () => {
    const storage = setup()
    socket.fire("connect")
    const id = socket.last("join").payload.playerId
    expect(id).toMatch(/^[A-Za-z0-9_-]{8,64}$/)
    expect(storage.data["jedi.playerId"]).toBe(id)
  })

  it("goes offline with the reason when the match is full", () => {
    setup()
    socket.fire("connect")
    socket.last("join").ack(null, { ok: false, reason: "match_full" })
    expect(client.status()).toBe("offline")
    expect(client.joinError()).toBe("match_full")
  })

  it("reports offline on disconnect and joins again on reconnect", () => {
    setup()
    joinOnline()
    const statuses: string[] = []
    client.onStatus((s) => statuses.push(s))
    socket.fire("disconnect")
    joinOnline()
    expect(statuses).toEqual(["offline", "connecting", "online"])
    expect(socket.sent.filter((s) => s.event === "join")).toHaveLength(2)
  })
})

describe("game state", () => {
  it("passes each view from the server to listeners", () => {
    setup()
    joinOnline()
    const seen: number[] = []
    const stop = client.onView((v) => seen.push(v.rival!.health))
    socket.fire("view", { ...view(100), rival: { ...view(80).rival! } })
    stop()
    socket.fire("view", view(60))
    expect(seen).toEqual([80])
    expect(client.view()?.you.health).toBe(60)
  })

  it("passes rockLanded events to listeners", () => {
    setup()
    const events: unknown[] = []
    client.onRockLanded((e) => events.push(e))
    socket.fire("rockLanded", { attackerSlot: 2, blocked: true, damage: 0 })
    expect(events).toEqual([{ attackerSlot: 2, blocked: true, damage: 0 }])
  })
})

describe("commands", () => {
  it("sends a fresh command ID and resolves with the server's reply", async () => {
    setup()
    joinOnline()
    const first = client.startBlock()
    const sentFirst = socket.last("command")
    sentFirst.ack(null, { commandId: sentFirst.payload.commandId, status: "accepted" })

    const second = client.endBlock()
    const sentSecond = socket.last("command")
    sentSecond.ack(null, { commandId: sentSecond.payload.commandId, status: "rejected", reason: "not_blocking" })

    expect(sentFirst.payload).toEqual({ commandId: "c5000", type: "startBlock" })
    expect(sentSecond.payload).toEqual({ commandId: "c5001", type: "endBlock" })
    expect(await first).toEqual({ commandId: "c5000", status: "accepted" })
    expect(await second).toMatchObject({ status: "rejected", reason: "not_blocking" })
  })

  it("starts IDs from page-load time so a reload can't reuse an earlier ID", () => {
    const storage = memoryStorage()
    const ids: string[] = []
    for (const loadedAt of [1_000_000, 1_060_000]) {
      socket = new FakeSocket()
      client = createGameClient({ storage, createSocket: () => socket, now: () => loadedAt })
      joinOnline()
      void client.throwRock()
      void client.throwRock()
      ids.push(...socket.sent.filter((s) => s.event === "command").map((s) => s.payload.commandId))
    }
    expect(ids).toEqual(["c1000000", "c1000001", "c1060000", "c1060001"])
  })

  it("refuses commands while not online instead of queueing them", async () => {
    setup()
    expect(await client.throwRock()).toMatchObject({ status: "rejected", reason: "offline" })
    expect(socket.sent.some((s) => s.event === "command")).toBe(false)
  })

  it("reports no_response when the server never answers", async () => {
    setup()
    joinOnline()
    const reply = client.throwRock()
    socket.last("command").ack(new Error("operation has timed out"), undefined)
    expect(await reply).toMatchObject({ status: "rejected", reason: "no_response" })
    expect(REPLY_TIMEOUT_MS).toBe(3000)
  })
})
