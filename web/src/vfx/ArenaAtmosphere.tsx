import { Suspense, use, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ArenaFrame } from '../../../server/src/contracts';
import { loadTerrainSampler } from '../arena/mars/MarsEnvironment';
import { useVfx } from './context';
import { VFX } from './config';

/** Decorative objects only: no collision bodies or authoritative state. */
function Wreck() {
 const terrain=use(loadTerrainSampler());const beacon=useRef<THREE.PointLight>(null);const smoke=useRef<THREE.InstancedMesh>(null);
 const dummy=useMemo(()=>new THREE.Object3D(),[]);const {reduced}=useVfx();
 useFrame(({clock})=>{const t=reduced?0:clock.elapsedTime;if(beacon.current)beacon.current.intensity=1+Math.pow(Math.max(0,Math.sin(t*2)),8)*5;
 for(let i=0;i<10;i++){const age=((t*.12+i/10)%1);dummy.position.set(age*1.6,age*3,.2*Math.sin(i));dummy.scale.setScalar(.22+age*.6);dummy.updateMatrix();smoke.current?.setMatrixAt(i,dummy.matrix);}if(smoke.current)smoke.current.instanceMatrix.needsUpdate=true;});
 return <group position={[-6,terrain.heightAt(-6,-10),-10]} rotation={[0,.45,-.12]}>
  <mesh position={[0,.45,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.35,.65,3.8,6]}/><meshStandardMaterial color="#514541" roughness={.95}/></mesh>
  <mesh position={[.3,.3,0]} rotation={[0,.1,.08]}><boxGeometry args={[1.3,.12,4.8]}/><meshStandardMaterial color="#6d5b51" roughness={.9}/></mesh>
  <mesh position={[1.7,.55,0]}><sphereGeometry args={[.07,8,6]}/><meshBasicMaterial color={[4,.15,.04]} toneMapped={false}/></mesh>
  <pointLight ref={beacon} position={[1.7,.7,0]} color="#ff4422" distance={3} intensity={2}/>
  <instancedMesh ref={smoke} args={[undefined,undefined,10]} position={[-.5,.7,0]} frustumCulled={false}><icosahedronGeometry args={[1,1]}/><meshBasicMaterial color="#55443e" transparent opacity={.08} depthWrite={false}/></instancedMesh>
 </group>;
}
export function ArenaAtmosphere({frameRef}:{frameRef:RefObject<ArenaFrame|null>}) {
 const {runtime,quality}=useVfx();const pools=useRef<(THREE.Mesh|null)[]>([]);const lamps=useRef<(THREE.PointLight|null)[]>([]);const spots=useRef<(THREE.SpotLight|null)[]>([]);
 useFrame(()=>{for(let i=0;i<2;i++){const player=frameRef.current?.players[i];const joints=player?.joints;const pool=pools.current[i],lamp=lamps.current[i],spot=spots.current[i];const hip=joints?.[23];
 if(pool){pool.visible=!!hip;if(hip)pool.position.set(hip[0],runtime.ground+.012,-hip[2]);}
 if(spot){spot.intensity=hip?2:0;if(hip){spot.position.set(hip[0]+.6,runtime.ground+5,-hip[2]+.8);spot.target.position.set(hip[0],runtime.ground,-hip[2]);spot.target.updateMatrixWorld();}}
 const blade=player?.blade;if(lamp){lamp.intensity=blade?2.5:0;if(blade)lamp.position.set((blade.hilt[0]+blade.tip[0])/2,runtime.ground+(blade.hilt[1]+blade.tip[1])/2,-(blade.hilt[2]+blade.tip[2])/2);}
 }});
 return <>
 {VFX.wreck&&<Suspense fallback={null}><Wreck/></Suspense>}
 {[0,1].map(i=><group key={i}>
 {VFX.duelingLights&&<mesh ref={m=>{pools.current[i]=m;}} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[1.2,40]}/><meshBasicMaterial color={i?'#ff713e':'#42cfff'} transparent opacity={.035} depthWrite={false} blending={THREE.AdditiveBlending}/></mesh>}
 {VFX.duelingLights&&quality!=='low'&&<spotLight ref={m=>{spots.current[i]=m;}} color={i?'#ff9960':'#74cfff'} angle={.32} penumbra={1} distance={9} decay={2}/>}
 {VFX.reactiveLight&&quality!=='low'&&<pointLight ref={m=>{lamps.current[i]=m;}} color={i?'#ff593b':'#4cc3ff'} distance={2.5} decay={2}/>}
 </group>)}
 </>;
}
