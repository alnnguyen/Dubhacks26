import { useEffect, useRef, type CSSProperties } from 'react';
import { Ship } from './Ship';
import './match-intro.css';
export type IntroPilot={callsign:string;shipName:string};
export type MatchIntroProps={self:IntroPilot;opponent:IntroPilot;durationMs?:number;elapsedMs?:number;paused?:boolean;reducedMotion?:boolean;onComplete:()=>void};
/** One local timeline; elapsedMs must be derived from server-adjusted time in the actual app. */
export function MatchIntro({self,opponent,durationMs=2600,elapsedMs=0,paused=false,reducedMotion=false,onComplete}:MatchIntroProps){
 const complete=useRef(onComplete);complete.current=onComplete;
 useEffect(()=>{
  if(paused)return;
  const remaining=Math.max(0,durationMs-elapsedMs);
  const id=window.setTimeout(()=>complete.current(),remaining);return()=>clearTimeout(id);
 },[durationMs,elapsedMs,paused,reducedMotion]);
 if(elapsedMs>=durationMs)return null;
 const style={'--duration':`${durationMs}ms`,'--elapsed':`${elapsedMs}ms`,'--play':paused?'paused':'running'} as CSSProperties;
 if(reducedMotion)return <section className="mi-reduced" aria-label={`${self.callsign} versus ${opponent.callsign}`}><span>MATCH FOUND</span><h1>{self.callsign}<b>VS</b>{opponent.callsign}</h1></section>;
 return <section className="mi-intro" style={style} aria-label={`Match found: ${self.callsign} versus ${opponent.callsign}`}>
  <div className="mi-panel mi-panel--red"><div className="mi-dots"/><div className="mi-orbit"/><div className="mi-ship mi-ship--red"><div className="mi-facing"><Ship team="red"/></div></div></div>
  <div className="mi-panel mi-panel--blue"><div className="mi-dots"/><div className="mi-orbit"/><div className="mi-ship mi-ship--blue"><div className="mi-facing"><Ship team="blue"/></div></div></div>
  <div className="mi-split"/>
  <svg className="mi-speed" viewBox="0 0 1400 900" preserveAspectRatio="none" aria-hidden="true">{Array.from({length:42},(_,i)=>{
   const angle=(i*137.508%360)*Math.PI/180,r=260+(i%6)*40;
   return <line key={i} x1={700+Math.cos(angle)*r} y1={450+Math.sin(angle)*r} x2={700+Math.cos(angle)*(r+140+(i%4)*70)} y2={450+Math.sin(angle)*(r+140+(i%4)*70)} strokeWidth={i%4===0?3:1}/>;
  })}</svg>
  <div className="mi-contact"><span className="mi-signal"/> HOSTILE CONTACT / MATCH FOUND</div>
  <div className="mi-name mi-name--red"><span>CHALLENGER / 02</span><strong>{opponent.callsign}</strong><small>{opponent.shipName}</small></div>
  <div className="mi-name mi-name--blue"><span>YOUR PILOT / 01</span><strong>{self.callsign}</strong><small>{self.shipName}</small></div>
  <div className="mi-burst"/><div className="mi-vs"><div>VS</div><span>ENGAGE</span></div>
  <div className="mi-lasers" aria-hidden="true">{[0,1,2,3].map(i=><i key={i} style={{'--i':i} as CSSProperties}/>)}</div>
  <div className="mi-flash"/><div className="mi-bottom">MARS ORBIT <span>DUEL LINK ESTABLISHED</span></div>
 </section>;
}
