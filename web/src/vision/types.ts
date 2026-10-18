export type Landmark = { x: number; y: number; z?: number }

export type Gesture = "palm" | "fist" | "gun" | "none"

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

export type Phase = "IDLE" | "CHARGING" | "HELD" | "GUN_AIM" | "SABER_RECOVER" | "LAUNCHED" | "COOLDOWN"

export type BattleCommandName =
  | "startLift"
  | "releaseRock"
  | "cancelLift"
  | "block"
  | "endBlock"
  | "gunActive"
  | "fireGun"
  | "saberActive"
  | "slash"

export type WeaponChoice = "rock" | "gun" | "saber"

/** Same command path buttons and gestures must share. */
export type BattleCommand = {
  name: BattleCommandName
  commandId: string
  sessionId: string
  matchId: string
  sentAtMs: number
}

export type Point = { x: number; y: number }

export type Intent = "palm" | "fist" | "gun" | "release" | "none" | "lost" | "ambiguous"
