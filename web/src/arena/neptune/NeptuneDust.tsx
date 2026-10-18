import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * White ice motes blowing past the camera on Neptune. Self-contained (no VFX
 * runtime): particles live in a box that wraps around the camera, drift on a
 * strong wind, and fade near the floor, very close up and far away.
 */
const vertex = /* glsl */ `
attribute vec3 aSeed;
uniform float uTime; uniform vec3 uWind; uniform float uGround; uniform float uCount; uniform mat4 uCamera;
varying vec2 vUv; varying float vFade;
void main(){
  vUv=uv; float grit=step(uCount,aSeed.z); float t=uTime; vec3 p;
  if(grit>0.5){
    // A few large, soft flakes streaking right past the lens.
    p=(uCamera*vec4(mod(aSeed.x*9.0+t*3.0,6.0)-3.0,sin(aSeed.y*17.0)*1.7,-.7-mod(aSeed.x*7.0+t*.5,2.0),1.0)).xyz;
  } else {
    p=cameraPosition+mod(vec3(aSeed.x*30.0,aSeed.y*12.0,aSeed.z*.371)+uWind*t-cameraPosition+vec3(15.0,6.0,15.0),vec3(30.0,12.0,30.0))-vec3(15.0,6.0,15.0);
  }
  vec4 mv=viewMatrix*vec4(p,1.0); float d=-mv.z;
  float size=mix(.009+aSeed.x*.016,.05,grit);
  mv.xy+=position.xy*vec2(size*mix(3.0,1.0,grit),size);
  vFade=smoothstep(uGround+.025,uGround+.5,p.y)*smoothstep(.2,1.5,d)*(1.0-smoothstep(10.0,17.0,d));
  vFade*=mix(.34,.1,grit);
  gl_Position=projectionMatrix*mv;
}`;
const fragment = /* glsl */ `
varying vec2 vUv; varying float vFade;
void main(){ vec2 q=vUv*2.0-1.0; float a=exp(-dot(q,q)*4.0)*smoothstep(1.0,.6,length(q)); gl_FragColor=vec4(vec3(.95,.98,1.0),a*vFade); }`;

const WIND = new THREE.Vector3(0.9, 0.08, -0.25).multiplyScalar(2.2);

export function NeptuneDust({ count = 8000, grit = 20, active = true }: { count?: number; grit?: number; active?: boolean }) {
  const total = count + grit;
  const geometry = useMemo(() => {
    const g = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(2, 2);
    g.index = quad.index;
    g.attributes = quad.attributes;
    const seeds = new Float32Array(total * 3);
    for (let i = 0; i < total; i++) seeds.set([Math.random(), Math.random(), i], i * 3);
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 3));
    g.instanceCount = total;
    return g;
  }, [total]);
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uGround: { value: 0 }, uWind: { value: WIND }, uCount: { value: count }, uCamera: { value: new THREE.Matrix4() } },
  }), [count]);
  useFrame(({ camera }, dt) => {
    if (active) material.uniforms.uTime.value += Math.min(dt, 0.1);
    material.uniforms.uCamera.value.copy(camera.matrixWorld);
  });
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={3} />;
}
