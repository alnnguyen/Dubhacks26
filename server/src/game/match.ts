import type { MatchSnapshot, PlayerSlot, PlayerState } from "../contracts.js";

export const STARTING_HEALTH = 100;

export interface Match {
  matchId: string;
  players: Map<PlayerSlot, PlayerState>;
}

export function createMatch(matchId: string): Match {
  return { matchId, players: new Map() };
}

export function createPlayer(slot: PlayerSlot): PlayerState {
  return {
    slot,
    connected: true,
    health: STARTING_HEALTH,
    action: "idle",
    weapon: "rock",
    block: { active: false, endsInMs: null },
  };
}

export function toSnapshot(match: Match): MatchSnapshot {
  const players = [...match.players.values()].sort((a, b) => a.slot - b.slot);
  return {
    matchId: match.matchId,
    phase: match.players.size === 2 ? "ready" : "waiting",
    players: structuredClone(players),
    rock: null,
  };
}
