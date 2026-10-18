import { useEffect, useMemo, useState } from "react";
import type { ArenaFrame, PlayerView, SaberResolved } from "../../../server/src/contracts";
import { SABER } from "../../../server/src/game/rules";
import type { GameClient } from "../networking/gameClient";
import { ArenaPreview } from "./ArenaPreview";
import { BattleHud } from "./BattleHud";

/**
 * /?dev=hud — the battle HUD over the synthetic arena, driven by a scripted
 * duel (hits, a guard break, winded, hull critical, K.O.) through the same
 * client events a real match sends. Not a match; nothing is sent anywhere.
 */
type Script = { at: number; you?: number; rival?: number; hit?: SaberResolved; stunRival?: boolean; winded?: boolean; finish?: boolean };
const SCRIPT: Script[] = [
  { at: 2000, rival: 85, hit: { attackerSlot: 1, outcome: "hit", damage: 15 } },
  { at: 4000, you: 85, hit: { attackerSlot: 2, outcome: "hit", damage: 15 } },
  { at: 5600, hit: { attackerSlot: 1, outcome: "guardBreak", damage: 0 }, stunRival: true },
  { at: 6200, rival: 70, hit: { attackerSlot: 1, outcome: "hit", damage: 15 } },
  { at: 7600, hit: { attackerSlot: 2, outcome: "blocked", damage: 0 } },
  { at: 8800, winded: true },
  { at: 9800, you: 55, hit: { attackerSlot: 2, outcome: "hit", damage: 30 } },
  { at: 11200, you: 25, hit: { attackerSlot: 2, outcome: "hit", damage: 30 } },
  { at: 13200, rival: 40, hit: { attackerSlot: 1, outcome: "hit", damage: 30 } },
  { at: 14400, rival: 0, hit: { attackerSlot: 1, outcome: "hit", damage: 40 }, finish: true },
];
const LOOP_MS = 22000;

export function HudPreview() {
  const listeners = useMemo(() => ({ arena: new Set<(f: ArenaFrame) => void>(), resolved: new Set<(e: SaberResolved) => void>() }), []);
  const client = useMemo(() => ({
    onArena: (l: (f: ArenaFrame) => void) => { listeners.arena.add(l); return () => listeners.arena.delete(l); },
    onSaberResolved: (l: (e: SaberResolved) => void) => { listeners.resolved.add(l); return () => listeners.resolved.delete(l); },
  }) as unknown as GameClient, [listeners]);
  const [loop, setLoop] = useState(0);
  const [hp, setHp] = useState({ you: 100, rival: 100 });
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const start = performance.now();
    let fired = 0, stunUntil = 0, winded = false, stamina = 100;
    setHp({ you: 100, rival: 100 }); setFinished(false);
    const id = window.setInterval(() => {
      const t = performance.now() - start;
      while (fired < SCRIPT.length && SCRIPT[fired].at <= t) {
        const s = SCRIPT[fired++];
        if (s.you !== undefined || s.rival !== undefined) setHp((h) => ({ you: s.you ?? h.you, rival: s.rival ?? h.rival }));
        if (s.hit) listeners.resolved.forEach((l) => l(s.hit!));
        if (s.stunRival) stunUntil = t + SABER.stunMs;
        if (s.winded) { winded = true; stamina = 0; }
        if (s.finish) setFinished(true);
      }
      stamina = winded ? Math.min(100, stamina + 1.5) : Math.max(35, 100 - (t % 6000) / 80);
      if (winded && stamina >= SABER.windedRecoverAt) winded = false;
      const player = (slot: 1 | 2, extra: Partial<ArenaFrame["players"][number]>) => ({ slot, cell: { q: 0, r: 0 }, facing: [0, 1] as [number, number], joints: null, blade: null, swinging: false, stamina: 100, winded: false, stunned: false, ...extra });
      const frame: ArenaFrame = { serverMs: t, engaged: true, players: [player(1, { stamina, winded }), player(2, { stunned: t < stunUntil })] };
      listeners.arena.forEach((l) => l(frame));
      if (t > LOOP_MS) setLoop((n) => n + 1);
    }, 50);
    return () => window.clearInterval(id);
  }, [loop, listeners]);

  const view = {
    matchId: `preview-${loop}`, round: 1, phase: finished ? "finished" : "active", startsInMs: null,
    world: { id: "mars", name: "Jezero Crater" },
    result: finished ? { winner: 1, reason: "knockout" } : null,
    board: { cellSize: 0.65, rows: 3, stepMs: 110 },
    you: { slot: 1, callsign: "NOVA-7", health: hp.you, connected: true, rematch: false, saber: { phoneLive: true } },
    rival: { slot: 2, callsign: "VEX", health: hp.rival, connected: true, rematch: false, saber: { phoneLive: true } },
  } as unknown as PlayerView;

  return (
    <>
      <ArenaPreview />
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none" }}>
        <BattleHud client={client} view={view} fighting={!finished} finished={finished}>
          <div className="bh-result-actions"><p>Preview loops in a few seconds.</p></div>
        </BattleHud>
      </div>
    </>
  );
}
