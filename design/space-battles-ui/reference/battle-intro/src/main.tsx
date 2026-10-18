import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MatchIntro } from './MatchIntro';
import { playIntroSound } from './sound';
import './preview.css';
const self={callsign:'NOVA-7',shipName:'NIGHTFALL / ION CLASS'};
const opponent={callsign:'VEX',shipName:'REDSHIFT / STRIKE CLASS'};
function Preview(){
 const [run,setRun]=useState(0),[active,setActive]=useState(true),[paused,setPaused]=useState(true),[elapsed,setElapsed]=useState(1650),[duration,setDuration]=useState(2600),[sound,setSound]=useState(false);
 const [reduce,setReduce]=useState(()=>new URLSearchParams(location.search).has('reduce') || matchMedia('(prefers-reduced-motion: reduce)').matches);
 const stopSound=useRef<()=>void>(()=>{});
 useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)');const listener=()=>setReduce(new URLSearchParams(location.search).has('reduce') || media.matches);media.addEventListener('change',listener);return()=>{media.removeEventListener('change',listener);stopSound.current()}},[]);
 function play(late=0){stopSound.current();setElapsed(late);setPaused(false);setActive(true);setRun(n=>n+1);if(sound&&!reduce)stopSound.current=playIntroSound(duration,late)}
 function freeze(){stopSound.current();setElapsed(duration*.65);setPaused(true);setActive(true);setRun(n=>n+1)}
 return <><div className="preview-stage">
  <div className="preview-arena" aria-hidden={active}><div className="preview-reticle"/><small>PREVIEW COMPLETE</small><h1>BATTLE<br/><span>READY.</span></h1><p>NOVA-7 <b>VS</b> VEX <i> / </i> MARS ORBIT</p></div>
  {active&&<MatchIntro key={run} self={self} opponent={opponent} durationMs={duration} elapsedMs={elapsed} paused={paused} reducedMotion={reduce} onComplete={()=>{setActive(false);stopSound.current()}}/>}
 </div>
 <nav className="preview-controls" aria-label="Animation preview controls"><div className="preview-wordmark">FLIGHT TEST <span>/ MATCH INTRO</span></div><div className="preview-actions"><label className="preview-length">Length <select value={duration} onChange={e=>{setDuration(Number(e.target.value));stopSound.current();setElapsed(Number(e.target.value)*.65);setPaused(true);setActive(true);setRun(n=>n+1)}}><option value={2200}>2.2s</option><option value={2600}>2.6s</option><option value={3000}>3.0s</option></select></label><button aria-pressed={sound} onClick={()=>{stopSound.current();setSound(!sound)}}>{sound?'SOUND ON':'SOUND OFF'}</button><button onClick={freeze}>HOLD VS</button><button className="preview-late" onClick={()=>play(1200)}>LATE JOIN +1.2s</button><button className="preview-play" onClick={()=>play()}>{active&&!paused?'REPLAY':'PLAY INTRO'} <span>↗</span></button></div></nav>
 <div className="preview-caption" aria-live="polite">{reduce?'Reduced motion: short title fade.':paused?'Held at the VS moment. Press Play intro to watch the full sequence.':active?`${(duration/1000).toFixed(1)} second sequence running…`:'Battle handoff reached. Replay when ready.'}</div>
 </>;
}
const mount = document.getElementById('root')! as HTMLElement & { __previewRoot?: ReturnType<typeof createRoot> };
(mount.__previewRoot ??= createRoot(mount)).render(<Preview/>);
