import { useEffect, useMemo } from 'react';
import { Bloom, ChromaticAberration, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ShockwaveEffect } from './Shockwave';
import { VFX, type Quality } from './config';
import type { VfxRuntime } from './runtime';
export function PostFX({runtime,quality,reduced}:{runtime:VfxRuntime;quality:Quality;reduced:boolean}) {
 const effect=useMemo(()=>new ShockwaveEffect(runtime),[runtime]);const offset=useMemo(()=>new THREE.Vector2(),[]);
 useFrame(()=>{effect.uniforms.get('time')!.value=runtime.clock.time;effect.uniforms.get('strength')!.value=reduced?0:Math.max(.25,runtime.big);offset.setScalar(reduced?0:runtime.big*.0015);});
 useEffect(()=>()=>effect.dispose(),[effect]);
 return <EffectComposer multisampling={0} enableNormalPass={false}>
  {VFX.bloom?<Bloom mipmapBlur intensity={.9} luminanceThreshold={1.1} luminanceSmoothing={.2}/>:<></>}
  {quality!=='low'&&VFX.shockwave&&!reduced?<primitive object={effect}/>:<></>}
  {quality!=='low'&&VFX.chromatic&&!reduced?<ChromaticAberration offset={offset} radialModulation/>:<></>}
  {VFX.vignette?<Vignette offset={.25} darkness={.22}/>:<></>}
  {VFX.noise?<Noise opacity={.012}/>:<></>}
 </EffectComposer>;
}
