import { ArenaAtmosphere } from './ArenaAtmosphere';
import { PilotDetails } from './PilotDetails';
import { rememberPresentation } from './VictoryScene';
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import type { ArenaFrame } from '../../../server/src/contracts';
import { nextQuality, VFX, type Quality } from './config';
import { VfxRuntime, type VisualImpact } from './runtime';
import { DustSystem } from './DustSystem';
import { Haze } from './Haze';
import { ImpactFlash } from './ImpactFlash';
import { SparkPool } from './SparkPool';
import { Shockwave } from './Shockwave';
import { ScorchDecals } from './ScorchDecals';
import { ShieldRipple } from './ShieldRipple';
import { CameraShake } from './CameraShake';
import { PostFX } from './PostFX';
import { BladeAccents } from './BladeAccents';
import { DemoControls } from './DemoControls';
import { FogLayer } from './FogLayer';
import { Metrics } from './Metrics';
import { ImpactAudio } from './ImpactAudio';
import { Context, useVfx } from './context';
export function VfxProvider({children}:{children:ReactNode}) {
 const runtime=useMemo(()=>new VfxRuntime(),[]);
 const [quality,setQuality]=useState<Quality>(()=>typeof matchMedia!=='undefined'&&matchMedia('(pointer: coarse), (max-width: 760px)').matches?'low':VFX.quality);
 const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 return <Context.Provider value={{runtime,quality,reduced}}>{(VFX.telemetry||new URLSearchParams(location.search).has('vfxStats'))&&<Metrics quality={quality}/>}{VFX.enabled&&VFX.autoQuality&&<PerformanceMonitor onDecline={()=>setQuality(nextQuality)} onFallback={()=>setQuality('low')}/>}{children}</Context.Provider>;
}
export function VfxGround({value}:{value:number}) {const {runtime}=useVfx();useEffect(()=>{runtime.ground=value;},[runtime,value]);return null;}
export function VfxLayer({frameRef,flashRef,basic=false}:{frameRef:RefObject<ArenaFrame|null>;flashRef:RefObject<VisualImpact|null>;basic?:boolean}) {
 const {runtime,quality:requestedQuality,reduced}=useVfx();const quality=basic?'low':requestedQuality;const {gl}=useThree();const project=useMemo(()=>new THREE.Vector3(),[]);const audio=useMemo(()=>new ImpactAudio(),[]);
 const metrics=useRef({elapsed:0,frames:0,maxCalls:0});
 useEffect(()=>{if(!VFX.enabled||!VFX.audio)return;audio.prepare();window.addEventListener('pointerdown',audio.prepare);return()=>{window.removeEventListener('pointerdown',audio.prepare);audio.dispose();};},[audio]);
 useFrame(({camera},dt)=>{
  if(!VFX.enabled)return;
  rememberPresentation(frameRef.current);
  runtime.clock.advance(dt,VFX.hitStop&&!reduced);
  const hit=flashRef.current;
  if(hit&&performance.now()-hit.startedMs<500&&runtime.accept(hit)){
    if(VFX.audio)audio.hit();
    // Approximate the contact normal from the already rendered incoming blade, never physics.
    if(!hit.normal&&hit.targetSlot){const players=frameRef.current?.players;if(players)for(let j=0;j<players.length;j++){const player=players[j];if(player.slot!==hit.targetSlot&&player.blade){const blade=player.blade;runtime.normals[(runtime.cursor+29)%30].set(blade.hilt[0]-blade.tip[0],Math.max(.15,blade.hilt[1]-blade.tip[1]),blade.tip[2]-blade.hilt[2]).normalize();break;}}}
  }
  runtime.trauma=Math.max(0,runtime.trauma-dt*1.5);runtime.big=Math.max(0,runtime.big-dt*2);
  for(let i=0;i<4;i++){const p=runtime.positions[(runtime.cursor-1-i+120)%30];project.set(p.x,p.y,p.z).project(camera);runtime.projected[i].set(project.x*.5+.5,project.y*.5+.5,p.w,project.z<1?1:0);}
  if(VFX.telemetry){const m=metrics.current;m.frames++;m.elapsed+=dt;m.maxCalls=Math.max(m.maxCalls,gl.info.render.calls);if(m.elapsed>5){console.info('[arena-vfx]',quality,{fps:Math.round(m.frames/m.elapsed),calls:gl.info.render.calls,maxCalls:m.maxCalls,triangles:gl.info.render.triangles});m.frames=0;m.elapsed=0;m.maxCalls=0;}}
 },-.25);
 if(!VFX.enabled)return null;
 return <>
  {!basic&&VFX.fog&&<FogLayer/>}
  {!basic&&(VFX.dust||VFX.foregroundGrit)&&<DustSystem runtime={runtime} quality={quality}/>}
  {!basic&&VFX.haze&&<Haze runtime={runtime}/>}
  {VFX.impactFlash&&<ImpactFlash runtime={runtime}/>}
  {VFX.sparks&&<SparkPool runtime={runtime} quality={quality}/>}
  {VFX.shockwave&&<Shockwave runtime={runtime}/>}
  {VFX.scorch&&<ScorchDecals runtime={runtime}/>}
  {VFX.shieldRipple&&<ShieldRipple runtime={runtime}/>}
  {new URLSearchParams(location.search).has('vfxDemo')&&<DemoControls runtime={runtime}/>}
  {!basic&&<ArenaAtmosphere frameRef={frameRef}/>}
  <PilotDetails frameRef={frameRef}/>
  <BladeAccents frameRef={frameRef} runtime={runtime}/>
  <CameraShake runtime={runtime} reduced={reduced}/>
  {!basic&&VFX.postFX&&<PostFX runtime={runtime} quality={quality} reduced={reduced}/>}
 </>;
}
