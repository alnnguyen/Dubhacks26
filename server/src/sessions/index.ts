import type { PlayerSlot } from "../contracts.js";
import type { Match } from "../game/match.js";

const PLAYER_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export type JoinResult =
  | { ok: true; slot: PlayerSlot; reclaimed: boolean }
  | { ok: false; reason: "invalid_request" | "match_full" };

// Maps the phone's stored playerId to its slot in the single demo match.
export class Sessions {
  private slotsByPlayerId = new Map<string, PlayerSlot>();

  constructor(private match: Match) {}

  slotOf(playerId: string): PlayerSlot | undefined {
    return this.slotsByPlayerId.get(playerId);
  }

  join(playerId: unknown): JoinResult {
    if (typeof playerId !== "string" || !PLAYER_ID_PATTERN.test(playerId)) {
      return { ok: false, reason: "invalid_request" };
    }

    const existing = this.slotsByPlayerId.get(playerId);
    if (existing !== undefined) {
      this.match.reconnect(existing);
      return { ok: true, slot: existing, reclaimed: true };
    }

    const free = ([1, 2] as const).find((slot) => !this.match.hasPlayer(slot));
    if (free === undefined) {
      return { ok: false, reason: "match_full" };
    }

    this.slotsByPlayerId.set(playerId, free);
    this.match.addPlayer(free);
    return { ok: true, slot: free, reclaimed: false };
  }

  disconnect(playerId: string): void {
    const slot = this.slotsByPlayerId.get(playerId);
    if (slot !== undefined) this.match.disconnect(slot);
  }
}
