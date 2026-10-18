import { useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VFX } from './config';
import { useVfx } from './context';
export function HitReaction({slot,children}:{slot:number;children:ReactNode}) {
 const root=useRef<THREE.Group>(null);const {runtime,reduced}=useVfx();
 useFrame(()=>{if(!root.current)return;root.current.position.x=0;root.current.rotation.z=0;if(!VFX.enabled||!VFX.hitReaction||reduced)return;for(let i=0;i<30;i++){const age=(performance.now()-runtime.realStarted[i])/1000;if(runtime.targets[i]===slot&&age>=0&&age<.18&&!runtime.blocked[i]){root.current.position.x=Math.sin(age*70)*.012*Math.exp(-age*20);root.current.rotation.z=Math.sin(age*45)*.008*Math.exp(-age*20);}}});
 return <group ref={root}>{children}</group>;
}
