import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { NeptuneEnvironment } from './NeptuneEnvironment';
import { DESTINATIONS } from '../../destinations/config';
import './neptune.css';
export const NEPTUNE_HANDOFF_SECONDS=.6;
const END_POSITION=new THREE.Vector3(.45,2.8,4.5),END_TARGET=new THREE.Vector3(0,1,-.6);
const MATCH_POSITION=new THREE.Vector3(0,14,28),MATCH_TARGET=new THREE.Vector3(0,-2,-1);
function ArrivalCamera({video,active,skip,reduced,onReady,onComplete}:{video:React.RefObject<HTMLVideoElement|null>;active:boolean;skip:boolean;reduced:boolean;onReady:()=>void;onComplete:()=>void}){
 const {gl,scene,camera}=useThree();const ready=useRef(false),elapsed=useRef(0),done=useRef(false);const target=useMemoVector();
 useEffect(()=>{let alive=true;gl.compileAsync(scene,camera).then(()=>{if(alive){ready.current=true;onReady();}}).catch(()=>{if(alive){ready.current=true;onReady();}});return()=>{alive=false;};},[gl,scene,camera,onReady]);
 useFrame((_,dt)=>{const el=video.current;if(!el||!active)return;const remaining=el.duration-el.currentTime;const fade=ready.current&&(skip||el.ended)?1:ready.current&&Number.isFinite(remaining)?THREE.MathUtils.clamp(1-remaining/NEPTUNE_HANDOFF_SECONDS,0,1):0;el.style.opacity=String(1-fade);
 if(ready.current&&(skip||el.ended)){elapsed.current+=Math.min(dt,.05);const t=reduced?1:THREE.MathUtils.smoothstep(elapsed.current/2.6,0,1);camera.position.copy(MATCH_POSITION).lerp(END_POSITION,t);target.copy(MATCH_TARGET).lerp(END_TARGET,t);camera.lookAt(target);if((reduced||elapsed.current>=2.6)&&!done.current){done.current=true;onComplete();}}
 else {camera.position.copy(MATCH_POSITION);camera.lookAt(MATCH_TARGET);}
 });return null;
}
function useMemoVector(){const ref=useRef(new THREE.Vector3());return ref.current;}
/** The live canvas is mounted and compiled behind the real video before crossfade. */
export function NeptuneArrival({active,skip=false,reducedMotion=false,onComplete,onPlaying,onError}:{active:boolean;skip?:boolean;reducedMotion?:boolean;onComplete:()=>void;onPlaying?:()=>void;onError?:()=>void}){
 const errorRef=useRef(onError);errorRef.current=onError;
 const video=useRef<HTMLVideoElement>(null);const [ready,setReady]=useState(false);const [ended,setEnded]=useState(false);const markReady=useCallback(()=>setReady(true),[]);
 useEffect(()=>{const el=video.current;if(!el||!active||skip)return;let disposed=false;void el.play().catch(()=>{if(!disposed)errorRef.current?.();});const visibility=()=>{if(document.hidden)el.pause();else if(!el.ended)void el.play().catch(()=>errorRef.current?.());};document.addEventListener('visibilitychange',visibility);return()=>{disposed=true;document.removeEventListener('visibilitychange',visibility);el.pause();};},[active,skip]);
 return <div className="neptune-arrival" data-active={active}>
 <div className="neptune-arrival__frame">
 <Canvas shadows dpr={[1,1.5]} frameloop={active?'always':'demand'} camera={{position:[0,14,28],fov:42,near:.05,far:2400}} gl={{antialias:true}}><Suspense fallback={null}><NeptuneEnvironment reducedMotion={reducedMotion}/><ArrivalCamera video={video} active={active} skip={skip} reduced={reducedMotion} onReady={markReady} onComplete={onComplete}/></Suspense></Canvas>
 <video ref={video} src={DESTINATIONS.neptune.cinematicPath} poster="/assets/neptune/arrival-final.jpg" muted playsInline preload="auto" onEnded={()=>setEnded(true)} onPlaying={onPlaying} onError={onError} aria-label="Spaceship descent to Neptune floating combat station"/>
 <div className="neptune-arrival__mist" aria-hidden style={{opacity:ended?0:.08}}/>
 </div>
 {active&&(ended||skip)&&!ready&&<p className="neptune-arrival__loading" role="status">Preparing the station…</p>}
 </div>;
}
