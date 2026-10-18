import { useRef, useState, type ReactNode } from "react";
import type { PlayerView, PlayerState } from "../../../server/src/contracts";
import "./duel-result.css";

type Pilot = Pick<PlayerState, "slot" | "callsign" | "health" | "connected" | "rematch">;
export type DuelResultView = Pick<PlayerView, "result" | "world" | "round"> & { you: Pilot; rival: Pilot };

/** The approved cinematic result, driven by the current authoritative match view. */
export function DuelResult({ view, note, onRematch, onLeave, replay }: {
  view: DuelResultView;
  note: string;
  onRematch: () => void;
  onLeave: () => void;
  replay?: ReactNode;
}) {
  const [replayOpen, setReplayOpen] = useState(false);
  const replayRef = useRef<HTMLDetailsElement>(null);
  function openReplay() {
    setReplayOpen(true);
    requestAnimationFrame(() => replayRef.current?.scrollIntoView({block:"start", behavior:matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"}));
  }
  const { you, rival, result, world } = view;
  const outcome = !result ? "unknown" : result.winner === null ? "draw" : result.winner === you.slot ? "win" : "lose";
  const title = { win: "Victory", lose: "Defeated", draw: "Draw", unknown: "Complete" }[outcome];
  const reason = result?.reason === "knockout" ? "Knockout" : result?.reason === "forfeit" ? "Forfeit" : "Duel complete";
  const description = outcome === "win" ? "The field is yours." : outcome === "lose" ? `${rival.callsign} won this round.` : outcome === "draw" ? "Neither pilot takes the win." : "The duel has ended.";
  const rematchStatus = !rival.connected ? `${rival.callsign} is offline.`
    : you.rematch ? `Waiting for ${rival.callsign} to accept…`
    : rival.rematch ? `${rival.callsign} wants a rematch.` : "Ready for another round?";
  const nameStyle = (name: string) => ({fontSize:`clamp(12px, ${10 / Math.max(4, name.length)}vw, 30px)`});
  const health = (value: number) => Math.max(0, Math.min(100, value));
  return <section className="duel-result" data-outcome={outcome} aria-label="Duel result">
    <div className="dr-stars" aria-hidden="true" />
    <div className="dr-horizon" aria-hidden="true" />
    <div className="dr-glass" aria-hidden="true"><div className="dr-glass-red" /><div className="dr-glass-blue" /></div>
    <div className="dr-seam" aria-hidden="true" /><div className="dr-sweep" aria-hidden="true" />
    <header className="dr-brand">✦ SPACE BATTLES <span>/ DUEL COMPLETE</span></header>
    <div className="dr-shell">
      <div className="dr-copy">
        <p className="dr-eyebrow">COMBAT LINK / {world.name} {view.round ? `· ROUND ${view.round}` : ""}</p>
        <p className="dr-lead">{outcome === "win" || outcome === "lose" ? "Mission" : "Duel"}</p>
        <h1><span className="dr-word-flight"><span className="dr-word-plate"><span>{title}</span></span></span></h1>
        <p className="dr-description">{description}</p>
        <div className="dr-status" role="status"><i className="dr-status-mark" aria-hidden="true" /><span>{rematchStatus}</span></div>
        {note && <p className="dr-warning" role="alert">{note}</p>}
        {replay && <button className="dr-replay-cta" type="button" data-ui-sound="commit" onClick={openReplay}>
          <span><small>PERCEPTRON / AI HIGHLIGHTS</small><strong>Watch Replay</strong></span><b aria-hidden="true">↗</b>
        </button>}
        <button className="dr-primary" type="button" data-ui-sound="commit" disabled={you.rematch || !rival.connected} onClick={onRematch}>
          <span>{you.rematch ? "Rematch requested" : rival.rematch ? "Accept rematch" : "Rematch"}</span><b aria-hidden="true">↗</b>
        </button>
        <button className="dr-back" type="button" data-ui-sound="back" onClick={onLeave}>← Back to bridge</button>
      </div>
      <aside className="dr-visual-column" aria-label="Match summary">
        <div className="dr-visual-meta"><span>FLIGHT DECK / TELEMETRY</span><b>{outcome === "win" ? "WIN" : outcome === "lose" ? "LOSS" : title.toUpperCase()}</b></div>
        <div className="dr-visual">
          <div className="dr-score-row">
            <div className="dr-pilot dr-pilot--you"><span>YOUR PILOT / {String(you.slot).padStart(2, "0")}</span><strong style={nameStyle(you.callsign)}>{you.callsign}</strong></div>
            <div className="dr-vs" aria-hidden="true">VS</div>
            <div className="dr-pilot dr-pilot--rival"><span>RIVAL / {String(rival.slot).padStart(2, "0")}</span><strong style={nameStyle(rival.callsign)}>{rival.callsign}</strong></div>
          </div>
          <div className="dr-bars">
            <div className="dr-bar"><span>You</span><div className="dr-bar-track"><div className="dr-bar-fill dr-you" style={{width:`${health(you.health)}%`}} /></div><span>{you.health}</span></div>
            <div className="dr-bar"><span>Rival</span><div className="dr-bar-track"><div className="dr-bar-fill dr-rival" style={{width:`${health(rival.health)}%`}} /></div><span>{rival.health}</span></div>
          </div>
          <p className="dr-reason">{reason} · {world.name}</p>
        </div>
        <div className="dr-visual-footer"><span>SD / 26</span><span>{you.rematch ? "REMATCH REQUESTED" : "OUTCOME CONFIRMED"}</span></div>
      </aside>
    </div>
    {replay && <details className="dr-replay" ref={replayRef} open={replayOpen} onToggle={e => setReplayOpen(e.currentTarget.open)}><summary>Watch duel replay <span aria-hidden="true">↘</span></summary>{replay}</details>}
  </section>;
}
