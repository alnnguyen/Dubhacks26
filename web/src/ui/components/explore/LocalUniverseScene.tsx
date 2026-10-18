import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CATALOG_STARS } from './catalog';
import { SolarBodies } from './SolarSystem';
import { StarSkybox } from './StarSkybox';
import { ExploreBoundary } from './ExploreBoundary';
import { LearnTargets } from './LearnTargets';
import { usePointTexture } from './CatalogScene';
import { LocalNavigation, LOCAL_RADIUS_PC, localStarPosition, localStarOpacity } from './localNavigation';
import type { GraphicsQuality } from '../../state/lobbyTypes';
import { LocalBodyLabels } from './LocalBodyLabels';
import { LocalObjectsScene } from './LocalObjectsScene';

const stars = CATALOG_STARS.filter(s => s.distancePc <= LOCAL_RADIUS_PC);
/** Both layers stay mounted. The controller changes one camera-relative world transform. */
export function LocalUniverseScene({ navigation, quality, onLearn, inspecting=false }: { navigation: LocalNavigation; quality: GraphicsQuality; onLearn: (id:string) => void; inspecting?:boolean }) {
  const scene=useThree(s=>s.scene);
  const pointsMaterial=useRef<THREE.PointsMaterial>(null);
  const marker=useRef<THREE.Group>(null);
  const texture=usePointTexture();
  const geometry=useMemo(() => {
    const pos=new Float32Array((stars.length+1)*3), colors=new Float32Array((stars.length+1)*3);
    new THREE.Color('#6fe5d0').toArray(colors,0);
    stars.forEach((s,i)=> { pos.set(localStarPosition(s.id)!,(i+1)*3); new THREE.Color(s.spectralType?.startsWith('M') ? '#ffb982' : '#d5e7ff').toArray(colors,(i+1)*3); });
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.computeBoundingSphere();return g;
  },[]);
  useEffect(()=>()=> { geometry.dispose(); scene.backgroundIntensity=1; },[geometry,scene]);
  useFrame(()=> {
    const opacity=localStarOpacity(Math.max(navigation.range,navigation.motion.position.length()));
    if(pointsMaterial.current) pointsMaterial.current.opacity=opacity;
    scene.backgroundIntensity=inspecting ? .08-opacity*.06 : .3-opacity*.28;
    const position=localStarPosition(navigation.focusId);
    if(marker.current) { marker.current.visible=!!position; if(position) marker.current.position.set(...position); }
  });
  return <group name="continuous-local-universe">
    <ExploreBoundary fallback={null}><Suspense fallback={null}><StarSkybox /></Suspense></ExploreBoundary>
    <SolarBodies quality={quality} />
    <LearnTargets environment="solar" onLearn={onLearn} />
    <LocalBodyLabels navigation={navigation} onLearn={onLearn} />
    <LocalObjectsScene navigation={navigation} onLearn={onLearn} />
    <points name="local-catalog-stars" geometry={geometry} frustumCulled={false} onClick={event=> {
      if(event.delta>5 || event.index===undefined || (event.index>0 && !stars[event.index-1]) || (pointsMaterial.current?.opacity ?? 0)<.15) return;
      event.stopPropagation();onLearn(event.index===0 ? 'sun' : stars[event.index-1].id);
    }}>
      <pointsMaterial ref={pointsMaterial} vertexColors map={texture} size={3} sizeAttenuation={false} transparent opacity={0} alphaTest={.02} toneMapped={false} depthWrite={false} />
    </points>
    <group ref={marker} visible={false}>
      <mesh onClick={e=> { if(e.delta>5)return;e.stopPropagation();onLearn(navigation.focusId); }}>
        <sphereGeometry args={[14,32,24]} /><meshBasicMaterial color="#fff1c7" toneMapped={false} />
      </mesh>
      <mesh scale={1.3}><sphereGeometry args={[14,24,16]} /><meshBasicMaterial color="#ffd49c" transparent opacity={.1} depthWrite={false} /></mesh>
    </group>
  </group>;
}
