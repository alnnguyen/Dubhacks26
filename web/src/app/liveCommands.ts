import type { ClientReply } from "../networking/gameClient"
import type { BattleCommand } from "../vision/types"

/** The combat calls LiveDuel is allowed to make. IDs stay inside createGameClient. */
export type CombatClient = {
  rockActive(): Promise<ClientReply>
  throwRock(): Promise<ClientReply>
  gunActive(): Promise<ClientReply>
  fireGun(): Promise<ClientReply>
  saberActive(): Promise<ClientReply>
  slash(): Promise<ClientReply>
  startBlock(): Promise<ClientReply>
  endBlock(): Promise<ClientReply>
}

/**
 * Palm lift and tracking-loss cancel stay on the phone.
 * Fist grab is local (`startLift`). Fling-open throws.
 * Gun: fist cocks, index+middle fires. Saber: fist holds, lateral slash.
 */
export async function dispatchBattleCommand(
  client: CombatClient,
  command: BattleCommand,
): Promise<ClientReply | null> {
  if (command.name === "releaseRock") {
    const switched = await client.rockActive()
    if (switched.status !== "accepted") return switched
    return client.throwRock()
  }
  if (command.name === "gunActive") return client.gunActive()
  if (command.name === "fireGun") {
    const switched = await client.gunActive()
    if (switched.status !== "accepted") return switched
    return client.fireGun()
  }
  if (command.name === "saberActive") return client.saberActive()
  if (command.name === "slash") {
    const switched = await client.saberActive()
    if (switched.status !== "accepted") return switched
    return client.slash()
  }
  if (command.name === "block") return client.startBlock()
  if (command.name === "endBlock") return client.endBlock()
  return null
}

export function describeCombatReply(label: string, reply: ClientReply): string {
  if (reply.status === "accepted") return `${label} accepted by the server.`
  return `${label} rejected: ${reply.reason}.`
}
