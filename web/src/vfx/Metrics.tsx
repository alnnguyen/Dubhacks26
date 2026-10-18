import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { VFX } from './config';
export function Metrics({quality}:{quality:string}) {
 const label=useRef<HTMLDivElement|null>(null),sample=useRef({frames:0,time:0,calls:0});const gl=useThree(s=>s.gl);
 useEffect(()=>{const old=gl.info.autoReset;gl.info.autoReset=false;const node=document.createElement('div');node.style.cssText='position:absolute;left:20px;bottom:24px;padding:8px 12px;background:#08101de6;color:#d5efff;font:12px monospace;z-index:50;pointer-events:none';node.textContent='Measuring render performance…';gl.domElement.parentElement?.append(node);label.current=node;return()=>{node.remove();gl.info.autoReset=old;};},[gl]);
 useFrame((_,dt)=>{const s=sample.current;s.frames++;s.time+=dt;s.calls+=gl.info.render.calls;gl.info.reset();if(s.time>=3){if(label.current)label.current.textContent=`VFX ${VFX.enabled?'ON':'OFF'} ${quality} · ${Math.round(s.frames/s.time)} FPS · ${Math.round(s.calls/s.frames)} calls`;s.frames=0;s.time=0;s.calls=0;}},-.8);
 return null;
}
