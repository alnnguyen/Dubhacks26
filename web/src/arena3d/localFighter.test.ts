import { describe, expect, it } from "vitest"
import type { ArenaFrame, PlayerSlot, Vec3 } from "../../../server/src/contracts"
import { turn, withLocalFighter, withSetupBody, type LocalFighter } from "./localFighter"

function bodyFrame(): Vec3[] {
  const j: Vec3[] = Array.from({ length: 33 }, () => [0, 0, 0] as Vec3)
  j[16] = [0.25, 0.25, 0.4]
  j[23] = [-0.12, 0, 0]
  j[24] = [0.12, 0, 0]
  return j
}

// The server's frame: the player with hips at `hips` (world), any blade.
function serverFrame(slot: PlayerSlot, hips: Vec3, withBlade = true): ArenaFrame {
  const joints = Array.from({ length: 33 }, () => hips)
  joints[23] = [hips[0] - 0.12, hips[1], hips[2]]
  joints[24] = [hips[0] + 0.12, hips[1], hips[2]]
  return {
    serverMs: 0,
    engaged: true,
    players: [
      {
        slot,
        cell: { q: 0, r: 0 },
        // On the z axis slot 1 faces +z and slot 2 faces -z.
        facing: slot === 1 ? [0, 1] : [0, -1],
        joints,
        blade: withBlade ? { hilt: hips, tip: [hips[0], hips[1] + 0.9, hips[2]] } : null,
        swinging: false,
        stamina: 100,
        winded: false,
        stunned: false,
      },
    ],
  }
}

// Calibrated facing north; phone pointing at the screen (north) means straight forward.
const local = (top: Vec3): LocalFighter => ({ joints: bodyFrame(), top, forward: [0, 1], mirror: false, hand: "right" })

const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]))

describe("withLocalFighter", () => {
  it("draws your blade from your own wrist and phone, where the server has you standing", () => {
    const f = withLocalFighter(serverFrame(1, [0.3, 1, 0]), 1, local([0, 1, 0]))
    const blade = f.players[0].blade!
    close(blade.hilt, [0.55, 1.25, 0.4])
    // Forward for slot 1 is +z; the server's blade length (0.9) is kept.
    close(blade.tip, [0.55, 1.25, 1.3])
  })

  it("turns slot 2 around like the server does", () => {
    const f = withLocalFighter(serverFrame(2, [0, 1, 1.3]), 2, local([1, 0, 0]))
    const blade = f.players[0].blade!
    close(blade.hilt, [-0.25, 1.25, 0.9])
    // Pointing to slot 2's right is world -x.
    close(blade.tip, [-1.15, 1.25, 0.9])
  })

  it("follows the server's facing off the z axis", () => {
    const frame = serverFrame(1, [0, 1, 0])
    // Facing +x: the player's forward is world +x, their right is world -z.
    frame.players[0].facing = [1, 0]
    const blade = withLocalFighter(frame, 1, local([0, 1, 0])).players[0].blade!
    close([blade.tip[0] - blade.hilt[0], blade.tip[2] - blade.hilt[2]], [0.9, 0])
    close(turn([1, 0, 0], [1, 0]), [0, 0, -1])
  })

  it("stands at the predicted spot from a step glide, facing the rival", () => {
    const frame = serverFrame(1, [0, 1, 0])
    frame.players.push({ slot: 2, cell: { q: 0, r: 1 }, facing: [0, -1], joints: null, blade: null, swinging: false, stamina: 100, winded: false, stunned: false })
    // Predicted one column to the right of the server's (lagging) spot.
    const f = withLocalFighter(frame, 1, local([0, 1, 0]), [0.65, 0])
    const me = f.players[0]
    // Hips land on the predicted spot.
    close([(me.joints![23][0] + me.joints![24][0]) / 2, (me.joints![23][2] + me.joints![24][2]) / 2], [0.65, 0])
    close(me.facing, [-Math.SQRT1_2, Math.SQRT1_2])
    // The blade points the same way when the phone points "forward".
    const blade = me.blade!
    const bl = Math.hypot(blade.tip[0] - blade.hilt[0], blade.tip[2] - blade.hilt[2])
    close([(blade.tip[0] - blade.hilt[0]) / bl, (blade.tip[2] - blade.hilt[2]) / bl], me.facing)
  })

  it("leaves the frame alone when the server shows no blade or there's no local data", () => {
    const noBlade = serverFrame(1, [0, 1, 0], false)
    expect(withLocalFighter(noBlade, 1, local([0, 1, 0]))).toBe(noBlade)
    const frame = serverFrame(1, [0, 1, 0])
    expect(withLocalFighter(frame, 1, null)).toBe(frame)
  })
})


describe("setup body feedback before saber calibration", () => {
  it("shows the first camera body before any arena frame or phone data arrives", () => {
    const f = withSetupBody(null, 1, bodyFrame(), .65, 1000)
    expect(f.players[0].joints).not.toBeNull()
    close(f.players[0].joints![16], [.25, 1.25, .4])
    expect(f.players[0].blade).not.toBeNull()
    close(f.players[0].blade!.hilt, f.players[0].joints![16])
    close(f.players[0].blade!.tip, [.25, 2.15, .4])
    expect(f.saberStart).toBeUndefined()
    expect(f.players[0].swinging).toBe(false)
  })

  it("draws a tracked body even if the server has not echoed it and no blade exists", () => {
    const frame = serverFrame(2, [0, 1, 0], false)
    frame.players[0].joints = null
    frame.players[0].cell = {q:1,r:2}
    const f = withSetupBody(frame, 2, bodyFrame(), .65, 1000)
    close(f.players[0].joints![16], [.4, 1.25, .9])
    expect(f.players[0].blade).not.toBeNull()
    expect(frame.players[0].blade).toBeNull()
    expect(frame.players[0].joints).toBeNull()
  })

  it("hides a lost or stale local body despite an older body/blade in the server frame", () => {
    const frame = serverFrame(1, [0, 1, 0])
    const f = withSetupBody(frame, 1, null, .65, 1000)
    expect(f.players[0].joints).toBeNull()
    expect(f.players[0].blade).toBeNull()
    expect(frame.players[0].joints).not.toBeNull()
  })

  it("preserves the rival, server countdown and calibrated blade during setup", () => {
    const frame = serverFrame(1, [.5, 1, -.2])
    const rival = serverFrame(2, [0, 1, 1.3]).players[0]
    frame.players.push(rival)
    frame.saberStart = { startsAtMs: 6000, unlocked: false }
    const f = withSetupBody(frame, 1, bodyFrame(), .65, 1000)
    expect(f.players[1]).toBe(rival)
    expect(f.saberStart).toBe(frame.saberStart)
    expect(f.players[0].blade).toBe(frame.players[0].blade)
    close(f.players[0].joints![16], [.75, 1.25, .2])
  })
})


it("setup saber follows the selected hand and measured phone direction before server calibration", () => {
  const body = bodyFrame(); body[15] = [-.3,.4,.2];
  const f = withSetupBody(null, 1, body, .65, 1000, {hand:"left",direction:[1,0,0]});
  close(f.players[0].blade!.hilt, [-.3,1.4,.2]);
  close(f.players[0].blade!.tip, [.6,1.4,.2]);
  expect(f.saberStart).toBeUndefined();
  expect(f.players[0].swinging).toBe(false);
});
