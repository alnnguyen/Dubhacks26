import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PlayerSlot, PlayerView } from "../../../server/src/contracts";
import { RULES, SABER } from "../../../server/src/game/rules";
import type { GameClient } from "../networking/gameClient";
import lyraPortrait from "../voice/assets/lyra-hologram.png";
import "./battle-hud.css";

/**
 * Arena battle HUD (brand kit mockups): name plates, segmented health with a
 * lagging damage trail, stamina with the recover mark, hit / knockback /
 * guard-break / stun call-outs, a combat log, LYRA's line and the K.O. →
 * winner sequence. Display only: every number comes from the server's view,
 * arena frames and resolved swings; nothing here affects the duel.
 */
const CRITICAL_HP = 25;
const KO_PLATE_MS = 1800;
const TEAM = { you: "NIGHTFALL", rival: "REDSHIFT" } as const;

type Side = "you" | "rival";
type Pop = { id: number; side: Side; damage: number; blocked: boolean };
type Banner = { id: number; by: Side };
type LogLine = { id: number; text: ReactNode };

const pad = (slot: PlayerSlot) => String(slot).padStart(2, "0");
const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Triangular shards flying out from a point; deterministic so re-renders don't reshuffle them. */
function Shards({ count, spread, palette }: { count: number; spread: number; palette: string[] }) {
  return (
    <span className="bh-shard-burst" aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + (i % 3) * 0.7;
        const d = spread * (0.45 + ((i * 37) % 55) / 100);
        return (
          <i
            key={i}
            style={{
              ["--x" as string]: `${Math.cos(a) * d}px`,
              ["--y" as string]: `${Math.sin(a) * d}px`,
              ["--r" as string]: `${(i * 73) % 360}deg`,
              ["--s" as string]: `${0.6 + ((i * 29) % 10) / 10}`,
              ["--c" as string]: palette[i % palette.length],
              ["--delay" as string]: `${(i % 5) * 30}ms`,
            }}
          />
        );
      })}
    </span>
  );
}

function HealthBar({ value, side }: { value: number; side: Side }) {
  const hp = Math.max(0, Math.min(RULES.startingHealth, value));
  const pct = (hp / RULES.startingHealth) * 100;
  const critical = hp > 0 && hp <= CRITICAL_HP;
  return (
    <div className={`bh-health bh-${side}`} data-critical={critical} data-empty={hp === 0}>
      <div className="bh-health-track">
        <div className="bh-health-chip" style={{ width: `${pct}%` }} />
        <div className="bh-health-fill" style={{ width: `${pct}%` }} />
        {critical && (
          <svg className="bh-health-cracks" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden>
            <path d="M6 0 L9 8 L5 12 L10 20 M18 0 L15 7 L21 11 L17 20" />
          </svg>
        )}
      </div>
      <strong className="bh-health-value">{hp}</strong>
    </div>
  );
}

function StaminaBar({ side, fillRef, valueRef, winded }: {
  side: Side;
  fillRef: React.RefObject<HTMLDivElement | null>;
  valueRef: React.RefObject<HTMLSpanElement | null>;
  winded: boolean;
}) {
  return (
    <div className={`bh-stamina bh-${side}`} data-winded={winded}>
      <div className="bh-stamina-track">
        <div ref={fillRef} className="bh-stamina-fill" />
        <i className="bh-stamina-mark" style={{ left: `${SABER.windedRecoverAt}%` }} />
      </div>
      <span className="bh-stamina-label">STAMINA <span ref={valueRef}>100</span></span>
    </div>
  );
}

export function BattleHud({ client, view, fighting, finished, children }: {
  client: GameClient;
  view: PlayerView;
  fighting: boolean;
  finished: boolean;
  /** Rematch / leave controls, shown under the winner card. */
  children?: ReactNode;
}) {
  const { you, rival } = view;
  const round = view.round ?? 1;
  const slot = useRef(you.slot);
  slot.current = you.slot;
  const names = useRef({ you: you.callsign, rival: rival.callsign });
  names.current = { you: you.callsign, rival: rival.callsign };

  // Per-tick values go straight to the DOM; only state changes re-render.
  const stamFill = { you: useRef<HTMLDivElement>(null), rival: useRef<HTMLDivElement>(null) };
  const stamValue = { you: useRef<HTMLSpanElement>(null), rival: useRef<HTMLSpanElement>(null) };
  const recoverValue = useRef<HTMLSpanElement>(null);
  const [winded, setWinded] = useState({ you: false, rival: false });
  const [stunned, setStunned] = useState({ you: false, rival: false });
  const stunStart = useRef({ you: 0, rival: 0 });
  const stunBar = { you: useRef<HTMLDivElement>(null), rival: useRef<HTMLDivElement>(null) };
  const stunMs = { you: useRef<HTMLSpanElement>(null), rival: useRef<HTMLSpanElement>(null) };

  const [pops, setPops] = useState<Pop[]>([]);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [knockback, setKnockback] = useState<{ id: number; side: Side } | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const [lyra, setLyra] = useState("Duel live. Watch their guard angle.");
  const [guardBreaks, setGuardBreaks] = useState(0);
  const nextId = useRef(1);

  const say = (line: string) => setLyra(line);
  const addLog = (text: ReactNode) => setLog((l) => [...l.slice(-2), { id: nextId.current++, text }]);

  useEffect(() => {
    const offArena = client.onArena((frame) => {
      const nextWinded = { you: false, rival: false };
      const nextStunned = { you: false, rival: false };
      for (const p of frame.players) {
        const side: Side = p.slot === slot.current ? "you" : "rival";
        nextWinded[side] = p.winded;
        nextStunned[side] = p.stunned;
        const value = Math.round(p.stamina);
        if (stamFill[side].current) stamFill[side].current.style.width = `${p.stamina}%`;
        if (stamValue[side].current) stamValue[side].current.textContent = String(value);
        if (side === "you" && recoverValue.current) recoverValue.current.textContent = String(value);
      }
      setWinded((w) => (w.you === nextWinded.you && w.rival === nextWinded.rival ? w : nextWinded));
      setStunned((s) => {
        if (s.you === nextStunned.you && s.rival === nextStunned.rival) return s;
        const now = performance.now();
        if (nextStunned.you && !s.you) stunStart.current.you = now;
        if (nextStunned.rival && !s.rival) stunStart.current.rival = now;
        return nextStunned;
      });
    });
    const offResolved = client.onSaberResolved((event) => {
      const by: Side = event.attackerSlot === slot.current ? "you" : "rival";
      const target: Side = by === "you" ? "rival" : "you";
      const attacker = names.current[by];
      const defender = names.current[target];
      const id = nextId.current++;
      if (event.outcome === "guardBreak") {
        setBanner({ id, by });
        if (by === "you") setGuardBreaks((n) => n + 1);
        addLog(<><b>{attacker}</b> <em className="bh-amber">guard break</em> / {defender} stunned {SABER.stunMs} ms</>);
        say(by === "you" ? `Guard broken! Strike now, ${SABER.stunMs} milliseconds.` : "Your guard broke. Hold on!");
      } else if (event.outcome === "hit" && event.damage > 0) {
        setPops((p) => [...p.slice(-3), { id, side: target, damage: event.damage, blocked: false }]);
        setKnockback({ id, side: target });
        addLog(<><b>{attacker}</b> <em className={by === "you" ? "bh-blue" : "bh-red"}>hit</em> {defender} / -{event.damage} / knockback {SABER.knockbackMeters} m</>);
        say(by === "you" ? "Clean hit. They're sliding back." : "You took a hit. Reset your guard.");
      } else if (event.outcome === "blocked") {
        setPops((p) => [...p.slice(-3), { id, side: target, damage: 0, blocked: true }]);
        addLog(<><b>{defender}</b> blocked {attacker}</>);
        say("Blades locked. Look for an opening.");
      }
    });
    return () => { offArena(); offResolved(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  // Winded and critical are state changes worth a log line and a word from LYRA.
  useEffect(() => {
    if (!winded.you) return;
    addLog(<><b>{you.callsign}</b> <em className="bh-amber">winded</em> / no steps until {SABER.windedRecoverAt}</>);
    say("You're winded. Hold still, two seconds.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winded.you]);
  const critical = you.health > 0 && you.health <= CRITICAL_HP;
  useEffect(() => {
    if (!critical) return;
    addLog(<><b>{you.callsign}</b> <em className="bh-red">hull critical</em> / {you.health} HP</>);
    say("Hull critical. Play it safe.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [critical]);

  // Clear call-outs after their animations.
  useEffect(() => { if (!banner) return; const t = window.setTimeout(() => setBanner(null), 1500); return () => window.clearTimeout(t); }, [banner]);
  useEffect(() => { if (!knockback) return; const t = window.setTimeout(() => setKnockback(null), 1300); return () => window.clearTimeout(t); }, [knockback]);
  useEffect(() => { if (!pops.length) return; const t = window.setTimeout(() => setPops((p) => p.slice(1)), 1100); return () => window.clearTimeout(t); }, [pops]);

  // Duel clock: runs while fighting, freezes at the finish, resets each round.
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef<number | null>(null);
  useEffect(() => { startedAt.current = null; setElapsed(0); setGuardBreaks(0); setLog([]); }, [round, view.matchId]);
  useEffect(() => {
    if (!fighting) return;
    startedAt.current ??= performance.now();
    const id = window.setInterval(() => setElapsed(performance.now() - (startedAt.current ?? performance.now())), 250);
    return () => window.clearInterval(id);
  }, [fighting]);

  // Stun countdown bars, sized every animation frame while someone is stunned.
  useEffect(() => {
    if (!stunned.you && !stunned.rival) return;
    let raf = 0;
    const tick = () => {
      const now = performance.now();
      for (const side of ["you", "rival"] as const) {
        const left = Math.max(0, SABER.stunMs - (now - stunStart.current[side]));
        if (stunBar[side].current) stunBar[side].current.style.width = `${(left / SABER.stunMs) * 100}%`;
        if (stunMs[side].current) stunMs[side].current.textContent = `${Math.round(left)} ms`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stunned.you, stunned.rival]);

  // K.O. plate first, then the winner card.
  const [showWinner, setShowWinner] = useState(false);
  const knockout = finished && view.result?.reason === "knockout";
  useEffect(() => {
    if (!finished) { setShowWinner(false); return; }
    if (!knockout) { setShowWinner(true); return; }
    const t = window.setTimeout(() => setShowWinner(true), KO_PLATE_MS);
    return () => window.clearTimeout(t);
  }, [finished, knockout]);

  const winner = view.result?.winner ?? null;
  const youWon = winner === you.slot;
  const winnerName = winner === null ? "DRAW" : youWon ? you.callsign : rival.callsign;

  const stunPanel = (side: Side) => stunned[side] && (
    <div className={`bh-stun bh-${side}`}>
      <span ref={stunMs[side]} className="bh-stun-ms">{SABER.stunMs} ms</span>
      <div className="bh-stun-track"><div ref={stunBar[side]} className="bh-stun-fill" /></div>
      <b className="bh-stun-badge">STUNNED</b>
    </div>
  );

  return (
    <div className="battle-hud" data-critical={critical && !finished} data-finished={finished}>
      <header className="bh-top">
        <section className="bh-side bh-you">
          <p className="bh-eyebrow">YOU / {pad(you.slot)} / {you.saber.phoneLive ? "SABER PHONE LINKED" : "SABER PHONE OFFLINE"}</p>
          <div className="bh-plate-row">
            <h2 className="bh-plate">{you.callsign}</h2>
            <span className="bh-team">{TEAM.you}</span>
          </div>
          <HealthBar value={you.health} side="you" />
          <StaminaBar side="you" fillRef={stamFill.you} valueRef={stamValue.you} winded={winded.you} />
          {winded.you && <div className="bh-winded">WINDED · RECOVER <span ref={recoverValue}>0</span> / {SABER.windedRecoverAt}</div>}
          {stunPanel("you")}
          {knockback?.side === "you" && <p key={knockback.id} className="bh-knockback">KNOCKBACK {SABER.knockbackMeters} m <span>›››</span></p>}
        </section>

        <div className="bh-clock">
          <strong>{clock(elapsed)}</strong>
          <span>ROUND {round}</span>
        </div>

        <section className="bh-side bh-rival">
          <p className="bh-eyebrow">RIVAL / {pad(rival.slot)} / {TEAM.rival}</p>
          <div className="bh-plate-row">
            <span className="bh-team">{TEAM.rival}</span>
            <h2 className="bh-plate">{rival.callsign}</h2>
          </div>
          <HealthBar value={rival.health} side="rival" />
          <StaminaBar side="rival" fillRef={stamFill.rival} valueRef={stamValue.rival} winded={winded.rival} />
          {winded.rival && <div className="bh-winded">{rival.callsign} WINDED</div>}
          {stunPanel("rival")}
          {knockback?.side === "rival" && <p key={knockback.id} className="bh-knockback">KNOCKBACK {SABER.knockbackMeters} m <span>›››</span></p>}
        </section>
      </header>

      {critical && !finished && <p className="bh-critical"><span>⋀⋀</span> HULL CRITICAL</p>}

      {pops.map((p) => (
        <div key={p.id} className={`bh-pop bh-${p.side}`} data-blocked={p.blocked}>
          <strong>{p.blocked ? "BLOCK" : `-${p.damage}`}</strong>
          <span>{p.blocked ? "CLASH" : "HIT"}</span>
          {!p.blocked && <Shards count={8} spread={70} palette={p.side === "rival" ? ["#ff727f", "#ffb1b8", "#ff4d61"] : ["#4b9aff", "#87dcff", "#e9f6ff"]} />}
        </div>
      ))}

      {banner && (
        <div key={banner.id} className={`bh-banner bh-by-${banner.by}`} role="status">
          <strong>GUARD BREAK</strong>
          <span>
            {banner.by === "you"
              ? `${rival.callsign} STUNNED ${SABER.stunMs} MS / FREE STRIKE`
              : `YOU'RE STUNNED ${SABER.stunMs} MS / BRACE`}
          </span>
        </div>
      )}

      {!finished && (
        <>
          <ol className="bh-log" aria-live="polite">
            <li><b>DUEL LIVE</b> / ROUND {round} / {RULES.startingHealth} HP each</li>
            {log.map((l) => <li key={l.id}>{l.text}</li>)}
          </ol>
          {fighting && (
            <aside className="bh-lyra">
              <img src={lyraPortrait} alt="" />
              <div>
                <small>LYRA / SHIP COPILOT</small>
                <p key={lyra}>{lyra}</p>
              </div>
            </aside>
          )}
        </>
      )}

      {finished && (
        <div className="bh-finish" data-stage={showWinner ? "winner" : "ko"}>
          {!showWinner && (
            <div className="bh-ko">
              <strong>K.O.</strong>
              <Shards count={44} spread={460} palette={["#87dcff", "#ff727f", "#ffd28a", "#e9f6ff", "#4b9aff"]} />
            </div>
          )}
          {showWinner && (
            <section className="bh-winner" aria-label="Result">
              <p className="bh-eyebrow">{knockout ? "KNOCKOUT" : "FORFEIT"} / ROUND {round} / {view.world.name.toUpperCase()}</p>
              <h3>{winner === null ? "RESULT" : "WINNER"}</h3>
              <div className={`bh-winner-plate ${winner === null || youWon ? "bh-you" : "bh-rival"}`}><strong>{winnerName}</strong></div>
              <p className="bh-winner-line">
                {winner === null ? "Both pilots down." : youWon
                  ? `${rival.callsign} is down. Clean finish, pilot.`
                  : `${rival.callsign} takes the round. Regroup and rematch.`}
              </p>
              <dl className="bh-stats">
                <div><dt>DAMAGE DEALT</dt><dd>{RULES.startingHealth - rival.health} HP</dd></div>
                <div><dt>HP LEFT</dt><dd>{you.health}</dd></div>
                <div><dt>GUARD BREAKS</dt><dd>{guardBreaks}</dd></div>
                <div><dt>DUEL TIME</dt><dd>{clock(elapsed)}</dd></div>
              </dl>
              {children}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
