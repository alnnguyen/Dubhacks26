import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, type Group, type PerspectiveCamera } from 'three';
import { SOLAR_BODIES, bodyWorldPosition } from './bodies';
import { LIVE_POSITIONS, LOCAL_OBJECT_INDEX } from './localObjects';
import { LocalNavigation, localStarPosition } from './localNavigation';

type Target = { id: string; name: string; position: [number,number,number]; radius: number };
const solar: Target[] = SOLAR_BODIES.map(b=>({...b,position:bodyWorldPosition(b)}));

/** Screen-sized navigation aids. Source bodies stay in the shared local frame. */
export function LocalBodyLabels({ navigation, onLearn }: { navigation: LocalNavigation; onLearn: (id:string)=>void }) {
  const group=useRef<Group>(null);
  const gl=useThree(s=>s.gl);
  const learn=useRef(onLearn);learn.current=onLearn;
  const elements=useRef(new Map<string,HTMLButtonElement>());
  const point=useMemo(()=>new Vector3(),[]);
  const direction=useMemo(()=>new Vector3(),[]);
  const offset=useMemo(()=>new Vector3(),[]);
  const focusId=navigation.focusId, focusName=navigation.focusName;
  const targets=useMemo<Target[]>(()=> {
    const object=LOCAL_OBJECT_INDEX.get(focusId), station=LOCAL_OBJECT_INDEX.get('sat-25544');
    const base:Target[]=station && focusId!==station.id ? [...solar,{...station}] : solar;
    const position=localStarPosition(focusId) ?? object?.position;
    return position ? [...base,{id:focusId,name:focusName,position,radius:object?.radius ?? 14}] : base;
  },[focusId,focusName]);
  // A small DOM overlay avoids a separate React root for every projected label.
  useEffect(()=> {
    const overlay=document.createElement('div');overlay.className='ex-body-labels';
    for(const target of targets) {
      const button=document.createElement('button');button.type='button';button.hidden=true;
      button.className='ex-body-label';button.setAttribute('aria-label',`Learn about ${target.name}`);
      const marker=document.createElement('span');marker.className='ex-body-label__marker';marker.setAttribute('aria-hidden','true');
      const name=document.createElement('span');name.className='ex-body-label__name';name.textContent=target.name;
      button.append(marker,name);button.addEventListener('pointerdown',e=>e.stopPropagation());
      button.addEventListener('click',e=>{e.stopPropagation();learn.current(target.id);});
      elements.current.set(target.id,button);overlay.append(button);
    }
    gl.domElement.parentElement?.append(overlay);
    const buttons=elements.current;
    return ()=>{overlay.remove();buttons.clear();};
  },[gl,targets]);
  useFrame(({camera,size})=> {
    if(!group.current)return;
    group.current.updateWorldMatrix(true,false);
    const occupied: {x:number;y:number;width:number}[]=[];
    const focal=size.height/(2*Math.tan((camera as PerspectiveCamera).fov*Math.PI/360));
    for(const target of targets) {
      const el=elements.current.get(target.id);if(!el)continue;
      // Spacecraft labels follow the time-lapse.
      const live=LIVE_POSITIONS.get(target.id);if(live)target.position=live;
      direction.set(...target.position).sub(navigation.motion.position);
      const distance=direction.length();direction.normalize();
      let hidden=distance>5000 || distance<=target.radius || (target.id.startsWith('sat-') && distance>70);
      // Do not reveal a planet's label through the Sun or another planet.
      for(const body of targets) {
        if(hidden || body.id===target.id)continue;
        offset.set(...body.position).sub(navigation.motion.position);
        const along=offset.dot(direction);
        if(along>0 && along<distance && offset.lengthSq()-along*along<body.radius*body.radius)hidden=true;
      }
      point.set(...target.position).applyMatrix4(group.current.matrixWorld).project(camera);
      const radius=focal*target.radius/Math.max(distance,target.radius);
      const x=(point.x+1)*size.width/2+radius+12, y=(1-point.y)*size.height/2-10;
      const width=target.name.length*7+24;
      if(point.z< -1 || point.z>1 || x<0 || x+width>size.width-8 || y<65 || y>size.height-100)hidden=true;
      if(occupied.some(r=>Math.abs(r.y-y)<28 && x<r.x+r.width && x+width>r.x))hidden=true;
      el.hidden=hidden;
      if(hidden)continue;
      occupied.push({x,y,width});
      el.style.transform=`translate(${(point.x+1)*size.width/2}px,${(1-point.y)*size.height/2}px)`;
      el.style.setProperty('--body-offset',`${radius+12}px`);
      el.style.setProperty('--marker-size',`${Math.max(12,Math.min(48,radius*2+8))}px`);
      el.dataset.close=String(radius>28);
      el.dataset.focus=String(target.id===navigation.focusId);
      el.style.opacity=String(Math.min(1,(5000-distance)/2000));
    }
  });
  return <group ref={group} name="local-body-navigation-labels" />;
}
