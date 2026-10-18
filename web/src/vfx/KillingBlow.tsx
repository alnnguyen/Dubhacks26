import { useEffect, useRef } from 'react';
import type { GameClient } from '../networking';
import { VFX } from './config';
import './killing-blow.css';
/** Result-state observer: the result appears immediately; only this transparent overlay animates. */
export function KillingBlow({client}:{client:GameClient}) {
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{let last='';let timer=0;const off=client.onView(view=>{if(!VFX.enabled||!VFX.killingBlow||!view||view.phase!=='finished'||view.result?.reason!=='knockout'||last===view.matchId||matchMedia('(prefers-reduced-motion: reduce), (pointer: coarse)').matches)return;last=view.matchId;root.current?.classList.add('vfx-kill-active');timer=window.setTimeout(()=>root.current?.classList.remove('vfx-kill-active'),500);});return()=>{off();clearTimeout(timer);};},[client]);
 return <div ref={root} className="vfx-kill" aria-hidden/>;
}
