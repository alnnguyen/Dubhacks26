import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ArenaFrame } from '../../../server/src/contracts';
import type { VfxRuntime } from './runtime';
import { VFX } from './config';
export function BladeAccents({frameRef,runtime}:{frameRef:RefObject<ArenaFrame|null>;runtime:VfxRuntime}) {
 const mesh=useRef<THREE.InstancedMesh>(null);const lights=useRef<(THREE.PointLight|null)[]>([]);
 const dummy=useMemo(()=>new THREE.Object3D(),[]),a=useMemo(()=>new THREE.Vector3(),[]),b=useMemo(()=>new THREE.Vector3(),[]),direction=useMemo(()=>new THREE.Vector3(),[]),up=useMemo(()=>new THREE.Vector3(0,1,0),[]);
 const colors=useMemo(()=>[new THREE.Color('#4cc3ff'),new THREE.Color('#ff4b3a')],[]);
 const material=useMemo(()=>new THREE.MeshBasicMaterial({color:new THREE.Color(.6,1.4,2.4),transparent:true,opacity:.10,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}),[]);
 useEffect(()=>()=>material.dispose(),[material]);
 useFrame(()=>{
  for(let i=0;i<2;i++){
   const blade=frameRef.current?.players[i]?.blade;dummy.scale.setScalar(0);
   if(blade&&VFX.bladeGlow){a.set(blade.hilt[0],blade.hilt[1]+runtime.ground,-blade.hilt[2]);b.set(blade.tip[0],blade.tip[1]+runtime.ground,-blade.tip[2]);direction.subVectors(b,a);const length=direction.length();dummy.position.copy(a).lerp(b,.5);dummy.quaternion.setFromUnitVectors(up,direction.normalize());const recent=runtime.positions[(runtime.cursor+29)%30];const locked=VFX.clashGlow&&runtime.blocked[(runtime.cursor+29)%30]&&runtime.clock.time-recent.w<.22;dummy.scale.set(.035*(locked?1.7:1),Math.max(.01,length),.035*(locked?1.7:1));}
   dummy.updateMatrix();mesh.current?.setMatrixAt(i,dummy.matrix);mesh.current?.setColorAt(i,colors[i]);
  }
  if(mesh.current){mesh.current.instanceMatrix.needsUpdate=true;if(mesh.current.instanceColor)mesh.current.instanceColor.needsUpdate=true;}
  for(let i=0;i<4;i++){const light=lights.current[i];if(!light)continue;const p=runtime.positions[(runtime.cursor-1-i+120)%30],age=runtime.clock.time-p.w;light.position.set(p.x,p.y,p.z);light.intensity=VFX.impactLights&&age>=0&&age<.16?5*(1-age/.16):0;}
 });
 return <><instancedMesh ref={mesh} args={[undefined,material,2]} frustumCulled={false}><capsuleGeometry args={[.5,0,4,12]}/></instancedMesh>{[0,1,2,3].map(i=><pointLight key={i} ref={l=>{lights.current[i]=l;}} color="#80dfff" intensity={0} distance={2}/>)}</>;
}
