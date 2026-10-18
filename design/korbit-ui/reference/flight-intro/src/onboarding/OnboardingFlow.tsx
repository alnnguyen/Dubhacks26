import { lazy, Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ACCENTS, type AccentId, type PilotIdentity, sanitizeCallsign, sanitizeShipName, savePilotIdentity } from '../app/pilotIdentity';
const HyperspaceTunnel = lazy(() => import('./HyperspaceTunnel').then(m => ({ default: m.HyperspaceTunnel })));
import { KeywordBlock } from './KeywordBlock';
import { LaserInput } from './LaserInput';
import './onboarding.css';
const steps = ['welcome', 'callsign', 'ship', 'bridge'] as const;
type Step = typeof steps[number] | 'closing' | 'hyperspace';
export function OnboardingFlow({onComplete}:{onComplete:(identity:PilotIdentity)=>void}) {
 const reduce = useReducedMotion() ?? false;
 const [step,setStep]=useState<Step>('welcome');
 const [callsign,setCallsign]=useState('STARHAWK');
 const [shipName,setShipName]=useState('QUIET LANCE');
 const [accent,setAccent]=useState<AccentId>('cyan');
 const identity=useMemo(()=>({callsign:sanitizeCallsign(callsign),shipName:sanitizeShipName(shipName),accent}),[callsign,shipName,accent]);
 const index=steps.indexOf(step as typeof steps[number]);
 useEffect(()=>{if(step!=='closing')return;const id=setTimeout(()=>setStep('hyperspace'),700);return()=>clearTimeout(id)},[step]);
 const finish=()=>onComplete(savePilotIdentity(identity));
 function submit(e:FormEvent){e.preventDefault();if(step==='callsign'&&identity.callsign)setStep('ship');if(step==='ship'&&identity.shipName)setStep('bridge')}
 return <main className="obn-root" data-step={step}>
  <div className="obn-atmosphere" aria-hidden/><div className="obn-horizon" aria-hidden/>
  {index>=0&&<><header className="obn-masthead"><div className="obn-brand"><b>✦</b><span>KO.rbit</span><i>/</i><span className="obn-muted">PILOT UPLINK</span></div><span className="obn-counter">0{index+1}<small> / 04</small></span></header>
  <div className="obn-stage"><AnimatePresence mode="wait"><motion.section key={step} className="obn-scene"
   initial={{opacity:0}} animate={{opacity:1}} exit={reduce?{opacity:0}:{opacity:0,x:'-110vw',rotate:3,scale:1.04}}
   transition={{duration:reduce?.15:.32}}>
   <span className="obn-laser-edge" aria-hidden/>
   <p className="obn-kicker">{step==='welcome'?'BEYOND THE SCREEN. INTO THE FIGHT.':step==='callsign'?'01 / ESTABLISH YOUR IDENTITY':step==='ship'?`${identity.callsign} / HULL REGISTRY`:'JUMP COORDINATES CONFIRMED'}</p>
   <h1 className="obn-title"><span className="obn-title__lead">{step==='welcome'?'WELCOME TO':step==='callsign'?'ENTER YOUR':step==='ship'?'NAME YOUR':'TAKE YOUR PLACE ON THE'}</span><KeywordBlock text={step==='welcome'?'KO.rbit':step==='callsign'?'CALLSIGN':step==='ship'?'STARSHIP':'BRIDGE'}/></h1>
   <div className="obn-content">
    {step==='welcome'&&<><p className="obn-sub">Your world. Your starship. Your next rival.</p><button className="obn-cta" onClick={()=>setStep('callsign')}>BEGIN TRANSMISSION <span>↗</span></button></>}
    {(step==='callsign'||step==='ship')&&<form onSubmit={submit} className="obn-form">
     {step==='callsign'?<LaserInput label="PILOT CALLSIGN" value={callsign} maxLength={14} autoComplete="off" spellCheck={false} onChange={e=>setCallsign(e.target.value)}/>:<><LaserInput label="STARSHIP NAME" value={shipName} maxLength={22} autoComplete="off" onChange={e=>setShipName(e.target.value)}/><div className="obn-accents" role="group" aria-label="Hull accent">{ACCENTS.map(a=><button key={a.id} type="button" aria-pressed={accent===a.id} style={{'--swatch':a.css} as React.CSSProperties} onClick={()=>setAccent(a.id)}><span/>{a.label}</button>)}</div></>}
     <button className="obn-cta" disabled={step==='callsign'?!identity.callsign:!identity.shipName}>{step==='callsign'?'LOCK CALLSIGN':'CONFIRM STARSHIP'} <span>↗</span></button>
    </form>}
    {step==='bridge'&&<><div className="obn-pilot"><strong>{identity.callsign}</strong><span>{identity.shipName} / {ACCENTS.find(a=>a.id===accent)?.label}</span></div><button className="obn-cta" onClick={()=>reduce?finish():setStep('closing')}>ENTER HYPERSPACE <span>↗</span></button></>}
   </div><span className="obn-laser-edge obn-laser-edge--bottom" aria-hidden/>
  </motion.section></AnimatePresence></div>
  <footer className="obn-footer"><div className="obn-foot">EARTH / SECTOR 07 <span>FLIGHT PREPARATION</span></div><div className="obn-progress" aria-label={`Step ${index+1} of 4`}>{steps.map((s,i)=><span key={s} data-on={i<=index}/>)}</div>{index>0&&<button className="obn-back" onClick={()=>setStep(steps[index-1])}>← BACK</button>}</footer></>}
  {!reduce&&index>=0&&<div key={`streak-${step}`} className="obn-streak" aria-hidden/>}
  {step==='closing'&&<div className="obn-close" aria-hidden><div className="obn-close__left"/><div className="obn-close__right"/><div className="obn-close__flash"/></div>}
  {step==='hyperspace'&&<Suspense fallback={<div className="ob-warp"/>}><HyperspaceTunnel active onFinished={finish}/></Suspense>}
 </main>;
}
