import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { GameClient } from '../networking';
import type { LobbyView, LobbyViewModel } from '../ui/state/lobbyTypes';
import { CopilotVoice, type CopilotPhase } from './CopilotVoice';
import { guideAnswer, type GuideAnswer } from './copilotGuide';
import { HologramPortrait } from './HologramPortrait';
import './hologram.css';
import { gameAudio } from '../audio/gameAudio';

type Message = {id: number; role: 'user' | 'assistant'; text: string; source?: 'guide' | 'grok'; action?: GuideAnswer};
const QUICK = [{label: 'Combat basics', text: 'How do I fight?'}, {label: 'Find a matchup', text: 'Who should I challenge?'}, {label: 'Navigate', text: 'Help me navigate the galaxy.'}];
const PHASE_LABEL: Record<CopilotPhase, string> = {idle: 'Ready when you are', connecting: 'Opening voice link…', listening: 'Listening · tap Send voice', thinking: 'Checking flight systems…', speaking: 'LYRA is speaking'};

export function HologramCopilot({lobby, client, hidden, onNavigate, onSelectPilot}: {
  lobby: LobbyViewModel;
  client?: GameClient;
  hidden: boolean;
  onNavigate: (view: LobbyView) => void;
  onSelectPilot: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<CopilotPhase>('idle');
  const [channel, setChannel] = useState<'ready' | 'grok' | 'unavailable'>('ready');
  const [error, setError] = useState('');
  const [sound, setSound] = useState(true);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<Message[]>([{id: 0, role: 'assistant', source: 'guide', text: 'I’m LYRA, your ship copilot. Need a rival or a quick combat briefing?'}]);
  const operation = useRef(0);
  const nextId = useRef(1), replyId = useRef(0), userId = useRef(0), question = useRef('');
  const voice = useRef<CopilotVoice | null>(null);
  const live = useRef({lobby, client}); live.current = {lobby, client};
  const end = useRef<HTMLDivElement>(null), launcher = useRef<HTMLButtonElement>(null);
  const titleId = useId(), panelId = useId();
  const busy = phase !== 'idle';
  useEffect(() => phase === 'listening' || phase === 'speaking' ? gameAudio.duck() : undefined, [phase]);

  function stop() { operation.current++; voice.current?.close(); voice.current = null; setPhase('idle'); setChannel('ready'); setError(''); setMessages(current => current.map(m => m.id === replyId.current && !m.text.trim() ? {...m, text: 'Transmission stopped. Ask again when you’re ready.', source: 'guide'} : m)); }
  function close() { stop(); setOpen(false); launcher.current?.focus({preventScroll: true}); }
  function greet() {
    void gameAudio.unlock().then((ok) => { if (ok) gameAudio.play('lyraHello'); });
  }
  function toggleOpen() {
    setOpen((wasOpen) => {
      if (!wasOpen) greet();
      return !wasOpen;
    });
  }
  useEffect(() => {
    if (hidden) { operation.current++; voice.current?.close(); voice.current = null; setOpen(false); setPhase('idle'); setChannel('ready'); }
  }, [hidden]);
  useEffect(() => {
    const stopBackground = () => { if (document.hidden) { operation.current++; voice.current?.close(); voice.current = null; setPhase('idle'); setChannel('ready'); } };
    document.addEventListener('visibilitychange', stopBackground);
    return () => { document.removeEventListener('visibilitychange', stopBackground); operation.current++; voice.current?.close(); };
  }, []);
  useEffect(() => { if (open) end.current?.scrollIntoView({block: 'nearest'}); }, [messages, open]);
  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); close(); } };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [open]);

  function fallback(message: string) {
    const answer = guideAnswer(question.current, live.current.lobby, !live.current.client);
    setError(message); setChannel('unavailable'); setPhase('idle');
    setMessages(current => current.map(m => m.id === replyId.current && !m.text.trim() ? {...m, source: 'guide', text: answer.text, action: answer} : m));
  }
  function connection() {
    if (voice.current) return voice.current;
    const game = live.current.client;
    if (!game) throw new Error('Choose Live mode to talk to Grok.');
    voice.current = new CopilotVoice(game, {
      phase: setPhase,
      connected: () => { setChannel('grok'); setError(''); },
      paused: () => { voice.current = null; setChannel('ready'); setError(''); },
      text: text => setMessages(current => current.map(m => m.id === replyId.current ? {...m, text, source: 'grok'} : m)),
      userText: text => setMessages(current => current.map(m => m.id === userId.current ? {...m, text} : m)),
      error: message => { voice.current = null; fallback(message); },
    });
    voice.current.muted = !sound;
    return voice.current;
  }
  function newTurn(text: string) {
    question.current = text; userId.current = nextId.current++; replyId.current = nextId.current++;
    setMessages(current => [...current.slice(-17), {id: userId.current, role: 'user', text}, {id: replyId.current, role: 'assistant', text: ''}]);
    setDraft(''); setError('');
  }
  async function ask(text: string) {
    if (busy || !text.trim()) return;
    const turn = ++operation.current;
    newTurn(text.trim().slice(0, 500));
    if (!client || channel === 'unavailable') {
      const answer = guideAnswer(text, lobby, !client);
      setMessages(current => current.map(m => m.id === replyId.current ? {...m, text: answer.text, source: 'guide', action: answer} : m));
      return;
    }
    try { await connection().ask(text); }
    catch (cause) { if (turn !== operation.current) return; voice.current?.close(); voice.current = null; fallback(cause instanceof Error ? cause.message : 'Voice is unavailable.'); }
  }
  async function microphone() {
    if (phase === 'listening') { voice.current?.finishRecording(); return; }
    if (busy || !client || channel === 'unavailable') return;
    const turn = ++operation.current;
    newTurn('Voice question');
    try { await connection().record(); }
    catch (cause) { if (turn !== operation.current) return; voice.current?.close(); voice.current = null; fallback(cause instanceof Error ? cause.message : 'Microphone unavailable. Typed help still works.'); }
  }
  function navigate(action?: GuideAnswer) {
    const pilot = lobby.nearby.find(p => p.id === action?.pilotId && p.status === 'available');
    close(); if (pilot) onSelectPilot(pilot.id); else onNavigate('radar');
  }
  function submit(event: FormEvent) { event.preventDefault(); void ask(draft); }
  if (hidden) return null;
  return <section className="lyra-root" data-phase={phase} data-open={open} aria-label="Ship copilot">
    <button ref={launcher} type="button" className="lyra-launcher" data-button-feedback="off" aria-label="Open LYRA ship copilot" aria-expanded={open} aria-controls={panelId} onClick={toggleOpen}>
      <HologramPortrait phase={phase} active={!open} /><span className="lyra-launcher__name">LYRA</span><span className="lyra-launcher__dot"/>
    </button>
    {open && <section id={panelId} className="lyra-panel" role="dialog" aria-modal="false" aria-labelledby={titleId}>
      <header className="lyra-head">
        <div className="lyra-head__portrait"><HologramPortrait phase={phase} sampleLevel={() => voice.current?.outputLevel() ?? 0} /></div>
        <div className="lyra-head__identity"><span>SHIP INTELLIGENCE</span><h2 id={titleId}>LYRA<span> / COPILOT</span></h2><small>{!client ? 'DEMO GUIDE' : channel === 'grok' ? 'GROK VOICE · LIVE STATE' : channel === 'unavailable' ? 'LOCAL GUIDE · VOICE UNAVAILABLE' : 'LIVE LOBBY · VOICE ON REQUEST'}</small></div>
        <button type="button" className="lyra-icon" aria-label="Close copilot" onClick={close}>×</button>
      </header>
      <div className="lyra-readout"><span className="lyra-status-dot"/><span role="status">{PHASE_LABEL[phase]}</span><span className="lyra-signal" aria-hidden>▂ ▄ ▆ ▄ ▂</span></div>
      <div className="lyra-messages" role="log" aria-label="Copilot conversation" aria-live="polite" aria-relevant="additions text">
        {messages.map(message => <article key={message.id} className={`lyra-message lyra-message--${message.role}`}>
          <span className="lyra-message__who">{message.role === 'user' ? lobby.self.callsign : message.source === 'grok' ? 'LYRA / GROK VOICE' : 'LYRA / LOCAL GUIDE'}</span>
          <p>{message.text || (phase === 'listening' ? 'Listening to your question…' : 'Checking flight systems…')}</p>
          {message.action && (message.action.pilotId || message.action.radar) && <button type="button" className="lyra-action" onClick={() => navigate(message.action)}>{message.action.pilotId ? 'Locate pilot in Radar' : 'Open Radar'} <span>↗</span></button>}
        </article>)}
        <div ref={end}/>
      </div>
      <div className="lyra-quick" aria-label="Suggested copilot questions">{QUICK.map(item => <button key={item.label} type="button" disabled={busy} onClick={() => void ask(item.text)}>{item.label}</button>)}</div>
      {error && <div className="lyra-error" role="status"><span>{error} Local help is available.</span><button type="button" onClick={() => { stop(); setError(''); }}>Retry Voice</button></div>}
      <form className="lyra-compose" onSubmit={submit}>
        <input aria-label="Ask LYRA" placeholder="Ask your copilot…" value={draft} maxLength={500} onChange={event => setDraft(event.target.value)} disabled={busy} />
        <button type="submit" disabled={busy || !draft.trim()} aria-label="Send question">↗</button>
      </form>
      <footer className="lyra-footer">
        <button className={phase === 'listening' ? 'lyra-mic lyra-mic--active' : 'lyra-mic'} type="button" disabled={!client || channel === 'unavailable' || (busy && phase !== 'listening')} title={!client ? 'Choose Live mode for Grok Voice' : undefined} onClick={() => void microphone()}>
          <svg viewBox="0 0 20 20" width="13" height="13" aria-hidden><rect x="7" y="2" width="6" height="10" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M4 9v1a6 6 0 0 0 12 0V9M10 16v3M7 19h6" fill="none" stroke="currentColor" strokeWidth="1.3"/></svg>{phase === 'listening' ? 'Send voice' : 'Speak'}
        </button>
        <button type="button" className="lyra-text-button" aria-pressed={sound} aria-label="Spoken replies" onClick={() => { setSound(!sound); if (voice.current) voice.current.muted = sound; }}>{sound ? 'Audio on' : 'Audio off'}</button>
        {busy && <button type="button" className="lyra-text-button" onClick={stop}>Stop</button>}
        <button type="button" className="lyra-text-button lyra-footer__radar" onClick={() => navigate()}>Radar ↗</button>
      </footer>
      {!client && <p className="lyra-mode-note">Demo pilots are simulated. Choose Live for Grok Voice.</p>}
    </section>}
  </section>;
}
