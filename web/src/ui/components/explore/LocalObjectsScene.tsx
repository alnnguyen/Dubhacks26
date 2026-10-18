import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { LOCAL_OBJECTS, LOCAL_OBJECT_INDEX, objectOrbit } from './localObjects';
import { CatalogPoints } from './CatalogScene';
import type { LocalNavigation } from './localNavigation';

/** Schematic geometry: recognizable spacecraft silhouettes, not engineering models. */
function Spacecraft({ station=false }: {station?:boolean}) {
  return <group rotation={[.35,.4,.15]}>
    <mesh rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.09,.09,station?.9:.35,12]} /><meshStandardMaterial color="#e1e7ed" metalness={.5} roughness={.4} /></mesh>
    {[-1,1].map(side=><group key={side} position={[0,0,side*(station?.65:.3)]}>
      <mesh><boxGeometry args={[station?1.7:.65,.025,station?.5:.4]} /><meshStandardMaterial color="#315eae" emissive="#183468" emissiveIntensity={.5} metalness={.4} roughness={.4} side={THREE.DoubleSide} /></mesh>
      {station && [-.55,.55].map(x=><mesh key={x} position={[x,0,0]}><boxGeometry args={[.025,.04,.56]} /><meshBasicMaterial color="#d1bb87" /></mesh>)}
    </group>)}
    {station && <mesh position={[0,.13,0]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.12,.12,.45,12]} /><meshStandardMaterial color="#dce6ed" metalness={.5} roughness={.45} /></mesh>}
  </group>;
}
function OrbitPath({id}:{id:string}) {
  const line=useMemo(()=> {
    const object=LOCAL_OBJECT_INDEX.get(id)!;
    const geometry=new THREE.BufferGeometry().setFromPoints(objectOrbit(object).map(p=>new THREE.Vector3(...p)));
    return new THREE.Line(geometry,new THREE.LineBasicMaterial({color:object.kind==='satellite'?'#6ee9df':'#a9c0dc',transparent:true,opacity:.35}));
  },[id]);
  useEffect(()=>()=>{line.geometry.dispose();(line.material as THREE.Material).dispose();},[line]);
  return <primitive object={line} />;
}
export function LocalObjectsScene({navigation,onLearn}:{navigation:LocalNavigation;onLearn:(id:string)=>void}) {
  const group=useRef<THREE.Group>(null);
  useFrame(()=>{if(group.current)group.current.visible=navigation.motion.position.length()<5000;});
  const rows=useMemo(()=>LOCAL_OBJECTS.map(o=>({id:o.id,position:o.position,color:o.kind==='satellite'?'#86ffe9':o.kind==='comet'?'#97e8f2':'#dcc3a2'})),[]);
  const selected=LOCAL_OBJECT_INDEX.get(navigation.focusId);
  const station=LOCAL_OBJECT_INDEX.get('sat-25544');
  const look=useMemo(()=>new THREE.Quaternion(),[]);
  if(selected?.kind==='comet')look.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...selected.position).normalize());
  return <group ref={group} name="cataloged-local-objects">
    <CatalogPoints rows={rows} size={3} onLearn={onLearn} />
    {station && <group position={station.position} onClick={e=>{if(e.delta>5)return;e.stopPropagation();onLearn(station.id);}}><Spacecraft station /></group>}
    {selected && <>
      <OrbitPath id={selected.id} />
      {selected.kind==='satellite' && selected.id!==station?.id && <group position={selected.position}><Spacecraft /></group>}
      {selected.kind!=='satellite' && <group position={selected.position}>
        <mesh onClick={e=>{if(e.delta>5)return;e.stopPropagation();onLearn(selected.id);}}><icosahedronGeometry args={[selected.radius,1]} /><meshStandardMaterial color={selected.kind==='comet'?'#99bbc5':'#9a8672'} roughness={1} flatShading /></mesh>
        {selected.kind==='comet' && <group quaternion={look}><mesh position={[0,2.8,0]} rotation={[Math.PI,0,0]}><coneGeometry args={[.9,5,16]} /><meshBasicMaterial color="#81d9ed" transparent opacity={.18} depthWrite={false} /></mesh></group>}
      </group>}
    </>}
  </group>;
}
