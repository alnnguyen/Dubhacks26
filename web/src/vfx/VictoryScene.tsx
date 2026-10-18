import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ArenaFrame, PlayerSlot } from '../../../server/src/contracts';
import { VFX } from './config';
import './victory.css';
let lastFrame:ArenaFrame|null=null;
export function rememberPresentation(frame:ArenaFrame|null){if(frame)lastFrame=frame;}
function Portrait({slot}:{slot:PlayerSlot|null}) {
 const group=useRef<THREE.Group>(null);
 const pose=useMemo(()=>{const player=lastFrame?.players.find(p=>p.slot===slot);const joints=player?.joints;if(!joints)return null;const x=(joints[23][0]+joints[24][0])/2,z=(joints[23][2]+joints[24][2])/2;return joints.map(j=>new THREE.Vector3(j[0]-x,j[1],-j[2]+z));},[slot]);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 useFrame(({clock,camera})=>{const t=reduced?0:Math.min(clock.elapsedTime,3)/3;camera.position.set(2.4+Math.sin(t*.3)*.8,1.6,4);camera.lookAt(0,1,0);});
 const color=slot===2?'#ff8055':'#65ceff';
 return <group ref={group}>
 {pose&&[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]].map(([a,b],i)=>{const dir=pose[b].clone().sub(pose[a]);return <mesh key={i} position={pose[a].clone().lerp(pose[b],.5)} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir.clone().normalize())}><cylinderGeometry args={[.035,.035,dir.length(),10]}/><meshStandardMaterial color={color} emissive={color} emissiveIntensity={.3}/></mesh>;})}
 {pose&&<mesh position={pose[0]}><sphereGeometry args={[.13,20,16]}/><meshStandardMaterial color={color}/></mesh>}
 <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.02,0]}><circleGeometry args={[200,64]}/><meshStandardMaterial color="#7e3e2c" roughness={1}/></mesh>
 <mesh rotation={[-Math.PI/2,0,0]} position={[0,0,0]}><ringGeometry args={[1.2,1.22,64]}/><meshBasicMaterial color={color}/></mesh>
 </group>;
}
/** A separate result-only camera. Results and return controls render immediately. */
export function VictoryScene({winner}:{winner:PlayerSlot|null}) {
 if(!VFX.enabled||!VFX.victory)return null;
 return <div className="vfx-victory" aria-hidden><Canvas camera={{position:[2.4,1.6,4],fov:42}} dpr={[1,1.5]}><color attach="background" args={['#371f20']}/><fog attach="fog" args={['#8e4638',6,25]}/><hemisphereLight args={['#c1d5ff','#9b4831',2]}/><directionalLight position={[3,4,2]} intensity={3} color="#ffd0a0"/><Portrait slot={winner}/></Canvas></div>;
}
