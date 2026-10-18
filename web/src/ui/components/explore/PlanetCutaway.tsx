import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { bodyWorldPosition, SOLAR_BODIES } from './bodies';
import { planetFacts } from './bodiesScience';
import { bindUniforms } from '../../../three/bindUniforms';

const MAXL = 6;

const CAP_VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec3 vWorld;
void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * mvPosition;
  #include <logdepthbuf_vertex>
  #include <clipping_planes_vertex>
}
`;

const CAP_FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
uniform float uFrac[${MAXL}];
uniform vec3 uCol[${MAXL}];
uniform int uCount;
uniform float uReveal;
uniform float uR;
uniform float uTime;
uniform float uHighlight;
uniform vec3 uCenter;
varying vec3 vWorld;
void main() {
  #include <clipping_planes_fragment>
  #include <logdepthbuf_fragment>
  float r = length(vWorld - uCenter) / uR;
  if (r > 1.0) discard;
  vec3 col = uCol[0];
  float inner = 0.0;
  float outer = uFrac[0];
  int idx = 0;
  for (int i = 0; i < ${MAXL}; i++) {
    if (i >= uCount) break;
    float lo = i == 0 ? 0.0 : uFrac[i - 1];
    if (r >= lo && r <= uFrac[i]) { col = uCol[i]; inner = lo; outer = uFrac[i]; idx = i; }
  }
  float t = float(uCount - 1 - idx) / max(float(uCount), 1.0);
  float a = smoothstep(t, t + 0.25, uReveal);
  float shade = 0.75 + 0.25 * (1.0 - (r - inner) / max(outer - inner, 1e-3));
  float edge = smoothstep(0.006, 0.0, abs(r - outer)) * step(r, 0.999);
  float heat = 0.04 * sin(uTime * 2.0 + r * 25.0) * step(float(idx), 0.0);
  vec3 c = col * (shade + heat) + vec3(0.13, 0.9, 1.0) * edge * 0.9;
  if (abs(float(idx)-uHighlight)<0.1) c=mix(c,vec3(1.0),0.25);
  gl_FragColor = vec4(mix(vec3(0.02, 0.03, 0.06), c, a), 1.0);
}
`;

export interface PlanetCutawayProps { bodyId:string; open:boolean; highlight?:number; reducedMotion?:boolean }

/** Clip the existing textured planet. All clipping planes follow the floating world frame. */
export function PlanetCutaway({bodyId,open,highlight=-1,reducedMotion=false}:PlanetCutawayProps) {
  const {scene,gl}=useThree();
  const facts=planetFacts(bodyId), body=SOLAR_BODIES.find(b=>b.id===bodyId);
  const group=useRef<THREE.Group>(null), capA=useRef<THREE.Mesh>(null),capB=useRef<THREE.Mesh>(null);
  const progress=useRef(0);
  const center=useMemo(()=>body ? bodyWorldPosition(body) : [0,0,0] as [number,number,number],[body]);
  const R=body?.radius ?? 1;
  const planes=useMemo(()=>Array.from({length:4},()=>new THREE.Plane()),[]);
  const [planeA,planeB,capClipA,capClipB]=planes;
  const vectors=useMemo(()=>Array.from({length:8},()=>new THREE.Vector3()),[]);
  const saved=useRef(new Map<THREE.Material,{planes:THREE.Plane[]|null;intersection:boolean}>());
  const uniforms=useMemo(()=>({
    uFrac:{value:Array.from({length:MAXL},(_,i)=>facts?.interior.layers[i]?.outerRadiusFraction ?? 1)},
    uCol:{value:Array.from({length:MAXL},(_,i)=>new THREE.Color(facts?.interior.layers[i]?.color ?? '#000'))},
    uCount:{value:facts?.interior.layers.length ?? 0},uReveal:{value:0},uR:{value:R},uTime:{value:0},uHighlight:{value:-1},uCenter:{value:new THREE.Vector3()},
  }),[facts,R]);
  const leaders=useRef<{svg:SVGSVGElement;items:{path:SVGPathElement;text:SVGTextElement}[]}|null>(null);
  useEffect(()=> {
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('ex-cutaway-leaders');
    svg.setAttribute('aria-hidden','true');
    const items=(facts?.interior.layers ?? []).map((layer,i)=> {
      const path=document.createElementNS(svg.namespaceURI,'path') as SVGPathElement;
      const text=document.createElementNS(svg.namespaceURI,'text') as SVGTextElement;
      path.setAttribute('stroke',layer.color);path.setAttribute('fill','none');text.textContent=`${i+1} · ${layer.name}`;
      svg.append(path,text);return {path,text};
    });
    gl.domElement.parentElement?.append(svg);leaders.current={svg,items};
    const materials=saved.current;
    return ()=> {
      svg.remove();leaders.current=null;
      for(const [material,old] of materials) {material.clippingPlanes=old.planes;material.clipIntersection=old.intersection;material.needsUpdate=true;}
      materials.clear();
    };
  },[facts,gl]);
  useFrame(({camera,size},rawDt)=> {
    if(!group.current || !body || !facts)return;
    const dt=document.hidden?0:Math.min(rawDt,.05);
    progress.current=THREE.MathUtils.damp(progress.current,open?1:0,reducedMotion?1000:4,dt);
    const u=progress.current*progress.current*(3-2*progress.current), cut=R*(1-u);
    uniforms.uReveal.value=Math.min(1,u*1.4);uniforms.uTime.value+=dt;uniforms.uHighlight.value=highlight;
    group.current.updateWorldMatrix(true,false);
    const [view,ax1,ax2,worldCenter,scale,anchor,projected]=vectors;
    view.copy(camera.position);group.current.worldToLocal(view);view.normalize();
    ax1.copy(view).applyAxisAngle(new THREE.Vector3(0,1,0),-Math.PI/4);
    ax2.copy(view).applyAxisAngle(new THREE.Vector3(0,1,0),Math.PI/4);
    planeA.set(ax1.clone().negate(),cut).applyMatrix4(group.current.matrixWorld);
    planeB.set(ax2.clone().negate(),cut).applyMatrix4(group.current.matrixWorld);
    capClipA.set(ax2,-cut).applyMatrix4(group.current.matrixWorld);
    capClipB.set(ax1,-cut).applyMatrix4(group.current.matrixWorld);
    group.current.getWorldPosition(worldCenter);group.current.getWorldScale(scale);
    uniforms.uCenter.value.copy(worldCenter);uniforms.uR.value=R*scale.x;
    const surface=scene.getObjectByName(`solar-body-${bodyId}`);
    surface?.traverse(object=> {
      if(!(object instanceof THREE.Mesh))return;
      const materials=Array.isArray(object.material)?object.material:[object.material];
      for(const material of materials)if(!saved.current.has(material)) {
        saved.current.set(material,{planes:material.clippingPlanes,intersection:material.clipIntersection});
        material.clippingPlanes=[planeA,planeB];material.clipIntersection=true;material.needsUpdate=true;
      }
    });
    for(const [cap,axis] of [[capA.current,ax1],[capB.current,ax2]] as const)if(cap) {
      cap.position.copy(axis).multiplyScalar(cut);
      // lookAt expects world coordinates when parent is transformed; set local quaternion directly.
      cap.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),axis);
      cap.visible=u>.001;
    }
    const surfaceMatrix=group.current.matrixWorld;
    const overlay=leaders.current;
    if(overlay) {
      overlay.svg.setAttribute('viewBox',`0 0 ${size.width} ${size.height}`);
      overlay.svg.style.opacity=String(open ? Math.max(0,(u-.65)/.35) : 0);
      overlay.svg.style.display=size.width<720 || size.height>size.width ? 'none' : '';
      const x=Math.max(24,size.width*.025), y0=size.height*.35;
      overlay.items.forEach((item,i)=> {
        const inner=i?facts.interior.layers[i-1].outerRadiusFraction:0, outer=facts.interior.layers[i].outerRadiusFraction;
        const mid=Math.max(.035,(inner+outer)/2)*R;
        // A point on cap A; lift toward its visible upper half.
        anchor.set(0,1,0).addScaledVector(ax1,-ax1.y).normalize().multiplyScalar(mid).addScaledVector(ax1,cut);
        projected.copy(anchor).applyMatrix4(surfaceMatrix).project(camera);
        const px=(projected.x+1)*size.width/2,py=(1-projected.y)*size.height/2;
        const y=y0+(facts.interior.layers.length-1-i)*38;
        item.path.setAttribute('d',`M ${px} ${py} L ${x+120} ${y} L ${x} ${y}`);
        item.path.setAttribute('opacity',highlight===i?'1':'.5');
        item.text.setAttribute('x',String(x));item.text.setAttribute('y',String(y-7));
      });
    }
  });
  if(!body || !facts || bodyId==='sun' || bodyId==='moon')return null;
  return <group ref={group} position={center} name="planet-cutaway-caps">
    <mesh ref={capA} visible={false}>
      <planeGeometry args={[R*2.2,R*2.2]} />
      <shaderMaterial vertexShader={CAP_VERT} fragmentShader={CAP_FRAG} uniforms={uniforms} ref={bindUniforms(uniforms)} clipping clippingPlanes={[capClipA]} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
    <mesh ref={capB} visible={false}>
      <planeGeometry args={[R*2.2,R*2.2]} />
      <shaderMaterial vertexShader={CAP_VERT} fragmentShader={CAP_FRAG} uniforms={uniforms} ref={bindUniforms(uniforms)} clipping clippingPlanes={[capClipB]} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  </group>;
}
