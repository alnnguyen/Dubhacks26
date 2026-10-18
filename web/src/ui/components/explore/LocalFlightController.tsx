import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Quaternion, Vector3, type Group } from 'three';
import { LocalNavigation, type LocalZoomRequest } from './localNavigation';
import type { ExploreDestination } from './destinations';
import type { FlightInput, FlightTelemetry } from './ShipFlightController';
import { useInspectFly } from './useInspectFly';

const FLIGHT_KEYS=new Set(['KeyW','KeyS','KeyA','KeyD','KeyQ','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','Space','KeyN','Equal','Minus','NumpadAdd','NumpadSubtract']);
const editable=(target:EventTarget|null)=>target instanceof HTMLElement && !!target.closest('input,textarea,select,[contenteditable="true"]');
export function LocalFlightController({ navigation, destination, resetToken, zoomRequest, enabled, input, reducedMotion, worldRef, onTelemetry, onWarpRequest, inspectId }: {
  navigation: LocalNavigation; destination: ExploreDestination; resetToken:number; zoomRequest?:LocalZoomRequest;
  enabled:boolean; input:FlightInput; reducedMotion:boolean; worldRef:RefObject<Group|null>;
  onTelemetry:(t:FlightTelemetry)=>void; onWarpRequest?:()=>void; inspectId?: string | null;
}) {
  const { camera,gl,scene }=useThree();
  const initialized=useRef(false);
  const keys=useRef(new Set<string>());
  const drag=useRef<{id:number;x:number;y:number}|null>(null);
  const timer=useRef(0);
  const inverse=useMemo(()=>new Quaternion(),[]);
  const offset=useMemo(()=>new Vector3(),[]);
  const onTelem=useRef(onTelemetry);onTelem.current=onTelemetry;
  const onNav=useRef(onWarpRequest);onNav.current=onWarpRequest;
  const motionRef=useRef(navigation.motion);
  motionRef.current=navigation.motion;
  useInspectFly(motionRef, inspectId, reducedMotion, navigation);
  useLayoutEffect(()=> {
    navigation.setDestination(destination,!initialized.current,reducedMotion);
    initialized.current=true;
  },[navigation,destination,resetToken,reducedMotion]);
  useEffect(()=> { if(zoomRequest && !inspectId) navigation.zoom(zoomRequest.command); },[navigation,zoomRequest,inspectId]);
  useEffect(()=> {
    const reset=()=> {keys.current.clear();drag.current=null;navigation.pause();};reset();
    const down=(e:KeyboardEvent)=> {
      if(!enabled || editable(e.target) || e.metaKey || e.ctrlKey || e.altKey || !FLIGHT_KEYS.has(e.code))return;
      e.preventDefault();
      if(e.code==='KeyN') {if(!e.repeat)onNav.current?.();return;}
      if(['Equal','NumpadAdd','Minus','NumpadSubtract'].includes(e.code)) {if(!e.repeat)navigation.zoom(['Minus','NumpadSubtract'].includes(e.code)?'out':'in');return;}
      keys.current.add(e.code);
    };
    const up=(e:KeyboardEvent)=>keys.current.delete(e.code);
    const visibility=()=> {if(document.hidden)reset();};
    const el=gl.domElement;
    const pointerDown=(e:PointerEvent)=> {if(!enabled||e.button!==0)return;drag.current={id:e.pointerId,x:e.clientX,y:e.clientY};el.setPointerCapture(e.pointerId);el.focus();};
    const pointerMove=(e:PointerEvent)=> {const d=drag.current;if(!enabled||!d||d.id!==e.pointerId)return;navigation.look(e.clientX-d.x,e.clientY-d.y);d.x=e.clientX;d.y=e.clientY;};
    const pointerEnd=()=> {drag.current=null;};
    const wheel=(e:WheelEvent)=> {
      if(!enabled)return;e.preventDefault();
      const delta=e.deltaY*(e.deltaMode===1 ? 16 : e.deltaMode===2 ? 300 : 1);
      navigation.zoomBy(delta*.003,e.timeStamp);el.focus();
    };
    el.tabIndex=0;el.setAttribute('aria-label','Local universe. Scroll or use plus and minus to zoom. W and S fly; arrows steer.');
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',reset);document.addEventListener('visibilitychange',visibility);
    el.addEventListener('pointerdown',pointerDown);el.addEventListener('pointermove',pointerMove);el.addEventListener('pointerup',pointerEnd);el.addEventListener('pointercancel',pointerEnd);el.addEventListener('lostpointercapture',pointerEnd);el.addEventListener('wheel',wheel,{passive:false});
    return ()=> {reset();window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',reset);document.removeEventListener('visibilitychange',visibility);
      el.removeEventListener('pointerdown',pointerDown);el.removeEventListener('pointermove',pointerMove);el.removeEventListener('pointerup',pointerEnd);el.removeEventListener('pointercancel',pointerEnd);el.removeEventListener('lostpointercapture',pointerEnd);el.removeEventListener('wheel',wheel);};
  },[navigation,enabled,gl]);
  useFrame((_,dt)=> {
    const k=keys.current;
    const axis=(a:string,b:string)=>Number(k.has(a))-Number(k.has(b));
    const boosting=k.has('ShiftLeft')||k.has('ShiftRight');
    const canFly = (enabled || navigation.motion.flying) && !document.hidden;
    if (navigation.motion.flying) {
      navigation.motion.step(document.hidden?0:dt,{thrust:0,strafe:0,lift:0,yaw:0,pitch:0,boost:false,brake:false},[],true);
      navigation.syncMotion();
    } else {
      navigation.step(dt,{thrust:Math.max(-1,Math.min(1,input.thrust+axis('KeyW','KeyS')+(input.cruise ? .6 : 0))),strafe:input.strafe+axis('KeyD','KeyA'),lift:axis('KeyQ','KeyE'),yaw:input.yaw+axis('ArrowLeft','ArrowRight'),pitch:input.pitch+axis('ArrowUp','ArrowDown'),boost:boosting,brake:input.brake||k.has('Space')},canFly);
    }
    inverse.copy(navigation.motion.orientation).invert();
    if(worldRef.current) {
      worldRef.current.quaternion.copy(inverse);
      worldRef.current.scale.setScalar(navigation.renderScale);
      worldRef.current.position.copy(navigation.motion.position).negate().multiplyScalar(navigation.renderScale).applyQuaternion(inverse);
    }
    scene.backgroundRotation.setFromQuaternion(inverse);camera.position.set(0,0,0);camera.quaternion.identity();
    timer.current+=dt;if(timer.current<.1)return;timer.current=0;
    const focus=navigation.bodies.find(b=>b.id===navigation.focusId);
    const distance=focus ? Math.max(0,offset.copy(navigation.motion.position).sub(new Vector3(...focus.position)).length()-focus.radius) : navigation.range;
    const label=navigation.inTransit ? `Approaching ${navigation.focusName}` : navigation.band==='galaxies'?'Galaxy atlas · real distances':navigation.band==='milkyWay'?'Milky Way · real scale, artistic disk':navigation.band==='stars'?'Nearby stars · compressed':navigation.band==='system'?'Solar system':`Near ${navigation.focusName}`;
    onTelem.current({speed:navigation.motion.velocity.length(),nearestName:navigation.focusName,nearestId:navigation.focusId,nearestDistance:distance,position:navigation.motion.position.toArray() as [number,number,number],absoluteDistance:navigation.motion.position.length(),scaleBand:navigation.band==='galaxies'?'catalogGalaxies':navigation.band==='milkyWay'?'milkyWay':navigation.band==='stars'?'catalogStars':navigation.band==='system'?'system':'planet',scaleLabel:label,showMilkyWay:false,boosting,pointerLocked:!!drag.current,
      localNavigation:{range:navigation.range,focus:navigation.focusName,inTransit:navigation.inTransit,zooming:navigation.zooming}});
  },-2);
  return null;
}
