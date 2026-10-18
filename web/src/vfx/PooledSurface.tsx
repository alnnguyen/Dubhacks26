import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { POOL_SIZE } from './config';
import type { VfxRuntime } from './runtime';
export type SurfaceKind='flash'|'ring'|'scorch'|'shield';
const fragment=`varying vec2 vUv;varying vec4 vData;varying vec3 vNormal;varying vec3 vView;uniform float uKind;uniform float uTime;
void main(){vec2 p=(vUv-.5)*2.0;float r=length(p),t=uTime-vData.x;float a=0.0;vec3 c=vec3(1.0);
if(uKind<.5){a=exp(-r*r*5.0)*(1.0-smoothstep(0.0,.12,t));c=vec3(4.0,5.0,5.0);}
else if(uKind<1.5){a=exp(-pow((r-.72)*24.0,2.0))*exp(-t*4.0);c=mix(vec3(3.0,1.1,.4),vec3(.5,2.0,3.0),vData.y);}
else if(uKind<2.5){float heat=exp(-t*.85);a=smoothstep(1.0,.15,r)*smoothstep(10.0,7.0,t)*.65;c=mix(vec3(.015,.008,.005),vec3(2.2,.35,.02),heat);}
else{float hex=abs(sin(p.x*25.0)+sin(p.x*12.5+p.y*21.65)+sin(p.x*12.5-p.y*21.65));float edge=pow(1.0-abs(dot(normalize(vNormal),normalize(vView))),2.0);float wave=exp(-pow((r-t*2.0)*18.0,2.0));a=(edge*.22+wave*.55)*smoothstep(1.8,1.0,hex)*exp(-t*4.0);c=vec3(.2,1.7,3.0);}
a*=step(0.0,t)*step(t,uKind>1.5&&uKind<2.5?10.0:.8);if(a<.001)discard;gl_FragColor=vec4(c,a);}`;
export function PooledSurface({runtime,kind}:{runtime:VfxRuntime;kind:SurfaceKind}) {
 const mesh=useRef<THREE.InstancedMesh>(null);
 const data=useMemo(()=>new THREE.InstancedBufferAttribute(new Float32Array(POOL_SIZE*4),4),[]);
 const geometry=useMemo(()=>{const g=kind==='shield'?new THREE.SphereGeometry(1,24,16):new THREE.PlaneGeometry(2,2);g.setAttribute('aData',data);return g;},[data,kind]);
 const index=['flash','ring','scorch','shield'].indexOf(kind);
 const material=useMemo(()=>new THREE.ShaderMaterial({vertexShader:`attribute vec4 aData;varying vec2 vUv;varying vec4 vData;varying vec3 vNormal;varying vec3 vView;void main(){vUv=uv;vData=aData;vec4 view=modelViewMatrix*instanceMatrix*vec4(position,1.0);vNormal=normalMatrix*mat3(instanceMatrix)*normal;vView=-view.xyz;gl_Position=projectionMatrix*view;}`,fragmentShader:fragment,uniforms:{uKind:{value:index},uTime:{value:0}},transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,side:THREE.DoubleSide,toneMapped:false,blending:kind==='scorch'?THREE.NormalBlending:THREE.AdditiveBlending}),[index,kind]);
 const dummy=useMemo(()=>new THREE.Object3D(),[]);
 useFrame(({camera})=>{
  const now=runtime.clock.time;material.uniforms.uTime.value=now;
  for(let i=0;i<POOL_SIZE;i++){
   const p=runtime.positions[i],age=now-p.w;const life=kind==='scorch'?10:kind==='flash'?.12:.8;
   const visible=age>=0&&age<life&&(kind!=='shield'||!!runtime.blocked[i]);
   dummy.position.set(p.x,kind==='scorch'||kind==='ring'?runtime.ground+.025:p.y,p.z);
   if(kind==='ring'||kind==='scorch')dummy.rotation.set(-Math.PI/2,0,0);else dummy.quaternion.copy(camera.quaternion);
   const scale=kind==='flash'?.1+age*3:kind==='ring'?.1+age*(runtime.kills[i]?7:3):kind==='shield'?.65:.24;
   dummy.scale.setScalar(visible?scale:0);dummy.updateMatrix();mesh.current?.setMatrixAt(i,dummy.matrix);
   data.setXYZW(i,p.w,runtime.blocked[i],0,0);
  }
  data.needsUpdate=true;if(mesh.current)mesh.current.instanceMatrix.needsUpdate=true;
 });
 useEffect(()=>()=>{geometry.dispose();material.dispose();},[geometry,material]);
 return <instancedMesh ref={mesh} args={[geometry,material,POOL_SIZE]} frustumCulled={false} renderOrder={kind==='scorch'?1:5}/>;
}
