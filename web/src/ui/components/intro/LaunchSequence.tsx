import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { createShipDeparture } from './shipDeparture';
import { ExploreBoundary } from '../explore/ExploreBoundary';
import './launchSequence.css';
const Tunnel=lazy(()=>import('../../../onboarding/HyperspaceTunnel').then(m=>({default:m.HyperspaceTunnel})));

/** Decorative ship departure feeds the existing hyperspeed tunnel. Completion is not a readiness claim. */
export function LaunchSequence({ callsign, accent='#87dcff', reducedMotion=false, onFinished }: {
  callsign:string; accent?:string; reducedMotion?:boolean; onFinished:()=>void;
}) {
  const reduce=!!useReducedMotion()||reducedMotion;
  const [phase,setPhase]=useState<'departure'|'warp'>('departure');
  const [finished,setFinished]=useState(false);
  const callback=useRef(onFinished);callback.current=onFinished;
  const done=useRef(false);
  const canvas=useRef<HTMLCanvasElement>(null);
  const finish=useCallback(()=>{if(!done.current){done.current=true;setFinished(true);callback.current();}},[]);
  useEffect(()=>{
    if(finished)return;
    if(reduce){const id=window.setTimeout(finish,300);return()=>clearTimeout(id);}
    if(phase==='departure'&&canvas.current)return createShipDeparture(canvas.current,callsign,accent,()=>setPhase('warp'));
  },[phase,reduce,callsign,accent,finished,finish]);
  useEffect(()=>{void import('../../../onboarding/HyperspaceTunnel').catch(()=>undefined);},[]);
  return <div className="ko-launch-sequence" aria-label="Launch sequence" role="status">
    <AnimatePresence initial={false}>
      {!reduce&&phase==='departure'&&<motion.div className="ko-launch-sequence__departure" key="ship" exit={{opacity:0}} transition={{duration:.55}}>
        <canvas ref={canvas} aria-hidden="true"/>
        <div className="ko-launch-sequence__hud"><span>{callsign} / DEPARTURE</span><span>FLIGHT DECK</span></div>
        <div className="ko-launch-sequence__caption"><span>LAUNCH SEQUENCE</span><strong>Leaving orbit.</strong></div>
      </motion.div>}
    </AnimatePresence>
    {!reduce&&phase==='warp'&&<ExploreBoundary fallback={<LaunchFallback onFinished={finish}/>}>
      <Suspense fallback={<div className="ko-launch-sequence__fallback"/>}>
        <Tunnel active durationMs={1900} caption="Hyperspace…" onFinished={finish}/>
      </Suspense>
    </ExploreBoundary>}
    {!reduce&&!finished&&<button className="ko-launch-sequence__skip" type="button" onClick={finish}>Skip animation</button>}
  </div>;
}
function LaunchFallback({onFinished}:{onFinished:()=>void}){
  const callback=useRef(onFinished);callback.current=onFinished;
  useEffect(()=>{const id=window.setTimeout(()=>callback.current(),300);return()=>clearTimeout(id);},[]);
  return <div className="ko-launch-sequence__fallback"/>;
}
