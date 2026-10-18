import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { GameClient } from '../networking';
import { CopilotVoice, type CopilotExtension, type CopilotPhase } from './CopilotVoice';
import { HologramPortrait } from './HologramPortrait';
import {
  EXPLORE_INSTRUCTIONS,
  exploreGuideAnswer,
  exploreToolState,
  factsFor,
  idleThought,
  noticeChange,
  type ExploreSnapshot,
  type LyraAction,
  type Thought,
} from './exploreLyra';
import { destinationById } from '../ui/components/explore/destinations';
import './exploreLyra.css';

type Message = { id: number; role: 'user' | 'assistant'; text: string; source: 'guide' | 'grok'; action?: LyraAction };
type Channel = 'grok' | 'local';

const THOUGHT_GAP_MS = 7000;
const IDLE_AFTER_MS = 26000;
const THOUGHT_SHOW_MS = 11000;
const QUICK = [
  { label: 'What’s here?', text: 'What are we looking at?' },
  { label: 'Find pilots', text: 'Who else is flying?' },
  { label: 'Surprise me', text: 'Take me somewhere amazing' },
];
const AMAZING = ['exo-trappist-1-e', 'visit-saturn', 'visit-jupiter', 'visit-sat-25544', 'galaxy', 'nearby-stars'];
const VOICE_KEY = 'sd.lyra.explore.voice';

type Recognition = { lang: string; interimResults: boolean; maxAlternatives: number; start(): void; stop(): void; abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null };
function recognitionCtor(): (new () => Recognition) | null {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
function readVoicePref() {
  try { return localStorage.getItem(VOICE_KEY) === 'on'; } catch { return false; }
}

/** LYRA during free flight: unprompted thoughts about what's around you, plus a chat you can type or talk to. */
export function ExploreCopilot({ snapshot, client, hidden, callsign, onAction }: {
  snapshot: ExploreSnapshot;
  client?: GameClient;
  hidden?: boolean;
  callsign: string;
  onAction: (action: LyraAction) => void;
}) {
  const [open, setOpen] = useState(false);
  const [thought, setThought] = useState<Thought | null>(null);
  const [thoughtsOn, setThoughtsOn] = useState(true);
  const [voiceOn, setVoiceOn] = useState(readVoicePref);
  const [phase, setPhase] = useState<CopilotPhase>('idle');
  const [channel, setChannel] = useState<Channel>(client ? 'grok' : 'local');
  const [note, setNote] = useState('');
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<Message[]>([{ id: 0, role: 'assistant', source: 'guide', text: 'LYRA online. I’ll point out what we fly past — ask me anything, or tell me where to go.' }]);

  const snap = useRef(snapshot); snap.current = snapshot;
  const prev = useRef<ExploreSnapshot | null>(null);
  const said = useRef(new Set<string>());
  const pending = useRef<Thought | null>(null);
  const lastThoughtAt = useRef(0);
  const lastEventAt = useRef(Date.now());
  const voice = useRef<CopilotVoice | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const nextId = useRef(1), replyId = useRef(0);
  const end = useRef<HTMLDivElement>(null);
  const busy = phase !== 'idle';
  const listenable = !!client && channel === 'grok' ? true : !!recognitionCtor();

  useEffect(() => { try { localStorage.setItem(VOICE_KEY, voiceOn ? 'on' : 'off'); } catch { /* private mode */ } }, [voiceOn]);
  useEffect(() => { setChannel(client ? 'grok' : 'local'); }, [client]);
  useEffect(() => { if (open) end.current?.scrollIntoView({ block: 'nearest' }); }, [messages, open]);

  const speakLocal = useCallback((text: string) => {
    if (!voiceOn || !('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const preferred = synth.getVoices().find((v) => /samantha|serena|female|zira|google uk english female/i.test(v.name) && v.lang.startsWith('en'));
    if (preferred) utterance.voice = preferred;
    utterance.rate = 1.03; utterance.pitch = 1.08;
    utterance.onstart = () => setPhase((p) => (p === 'idle' ? 'speaking' : p));
    utterance.onend = utterance.onerror = () => setPhase((p) => (p === 'speaking' ? 'idle' : p));
    synth.speak(utterance);
  }, [voiceOn]);

  const show = useCallback((t: Thought) => {
    said.current.add(t.key);
    lastThoughtAt.current = Date.now();
    setThought(t);
    if (!voice.current) speakLocal(t.text);
  }, [speakLocal]);

  // Notice what changes as you fly. Interesting changes queue; the best one is shown when LYRA has room to talk.
  useEffect(() => {
    if (hidden) return;
    const t = noticeChange(prev.current, snapshot, said.current);
    prev.current = snapshot;
    if (!t) return;
    lastEventAt.current = Date.now();
    if (!pending.current || t.priority >= pending.current.priority) pending.current = t;
  }, [snapshot, hidden]);

  useEffect(() => {
    if (hidden || !thoughtsOn) return;
    const tick = setInterval(() => {
      if (busy || document.hidden) return;
      const now = Date.now();
      const queued = pending.current;
      if (queued && (queued.priority === 2 || now - lastThoughtAt.current > THOUGHT_GAP_MS)) {
        pending.current = null;
        if (!said.current.has(queued.key)) show(queued);
        return;
      }
      if (now - Math.max(lastThoughtAt.current, lastEventAt.current) > IDLE_AFTER_MS && snap.current.speed < 2) {
        const idle = idleThought(snap.current, said.current);
        if (idle) show(idle);
        lastEventAt.current = now;
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [hidden, thoughtsOn, busy, show]);

  useEffect(() => {
    if (!thought) return;
    const id = setTimeout(() => setThought(null), THOUGHT_SHOW_MS + thought.text.length * 25);
    return () => clearTimeout(id);
  }, [thought]);

  const stopAll = useCallback(() => {
    voice.current?.close(); voice.current = null;
    recognition.current?.abort(); recognition.current = null;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setPhase('idle');
  }, []);
  useEffect(() => { if (hidden) { stopAll(); setOpen(false); } }, [hidden, stopAll]);
  useEffect(() => () => stopAll(), [stopAll]);

  function reply(text: string, source: Message['source'], action?: LyraAction) {
    setMessages((all) => all.map((m) => (m.id === replyId.current ? { ...m, text, source, action } : m)));
  }
  function answerLocally(question: string, reason?: string) {
    const answer = exploreGuideAnswer(question, snap.current);
    if (reason) setNote(reason);
    reply(answer.text, 'guide', answer.action);
    setPhase('idle');
    speakLocal(answer.text);
  }
  function grok(): CopilotVoice {
    if (voice.current) return voice.current;
    const extension: CopilotExtension = {
      instructions: EXPLORE_INSTRUCTIONS,
      tools: [{ type: 'function', name: 'getExploreState', description: 'Read what the player is flying near, its facts, the view scale and where other pilots are. Call before answering about the current view.', parameters: { type: 'object', properties: {}, required: [], additionalProperties: false } }],
      handle: () => exploreToolState(snap.current),
    };
    voice.current = new CopilotVoice(client!, {
      phase: setPhase,
      connected: () => setNote(''),
      paused: () => { voice.current = null; },
      text: (text) => reply(text, 'grok'),
      userText: (text) => setMessages((all) => all.map((m) => (m.id === replyId.current - 1 ? { ...m, text } : m))),
      error: (message) => { voice.current = null; setChannel('local'); answerLocally(questionRef.current, `${message} Using the local guide.`); },
    }, extension);
    voice.current.muted = !voiceOn;
    return voice.current;
  }
  const questionRef = useRef('');
  function newTurn(text: string) {
    questionRef.current = text;
    const userId = nextId.current++; replyId.current = nextId.current++;
    setMessages((all) => [...all.slice(-17), { id: userId, role: 'user', source: 'guide', text }, { id: replyId.current, role: 'assistant', source: 'guide', text: '' }]);
    setDraft(''); setNote('');
  }

  async function ask(raw: string) {
    const text = raw.trim().slice(0, 500);
    if (!text || busy) return;
    newTurn(text);
    if (/somewhere amazing|surprise me/i.test(text)) {
      const options = AMAZING.filter((id) => id !== snap.current.destinationId);
      const dest = destinationById(options[Math.floor(Math.random() * options.length)]);
      const line = factsFor(dest.bodyId ?? dest.id)[0] ?? dest.briefing ?? '';
      const text = `How about ${dest.label}? ${line}`.trim();
      reply(text, 'guide', { kind: 'jump', destinationId: dest.id, label: `Jump to ${dest.label}` });
      speakLocal(text);
      return;
    }
    if (client && channel === 'grok') {
      try { await grok().ask(text); return; }
      catch (cause) { voice.current?.close(); voice.current = null; setChannel('local'); answerLocally(text, `${cause instanceof Error ? cause.message : 'Grok Voice is unavailable.'} Using the local guide.`); return; }
    }
    answerLocally(text);
  }

  async function microphone() {
    if (phase === 'listening') {
      if (voice.current) voice.current.finishRecording(); else recognition.current?.stop();
      return;
    }
    if (busy) return;
    if (client && channel === 'grok') {
      newTurn('Voice question');
      try { await grok().record(); return; }
      catch (cause) { voice.current?.close(); voice.current = null; setChannel('local'); setNote(`${cause instanceof Error ? cause.message : 'Grok Voice is unavailable.'} Trying on-device speech.`); }
    }
    const Ctor = recognitionCtor();
    if (!Ctor) { setNote('This browser has no speech recognition. Type your question instead.'); return; }
    const rec = new Ctor();
    recognition.current = rec;
    rec.lang = 'en-US'; rec.interimResults = false; rec.maxAlternatives = 1;
    let heard = '';
    rec.onresult = (e) => { heard = e.results[0]?.[0]?.transcript ?? ''; };
    rec.onerror = (e) => { if (e.error !== 'aborted') setNote(e.error === 'not-allowed' ? 'Microphone permission was denied.' : 'I didn’t catch that. Try again or type.'); };
    rec.onend = () => { recognition.current = null; setPhase('idle'); if (heard) void ask(heard); };
    setPhase('listening');
    rec.start();
  }

  function act(action: LyraAction) {
    onAction(action);
    setThought(null);
  }
  function submit(e: FormEvent) { e.preventDefault(); void ask(draft); }

  if (hidden) return null;
  const sourceLabel = (m: Message) => (m.role === 'user' ? callsign : m.source === 'grok' ? 'LYRA · GROK VOICE' : 'LYRA · LOCAL GUIDE');
  return (
    <section className="ex-lyra" data-open={open} data-phase={phase} aria-label="LYRA exploration guide"
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') setOpen(false); }}>
      {!open && thought && thoughtsOn && (
        <div className="ex-lyra__thought" role="status" aria-live="polite">
          <p>{thought.text}</p>
          <div className="ex-lyra__thought-actions">
            {thought.action && <button type="button" className="ex-lyra__act" onClick={() => act(thought.action!)}>{thought.action.label} ↗</button>}
            <button type="button" className="ex-lyra__quiet" onClick={() => setThought(null)} aria-label="Dismiss thought">×</button>
          </div>
        </div>
      )}
      <button type="button" className="ex-lyra__launcher" aria-expanded={open} aria-label={open ? 'Close LYRA' : 'Talk to LYRA'} onClick={() => setOpen(!open)}>
        <HologramPortrait phase={phase} active={!open} sampleLevel={() => voice.current?.outputLevel() ?? (phase === 'speaking' ? 0.25 + 0.2 * Math.sin(performance.now() / 70) : 0)} />
        <span className="ex-lyra__name">LYRA</span>
      </button>
      {open && (
        <div className="ex-lyra__panel" role="dialog" aria-label="Talk to LYRA">
          <header className="ex-lyra__head">
            <div>
              <span className="ex-lyra__eyebrow">EXPLORATION GUIDE</span>
              <strong>LYRA</strong>
              <small>{channel === 'grok' ? 'GROK VOICE · LIVE FLIGHT DATA' : recognitionCtor() ? 'LOCAL GUIDE · ON-DEVICE SPEECH' : 'LOCAL GUIDE'}</small>
            </div>
            <button type="button" className="ex-lyra__icon" aria-label="Close LYRA" onClick={() => setOpen(false)}>×</button>
          </header>
          <div className="ex-lyra__messages" role="log" aria-live="polite">
            {messages.map((m) => (
              <article key={m.id} className={`ex-lyra__msg ex-lyra__msg--${m.role}`}>
                <span>{sourceLabel(m)}</span>
                <p>{m.text || (phase === 'listening' ? 'Listening…' : 'Checking flight data…')}</p>
                {m.action && <button type="button" className="ex-lyra__act" onClick={() => act(m.action!)}>{m.action.label} ↗</button>}
              </article>
            ))}
            <div ref={end} />
          </div>
          {note && <p className="ex-lyra__note" role="status">{note}</p>}
          <div className="ex-lyra__quick">
            {QUICK.map((q) => <button key={q.label} type="button" disabled={busy} onClick={() => void ask(q.text)}>{q.label}</button>)}
          </div>
          <form className="ex-lyra__compose" onSubmit={submit}>
            <input aria-label="Ask LYRA" placeholder="Ask about the universe…" value={draft} maxLength={500} onChange={(e) => setDraft(e.target.value)} disabled={busy} />
            <button type="submit" disabled={busy || !draft.trim()} aria-label="Send">↗</button>
          </form>
          <footer className="ex-lyra__foot">
            <button type="button" className={phase === 'listening' ? 'ex-lyra__mic is-live' : 'ex-lyra__mic'} disabled={!listenable || (busy && phase !== 'listening')} onClick={() => void microphone()}>
              {phase === 'listening' ? 'Send voice' : 'Speak'}
            </button>
            <button type="button" aria-pressed={voiceOn} onClick={() => { const next = !voiceOn; setVoiceOn(next); if (voice.current) voice.current.muted = !next; if (!next && 'speechSynthesis' in window) window.speechSynthesis.cancel(); }}>
              {voiceOn ? 'Voice on' : 'Voice off'}
            </button>
            <button type="button" aria-pressed={thoughtsOn} onClick={() => { setThoughtsOn(!thoughtsOn); setThought(null); }}>
              {thoughtsOn ? 'Thoughts on' : 'Thoughts off'}
            </button>
            {busy && <button type="button" onClick={stopAll}>Stop</button>}
          </footer>
        </div>
      )}
    </section>
  );
}
