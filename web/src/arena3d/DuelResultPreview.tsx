import { useState } from "react";
import { DuelResult, type DuelResultView } from "./DuelResult";

export function DuelResultPreview() {
  const [outcome,setOutcome]=useState<"win"|"lose"|"draw">("win");
  const [requested,setRequested]=useState(false);
  const [invited,setInvited]=useState(false);
  const [offline,setOffline]=useState(false);
  const [note,setNote]=useState("");
  const view: DuelResultView={round:1,world:{id:"mars",name:"Mars",gravityMps2:3.7},result:{winner:outcome==="draw"?null:outcome==="win"?1:2,reason:"knockout"},
    you:{slot:1,callsign:"NOVA-7",health:outcome==="lose"?0:55,connected:true,rematch:requested},
    rival:{slot:2,callsign:"VEX",health:outcome==="win"?0:40,connected:!offline,rematch:invited}};
  return <><DuelResult view={view} note={note} onRematch={()=>setRequested(true)} onLeave={()=>setNote("Preview only — live button returns to the cockpit.")} replay={<section className="replay-panel"><h2>Your duel. The highlights.</h2><p>Preview placeholder. The live screen contains your actual replay controls.</p></section>} />
    <nav style={{position:"fixed",zIndex:60,top:10,right:16,display:"flex",gap:6,flexWrap:"wrap",maxWidth:"65vw",justifyContent:"flex-end",font:"10px monospace"}} aria-label="Result preview controls">
      <span style={{color:"#9cb8d7",background:"#020711",padding:8}}>DESIGN PREVIEW / SIMULATED RESULT</span>
      {(["win","lose","draw"] as const).map(o=><button key={o} onClick={()=>{setOutcome(o);setRequested(false);setNote("");}}>{o}</button>)}
      <button onClick={()=>setInvited(v=>!v)}>Toggle rival rematch</button><button onClick={()=>setOffline(v=>!v)}>Toggle rival offline</button>
    </nav></>;
}
