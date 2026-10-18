import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
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
import { RivalShips } from './RivalShips';
import { HoverPicker } from './HoverPicker';
import { MilkyWayDisk } from './MilkyWay';
import { GALACTIC_CENTER, GALACTIC_NORTH, LOCAL_GALAXIES, MILKY_WAY_RADIUS, galaxyLayerOpacity, milkyWayOpacity, nearbyStarFade } from './cosmicScale';
import type { NearbyPilot } from '../../state/lobbyTypes';

const stars = CATALOG_STARS.filter(s => s.distancePc <= LOCAL_RADIUS_PC);
/** Both layers stay mounted. The controller changes one camera-relative world transform. */
export function LocalUniverseScene({ navigation, quality, onLearn, inspecting=false, inspectId=null, rivals, onSelectRival }: { navigation: LocalNavigation; quality: GraphicsQuality; onLearn: (id:string) => void; inspecting?:boolean; inspectId?: string | null; rivals?: NearbyPilot[]; onSelectRival?: (id:string) => void }) {
  const scene=useThree(s=>s.scene);
  const pointsMaterial=useRef<THREE.PointsMaterial>(null);
  const inspectRef=useRef(inspectId);inspectRef.current=inspectId;
  const galaxyMaterial=useRef<THREE.PointsMaterial>(null);
  const diskGroup=useRef<THREE.Group>(null);
  const diskVisible=useRef(false);
  const galaxyGeometry=useMemo(()=> {
    const pos=new Float32Array(LOCAL_GALAXIES.length*3);
    LOCAL_GALAXIES.forEach((g,i)=>pos.set(g.position,i*3));
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.computeBoundingSphere();return geo;
  },[]);
  useEffect(()=>()=>galaxyGeometry.dispose(),[galaxyGeometry]);
  const diskQuaternion=useMemo(()=>new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...GALACTIC_NORTH)),[]);
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
    const opacity=localStarOpacity(Math.max(navigation.range,navigation.motion.position.length()))*nearbyStarFade(navigation.range);
    if(pointsMaterial.current) pointsMaterial.current.opacity=opacity;
    // The sky cubemap is a view from Earth; it fades out as you leave the galaxy.
    const cosmic=1-milkyWayOpacity(navigation.range)*.85;
    scene.backgroundIntensity=(inspecting ? .08-opacity*.06 : .3-opacity*.28)*cosmic;
    const galaxies=galaxyLayerOpacity(navigation.range);
    if(galaxyMaterial.current) { galaxyMaterial.current.opacity=galaxies; galaxyMaterial.current.visible=galaxies>.01; }
    if(diskGroup.current) diskGroup.current.visible=milkyWayOpacity(navigation.range)>.01;
    diskVisible.current=milkyWayOpacity(navigation.range)>.5;
    // The star you're inspecting (or flying to) gets a body to frame; other stars stay points.
    const position=localStarPosition(inspectRef.current ?? '') ?? localStarPosition(navigation.focusId);
    if(marker.current) { marker.current.visible=!!position; if(position) marker.current.position.set(...position); }
  });
  return <group name="continuous-local-universe">
    <ExploreBoundary fallback={null}><Suspense fallback={null}><StarSkybox /></Suspense></ExploreBoundary>
    <SolarBodies quality={quality} />
    <LearnTargets environment="solar" onLearn={onLearn} />
    <LocalBodyLabels navigation={navigation} onLearn={onLearn} />
    <LocalObjectsScene navigation={navigation} onLearn={onLearn} />
    <group ref={diskGroup} position={GALACTIC_CENTER} quaternion={diskQuaternion} visible={false} name="milky-way-real-scale">
      <MilkyWayDiskWhen visible={diskVisible} radius={MILKY_WAY_RADIUS} />
    </group>
    <points name="galaxy-atlas" geometry={galaxyGeometry} frustumCulled={false}>
      <pointsMaterial ref={galaxyMaterial} map={texture} color="#c9dcff" size={5} sizeAttenuation={false} transparent opacity={0} alphaTest={.02} toneMapped={false} depthWrite={false} />
    </points>
    <HoverPicker navigation={navigation} onLearn={onLearn} />
    {rivals && rivals.length > 0 && onSelectRival && <RivalShips navigation={navigation} rivals={rivals} onSelect={onSelectRival} />}
    <points name="local-catalog-stars" geometry={geometry} frustumCulled={false}>
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

/** The existing artistic disk shader, fading with a ref so the scene never re-renders per frame. */
function MilkyWayDiskWhen({ visible, radius }: { visible: { current: boolean }; radius: number }) {
  const [on, setOn] = useState(false);
  useFrame(() => { if (visible.current !== on) setOn(visible.current); });
  return <MilkyWayDisk visible={on} radius={radius} />;
}
