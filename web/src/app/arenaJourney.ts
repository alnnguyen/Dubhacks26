import type { PlayerView } from "../networking";

const KEY = "sd.arena.journey.v1";
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type ArenaJourney = { matchId: string; pilotId: string; rivalId: string; stage: "travel" | "arena" };
const browserStorage = (): StorageLike | undefined => { try { return window.sessionStorage; } catch { return undefined; } };
export function journeyFor(view: PlayerView, stage: ArenaJourney["stage"]): ArenaJourney {
  return { matchId: view.matchId, pilotId: view.you.pilotId, rivalId: view.rival.pilotId, stage };
}
export function matchesJourney(view: PlayerView, journey: ArenaJourney | null): boolean {
  return !!journey && journey.matchId === view.matchId && journey.pilotId === view.you.pilotId && journey.rivalId === view.rival.pilotId;
}
export function readArenaJourney(storage = browserStorage()): ArenaJourney | null {
  try {
    const j = JSON.parse(storage?.getItem(KEY) ?? "null");
    return j && typeof j.matchId === "string" && typeof j.pilotId === "string" && typeof j.rivalId === "string" && (j.stage === "travel" || j.stage === "arena") ? j : null;
  } catch { return null; }
}
export function saveArenaJourney(journey: ArenaJourney, storage = browserStorage()): void {
  try { storage?.setItem(KEY, JSON.stringify(journey)); } catch { /* In-memory flow still works. */ }
}
export function clearArenaJourney(storage = browserStorage()): void {
  try { storage?.removeItem(KEY); } catch { /* In-memory flow still works. */ }
}
