import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { POOL_SIZE, TIERS, type Quality } from './config';
import type { VfxRuntime } from './runtime';
const vertex=`attribute vec3 aSeed;attribute float aSlot;uniform vec4 uHits[30];uniform vec3 uNormals[30];uniform float uTime;uniform float uGround;varying vec2 vUv;varying float vAlpha;
void main(){vUv=uv;int i=int(aSlot);float t=uTime-uHits[i].w;vec3 n=uNormals[i];vec3 v=normalize(n+vec3(sin(aSeed.x*91.0),abs(cos(aSeed.y*77.0))*.8,cos(aSeed.x*49.0)))*(.9+aSeed.y*2.8);vec3 p=uHits[i].xyz+v*t+vec3(0,-3.0*t*t,0);float h=max(.0,uHits[i].y-uGround);float impact=(v.y+sqrt(v.y*v.y+12.0*h))/6.0;if(t>impact){float b=t-impact;p.y=uGround+max(0.0,-(v.y-6.0*impact)*.32*b-3.0*b*b);}vec4 mv=viewMatrix*vec4(p,1.0);mv.xy+=position.xy*vec2(.009,.035+aSeed.x*.07);gl_Position=projectionMatrix*mv;vAlpha=step(0.0,t)*(1.0-smoothstep(.15,.7,t));}`;
const fragment=`varying vec2 vUv;varying float vAlpha;void main(){vec2 p=vUv*2.0-1.0;float a=exp(-p.x*p.x*5.0)*smoothstep(1.0,0.0,abs(p.y));gl_FragColor=vec4(vec3(3.5,1.7,.65),a*vAlpha);}`;
export function SparkPool({runtime,quality}:{runtime:VfxRuntime;quality:Quality}) {
 const perHit=TIERS[quality].sparks;
 const geometry=useMemo(()=>{const g=new THREE.InstancedBufferGeometry(),q=new THREE.PlaneGeometry(2,2);g.index=q.index;g.attributes=q.attributes;const seeds=new Float32Array(POOL_SIZE*perHit*3),slots=new Float32Array(POOL_SIZE*perHit);for(let i=0;i<slots.length;i++){seeds.set([Math.random(),Math.random(),Math.random()],i*3);slots[i]=Math.floor(i/perHit);}g.setAttribute('aSeed',new THREE.InstancedBufferAttribute(seeds,3));g.setAttribute('aSlot',new THREE.InstancedBufferAttribute(slots,1));g.instanceCount=slots.length;return g;},[perHit]);
 const material=useMemo(()=>new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms:{uHits:{value:runtime.positions},uNormals:{value:runtime.normals},uTime:{value:0},uGround:{value:0}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}),[runtime]);
 useFrame(()=>{material.uniforms.uTime.value=runtime.clock.time;material.uniforms.uGround.value=runtime.ground+.02;});
 useEffect(()=>()=>{geometry.dispose();material.dispose();},[geometry,material]);
 return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={4}/>;
}
