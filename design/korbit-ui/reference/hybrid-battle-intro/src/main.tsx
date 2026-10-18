import {useCallback,useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import {createRoot} from 'react-dom/client';
import {CockpitScene,type JumpClock} from './CockpitScene';
import {jumpSound} from './sound';
import {Ship} from './Ship';
import './style.css';
function Preview(){
 const [mode,setMode]=useState<JumpClock['mode']>('idle'),[run,setRun]=useState(0),[ready,setReady]=useState(false),[duration,setDuration]=useState(2600),[sound,setSound]=useState(false);
 const [reduced,setReduced]=useState(()=>new URLSearchParams(location.search).has('reduce')||matchMedia('(prefers-reduced-motion:reduce)').matches);
 const [holdAt,setHoldAt]=useState(.29);
 const stopAudio=useRef<()=>void>(()=>{});const startedAt=useRef(performance.now());
 const onReady=useCallback(()=>setReady(true),[]);
 const clock=useMemo<JumpClock>(()=>({mode,startedAt:startedAt.current,elapsedMs:mode==='hold'?duration*holdAt:0,durationMs:duration,reduced}),[mode,run,duration,reduced,holdAt]);
 useEffect(()=>{if(mode!=='playing')return;const id=setTimeout(()=>{stopAudio.current();setMode('done')},duration);return()=>clearTimeout(id)},[mode,run,duration]);
 useEffect(()=>{const m=matchMedia('(prefers-reduced-motion:reduce)'),update=()=>setReduced(new URLSearchParams(location.search).has('reduce')||m.matches);m.addEventListener('change',update);return()=>{m.removeEventListener('change',update);stopAudio.current()}},[]);
 function play(){stopAudio.current();startedAt.current=performance.now();setRun(x=>x+1);setMode('playing');if(sound&&!reduced)stopAudio.current=jumpSound(duration)}
 function hold(at=.29){setHoldAt(at);stopAudio.current();setMode('hold');setRun(x=>x+1)}
 function reset(){stopAudio.current();setMode('idle');setRun(x=>x+1)}
 const running=mode==='playing'||mode==='hold';
 const style={'--duration':`${duration}ms`,'--elapsed':mode==='hold'?`${duration*holdAt}ms`:'0ms','--play':mode==='hold'?'paused':'running'} as CSSProperties;
 return <main className={`cj-root ${running?'cj-running':''} ${reduced?'cj-reduced':''}`} data-mode={mode}>
  <div className="cj-scene"><CockpitScene clock={clock} onReady={onReady}/></div>
  <div className="cj-glass" aria-hidden/>
  <header className="cj-header"><div><span className="cj-mark">✦</span><strong>KO.rbit</strong><i>/</i><span>FLIGHT DECK</span></div><small><b/> {mode==='idle'?'CONTACT ACQUIRED':mode==='done'?'ARRIVAL CONFIRMED':'HYPERDRIVE ENGAGED'}</small></header>
  {mode==='idle'&&<section className="cj-match"><p>RIVAL SIGNAL LOCKED</p><div className="cj-target"><span/><span/><span/><span/><i>+</i></div><h1>VEX</h1><small>REDSHIFT <span>/</span> STRIKE CLASS</small><button disabled={!ready} onClick={play}>{ready?'ENGAGE JUMP':'POWERING BRIDGE…'} <span>↗</span></button></section>}
  {running&&<div key={run} className="cj-timeline" style={style}>
   <section className="hv-matchup" aria-label="NOVA-7 versus VEX">
    <div className="hv-panel hv-panel--red"/><div className="hv-panel hv-panel--blue"/>
    <div className="hv-seam"/>
    <div className="hv-ship hv-ship--red"><div><Ship team="red"/></div></div>
    <div className="hv-ship hv-ship--blue"><div><Ship team="blue"/></div></div>
    <div className="hv-label hv-label--red"><span>RIVAL PILOT / 02</span><strong>VEX</strong><small>REDSHIFT</small></div>
    <div className="hv-label hv-label--blue"><span>YOUR PILOT / 01</span><strong>NOVA-7</strong><small>NIGHTFALL</small></div>
    <div className="hv-versus"><b>VS</b><span>MATCH CONFIRMED</span></div>
    <div className="hv-laser"/>
   </section>
   <div className="cj-warp-label"><span/> JUMP CORRIDOR STABLE <span/></div>
   <div className="cj-arrival"><small>APPROACH VECTOR</small><strong>MARS ORBIT</strong><span>3.7 m/s² / COMBAT SYSTEMS READY</span></div>
   <div className="cj-lightpass"/><div className="cj-edge-beam cj-edge-beam--left"/><div className="cj-edge-beam cj-edge-beam--right"/>
  </div>}
  {mode==='done'&&<section className="cj-handoff"><p>JUMP COMPLETE / COMBAT LINK ONLINE</p><h1>MARS<span> ORBIT</span></h1><div>NOVA-7 <b>VS</b> VEX</div><small>SURFACE GRAVITY 3.7 m/s²</small><p className="cj-handoff-note">Preview arrival — camera duel would open here.</p><button onClick={play}>REPLAY JUMP ↗</button></section>}
  <div className="cj-metrics"><div><span>VESSEL</span><b>NIGHTFALL</b></div><div><span>JUMP VECTOR</span><b>04 : 17 : 26</b></div><div><span>LINK</span><b className="cj-cyan">02 PILOTS</b></div></div>
  <nav className="cj-controls" aria-label="Preview controls"><span className="cj-preview-tag">GLASS VS / JUMP TRIAL</span><div><label>Duration <select value={duration} onChange={e=>{stopAudio.current();setDuration(Number(e.target.value));setMode('idle')}}><option value={2200}>2.2s</option><option value={2600}>2.6s</option><option value={3000}>3.0s</option></select></label><button aria-pressed={sound} onClick={()=>{stopAudio.current();setSound(!sound)}}>{sound?'SOUND ON':'SOUND OFF'}</button><button disabled={!ready} onClick={()=>hold(.29)}>HOLD VS</button><button disabled={!ready} onClick={()=>hold(.67)}>HOLD WARP</button><button onClick={reset}>RESET</button><button className="cj-play" disabled={!ready} onClick={play}>PLAY JUMP <span>↗</span></button></div></nav>
  {!ready&&<div className="cj-loading" role="status">POWERING BRIDGE SYSTEMS…</div>}
  <p className="cj-status" role="status">{mode==='idle'?`${(duration/1000).toFixed(1)}s glass VS → hyperspace → Mars`:mode==='hold'?holdAt<.4?'Glass matchup held for inspection':'Hyperspace held for inspection':mode==='done'?'Jump complete. Preview handoff reached.':reduced?'Reduced motion: static matchup, same handoff time.':'Jump sequence running…'}</p>
 </main>;
}
const mount=document.getElementById('root')! as HTMLElement&{__previewRoot?:ReturnType<typeof createRoot>};(mount.__previewRoot??=createRoot(mount)).render(<Preview/>);
