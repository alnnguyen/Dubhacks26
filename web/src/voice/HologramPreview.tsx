import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HologramPortrait } from './HologramPortrait';
import type { CopilotPhase } from './CopilotVoice';
import './portrait-preview.css';

function PortraitPreview() {
  const [phase, setPhase] = useState<CopilotPhase>('idle');
  useEffect(() => {
    if (phase !== 'speaking') return;
    const timeout = setTimeout(() => setPhase('idle'), 8000);
    return () => clearTimeout(timeout);
  }, [phase]);
  const level = () => {
    if (phase !== 'speaking') return 0;
    const t = performance.now() / 1000;
    return Math.sin(t * 2.1) > .72 ? 0 : Math.max(0, .4 + .28 * Math.sin(t * 17) + .22 * Math.sin(t * 9));
  };
  return <main className="portrait-preview">
    <header><span>SHIP INTELLIGENCE / CHARACTER STUDY</span><h1>LYRA<span> / HOLOGRAM</span></h1><p>Your chosen artwork, animated for the cockpit.</p></header>
    <section className="portrait-stage" aria-label="LYRA animation preview"><div className="portrait-stage__face"><HologramPortrait phase={phase} sampleLevel={level}/></div><span className="portrait-stage__label">{phase.toUpperCase()} / SIGNAL ONLINE</span></section>
    <nav aria-label="Animation states">{(['idle', 'listening', 'thinking', 'speaking'] as const).map(state => <button key={state} aria-pressed={phase === state} onClick={() => setPhase(state)}>{state === 'speaking' ? 'Preview talking' : state}</button>)}</nav>
    <p className="portrait-preview__note">Visual preview · talking uses a simulated audio envelope for 8 seconds.<br/>In the game, mouth movement follows Grok’s actual voice playback. No API call or microphone is used here.</p>
  </main>;
}
createRoot(document.getElementById('root')!).render(<PortraitPreview/>);
