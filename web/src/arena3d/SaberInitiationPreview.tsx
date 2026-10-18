import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import type { ArenaFrame, SaberStart, SetupStep, Vec3 } from "../../../server/src/contracts";
import { ArenaScene, type ImpactFlash } from "./ArenaScene";
import { SaberInitiation, SaberCountdown, saberCountdown } from "./SaberInitiation";
import { withSetupBody } from "./localFighter";
import { STEP_ORDER } from "./setupWizard";
import "./arena3d.css";

/** UI-only review route. Synthetic poses and readiness; no network, camera, or permissions. */
export function SaberInitiationPreview() {
  const [step,setStep]=useState<SetupStep>("upright");
  const [running,setRunning]=useState(true);
  const [progress,setProgress]=useState(.55);
  const [bodySeen,setBodySeen]=useState(true);
  const [phoneLive,setPhoneLive]=useState(true);
  const [rivalReady,setRivalReady]=useState(false);
  const [start,setStart]=useState<SaberStart>({startsAtMs:null,unlocked:false});
  const [remaining,setRemaining]=useState<number|null>(null);
  const startRef=useRef(start);startRef.current=start;
  const [qr,setQr]=useState<string|null>(null);
  const frame=useRef<ArenaFrame|null>(null);
  const flash=useRef<ImpactFlash|null>(null);
  const pose=useRef({step,running,bodySeen,phoneLive});pose.current={step,running,bodySeen,phoneLive};
  const youReady=step==="done"&&running&&bodySeen&&phoneLive;
  const fighting=start.unlocked&&youReady&&rivalReady;
  useEffect(()=>{let cancel=false;void QRCode.toDataURL("DESIGN PREVIEW ONLY — NOT A LIVE SABER LINK",{width:160,margin:1}).then(q=>{if(!cancel)setQr(q);});return()=>{cancel=true;};},[]);
  useEffect(()=>{
    const id=window.setInterval(()=>{
      const state=startRef.current;
      if (!youReady || !rivalReady) {
        if (!state.unlocked && state.startsAtMs!==null) setStart({startsAtMs:null,unlocked:false});
        setRemaining(null);return;
      }
      const next=state.unlocked?state:state.startsAtMs===null?{startsAtMs:performance.now()+3000,unlocked:false}:performance.now()>=state.startsAtMs?{...state,unlocked:true}:state;
      if (next!==state) setStart(next);
      setRemaining(saberCountdown(next,performance.now()));
    },80);
    return()=>window.clearInterval(id);
  },[youReady,rivalReady]);
  useEffect(()=>{
    let raf=0;
    const tick=()=>{
      const p=pose.current;
      const j:Vec3[]=Array.from({length:33},()=>[0,0,0]);
      j[0]=[0,.75,.1];j[11]=[-.2,.5,0];j[12]=[.2,.5,0];j[13]=[-.3,.28,.05];j[14]=[.3,.28,.05];j[15]=[-.25,.05,.1];j[16]=[.25,.1,.2];j[23]=[-.12,0,0];j[24]=[.12,0,0];j[25]=[-.14,-.45,0];j[26]=[.14,-.45,0];j[27]=[-.14,-.9,0];j[28]=[.14,-.9,0];
      const pulse=Math.sin(performance.now()/650)*.025;
      if(p.step==="upright") {j[14]=[.34,.8,0];j[16]=[.26,1.1+pulse,0];}
      if(p.step==="right") {j[14]=[.53,.43,.05];j[16]=[.8+pulse,.43,.05];}
      if(p.step==="reach") {j[14]=[.32,.35,.28];j[16]=[.25,.38,p.step==="reach"?.65+pulse:.4];}
      const map=(v:Vec3,slot:1|2):Vec3=>slot===1?[v[0],v[1]+1,v[2]-1.3]:[-v[0],v[1]+1,1.3-v[2]];
      const hand=map(j[16],1),top:Vec3=p.step==="upright"?[0,.9,0]:p.step==="right"?[.9,0,0]:[0,0,.9];
      frame.current={serverMs:performance.now(),engaged:false,players:[
        {slot:1,cell:{q:0,r:-2},facing:[0,1],joints:p.running&&p.bodySeen?j.map(v=>map(v,1)):null,blade:p.running&&p.phoneLive?{hilt:hand,tip:[hand[0]+top[0],hand[1]+top[1],hand[2]+top[2]]}:null,swinging:false,stamina:100,winded:false,stunned:false},
        {slot:2,cell:{q:0,r:2},facing:[0,-1],joints:j.map(v=>map(v,2)),blade:null,swinging:false,stamina:100,winded:false,stunned:false},
      ]};
      raf=requestAnimationFrame(tick);
    };tick();return()=>cancelAnimationFrame(raf);
  },[]);
  const select=(s:SetupStep)=>{setRunning(true);setStep(s);setBodySeen(true);setPhoneLive(s!=="stand"&&s!=="phone");setProgress(.55);setStart({startsAtMs:null,unlocked:false});setRivalReady(false);};
  return <main className="arena-duel" data-initiating={!fighting}>
    <div className="si-arena-viewport"><ArenaScene getFrame={()=>{const f=frame.current;return !fighting&&f?withSetupBody(f,1,f.players.find(p=>p.slot===1)?.joints??null,.65,performance.now()):f;}} flashRef={flash} mySlot={1} board={{cellSize:.65,rows:3}} initiation={!fighting}/></div>
    <nav className="si-preview-tools" aria-label="Initiation preview controls"><span>DESIGN PREVIEW / SIMULATED TELEMETRY · NO CAMERA, PHONE OR SERVER</span>
      <select aria-label="Preview task" value={step} onChange={e=>select(e.target.value as SetupStep)}>{STEP_ORDER.map(s=><option key={s} value={s}>{s}</option>)}</select>
      <button onClick={()=>select(STEP_ORDER[Math.min(STEP_ORDER.indexOf(step)+1,STEP_ORDER.length-1)])}>Simulate task confirmed</button>
      <button onClick={()=>setBodySeen(b=>!b)}>Toggle body tracking</button>
      <button onClick={()=>setPhoneLive(b=>!b)}>Toggle phone motion</button>
      <button disabled={!youReady} onClick={()=>setRivalReady(true)}>Simulate rival ready</button>
    </nav>
    {!fighting&&<SaberInitiation step={step} progress={progress} running={running} loading={false} bodySeen={bodySeen} phonePaired={step!=="stand"} phoneLive={phoneLive} youReady={youReady} rivalReady={rivalReady} yourName="NOVA-7" rivalName="VEX" start={start} serverFresh qr={qr} saberUrl="" notes={[]} error={null} onStart={()=>setRunning(true)} onRedo={()=>select("phone")}/>}
    <SaberCountdown start={start} remaining={remaining} fresh />
    <div className="si-preview-camera"><strong>CAMERA FEEDBACK</strong><small>Preview placeholder · no camera</small></div>
    {fighting&&<p className="arena-controls">Preview only · simulated countdown complete</p>}
  </main>;
}
