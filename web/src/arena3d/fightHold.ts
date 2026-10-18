/**
 * Keeps the arena on screen through a short tracking gap once the fight is on.
 *
 * The server marks a player unarmed the moment their body or saber input is
 * older than SABER.staleMs (300 ms), and both laptops see it. Dropping straight
 * back to the initiation overlay for every such gap made the match flicker, so
 * the picture holds for a grace period with a notice instead. The server still
 * ignores swings during the gap; only what is drawn changes.
 */
export const TRACKING_GRACE_MS = 1800

export interface FightHold {
  /** Both blades have been live since the gate last opened. */
  started: boolean
  /** When the strict gate last dropped, null while fighting. */
  lostAtMs: number | null
}

export const IDLE_HOLD: FightHold = { started: false, lostAtMs: null }

export interface FightHoldInput {
  /** The strict gate: phase active, setup done, both armed, unlocked, fresh. */
  fighting: boolean
  /** The server's start gate for this round; a rematch resets it. */
  unlocked: boolean
  active: boolean
  nowMs: number
}

export function tickFightHold(hold: FightHold, { fighting, unlocked, active, nowMs }: FightHoldInput): FightHold {
  if (!unlocked || !active) return hold.started || hold.lostAtMs !== null ? IDLE_HOLD : hold
  if (fighting) return hold.started && hold.lostAtMs === null ? hold : { started: true, lostAtMs: null }
  if (!hold.started) return hold
  return hold.lostAtMs === null ? { ...hold, lostAtMs: nowMs } : hold
}

/** Whether to keep drawing the fight (true while fighting or within the grace window). */
export function holdsFight(hold: FightHold, fighting: boolean, nowMs: number): boolean {
  if (fighting) return true
  if (!hold.started) return false
  // A null lostAtMs here means the gate dropped this very render and the tick is pending.
  return hold.lostAtMs === null || nowMs - hold.lostAtMs < TRACKING_GRACE_MS
}

export interface TrackingLossInput {
  youBody: boolean
  youSaber: boolean
  rivalArmed: boolean
  serverFresh: boolean
  rivalName: string
}

/** What to tell the player while the fight is held through a gap, most actionable first. */
export function trackingLossNote({ youBody, youSaber, rivalArmed, serverFresh, rivalName }: TrackingLossInput): string {
  if (!serverFresh) return "Reconnecting to the arena…"
  if (!youBody) return "Camera lost you — step back into view."
  if (!youSaber) return "Saber signal lost — keep your phone awake and steady."
  if (!rivalArmed) return `${rivalName}'s tracking dropped — hold on…`
  return "Restoring tracking…"
}
