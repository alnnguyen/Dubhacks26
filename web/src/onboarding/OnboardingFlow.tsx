import { LaunchSequence } from '../ui/components/intro/LaunchSequence';
import { KorbitIntro } from '../ui/components/intro/KorbitIntro';
import { BRAND_NAME } from '../ui/brand';
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ACCENTS, type AccentId, type PilotIdentity, sanitizeCallsign, sanitizeShipName, savePilotIdentity } from '../app/pilotIdentity';
import { KeywordBlock } from './KeywordBlock';
import { LaserInput } from './LaserInput';
import './onboarding.css';
import { gameAudio } from '../audio/gameAudio';
import { useAudioScene } from '../audio/useAudioScene';
const steps = ['welcome', 'callsign', 'ship', 'bridge'] as const;
type Step = typeof steps[number] | 'closing';
export function OnboardingFlow({onComplete}:{onComplete:(identity:PilotIdentity)=>void}) {
 useAudioScene('onboarding');
 const reduce = useReducedMotion() ?? false;
 const [step,setStep]=useState<Step>('welcome');
 const [callsign,setCallsign]=useState('STARHAWK');
 const [shipName,setShipName]=useState('QUIET LANCE');
 const [accent,setAccent]=useState<AccentId>('cyan');
 const identity=useMemo(()=>({callsign:sanitizeCallsign(callsign),shipName:sanitizeShipName(shipName),accent}),[callsign,shipName,accent]);
 const index=steps.indexOf(step as typeof steps[number]);
 const boardingWarp = step === 'closing';
 useEffect(() => { if (boardingWarp) return gameAudio.play('introJump'); }, [boardingWarp]);

 const finish=()=>onComplete(savePilotIdentity(identity));
 function submit(e:FormEvent){e.preventDefault();if(step==='callsign'&&identity.callsign)setStep('ship');if(step==='ship'&&identity.shipName)setStep('bridge')}
 if (step === 'welcome') return <KorbitIntro actionLabel="Begin transmission" onContinue={()=>setStep('callsign')} reducedMotion={reduce}/>;
 return <main className="obn-root" data-step={step}>
  <div className="obn-atmosphere" aria-hidden/><div className="obn-horizon" aria-hidden/>
  {index>=0&&<><header className="obn-masthead"><div className="obn-brand"><b>✦</b><span className="ko-wordmark">{BRAND_NAME}</span><i>/</i><span className="obn-muted">PILOT UPLINK</span></div><span className="obn-counter">0{index+1}<small> / 04</small></span></header>
  <div className="obn-stage"><AnimatePresence mode="wait"><motion.section key={step} className="obn-scene"
   initial={{opacity:0}} animate={{opacity:1}} exit={reduce?{opacity:0}:{opacity:0,x:'-110vw',rotate:3,scale:1.04}}
   transition={{duration:reduce?.15:.32}}>
   <span className="obn-laser-edge" aria-hidden/>
   <p className="obn-kicker">{step==='callsign'?'01 / ESTABLISH YOUR IDENTITY':step==='ship'?`${identity.callsign} / HULL REGISTRY`:'JUMP COORDINATES CONFIRMED'}</p>
   <h1 className="obn-title"><span className="obn-title__lead">{step==='callsign'?'ENTER YOUR':step==='ship'?'NAME YOUR':'TAKE YOUR PLACE ON THE'}</span><KeywordBlock text={step==='callsign'?'CALLSIGN':step==='ship'?'STARSHIP':'BRIDGE'}/></h1>
   <div className="obn-content">
    {(step==='callsign'||step==='ship')&&<form onSubmit={submit} className="obn-form">
     {step==='callsign'?<LaserInput label="PILOT CALLSIGN" value={callsign} maxLength={14} autoComplete="off" spellCheck={false} onChange={e=>setCallsign(e.target.value)}/>:<><LaserInput label="STARSHIP NAME" value={shipName} maxLength={22} autoComplete="off" onChange={e=>setShipName(e.target.value)}/><div className="obn-accents" role="group" aria-label="Hull accent">{ACCENTS.map(a=><button key={a.id} type="button" aria-pressed={accent===a.id} style={{'--swatch':a.css} as CSSProperties} onClick={()=>setAccent(a.id)}><span/>{a.label}</button>)}</div></>}
     <button className="obn-cta" disabled={step==='callsign'?!identity.callsign:!identity.shipName}>{step==='callsign'?'LOCK CALLSIGN':'CONFIRM STARSHIP'} <span>↗</span></button>
    </form>}
    {step==='bridge'&&<><dl className="ko-launch-manifest">
      <div><dt>Callsign</dt><dd>{identity.callsign}</dd></div>
      <div><dt>Starship</dt><dd>{identity.shipName}</dd></div>
      <div><dt>Hull accent</dt><dd><i style={{background:ACCENTS.find(a=>a.id===accent)?.css}} aria-hidden="true"/>{ACCENTS.find(a=>a.id===accent)?.label}</dd></div>
    </dl><button className="obn-cta" data-ui-sound="commit" onClick={()=>reduce?finish():setStep('closing')}>ENTER HYPERSPACE <span>↗</span></button></>}
   </div><span className="obn-laser-edge obn-laser-edge--bottom" aria-hidden/>
  </motion.section></AnimatePresence></div>
  <footer className="obn-footer"><div className="obn-foot">EARTH / SECTOR 07 <span>FLIGHT PREPARATION</span></div><div className="obn-progress" aria-label={`Step ${index+1} of 4`}>{steps.map((s,i)=><span key={s} data-on={i<=index}/>)}</div>{index>0&&<button className="obn-back" onClick={()=>setStep(steps[index-1])}>← BACK</button>}</footer></>}
  {!reduce&&index>=0&&<div key={`streak-${step}`} className="obn-streak" aria-hidden/>}
  {step==='closing'&&<LaunchSequence callsign={identity.callsign} accent={ACCENTS.find(a=>a.id===accent)?.css} reducedMotion={reduce} onFinished={finish}/>}
 </main>;
}
