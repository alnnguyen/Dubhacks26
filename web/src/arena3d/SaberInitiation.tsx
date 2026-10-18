import { useEffect, useRef, useState } from "react";
import type { SaberStart, SetupStep } from "../../../server/src/contracts";
import { INSTRUCTIONS, STEP_ORDER } from "./setupWizard";
import lyraPortrait from "../voice/assets/lyra-hologram.png";
import "./saber-initiation.css";

const STEPS = STEP_ORDER.filter(s => s !== "done");
const COPY: Record<SetupStep, { lead: string; word: string; label: string; confirmed: string }> = {
  stand: { lead: "FIND YOUR", word: "POSITION", label: "Body lock", confirmed: "Position confirmed" },
  phone: { lead: "IGNITE YOUR", word: "SABER", label: "Phone link", confirmed: "Saber linked" },
  forward: { lead: "POINT", word: "FORWARD", label: "Heading", confirmed: "Heading aligned" },
  up: { lead: "RAISE YOUR", word: "SABER", label: "Saber hand", confirmed: "Saber hand found" },
  right: { lead: "POINT TO YOUR", word: "RIGHT", label: "Direction", confirmed: "Direction confirmed" },
  reach: { lead: "REACH", word: "FORWARD", label: "Reach", confirmed: "Reach confirmed" },
  done: { lead: "BATTLE", word: "READY", label: "Ready", confirmed: "Initiation complete" },
};

export interface SaberInitiationProps {
  step: SetupStep;
  progress: number;
  running: boolean;
  loading: boolean;
  bodySeen: boolean;
  phonePaired: boolean;
  phoneLive: boolean;
  youReady: boolean;
  rivalReady: boolean;
  yourName: string;
  rivalName: string;
  start: SaberStart | null;
  serverFresh: boolean;
  qr: string | null;
  saberUrl: string;
  notes: string[];
  error: string | null;
  onStart: () => void;
  onRedo: () => void;
}

/** Presentation follows the existing measured wizard; it never advances calibration. */
export function SaberInitiation(p: SaberInitiationProps) {
  const previous = useRef(p.step);
  const [confirmed, setConfirmed] = useState("");
  const [movementOpen, setMovementOpen] = useState(false);
  useEffect(() => setMovementOpen(p.step === "done" && p.youReady && !p.rivalReady), [p.step, p.youReady, p.rivalReady]);
  useEffect(() => {
    if (previous.current === p.step) return;
    const before = previous.current;
    previous.current = p.step;
    // Redo is a reset, not successful completion.
    if (STEP_ORDER.indexOf(p.step) <= STEP_ORDER.indexOf(before)) { setConfirmed(""); return; }
    setConfirmed(COPY[before].confirmed);
    const timer = window.setTimeout(() => setConfirmed(""), 1300);
    return () => window.clearTimeout(timer);
  }, [p.step]);
  const index = p.step === "done" ? STEPS.length : STEPS.indexOf(p.step);
  const copy = COPY[p.step];
  const holding = p.running && !p.loading && p.progress > 0;
  const recovering = p.step === "done" && p.start?.unlocked;
  const movement = !recovering && movementOpen;
  const title = movement ? { lead: "SWIPE", word: "TO MOVE" } : !p.running ? { lead: "BRING YOUR", word: "SYSTEMS ONLINE" } : recovering ? { lead: "RESTORE YOUR", word: "LINK" } : copy;
  const description = movement ? "Quick-swipe up, down, left or right on your saber phone. Each swipe makes one move." : !p.running ? "Your laptop sees you. Your phone becomes your saber. Keep your avatar in view as we bring each system online."
    : p.loading ? "Opening your camera and loading body tracking…"
    : recovering ? "Keep your upper body in frame and your saber phone awake. Combat resumes when both live links return."
    : p.step === "done" ? !p.youReady ? "Keep your body in frame and your phone awake while your calibration reaches the arena."
      : !p.rivalReady ? `You're ready. ${p.rivalName} is finishing initiation. Keep your camera and saber connected.`
      : "Both pilots are ready. Hold position for the shared countdown."
    : INSTRUCTIONS[p.step];
  const missingStart = p.step === "done" && p.youReady && p.rivalReady && p.serverFresh && !p.start;

  return <section className="si-overlay" aria-label="Saber initiation" data-step={p.step} data-movement={movement}>
    <div className="si-shade" aria-hidden="true" />
    <div className="si-brand">✦ SPACE BATTLES <span>/ SABER INITIATION</span></div>
    <div className="si-content">
    <header key={`${p.running}-${p.step}-${recovering}-${movement}`} className="si-prompt si-slide">
      <p className="si-eyebrow">{movement ? "PHONE / MOVEMENT CONTROLS" : recovering ? "LIVE LINK / RECOVERY" : !p.running ? "FLIGHT DECK / PRE-COMBAT" : p.step === "done" ? "INITIATION COMPLETE" : `${String(index + 1).padStart(2, "0")} / ${copy.label.toUpperCase()}`}</p>
      <h1 className="si-title" data-long={title.lead.length + title.word.length > 20}><span>{title.lead}</span><strong>{title.word}</strong></h1>
      <p className="si-description">{description}</p>
    </header>
    {movement && <SwipeLesson />}
      <div className="si-meta"><span>MARS / SABER INITIATION</span><span>{String(Math.min(index + 1, 6)).padStart(2, "0")} / 06</span></div>
      <ol className="si-rail" aria-label="Setup progress">{STEPS.map((s, i) => <li key={s} data-done={i < index} aria-current={s === p.step ? "step" : undefined}><i /> <span>{COPY[s].label}</span></li>)}</ol>
      <div className="si-feedback" role="status" aria-live="polite">
        {confirmed ? <span className="si-confirmed" key={confirmed}>✓ {confirmed}</span> : <span>{!p.running ? "AWAITING CAMERA" : p.loading ? "STARTING TRACKING" : !p.serverFresh ? "CONNECTING ARENA LINK" : p.step === "done" ? p.youReady ? "YOUR SYSTEMS READY" : "CONFIRMING SYSTEMS" : holding ? "POSE DETECTED · HOLD STEADY" : p.step === "phone" ? "WAITING FOR IGNITION" : !p.bodySeen ? "BRING YOUR UPPER BODY INTO VIEW" : "TRACKING LIVE · FOLLOW THE PROMPT"}</span>}
      </div>
      {p.running && !p.loading && p.step !== "done" && <div className="si-hold">
        <div className="si-hold__track" role="progressbar" aria-label="Current task hold" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p.progress * 100)}><i style={{width:`${Math.round(p.progress * 100)}%`}} /></div>
        <span>{holding ? `${Math.round(p.progress * 100)}% · KEEP HOLDING` : "WAITING FOR THE POSE"}</span>
      </div>}
      <div className="si-sensors" aria-label="Live device feedback">
        <Sensor ok={p.running && p.bodySeen} label="Camera" detail={!p.running ? "Off" : p.loading ? "Starting" : p.bodySeen ? "Body tracked" : "Find your body"} />
        <Sensor ok={p.phonePaired} label="Phone" detail={p.phonePaired ? "Paired" : "Not linked"} />
        <Sensor ok={p.phoneLive} label="Saber" detail={p.phoneLive ? "Motion live" : "Awaiting ignition"} />
      </div>
      {p.running && (p.step === "phone" || (p.step === "done" && !p.phonePaired)) && <div className="si-pair">
        {p.qr && <img src={p.qr} width="122" height="122" alt="Scan to connect your saber phone" />}
        <div><strong>SCAN. IGNITE. CONNECT.</strong><p>Open this on your iPhone, tap <b>Ignite saber</b>, then allow motion access.</p>{p.saberUrl && <a href={p.saberUrl} target="_blank" rel="noreferrer">Open phone controller ↗</a>}</div>
      </div>}
      {p.step === "done" && <div className="si-pilots"><span data-ready={p.youReady}><i />{p.yourName}<b>{p.youReady ? "READY" : "SYNCING"}</b></span><span data-ready={p.rivalReady}><i />{p.rivalName}<b>{p.rivalReady ? "READY" : "SETTING UP"}</b></span></div>}

      {p.notes.length > 0 && <details className="si-notes"><summary>Calibration notes ({p.notes.length})</summary>{p.notes.map(n => <p key={n}>{n}</p>)}</details>}
      {missingStart && <p className="si-error" role="alert">The match host needs the updated countdown server. Rejoin after the host updates.</p>}
      {p.error && <p className="si-error" role="alert">{p.error}</p>}
      <div className="si-actions"><button type="button" className="si-redo" onClick={() => setMovementOpen(v => !v)}>{movementOpen ? "Back to setup" : "Movement controls"}</button>{!p.running ? <button type="button" className="si-primary" onClick={p.onStart}>{p.error ? "Retry camera" : "Start camera"}<span>↗</span></button> : <button type="button" className="si-redo" onClick={p.onRedo} disabled={p.loading}>↶ Restart setup</button>}</div>
      <div className="si-lyra"><img src={lyraPortrait} alt="LYRA hologram" /><p><span>LYRA / SHIP COPILOT</span>{movement ? "Swipe up to close in, down to back away, or left and right to circle your rival." : description}</p></div>
      <p className="si-next">{p.step === "done" ? "NEXT / COUNTDOWN → DUEL" : `NEXT / ${COPY[STEP_ORDER[Math.min(index + 1, STEP_ORDER.length - 1)]].label.toUpperCase()}`}</p>
    </div>
    <div className="si-live-window"><span>YOU / {p.yourName}</span>{(!p.running || !p.bodySeen) && <div className="si-avatar-empty">{p.loading ? "STARTING CAMERA…" : p.running ? "STEP INTO VIEW" : "YOUR AVATAR APPEARS HERE"}<small>{p.running ? "Face your laptop and show your upper body." : "Start your camera to see your movements."}</small></div>}<b>{p.running && p.bodySeen ? "● BODY TRACKED" : "○ AWAITING BODY"} <em>{p.phoneLive ? "SABER ONLINE" : "SABER STANDBY"}</em></b></div>
    <div key={`${p.step}-${movement}`} className="si-laser" aria-hidden="true" />
  </section>;
}

/** Instructions only: the real phone retains its existing validated swipe input. */
function SwipeLesson() {
  return <div className="si-swipe-lesson" aria-label="Quick swipe movement guide">
    <div className="si-swipe-phone"><span>SWIPE TO MOVE</span><div className="si-swipe-pad" aria-hidden="true"><b>↑</b><b>→</b><b>↓</b><b>←</b><i /></div><small>ONE SWIPE. ONE MOVE.<br />LIFT. SWIPE AGAIN.</small></div>
    <p>↑ Close in<br />↓ Back away<br />← → Circle your rival</p>
  </div>;
}

function Sensor({ok,label,detail}:{ok:boolean;label:string;detail:string}) {
  return <div data-ok={ok}><i /><span>{label}<b>{detail}</b></span></div>;
}

/** 0 means waiting for authoritative GO, never an early local start. */
export function saberCountdown(start: SaberStart | null, serverNowMs: number): number | null {
  return !start || start.unlocked || start.startsAtMs === null ? null : Math.max(0, Math.ceil((start.startsAtMs - serverNowMs) / 1000));
}
export function SaberCountdown({start,remaining,fresh}:{start:SaberStart|null;remaining:number|null;fresh:boolean}) {
  const [go, setGo] = useState(false);
  useEffect(() => {
    if (!start?.unlocked) { setGo(false); return; }
    setGo(true);
    const id=window.setTimeout(()=>setGo(false),850);
    return ()=>window.clearTimeout(id);
  },[start?.unlocked]);
  if (!fresh || (!go && remaining === null)) return null;
  const label=go ? "FIGHT" : remaining === 0 ? "SYNCING" : String(remaining);
  return <div className="si-countdown" role="status" aria-live="assertive"><span>{go ? "COMBAT LINK OPEN" : "BOTH PILOTS READY"}</span><strong key={label}>{label}</strong><small>{go ? "May the best pilot win." : "Hold your position."}</small></div>;
}
