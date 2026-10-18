import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sunDirection } from '../arena/mars/MarsSky';
import { render as mars } from '../arena/mars/marsConfig';
import { VFX } from './config';
import type { VfxRuntime } from './runtime';
const vertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,1.0,1.0);}`;
const fragment=`
uniform float uTime;uniform vec3 uWind;uniform vec3 uColor;uniform vec4 uHits[4];uniform float uShaft;uniform vec2 uSun;
varying vec2 vUv;
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
void main(){vec3 p=vec3(vUv*vec2(7.0,4.0),uTime*.02)-uWind*uTime*.06;float n=noise(p)*.65+noise(p*2.1)*.35;float gust=.65+.35*sin(uTime*1.04);float edge=smoothstep(.15,.7,length((vUv-.5)*vec2(1.0,.8)));float a=(.016+n*.035+edge*.025)*gust;vec3 color=uColor;
for(int i=0;i<4;i++){float age=uTime-uHits[i].z;float light=exp(-dot(vUv-uHits[i].xy,vUv-uHits[i].xy)*70.0)*exp(-max(age,0.0)*6.0)*step(0.0,age);color+=vec3(.1,.65,.9)*light*.8;}
float shaft=pow(max(0.0,1.0-abs(vUv.x-uSun.x-(vUv.y-uSun.y)*.28)*7.0),9.0)*.018*uShaft;gl_FragColor=vec4(color+vec3(.4,.25,.1)*shaft,a+shaft);}`;
export function Haze({runtime}:{runtime:VfxRuntime}) {
 const material=useMemo(()=>new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,transparent:true,depthWrite:false,depthTest:false,uniforms:{uTime:{value:0},uWind:{value:new THREE.Vector3(...VFX.windDirection)},uColor:{value:new THREE.Color(VFX.hazeColor)},uHits:{value:runtime.projected},uShaft:{value:Number(VFX.shafts)},uSun:{value:new THREE.Vector2(.7,1)}}}),[runtime]);
 const sun=useMemo(()=>sunDirection(mars.sunElevationDeg,mars.sunAzimuthDeg),[]);const point=useMemo(()=>new THREE.Vector3(),[]);
 useFrame(({camera})=>{material.uniforms.uTime.value=runtime.clock.time;point.copy(sun).multiplyScalar(100).add(camera.position).project(camera);material.uniforms.uSun.value.set(point.x*.5+.5,point.y*.5+.5);});
 useEffect(()=>()=>material.dispose(),[material]);
 return <mesh material={material} frustumCulled={false} renderOrder={8}><planeGeometry args={[2,2]}/></mesh>;
}
