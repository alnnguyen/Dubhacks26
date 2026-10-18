import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import type { VfxRuntime, VisualImpact } from './runtime';
/** Explicitly synthetic VFX buttons; no command, game state or server event is generated. */
export function DemoControls({runtime}:{runtime:VfxRuntime}) {
 const gl=useThree(s=>s.gl);
 useEffect(()=>{
  const root=document.createElement('div');root.style.cssText='position:absolute;left:20px;bottom:70px;z-index:50;display:flex;gap:8px';
  const impact:VisualImpact={kind:'hit',at:[0,1.4,0],startedMs:0,damage:30,targetSlot:2};
  for(const label of ['Preview hit','Preview guard','Preview finisher']){const b=document.createElement('button');b.textContent=label;b.style.cssText='background:#08192d;color:#ddf7ff;border:1px solid #46758a;padding:8px;cursor:pointer';b.onclick=()=>{impact.kind=label==='Preview guard'?'blocked':'hit';impact.isKill=label==='Preview finisher';impact.startedMs=performance.now();runtime.accept(impact);};root.append(b);}
  gl.domElement.parentElement?.append(root);return()=>root.remove();
 },[runtime,gl]);return null;
}
