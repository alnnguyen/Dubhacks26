export type Landmark = { x: number; y: number; z?: number }

export type Gesture = "palm" | "fist" | "none"

export type HandTrack = {
  id: string
  landmarks: Landmark[]
}

export type TouchInput = {
  lift: boolean
  throw: boolean
  block: boolean
  cancel: boolean
}

export type Phase = "IDLE" | "CHARGING" | "HELD" | "LAUNCHED" | "COOLDOWN"

export type BattleCommandName = "startLift" | "releaseRock" | "cancelLift" | "block"

/** Same command path buttons and gestures must share. Payloads stay pending B's schema. */
export type BattleCommand = {
  name: BattleCommandName
  commandId: string
  sessionId: string
  matchId: string
  sentAtMs: number
}

export type Point = { x: number; y: number }

export type Intent = "palm" | "fist" | "none" | "lost" | "ambiguous"
