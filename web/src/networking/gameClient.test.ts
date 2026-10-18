import { afterEach, describe, expect, it, vi } from "vitest"
import { createGameClient, REPLY_TIMEOUT_MS, type GameClient, type LobbyView, type PlayerView } from "./index"
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
  volatile = { emit: (event: string, payload: unknown) => void this.sent.push({ event, payload, ack: () => {} }) }
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
    pilotId: `p${slot}`,
    callsign: `PILOT ${slot}`,
    connected: true,
    reconnectEndsInMs: null,
    ready: true,
    rematch: false,
    health,
    saber: { swinging: false, cooldownEndsInMs: null, paired: false, phoneLive: false, bodyReady: false, saberReady: false },
  })
  const world = { id: "mars" as const, name: "Mars", gravityMps2: 3.7 }
  return {
    matchId: "m1",
    phase: "active",
    startsInMs: null,
    world,
    result: null,
    board: { cellSize: 0.65, rows: 3, stepMs: 110 },
    you: player(1),
    rival: player(2),
  }
}

const pilot = (id: string) => ({ id, callsign: id.toUpperCase(), status: "available" as const, wins: 0, losses: 0 })
const lobbyView = (others: string[] = []): LobbyView => ({
  you: pilot("pme"),
  pilots: others.map(pilot),
  challenge: null,
  pairCode: "ABC234",
})

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

function joinOnline(matchView: PlayerView | null = view(100)) {
  socket.fire("connect")
  socket.last("join").ack(null, { ok: true, lobby: lobbyView(), view: matchView })
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe("connecting", () => {
  it("routes to the configured shared server while preserving an explicit override", () => {
    vi.stubEnv("VITE_GAME_SERVER_URL", "https://shared.example")
    const createSocket = vi.fn(() => new FakeSocket())
    const shared = createGameClient({ storage: null, createSocket })
    expect(createSocket).toHaveBeenLastCalledWith("https://shared.example")
    shared.close()
    const local = createGameClient({ url: "http://localhost:3001", storage: null, createSocket })
    expect(createSocket).toHaveBeenLastCalledWith("http://localhost:3001")
    local.close()
  })

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

  it("goes offline with the reason when the join is refused", () => {
    setup()
    socket.fire("connect")
    socket.last("join").ack(null, { ok: false, reason: "invalid_request" })
    expect(client.status()).toBe("offline")
    expect(client.joinError()).toBe("invalid_request")
  })

  it("sends the stored callsign on join and stores a new one", () => {
    const storage = setup(memoryStorage({ "jedi.callsign": "NOVA" }))
    joinOnline()
    expect(socket.last("join").payload.callsign).toBe("NOVA")
    void client.setCallsign("VEX")
    expect(storage.data["jedi.callsign"]).toBe("VEX")
    expect(socket.last("command").payload).toMatchObject({ type: "setCallsign", callsign: "VEX" })
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
  it("keeps the lobby from the join reply and from lobby events", () => {
    setup()
    joinOnline(null)
    expect(client.lobby()?.you.id).toBe("pme")
    expect(client.view()).toBeNull()
    const seen: number[] = []
    client.onLobby((l) => seen.push(l.pilots.length))
    socket.fire("lobby", lobbyView(["pnova", "pvex"]))
    expect(seen).toEqual([2])
    expect(client.lobby()?.pilots.map((p) => p.callsign)).toEqual(["PNOVA", "PVEX"])
  })

  it("clears the view when the server says the player left their match", () => {
    setup()
    joinOnline()
    socket.fire("view", null)
    expect(client.view()).toBeNull()
  })

  it("passes each view from the server to listeners", () => {
    setup()
    joinOnline()
    const seen: number[] = []
    const stop = client.onView((v) => seen.push(v!.rival.health))
    socket.fire("view", { ...view(100), rival: { ...view(80).rival } })
    stop()
    socket.fire("view", view(60))
    expect(seen).toEqual([80])
    expect(client.view()?.you.health).toBe(60)
  })
})

describe("arena stream", () => {
  const pose = { tracked: true, joints: [], calibrated: true, setup: null }

  it("streams body poses with increasing seq from page-load time", () => {
    setup()
    joinOnline()
    client.sendBodyPose(pose)
    client.sendBodyPose(pose)
    const sent = socket.sent.filter((s) => s.event === "bodyPose").map((s) => s.payload.seq)
    expect(sent).toEqual([5000, 5001])
  })

  it("drops poses while offline instead of queueing them", () => {
    setup()
    client.sendBodyPose(pose)
    expect(socket.sent.some((s) => s.event === "bodyPose")).toBe(false)
  })

  it("passes arena frames and outcomes to listeners", () => {
    setup()
    joinOnline()
    const frames: unknown[] = []
    const outcomes: unknown[] = []
    client.onArena((f) => frames.push(f))
    client.onSaberResolved((e) => outcomes.push(e))
    socket.fire("arena", { serverMs: 0, engaged: false, players: [] })
    socket.fire("saberResolved", { attackerSlot: 2, outcome: "blocked", damage: 0 })
    expect(frames).toEqual([{ serverMs: 0, engaged: false, players: [] }])
    const steps: unknown[] = []
    client.onStepped((e) => steps.push(e))
    socket.fire("stepped", { slot: 1, cell: { q: 0, r: 0 } })
    expect(steps).toEqual([{ slot: 1, cell: { q: 0, r: 0 } }])
    void client.step("left")
    expect(socket.last("command").payload).toMatchObject({ type: "step", direction: "left" })
    const readings: unknown[] = []
    client.onPhoneAim((a) => readings.push(a))
    socket.fire("phoneAim", { seq: 1, tracked: true, top: [0, 0, 1], rate: 0 })
    expect(readings).toHaveLength(1)
    void client.calibrateSaber({ forward: [0, 1], hand: "right", mirror: false, done: true })
    expect(socket.last("command").payload).toMatchObject({ type: "calibrateSaber", calibration: { hand: "right" } })
    expect(outcomes).toEqual([{ attackerSlot: 2, outcome: "blocked", damage: 0 }])
  })
})

describe("commands", () => {
  it("sends a fresh command ID and resolves with the server's reply", async () => {
    setup()
    joinOnline()
    const first = client.ready()
    const sentFirst = socket.last("command")
    sentFirst.ack(null, { commandId: sentFirst.payload.commandId, status: "accepted" })

    const second = client.ready()
    const sentSecond = socket.last("command")
    sentSecond.ack(null, { commandId: sentSecond.payload.commandId, status: "rejected", reason: "match_not_active" })

    expect(sentFirst.payload).toEqual({ commandId: "c5000", type: "ready" })
    expect(sentSecond.payload).toEqual({ commandId: "c5001", type: "ready" })
    expect(await first).toEqual({ commandId: "c5000", status: "accepted" })
    expect(await second).toMatchObject({ status: "rejected", reason: "match_not_active" })
  })

  it("starts IDs from page-load time so a reload can't reuse an earlier ID", () => {
    const storage = memoryStorage()
    const ids: string[] = []
    for (const loadedAt of [1_000_000, 1_060_000]) {
      socket = new FakeSocket()
      client = createGameClient({ storage, createSocket: () => socket, now: () => loadedAt })
      joinOnline()
      void client.ready()
      void client.ready()
      ids.push(...socket.sent.filter((s) => s.event === "command").map((s) => s.payload.commandId))
    }
    expect(ids).toEqual(["c1000000", "c1000001", "c1060000", "c1060001"])
  })

  it("lobby and match commands carry their arguments", () => {
    setup()
    joinOnline()
    void client.challenge("pnova")
    void client.acceptChallenge("ch1")
    void client.declineChallenge("ch2")
    void client.cancelChallenge("ch3")
    void client.ready()
    void client.forfeit()
    void client.rematch()
    void client.leaveMatch()
    const payloads = socket.sent.filter((s) => s.event === "command").map(({ payload: { commandId, ...rest } }) => rest)
    expect(payloads).toEqual([
      { type: "challenge", pilotId: "pnova" },
      { type: "acceptChallenge", challengeId: "ch1" },
      { type: "declineChallenge", challengeId: "ch2" },
      { type: "cancelChallenge", challengeId: "ch3" },
      { type: "ready" },
      { type: "forfeit" },
      { type: "rematch" },
      { type: "leaveMatch" },
    ])
  })

  it("refuses commands while not online instead of queueing them", async () => {
    setup()
    expect(await client.ready()).toMatchObject({ status: "rejected", reason: "offline" })
    expect(socket.sent.some((s) => s.event === "command")).toBe(false)
  })

  it("reports no_response when the server never answers", async () => {
    setup()
    joinOnline()
    const reply = client.ready()
    socket.last("command").ack(new Error("operation has timed out"), undefined)
    expect(await reply).toMatchObject({ status: "rejected", reason: "no_response" })
    expect(REPLY_TIMEOUT_MS).toBe(3000)
  })
})


describe("read-only copilot transport", () => {
  it("never queues provider access while offline", async () => {
    setup();
    expect(await client.copilotSession()).toEqual({ok: false, reason: "offline"});
    expect(await client.copilotContext()).toEqual({ok: false, reason: "offline"});
    expect(socket.sent).toHaveLength(0);
  });
  it("requests state without accepting a caller-supplied identity and handles missing replies", async () => {
    setup(); joinOnline(null);
    const context = client.copilotContext();
    expect(socket.last("copilot:context").payload).toEqual({});
    socket.last("copilot:context").ack(null, {ok: true, context: {source: "live", lobby: lobbyView(), match: null}});
    expect(await context).toMatchObject({ok: true, context: {source: "live"}});
    const session = client.copilotSession();
    socket.last("copilot:session").ack(new Error("timeout"), undefined);
    expect(await session).toEqual({ok: false, reason: "no_response"});
  });
});

describe('replay transport', () => {
  it('never uploads while offline or when the server refuses the ticket', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    setup();
    const video = new Blob(['mock'], {type: 'video/webm'});
    expect(await client.analyzeReplay('m1', video, 5)).toEqual({ok: false, reason: 'offline'});
    joinOnline();
    const response = client.analyzeReplay('m1', video, 5);
    expect(socket.last('replay:ticket').payload).toEqual({matchId: 'm1'});
    socket.last('replay:ticket').ack(null, {ok: false, reason: 'unavailable'});
    expect(await response).toEqual({ok: false, reason: 'unavailable'});
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('uploads only with a server ticket to the same configured backend and honors cancellation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ok: false, reason: 'no_moments'})));
    vi.stubGlobal('fetch', fetchMock);
    socket = new FakeSocket();
    client = createGameClient({url: 'https://replay-game.example', storage: null, createSocket: () => socket});
    joinOnline();
    const controller = new AbortController();
    const video = new Blob(['mock'], {type: 'video/webm'});
    const response = client.analyzeReplay('m1', video, 5, controller.signal);
    socket.last('replay:ticket').ack(null, {ok: true, ticket: 'short-lived-ticket'});
    expect(await response).toEqual({ok: false, reason: 'no_moments'});
    const [url, request] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe('https://replay-game.example/replay/m1');
    expect(request.body).toBe(video);
    expect(request.headers.Authorization).toBe('Bearer short-lived-ticket');
    expect(request.headers['X-Replay-Duration']).toBe('5');
    expect(request.signal.aborted).toBe(false);
    controller.abort();
    expect(request.signal.aborted).toBe(true);
  });
});
