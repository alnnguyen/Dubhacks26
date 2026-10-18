import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TIERS, VFX, type Quality } from './config';
import type { VfxRuntime } from './runtime';
import { GRIT_RADIUS } from './ForegroundGrit';
const vertex = `
attribute vec3 aSeed;
uniform float uTime; uniform vec3 uWind; uniform float uGround; uniform float uCount;
uniform vec4 uHits[4]; uniform mat4 uCamera;
varying vec2 vUv; varying float vFade; varying float vLight;
void main(){
 vUv=uv; float grit=step(uCount,aSeed.z);float t=uTime; vec3 p;
 if(grit>0.5){p=(uCamera*vec4(mod(aSeed.x*9.0+t*3.0,6.0)-3.0,sin(aSeed.y*17.0)*1.7,-.7-mod(aSeed.x*7.0+t*.5,2.0),1.0)).xyz;}
 else{p=cameraPosition+mod(vec3(aSeed.x*30.0,aSeed.y*12.0,aSeed.z*.371)+uWind*t-cameraPosition+vec3(15.0,6.0,15.0),vec3(30.0,12.0,30.0))-vec3(15.0,6.0,15.0);}
 float burst=0.0;vLight=0.0;
 for(int i=0;i<4;i++){float age=t-uHits[i].w;vec3 d=p-uHits[i].xyz;float r=length(d.xz);float wave=exp(-pow((r-age*5.0)*2.0,2.0))*step(0.0,age)*exp(-age*3.0);p.y+=wave*.35;burst+=wave;vLight+=exp(-dot(d,d)*.5)*exp(-max(age,0.0)*5.0)*step(0.0,age);}
 vec4 mv=viewMatrix*vec4(p,1.0);float d=-mv.z;
 float size=mix(.009+aSeed.x*.016,${GRIT_RADIUS.toFixed(2)},grit);
 mv.xy+=position.xy*vec2(size*mix(3.0,1.0,grit),size)*mix(1.0,1.8,burst);
 vFade=smoothstep(uGround+.025,uGround+.5,p.y)*smoothstep(.2,1.5,d)*(1.0-smoothstep(10.0,17.0,d));
 vFade*=mix(.24,.07,grit);gl_Position=projectionMatrix*mv;
}`;
const fragment=`varying vec2 vUv;varying float vFade;varying float vLight;void main(){vec2 q=vUv*2.0-1.0;float a=exp(-dot(q,q)*4.0)*smoothstep(1.0,.6,length(q));gl_FragColor=vec4(mix(vec3(.78,.43,.25),vec3(.55,.92,1.0),min(1.0,vLight)),a*vFade);}`;
export function DustSystem({runtime,quality}:{runtime:VfxRuntime;quality:Quality}) {
 const count=(VFX.dust?TIERS[quality].dust:0)+(VFX.foregroundGrit?TIERS[quality].grit:0);
 const geometry=useMemo(()=>{const g=new THREE.InstancedBufferGeometry();const quad=new THREE.PlaneGeometry(2,2);g.index=quad.index;g.attributes=quad.attributes;const seeds=new Float32Array(count*3);for(let i=0;i<count;i++)seeds.set([Math.random(),Math.random(),i],i*3);g.setAttribute('aSeed',new THREE.InstancedBufferAttribute(seeds,3));g.instanceCount=count;return g;},[count]);
 const material=useMemo(()=>new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,transparent:true,depthWrite:false,uniforms:{uTime:{value:0},uGround:{value:0},uWind:{value:new THREE.Vector3(...VFX.windDirection)},uCount:{value:VFX.dust?TIERS[quality].dust:0},uCamera:{value:new THREE.Matrix4()},uHits:{value:Array.from({length:4},()=>new THREE.Vector4(0,0,0,-100))}}}),[quality]);
 useFrame(({camera})=>{material.uniforms.uTime.value=runtime.clock.time;material.uniforms.uGround.value=runtime.ground;material.uniforms.uCamera.value.copy(camera.matrixWorld);for(let i=0;i<4;i++)material.uniforms.uHits.value[i].copy(runtime.positions[(runtime.cursor-1-i+120)%30]);});
 useEffect(()=>()=>{geometry.dispose();material.dispose();},[geometry,material]);
 return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={3}/>;
}
