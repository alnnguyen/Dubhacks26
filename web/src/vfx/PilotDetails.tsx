import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ArenaFrame } from '../../../server/src/contracts';
import { useVfx } from './context';
import { VFX } from './config';
/** Attachments follow existing joint positions; they never alter the skeleton. */
export function PilotDetails({frameRef}:{frameRef:RefObject<ArenaFrame|null>}) {
 const {runtime,reduced}=useVfx();const heads=useRef<(THREE.Group|null)[]>([]),badges=useRef<(THREE.Mesh|null)[]>([]),scans=useRef<(THREE.Mesh|null)[]>([]);
 const first=useRef([-1,-1]);
 const scanMaterial=useMemo(()=>new THREE.MeshBasicMaterial({color:'#91efff',transparent:true,opacity:.4,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}),[]);
 useEffect(()=>()=>scanMaterial.dispose(),[scanMaterial]);
 useFrame(()=>{for(let i=0;i<2;i++){const p=frameRef.current?.players[i];const j=p?.joints;const head=heads.current[i],badge=badges.current[i],scan=scans.current[i];
 if(head){head.visible=!!j;if(j){head.position.set(j[0][0],j[0][1]+runtime.ground,-j[0][2]);head.rotation.y=Math.atan2(p.facing[0],-p.facing[1]);}}
 if(badge){badge.visible=!!j;if(j)badge.position.set(j[11][0],j[11][1]+runtime.ground,-j[11][2]);}
 if(j&&first.current[i]<0)first.current[i]=runtime.clock.time;
 const age=runtime.clock.time-first.current[i];if(scan){scan.visible=!!j&&VFX.entrances&&!reduced&&age>=0&&age<.9;if(j){scan.position.set(j[23][0],runtime.ground+.15+age*2,-j[23][2]);scan.scale.setScalar(.7+Math.sin(age*5)*.06);}}
 }});
 return <>{[0,1].map(i=><group key={i}>
 {VFX.pilotDetails&&<group ref={g=>{heads.current[i]=g;}}>
 <mesh rotation={[0,0,i?.12:-.12]}><torusGeometry args={[.155,.018,6,24,Math.PI*1.65]}/><meshStandardMaterial color={i?'#c77a51':'#89b5c6'} metalness={.65} roughness={.35}/></mesh>
 <mesh position={[i?-.17:.17,0,0]}><boxGeometry args={[.035,.11,.08]}/><meshStandardMaterial color="#273541"/></mesh>
 </group>}
 {VFX.pilotDetails&&<mesh ref={m=>{badges.current[i]=m;}} rotation={[0,0,Math.PI/4]}><boxGeometry args={[.055,.055,.055]}/><meshStandardMaterial color={i?'#ff713e':'#70dbff'} emissive={i?'#ff713e':'#70dbff'} emissiveIntensity={1.2}/></mesh>}
 <mesh ref={m=>{scans.current[i]=m;}} rotation={[-Math.PI/2,0,0]} material={scanMaterial}><ringGeometry args={[.45,.47,48]}/></mesh>
 </group>)}</>;
}
