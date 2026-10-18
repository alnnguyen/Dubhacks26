import { expect, it, vi } from "vitest"
import { describeCombatReply, dispatchBattleCommand, type CombatClient } from "./liveCommands"
import type { BattleCommand } from "../vision/types"
import type { ClientReply } from "../networking/gameClient"

const accepted = (commandId: string): ClientReply => ({ commandId, status: "accepted" })

function command(name: BattleCommand["name"]): BattleCommand {
  return { name, commandId: `pilot:match:${name}`, matchId: "debug", sessionId: "pilot", sentAtMs: 1 }
}

function client(overrides: Partial<CombatClient> = {}): CombatClient {
  return {
    rockActive: vi.fn(async () => accepted("rock")),
    throwRock: vi.fn(async () => accepted("throw")),
    gunActive: vi.fn(async () => accepted("gun")),
    fireGun: vi.fn(async () => accepted("fire")),
    startBlock: vi.fn(async () => accepted("up")),
    endBlock: vi.fn(async () => accepted("down")),
    ...overrides,
  }
}

it("keeps lift and cancel on the phone", async () => {
  const combat = client()
  expect(await dispatchBattleCommand(combat, command("startLift"))).toBeNull()
  expect(await dispatchBattleCommand(combat, command("cancelLift"))).toBeNull()
  expect(combat.rockActive).not.toHaveBeenCalled()
  expect(combat.throwRock).not.toHaveBeenCalled()
})

it("switches to the rock before throwing", async () => {
  const combat = client()
  expect(await dispatchBattleCommand(combat, command("releaseRock"))).toEqual(accepted("throw"))
  expect(combat.rockActive).toHaveBeenCalledOnce()
  expect(combat.throwRock).toHaveBeenCalledOnce()
})

it("arms then fires the gun", async () => {
  const combat = client()
  expect(await dispatchBattleCommand(combat, command("gunActive"))).toEqual(accepted("gun"))
  expect(await dispatchBattleCommand(combat, command("fireGun"))).toEqual(accepted("fire"))
  expect(combat.gunActive).toHaveBeenCalledTimes(2)
  expect(combat.fireGun).toHaveBeenCalledOnce()
})

it("maps a block hold to start then end", async () => {
  const combat = client()
  expect(await dispatchBattleCommand(combat, command("block"))).toEqual(accepted("up"))
  expect(await dispatchBattleCommand(combat, command("endBlock"))).toEqual(accepted("down"))
})

it("describes accepted and rejected replies", () => {
  expect(describeCombatReply("Throw rock", accepted("c1"))).toMatch(/accepted/)
  expect(describeCombatReply("Fire gun", { commandId: "c2", status: "rejected", reason: "on_cooldown" })).toMatch(
    /on_cooldown/,
  )
})
