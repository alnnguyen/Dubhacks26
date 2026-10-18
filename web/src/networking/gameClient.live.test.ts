import { io } from "socket.io-client"
import { describe, expect, it } from "vitest"
import { createGameClient, type GameClient, type LobbyView, type PlayerView } from "./index"

// Opt-in: runs only against a real, freshly started game server, e.g.
// GAME_SERVER_URL=http://127.0.0.1:3001 npx vitest run src/networking/gameClient.live.test.ts
const url: string | undefined = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env
  .GAME_SERVER_URL

function memoryStorage() {
  const data: Record<string, string> = {}
  return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v) }
}

function open(): GameClient {
  return createGameClient({
    url,
    storage: memoryStorage(),
    createSocket: (target) => io(target!, { rejectUnauthorized: false } as never),
  })
}

const until = <T>(subscribe: (done: (value: T) => void) => () => void, matches: (value: T) => boolean) =>
  new Promise<T>((resolve) => {
    const stop = subscribe((value) => {
      if (matches(value)) {
        stop()
        resolve(value)
      }
    })
  })

describe.runIf(url)("live game server", () => {
  it("challenge, accept, ready, then both see the same forfeit result", async () => {
    const alice = open()
    const bob = open()
    const online = (c: GameClient) =>
      c.status() === "online" ? Promise.resolve() : until<string>(c.onStatus, (s) => s === "online")
    await Promise.all([online(alice), online(bob)])

    const bobId = bob.lobby()!.you.id
    const seen = alice.lobby()!.pilots.some((p) => p.id === bobId)
      ? Promise.resolve()
      : until<LobbyView>(alice.onLobby, (l) => l.pilots.some((p) => p.id === bobId))
    await seen
    const incoming = until<LobbyView>(bob.onLobby, (l) => l.challenge?.status === "pending")
    expect(await alice.challenge(bobId)).toMatchObject({ status: "accepted" })
    expect(await bob.acceptChallenge((await incoming).challenge!.id)).toMatchObject({ status: "accepted" })

    const active = (c: GameClient) =>
      c.view()?.phase === "active" ? Promise.resolve() : until<PlayerView | null>(c.onView, (v) => v?.phase === "active")
    await Promise.all([alice.ready(), bob.ready()])
    await Promise.all([active(alice), active(bob)])
    expect(alice.view()!.world.id).toBe(bob.view()!.world.id)

    const bobSlot = bob.view()!.you.slot
    const bobWins = until<PlayerView | null>(bob.onView, (v) => v?.result?.winner === bobSlot)
    expect(await alice.leaveMatch()).toMatchObject({ status: "accepted" })
    expect((await bobWins)!.result).toEqual({ winner: bobSlot, reason: "forfeit" })

    await bob.leaveMatch()
    alice.close()
    bob.close()
  }, 10_000)
})
