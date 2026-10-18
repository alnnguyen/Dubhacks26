import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { VFX } from './config';
export function FogLayer() {
 const scene=useThree(s=>s.scene);const fog=useMemo(()=>new THREE.Fog(VFX.hazeColor,22,150),[]);const previous=useRef(scene.fog);
 // Mars loads asynchronously; preserve its fog even if it arrives after this layer.
 useFrame(()=>{if(scene.fog!==fog){previous.current=scene.fog;scene.fog=fog;}},-.1);
 useEffect(()=>()=>{if(scene.fog===fog)scene.fog=previous.current;},[scene,fog]);return null;
}
