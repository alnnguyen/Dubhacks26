import { useSyncExternalStore } from "react"
import { createGameClient, type GameClient } from "./gameClient"

let shared: GameClient | null = null

/**
 * The page's one connection to the game server, created on first use.
 * VITE_GAME_SERVER_URL points a separately hosted frontend at the server;
 * without it the page's own origin is used (Vite proxies /socket.io locally).
 */
export function getGameClient(): GameClient {
  shared ??= createGameClient()
  return shared
}

export function useGameStatus(client: GameClient = getGameClient()) {
  return useSyncExternalStore(client.onStatus, client.status)
}

export function useGameLobby(client: GameClient = getGameClient()) {
  return useSyncExternalStore(client.onLobby, client.lobby)
}

export function useGameView(client: GameClient = getGameClient()) {
  return useSyncExternalStore(client.onView, client.view)
}
