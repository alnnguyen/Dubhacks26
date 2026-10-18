import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const NEPTUNE_PLATFORM_RADIUS=10;
/** Presentation spawn transforms mirror the existing server's initial 2.6 m separation. */
export const NEPTUNE_SPAWNS=[{position:[0,0,1.3],rotation:[0,Math.PI,0]},{position:[0,0,-1.3],rotation:[0,0,0]}] as const;
const skyVertex=`varying vec3 vWorld;void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const skyFragment=`varying vec3 vWorld;void main(){vec3 d=normalize(vWorld-cameraPosition);float h=max(d.y,0.);vec3 c=mix(vec3(.38,.67,.86),vec3(.025,.16,.4),pow(h,.4));float sun=pow(max(dot(d,normalize(vec3(-.6,.6,-.5))),0.),180.);gl_FragColor=vec4(c+vec3(.7,.8,.9)*sun,1.);}`;
const cloudVertex=`varying vec2 vWorld;void main(){vec4 p=modelMatrix*vec4(position,1.);vWorld=p.xz;gl_Position=projectionMatrix*viewMatrix*p;}`;
const cloudFragment=`uniform float uTime;uniform float uLayer;varying vec2 vWorld;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}float fbm(vec2 p){float n=0.,a=.5;for(int i=0;i<5;i++){n+=noise(p)*a;p=p*2.03+11.7;a*=.5;}return n;}
void main(){vec2 p=vWorld*.017+vec2(uTime*.003,uLayer*12.);float n=fbm(p+fbm(p*.4));float detail=fbm(p*5.);float body=smoothstep(.28,.73,n);float light=clamp((fbm(p+vec2(-.06,.07))-n)*8.+.6,0.,1.);vec3 c=mix(vec3(.08,.28,.54),vec3(.77,.9,1.),light*.8+detail*.2);float alpha=mix(.85,.5,uLayer)*body;gl_FragColor=vec4(c,alpha);}`;
export function NeptuneSky(){return <mesh><sphereGeometry args={[1800,32,20]}/><shaderMaterial vertexShader={skyVertex} fragmentShader={skyFragment} side={THREE.BackSide} depthWrite={false}/></mesh>;}
const puffVertex=`varying vec2 vUv;void main(){vUv=uv;vec4 center=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);vec2 size=vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));center.xy+=position.xy*size;gl_Position=projectionMatrix*center;}`;
const puffFragment=`varying vec2 vUv;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}void main(){vec2 p=(vUv-.5)*2.;float n=noise(vUv*6.)*.5+noise(vUv*13.)*.25+noise(vUv*26.)*.125;float a=smoothstep(1.,.15,length(p)+n*.25)*.7;vec3 c=mix(vec3(.22,.46,.68),vec3(.83,.94,1.),smoothstep(.05,.9,vUv.y+n*.2));gl_FragColor=vec4(c,a);}`;
function Cloudscape({reducedMotion}:{reducedMotion:boolean}){
 const mats=useRef<(THREE.ShaderMaterial|null)[]>([]);const banks=useRef<THREE.InstancedMesh>(null);const dummy=useMemo(()=>new THREE.Object3D(),[]);
 useEffect(()=>{for(let i=0;i<240;i++){const a=i*2.39996,r=65+(i%13)*12;dummy.position.set(Math.cos(a)*r,-16+(i%7)*1.2,Math.sin(a)*r);dummy.scale.set(22+(i%5)*3,9+(i%4)*2,1);dummy.rotation.y=0;dummy.updateMatrix();banks.current?.setMatrixAt(i,dummy.matrix);}if(banks.current)banks.current.instanceMatrix.needsUpdate=true;},[dummy]);
 useFrame(({clock})=>{for(const mat of mats.current)if(mat)mat.uniforms.uTime.value=reducedMotion?0:clock.elapsedTime;});
 return <><mesh rotation={[-Math.PI/2,0,0]} position={[0,-42,0]}><planeGeometry args={[3500,3500]}/><meshBasicMaterial color="#2868a6"/></mesh>
 {[0,1,2].map((layer)=><mesh key={layer} rotation={[-Math.PI/2,0,0]} position={[0,-14-layer*9,0]} renderOrder={-3+layer}><planeGeometry args={[2400,2400]}/><shaderMaterial ref={m=>{mats.current[layer]=m;}} vertexShader={cloudVertex} fragmentShader={cloudFragment} uniforms={{uTime:{value:0},uLayer:{value:layer/2}}} transparent depthWrite={false} side={THREE.DoubleSide}/></mesh>)}
 <instancedMesh ref={banks} args={[undefined,undefined,240]} frustumCulled={false} renderOrder={-1}><planeGeometry args={[1,1]}/><shaderMaterial vertexShader={puffVertex} fragmentShader={puffFragment} transparent depthWrite={false}/></instancedMesh>
 </>;
}
function Platform(){
 const geometry=useMemo(()=>{
  const parts:THREE.BufferGeometry[]=[];
  for(let ring=0;ring<3;ring++){const inner=ring===0?2.2:4.5+ring*1.35,outer=ring===0?5.75:inner+1.28,count=ring===0?12:48;for(let i=0;i<count;i++){const g=new THREE.RingGeometry(inner,outer,ring===0?12:3,1,i*Math.PI*2/count+.006,Math.PI*2/count-.012);g.rotateX(-Math.PI/2);g.translate(0,.012+ring*.004,0);parts.push(g);}}
  const merged=mergeGeometries(parts);parts.forEach(g=>g.dispose());return merged;
 },[]);
 const normal=useMemo(()=>{const bytes=new Uint8Array(128*128*4);for(let i=0;i<128*128;i++){const n=(Math.sin(i*97.13)*437.1)%1;bytes.set([128+n*10,128+n*10,252,255],i*4);}const t=new THREE.DataTexture(bytes,128,128);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(16,16);t.needsUpdate=true;return t;},[]);
 const braces=useRef<THREE.InstancedMesh>(null),vents=useRef<THREE.InstancedMesh>(null),strips=useRef<THREE.InstancedMesh>(null);const dummy=useMemo(()=>new THREE.Object3D(),[]);
 useEffect(()=>{for(let i=0;i<24;i++){const a=i*Math.PI/12;dummy.position.set(Math.sin(a)*9.15,.3,Math.cos(a)*9.15);dummy.rotation.set(0,a,0);dummy.scale.set(.23,.25,1.6);dummy.updateMatrix();braces.current?.setMatrixAt(i,dummy.matrix);dummy.position.set(Math.sin(a)*9.98,-.55,Math.cos(a)*9.98);dummy.scale.set(.75,.32,.05);dummy.updateMatrix();vents.current?.setMatrixAt(i,dummy.matrix);dummy.position.set(Math.sin(a)*9.1,.44,Math.cos(a)*9.1);dummy.scale.set(.045,.012,1.1);dummy.updateMatrix();strips.current?.setMatrixAt(i,dummy.matrix);}for(const m of [braces.current,vents.current,strips.current])if(m)m.instanceMatrix.needsUpdate=true;},[dummy]);
 useEffect(()=>()=>{geometry.dispose();normal.dispose();},[geometry,normal]);
 const ring=(radius:number,tube:number,y:number,color:string,glow=false)=><mesh key={`${radius}:${y}`} rotation={[-Math.PI/2,0,0]} position={[0,y,0]}><torusGeometry args={[radius,tube,6,128]}/>{glow?<meshBasicMaterial color={color} toneMapped={false}/>:<meshStandardMaterial color={color} metalness={.75} roughness={.35}/>}</mesh>;
 return <group>
 <mesh position={[0,-.65,0]} receiveShadow castShadow><cylinderGeometry args={[10,9.5,1.3,128]}/><meshStandardMaterial color="#182a3b" metalness={.7} roughness={.4}/></mesh>
 <mesh receiveShadow geometry={geometry}><meshStandardMaterial color="#536c80" metalness={.65} roughness={.48} normalMap={normal} normalScale={new THREE.Vector2(.2,.2)}/></mesh>
 <mesh receiveShadow rotation={[-Math.PI/2,0,0]} position={[0,.025,0]}><circleGeometry args={[2.17,64]}/><meshStandardMaterial color="#6d8498" metalness={.75} roughness={.36} normalMap={normal}/></mesh>
 {[1,1.1,1.9,2.2,5.8,6,7.2,8.7,9.7,10].map(r=>ring(r,r>8?.08:.025,r>8?.18:.035,'#91aabb'))}
 {[8.2,8.45,9.65].map(r=>ring(r,.025,.16,'#64edff',true))}
 {ring(9.8,.045,-.7,'#37b9dd',true)}{ring(8.5,.22,-1.2,'#172b40')}
 <instancedMesh ref={braces} args={[undefined,undefined,24]} castShadow><boxGeometry/><meshStandardMaterial color="#8b9eae" metalness={.8} roughness={.32}/></instancedMesh>
 <instancedMesh ref={vents} args={[undefined,undefined,24]}><boxGeometry/><meshStandardMaterial color="#050e1b" roughness={.65}/></instancedMesh>
 <instancedMesh ref={strips} args={[undefined,undefined,24]}><boxGeometry/><meshBasicMaterial color={[.2,2,2.4]} toneMapped={false}/></instancedMesh>
 <mesh position={[0,-1.4,0]}><cylinderGeometry args={[6.5,3,1.3,24,1,true]}/><meshStandardMaterial color="#233c52" metalness={.7} roughness={.45}/></mesh>
 </group>;
}
export function NeptuneEnvironment({reducedMotion=false}:{reducedMotion?:boolean}){
 return <><color attach="background" args={['#568ebd']}/><fog attach="fog" args={['#6eabd3',70,700]}/><NeptuneSky/>
 <hemisphereLight args={['#d9efff','#1d4577',2]}/><directionalLight position={[-16,26,-12]} intensity={3.3} color="#e6f6ff" castShadow shadow-mapSize={[1024,1024]} shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={14} shadow-camera-bottom={-14} shadow-bias={-.0004}/>
 <Environment frames={1} resolution={64} environmentIntensity={.7}><NeptuneSky/></Environment>
 <Cloudscape reducedMotion={reducedMotion}/><Platform/>
 </>;
}
