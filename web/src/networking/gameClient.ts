import { gameServerUrl } from "./gameEndpoint"
import { io } from "socket.io-client"
// Temporary cross-folder import until server/src/contracts.ts moves to packages/contracts.
import type {
  ChallengeView,
  ReplayTicketReply,
  ReplayReply,
  CopilotSessionReply,
  CopilotContextReply,
  LyraNarrateReply,
  Command,
  CommandReply,
  JoinReply,
  LobbyView,
  MatchResult,
  Pilot,
  PilotLocation,
  PlayerState,
  PlayerView,
  ArenaFrame,
  BodyPose,
  SaberAim,
  SaberCalibration,
  SaberResolved,
  SaberStatus,
  StepDirection,
  World,
} from "../../../server/src/contracts"

export type {
  ChallengeView,
  CopilotSessionReply,
  CopilotContextReply,
  CommandReply,
  LobbyView,
  MatchResult,
  Pilot,
  PilotLocation,
  PlayerState,
  PlayerView,
  ArenaFrame,
  BodyPose,
  SaberAim,
  SaberCalibration,
  SaberResolved,
  SaberStatus,
  StepDirection,
  World,
}

/** A command without its ID; this module adds one. */
type Payload = Command extends infer C ? (C extends Command ? Omit<C, "commandId"> : never) : never

export type ConnectionStatus = "connecting" | "online" | "offline"

/** Server replies, plus two outcomes decided on the phone when no server reply is possible. */
export type ClientReply =
  | CommandReply
  | { commandId: string; status: "rejected"; reason: "offline" | "no_response" }

export const REPLY_TIMEOUT_MS = 3000
const PLAYER_ID_KEY = "jedi.playerId"
const CALLSIGN_KEY = "jedi.callsign"

/** The subset of a Socket.IO client socket this module uses, so tests can fake it. */
export interface SocketLike {
  connected: boolean
  on(event: string, listener: (...args: any[]) => void): unknown
  timeout(ms: number): { emit(event: string, payload: unknown, ack: (err: Error | null, reply: any) => void): unknown }
  /** Fire-and-forget emits that are dropped rather than buffered while offline. */
  volatile: { emit(event: string, payload: unknown): unknown }
  disconnect(): unknown
}

export interface GameClientOptions {
  /** Defaults to VITE_GAME_SERVER_URL, or the page origin when unset (Vite proxies locally). */
  url?: string
  storage?: Pick<Storage, "getItem" | "setItem"> | null
  createSocket?: (url: string | undefined) => SocketLike
  now?: () => number
}

export interface GameClient {
  /** Opt-in post-match analysis. The permanent provider key stays on the server. */
  analyzeReplay(matchId: string, video: Blob, duration: number, signal?: AbortSignal): Promise<ReplayReply>
  /** Read-only Voice access on this already joined connection. */
  copilotSession(): Promise<CopilotSessionReply>
  copilotContext(): Promise<CopilotContextReply>
  /** Allowlisted LYRA arena lines via server Grok TTS (cue id only). */
  lyraNarrate(cue: string): Promise<LyraNarrateReply>
  status(): ConnectionStatus
  /** Why the last join failed, e.g. "invalid_request". Null while joined or still trying. */
  joinError(): string | null
  /** The shared room: you, the other connected pilots, and your latest challenge. Null until joined. */
  lobby(): LobbyView | null
  /** Your match, or null while you're not in one. */
  view(): PlayerView | null
  onStatus(listener: (status: ConnectionStatus) => void): () => void
  onLobby(listener: (lobby: LobbyView) => void): () => void
  onView(listener: (view: PlayerView | null) => void): () => void
  /** Both players' bodies and blades in the arena, every server tick. */
  onArena(listener: (frame: ArenaFrame) => void): () => void
  onSaberResolved(listener: (event: SaberResolved) => void): () => void
  /** Your own paired phone's readings, relayed by the server for the setup checks. */
  onPhoneAim(listener: (aim: SaberAim) => void): () => void
  /** Store what the laptop's guided setup measured about your phone. */
  calibrateSaber(calibration: SaberCalibration): Promise<ClientReply>
  /** A step was accepted (yours or your rival's), ahead of the next arena frame. */
  onStepped(listener: (event: { slot: 1 | 2; cell: { q: number; r: number }; orbitCenter?: [number, number] }) => void): () => void
  /** One step to a neighboring cell, relative to the way you face (forward is toward your rival's side). */
  step(direction: StepDirection): Promise<ClientReply>
  /**
   * Stream your own body from the laptop camera (~20 Hz). No reply; a stale
   * pose is useless, so nothing is sent while offline. This module numbers them.
   */
  sendBodyPose(pose: Omit<BodyPose, "seq">): void
  /** Stored on the phone and sent on every join, so it survives reloads. */
  setCallsign(callsign: string): Promise<ClientReply>
  /** Where you are flying in exploration, shown to other pilots. null clears it. Display only. */
  setLocation(location: PilotLocation | null): Promise<ClientReply>
  /** Without a destination the server rolls the world itself; the override exists for tests and tools. */
  challenge(pilotId: string, destination?: "mars" | "neptune"): Promise<ClientReply>
  acceptChallenge(challengeId: string): Promise<ClientReply>
  declineChallenge(challengeId: string): Promise<ClientReply>
  cancelChallenge(challengeId: string): Promise<ClientReply>
  /** Finished the briefing. The match starts once both players are ready. */
  ready(): Promise<ClientReply>
  /** Give this round to your rival but stay in the match, so you can still rematch. */
  forfeit(): Promise<ClientReply>
  /** After the match ends: play again with the same setup. A new round counts down once both ask. */
  rematch(): Promise<ClientReply>
  /** Back to the lobby. Before the match ends this forfeits it. */
  leaveMatch(): Promise<ClientReply>
  close(): void
}

export function createGameClient(options: GameClientOptions = {}): GameClient {
  const now = options.now ?? Date.now
  const storage = options.storage === undefined ? safeLocalStorage() : options.storage
  const playerId = loadPlayerId(storage)
  const socket = (options.createSocket ?? defaultSocket)(options.url ?? gameServerUrl())

  let status: ConnectionStatus = "connecting"
  let joinError: string | null = null
  let lobby: LobbyView | null = null
  let view: PlayerView | null = null
  // Starts at page-load time so IDs after a reload are higher than any sent before it.
  let nextCommand = now()

  const statusListeners = new Set<(status: ConnectionStatus) => void>()
  const lobbyListeners = new Set<(lobby: LobbyView) => void>()
  const viewListeners = new Set<(view: PlayerView | null) => void>()
  const arenaListeners = new Set<(frame: ArenaFrame) => void>()
  const phoneAimListeners = new Set<(aim: SaberAim) => void>()
  const steppedListeners = new Set<(event: { slot: 1 | 2; cell: { q: number; r: number }; orbitCenter?: [number, number] }) => void>()
  const resolvedListeners = new Set<(event: SaberResolved) => void>()
  // Page-load time, like command IDs, so poses after a reload are newer than any before it.
  let nextPose = now()

  function setStatus(next: ConnectionStatus) {
    if (next === status) return
    status = next
    statusListeners.forEach((listener) => listener(next))
  }

  function setLobby(next: LobbyView) {
    lobby = next
    lobbyListeners.forEach((listener) => listener(next))
  }

  function setView(next: PlayerView | null) {
    view = next
    viewListeners.forEach((listener) => listener(next))
  }

  // Socket.IO reconnects by itself; every new connection must join again.
  socket.on("connect", () => {
    setStatus("connecting")
    const callsign = readStorage(storage, CALLSIGN_KEY) ?? undefined
    socket.timeout(REPLY_TIMEOUT_MS).emit("join", { playerId, callsign }, (err, reply: JoinReply) => {
      if (err) return setStatus("offline")
      if (!reply.ok) {
        joinError = reply.reason
        return setStatus("offline")
      }
      joinError = null
      setLobby(reply.lobby)
      setView(reply.view)
      setStatus("online")
    })
  })
  socket.on("disconnect", () => setStatus("offline"))
  socket.on("connect_error", () => setStatus("offline"))
  socket.on("lobby", (next: LobbyView) => setLobby(next))
  socket.on("view", (next: PlayerView | null) => setView(next))
  socket.on("arena", (frame: ArenaFrame) => arenaListeners.forEach((listener) => listener(frame)))
  socket.on("phoneAim", (aim: SaberAim) => phoneAimListeners.forEach((listener) => listener(aim)))
  socket.on("stepped", (event: { slot: 1 | 2; cell: { q: number; r: number }; orbitCenter?: [number, number] }) => steppedListeners.forEach((listener) => listener(event)))
  socket.on("saberResolved", (event: SaberResolved) => resolvedListeners.forEach((listener) => listener(event)))

  function send(payload: Payload): Promise<ClientReply> {
    const commandId = `c${nextCommand++}`
    // Refuse instead of letting Socket.IO buffer it: a shot fired seconds late is worse than none.
    if (status !== "online" || !socket.connected) {
      return Promise.resolve({ commandId, status: "rejected", reason: "offline" })
    }
    return new Promise((resolve) => {
      socket.timeout(REPLY_TIMEOUT_MS).emit("command", { commandId, ...payload }, (err, reply: CommandReply) => {
        resolve(err ? { commandId, status: "rejected", reason: "no_response" } : reply)
      })
    })
  }

  function copilotRequest<T extends CopilotSessionReply | CopilotContextReply>(event: string, timeoutMs: number): Promise<T> {
    if (status !== 'online' || !socket.connected) return Promise.resolve({ ok: false, reason: 'offline' } as T)
    return new Promise(resolve => {
      socket.timeout(timeoutMs).emit(event, {}, (err, reply) => resolve(err ? { ok: false, reason: 'no_response' } as T : reply))
    })
  }

  function subscribe<T>(set: Set<T>, listener: T) {
    set.add(listener)
    return () => void set.delete(listener)
  }

  return {
    analyzeReplay: async (matchId, video, duration, signal) => {
      if (status !== 'online' || !socket.connected) return { ok: false, reason: 'offline' }
      const ticket = await new Promise<ReplayTicketReply>(resolve => {
        socket.timeout(REPLY_TIMEOUT_MS).emit('replay:ticket', { matchId }, (err, reply) =>
          resolve(err ? { ok: false, reason: 'no_response' } : reply))
      })
      if (!ticket.ok) return ticket
      try {
        const url = new URL(`/replay/${encodeURIComponent(matchId)}`, options.url ?? gameServerUrl() ?? location.origin)
        const res = await fetch(url, { method: 'POST', body: video,
          signal: AbortSignal.any([AbortSignal.timeout(65_000), ...(signal ? [signal] : [])]),
          headers: { Authorization: `Bearer ${ticket.ticket}`, 'Content-Type': video.type, 'X-Replay-Duration': String(duration) } })
        const reply = await res.json() as ReplayReply
        if (typeof reply?.ok !== 'boolean' || (reply.ok && (!Array.isArray(reply.moments) || !Array.isArray(reply.boxes) || reply.source !== 'perceptron'))) return { ok: false, reason: 'provider_error' }
        return reply
      } catch { return { ok: false, reason: 'no_response' } }
    },
    copilotSession: () => copilotRequest<CopilotSessionReply>('copilot:session', 18000),
    copilotContext: () => copilotRequest<CopilotContextReply>('copilot:context', REPLY_TIMEOUT_MS),
    lyraNarrate: (cue) => {
      if (status !== 'online' || !socket.connected) return Promise.resolve({ ok: false, reason: 'offline' })
      return new Promise(resolve => {
        socket.timeout(22000).emit('lyra:narrate', { cue }, (err, reply: LyraNarrateReply) =>
          resolve(err ? { ok: false, reason: 'no_response' } : reply))
      })
    },
    status: () => status,
    joinError: () => joinError,
    lobby: () => lobby,
    view: () => view,
    onStatus: (listener) => subscribe(statusListeners, listener),
    onLobby: (listener) => subscribe(lobbyListeners, listener),
    onView: (listener) => subscribe(viewListeners, listener),
    onArena: (listener) => subscribe(arenaListeners, listener),
    onPhoneAim: (listener) => subscribe(phoneAimListeners, listener),
    onStepped: (listener) => subscribe(steppedListeners, listener),
    calibrateSaber: (calibration) => send({ type: "calibrateSaber", calibration }),
    step: (direction) => send({ type: "step", direction }),
    onSaberResolved: (listener) => subscribe(resolvedListeners, listener),
    sendBodyPose: (pose) => {
      if (status !== "online" || !socket.connected) return
      socket.volatile.emit("bodyPose", { ...pose, seq: nextPose++ })
    },
    setCallsign: (callsign) => {
      writeStorage(storage, CALLSIGN_KEY, callsign)
      return send({ type: "setCallsign", callsign })
    },
    setLocation: (location) => send({ type: "setLocation", location }),
    challenge: (pilotId, destination) => send({ type: "challenge", pilotId, ...(destination ? { destination } : {}) }),
    acceptChallenge: (challengeId) => send({ type: "acceptChallenge", challengeId }),
    declineChallenge: (challengeId) => send({ type: "declineChallenge", challengeId }),
    cancelChallenge: (challengeId) => send({ type: "cancelChallenge", challengeId }),
    ready: () => send({ type: "ready" }),
    forfeit: () => send({ type: "forfeit" }),
    rematch: () => send({ type: "rematch" }),
    leaveMatch: () => send({ type: "leaveMatch" }),
    close: () => {
      socket.disconnect()
      setStatus("offline")
    },
  }
}

function defaultSocket(url: string | undefined): SocketLike {
  return url ? io(url) : io()
}

// Without storage (private mode, blocked site data) the ID lasts only for this page load.
function loadPlayerId(storage: Pick<Storage, "getItem" | "setItem"> | null): string {
  const stored = readStorage(storage, PLAYER_ID_KEY)
  if (stored) return stored
  const id = crypto.randomUUID()
  writeStorage(storage, PLAYER_ID_KEY, id)
  return id
}

function readStorage(storage: Pick<Storage, "getItem"> | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null
  } catch {
    return null
  }
}

function writeStorage(storage: Pick<Storage, "setItem"> | null, key: string, value: string) {
  try {
    storage?.setItem(key, value)
  } catch { /* keep going without it */ }
}

function safeLocalStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage
  } catch {
    return null
  }
}
