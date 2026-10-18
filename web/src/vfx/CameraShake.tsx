import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { VFX } from './config';
import type { VfxRuntime } from './runtime';
export function CameraShake({runtime,reduced}:{runtime:VfxRuntime;reduced:boolean}) {
 const camera=useThree(s=>s.camera) as THREE.PerspectiveCamera;
 const offset=useMemo(()=>new THREE.Vector3(),[]);const punch=useMemo(()=>({last:0}),[]);
 // Restore last frame's cosmetic contribution BEFORE the untouched shoulder camera follows gameplay.
 useFrame(()=>{camera.position.sub(offset);camera.fov+=punch.last;if(punch.last)camera.updateProjectionMatrix();offset.set(0,0,0);punch.last=0;},-.5);
 useFrame(({clock})=>{if(reduced||!VFX.cameraShake)return;const t=clock.elapsedTime,a=runtime.trauma*runtime.trauma;offset.set(Math.sin(t*73)*a*.035,Math.sin(t*91)*a*.025,0);camera.position.add(offset);punch.last=Math.min(2,runtime.big*2);camera.fov-=punch.last;camera.updateProjectionMatrix();});
 useEffect(()=>()=>{camera.position.sub(offset);camera.fov+=punch.last;camera.updateProjectionMatrix();},[camera,offset,punch]);
 return null;
}
