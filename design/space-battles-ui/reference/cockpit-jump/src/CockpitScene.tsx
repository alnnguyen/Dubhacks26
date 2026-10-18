import {useEffect,useMemo,useRef} from 'react';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {Environment,Lightformer} from '@react-three/drei';
import {Bloom,EffectComposer,Vignette} from '@react-three/postprocessing';
import * as THREE from 'three';
import {Cockpit} from './ui/components/spaceship/Cockpit';
import {CommanderDisplay} from './ui/components/spaceship/CommanderDisplay';
export type JumpClock={mode:'idle'|'playing'|'hold'|'done';startedAt:number;elapsedMs:number;durationMs:number;reduced:boolean};
export function progress(clock:JumpClock,now:number){return clock.mode==='idle'?0:clock.mode==='done'?1:Math.min(1,Math.max(0,(clock.elapsedMs+(clock.mode==='playing'?now-clock.startedAt:0))/clock.durationMs))}
export function warpAmount(t:number){if(t<.13)return 0;if(t<.42)return Math.pow((t-.13)/.29,2);if(t<.83)return 1;return Math.max(0,(1-t)/.17)}
function rng(seed:number){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
function Rig({clock}:{clock:JumpClock}){
 const {camera,size}=useThree();
 useFrame(()=>{
  const p=progress(clock,performance.now()),w=clock.reduced?0:warpAmount(p),cam=camera as THREE.PerspectiveCamera;
  const aspect=size.width/size.height;
  const base=THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(64)/2)/aspect)),50,96);
  const push=clock.reduced?0:Math.min(1,p/.65)*1.05;
  cam.position.set(Math.sin(p*53)*.006*w,1.64+Math.sin(p*39)*.004*w,1.15-push);
  cam.lookAt(0,1.6,-12);cam.fov=base+w*11;cam.updateProjectionMatrix();
 });return null;
}
function StarField({clock}:{clock:JumpClock}){
 const n=340,seeded=useMemo(()=>{const r=rng(1307);return Array.from({length:n},()=>{const a=r()*Math.PI*2,rad=2+r()*54;return{x:Math.cos(a)*rad,y:1.7+Math.sin(a)*rad,z:-8-r()*185}})},[]);
 const geometry=useMemo(()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*6),3));return g},[]);
 const material=useMemo(()=>new THREE.LineBasicMaterial({color:new THREE.Color(1.4,2.3,3.2),transparent:true,opacity:.65,toneMapped:false,depthWrite:false}),[]);
 useEffect(()=>()=>{geometry.dispose();material.dispose()},[geometry,material]);
 useFrame((_,delta)=>{
  const t=progress(clock,performance.now()),warp=clock.reduced?0:warpAmount(t),dt=clock.mode==='hold'?0:Math.min(delta,.04);
  const positions=geometry.attributes.position;
  for(let i=0;i<n;i++){const s=seeded[i];s.z+=dt*(1+warp*180);if(s.z>-3)s.z=-190;
   positions.setXYZ(i*2,s.x,s.y,s.z);positions.setXYZ(i*2+1,s.x,s.y,s.z-(.025+warp*(6+(i%7)*1.7)));
  }
  positions.needsUpdate=true;material.opacity=.65+warp*.35;
 });return <lineSegments geometry={geometry} material={material} frustumCulled={false}/>;
}
function Tunnel({clock}:{clock:JumpClock}){
 const geometry=useMemo(()=>{const values:number[]=[];for(let r=0;r<14;r++)for(let i=0;i<80;i++){const a=i/80*Math.PI*2,b=(i+1)/80*Math.PI*2,rad=8+r*.8,z=-10-r*8;values.push(Math.cos(a)*rad,1.7+Math.sin(a)*rad,z,Math.cos(b)*rad,1.7+Math.sin(b)*rad,z)}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(values,3));return g},[]);
 const material=useMemo(()=>new THREE.LineBasicMaterial({color:'#327dbb',transparent:true,opacity:0,depthWrite:false}),[]);
 useEffect(()=>()=>{geometry.dispose();material.dispose()},[geometry,material]);
 const glow=useMemo(()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d')!,g=c.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(218,246,255,1)');g.addColorStop(.13,'rgba(122,198,255,.8)');g.addColorStop(.4,'rgba(36,100,220,.25)');g.addColorStop(1,'rgba(0,40,130,0)');c.fillStyle=g;c.fillRect(0,0,128,128);return new THREE.CanvasTexture(canvas)},[]);
 useEffect(()=>()=>glow.dispose(),[glow]);
 const sprite=useRef<THREE.Sprite>(null);
 useFrame(()=>{const w=clock.reduced?0:warpAmount(progress(clock,performance.now()));material.opacity=w*.1;if(sprite.current)(sprite.current.material as THREE.SpriteMaterial).opacity=w*.9});
 return <><lineSegments geometry={geometry} material={material}/><sprite ref={sprite} position={[0,1.7,-65]} scale={[35,35,1]}><spriteMaterial map={glow} transparent opacity={0} depthWrite={false} toneMapped={false}/></sprite></>;
}
function Mars({clock}:{clock:JumpClock}){
 const mesh=useRef<THREE.Mesh>(null);
 const texture=useMemo(()=>{const c=document.createElement('canvas');c.width=512;c.height=256;const g=c.getContext('2d')!,r=rng(91);g.fillStyle='#9f523b';g.fillRect(0,0,512,256);for(let i=0;i<4500;i++){g.fillStyle=r()>.45?'rgba(226,154,104,.15)':'rgba(39,24,24,.14)';g.beginPath();g.ellipse(r()*512,r()*256,1+r()*20,1+r()*6,r()*Math.PI,0,Math.PI*2);g.fill()}const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;return map},[]);
 useEffect(()=>()=>texture.dispose(),[texture]);
 useFrame(()=>{if(!mesh.current)return;const p=clock.reduced?0:progress(clock,performance.now()),w=clock.reduced?0:warpAmount(p);(mesh.current.material as THREE.MeshStandardMaterial).opacity=1-w;mesh.current.position.set(p>.85?-4:9,3,-42);mesh.current.rotation.y=.3+p*.2});
 return <mesh ref={mesh} position={[9,3,-42]}><sphereGeometry args={[10,48,32]}/><meshStandardMaterial map={texture} color="#cd9a7e" roughness={1} transparent opacity={1}/></mesh>;
}
function FirstFrame({onReady}:{onReady:()=>void}){const done=useRef(false);useFrame(()=>{if(!done.current){done.current=true;requestAnimationFrame(onReady)}});return null}
export function CockpitScene({clock,onReady}:{clock:JumpClock;onReady:()=>void}){
 return <Canvas dpr={[1,1.25]} camera={{position:[0,1.64,1.15],near:.05,far:280,fov:50}} gl={{antialias:true,powerPreference:'high-performance',alpha:false}} onCreated={({gl})=>{gl.setClearColor('#01040a');gl.toneMapping=THREE.ACESFilmicToneMapping;gl.toneMappingExposure=1.1}} aria-hidden="true">
  <Environment frames={1} resolution={128} environmentIntensity={.65}><color attach="background" args={['#050810']}/><Lightformer form="rect" position={[0,2,-4]} scale={[5,2,1]} color="#c7e6ff" intensity={2.8}/><Lightformer form="rect" position={[0,3,0]} rotation={[Math.PI/2,0,0]} scale={[3,5,1]} color="#d0e6ff" intensity={2.1}/><Lightformer form="circle" position={[1,1.3,-2]} scale={1.5} color="#1b8cff" intensity={2}/></Environment>
  <ambientLight intensity={.32}/><directionalLight position={[12,6,-20]} intensity={2.2} color="#ffe0bd"/><pointLight position={[0,2,-2.1]} intensity={3} color="#57b8ff"/><pointLight position={[0,2.5,.5]} intensity={4} color="#b6cfff"/>
  <StarField clock={clock}/><Mars clock={clock}/><Tunnel clock={clock}/><Cockpit quality="low" alert={clock.mode==='playing'||clock.mode==='hold'} reducedMotion={clock.reduced} contacts={1}/><CommanderDisplay callsign="NOVA-7" connection="online" alert={clock.mode==='playing'} fps={2} onActivate={()=>{}}/><Rig clock={clock}/><FirstFrame onReady={onReady}/>
  <EffectComposer multisampling={0}><Bloom intensity={.55} luminanceThreshold={1.15} mipmapBlur/><Vignette offset={.25} darkness={.6}/></EffectComposer>
 </Canvas>;
}
