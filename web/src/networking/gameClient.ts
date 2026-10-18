import { io } from "socket.io-client"
// Temporary cross-folder import until server/src/contracts.ts moves to packages/contracts.
import type {
  CommandReply,
  CommandType,
  JoinReply,
  PlayerView,
  RockLanded,
} from "../../../server/src/contracts"

export type { CommandReply, PlayerView, RockLanded }

export type ConnectionStatus = "connecting" | "online" | "offline"

/** Server replies, plus two outcomes decided on the phone when no server reply is possible. */
export type ClientReply =
  | CommandReply
  | { commandId: string; status: "rejected"; reason: "offline" | "no_response" }

export const REPLY_TIMEOUT_MS = 3000
const PLAYER_ID_KEY = "jedi.playerId"

/** The subset of a Socket.IO client socket this module uses, so tests can fake it. */
export interface SocketLike {
  connected: boolean
  on(event: string, listener: (...args: any[]) => void): unknown
  timeout(ms: number): { emit(event: string, payload: unknown, ack: (err: Error | null, reply: any) => void): unknown }
  disconnect(): unknown
}

export interface GameClientOptions {
  /** Defaults to the page's own origin, which Vite proxies to the game server. */
  url?: string
  storage?: Pick<Storage, "getItem" | "setItem">
  createSocket?: (url: string | undefined) => SocketLike
  now?: () => number
}

export interface GameClient {
  status(): ConnectionStatus
  /** Why the last join failed, e.g. "match_full". Null while joined or still trying. */
  joinError(): string | null
  view(): PlayerView | null
  onStatus(listener: (status: ConnectionStatus) => void): () => void
  onView(listener: (view: PlayerView) => void): () => void
  onRockLanded(listener: (event: RockLanded) => void): () => void
  throwRock(): Promise<ClientReply>
  startBlock(): Promise<ClientReply>
  endBlock(): Promise<ClientReply>
  close(): void
}

export function createGameClient(options: GameClientOptions = {}): GameClient {
  const now = options.now ?? Date.now
  const playerId = loadPlayerId(options.storage ?? safeLocalStorage())
  const socket = (options.createSocket ?? defaultSocket)(options.url)

  let status: ConnectionStatus = "connecting"
  let joinError: string | null = null
  let view: PlayerView | null = null
  // Starts at page-load time so IDs after a reload are higher than any sent before it.
  let nextCommand = now()

  const statusListeners = new Set<(status: ConnectionStatus) => void>()
  const viewListeners = new Set<(view: PlayerView) => void>()
  const landedListeners = new Set<(event: RockLanded) => void>()

  function setStatus(next: ConnectionStatus) {
    if (next === status) return
    status = next
    statusListeners.forEach((listener) => listener(next))
  }

  function setView(next: PlayerView) {
    view = next
    viewListeners.forEach((listener) => listener(next))
  }

  // Socket.IO reconnects by itself; every new connection must join again.
  socket.on("connect", () => {
    setStatus("connecting")
    socket.timeout(REPLY_TIMEOUT_MS).emit("join", { playerId }, (err, reply: JoinReply) => {
      if (err) return setStatus("offline")
      if (!reply.ok) {
        joinError = reply.reason
        return setStatus("offline")
      }
      joinError = null
      setView(reply.view)
      setStatus("online")
    })
  })
  socket.on("disconnect", () => setStatus("offline"))
  socket.on("connect_error", () => setStatus("offline"))
  socket.on("view", (next: PlayerView) => setView(next))
  socket.on("rockLanded", (event: RockLanded) => landedListeners.forEach((listener) => listener(event)))

  function send(type: CommandType): Promise<ClientReply> {
    const commandId = `c${nextCommand++}`
    // Refuse instead of letting Socket.IO buffer it: a shot fired seconds late is worse than none.
    if (status !== "online" || !socket.connected) {
      return Promise.resolve({ commandId, status: "rejected", reason: "offline" })
    }
    return new Promise((resolve) => {
      socket.timeout(REPLY_TIMEOUT_MS).emit("command", { commandId, type }, (err, reply: CommandReply) => {
        resolve(err ? { commandId, status: "rejected", reason: "no_response" } : reply)
      })
    })
  }

  function subscribe<T>(set: Set<T>, listener: T) {
    set.add(listener)
    return () => void set.delete(listener)
  }

  return {
    status: () => status,
    joinError: () => joinError,
    view: () => view,
    onStatus: (listener) => subscribe(statusListeners, listener),
    onView: (listener) => subscribe(viewListeners, listener),
    onRockLanded: (listener) => subscribe(landedListeners, listener),
    throwRock: () => send("throwRock"),
    startBlock: () => send("startBlock"),
    endBlock: () => send("endBlock"),
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
  try {
    const stored = storage?.getItem(PLAYER_ID_KEY)
    if (stored) return stored
  } catch { /* fall through to a fresh ID */ }
  const id = crypto.randomUUID()
  try {
    storage?.setItem(PLAYER_ID_KEY, id)
  } catch { /* keep the in-memory ID */ }
  return id
}

function safeLocalStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage
  } catch {
    return null
  }
}
