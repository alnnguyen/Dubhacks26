import { MathUtils, Matrix4, Quaternion, Vector3 } from 'three';
import { bodyWorldPosition, SOLAR_BODIES } from './bodies';
import { LOCAL_OBJECT_INDEX } from './localObjects';
import { STAR_INDEX, starPosition } from './catalog';
import type { ExploreDestination } from './destinations';
import { FlightMotion, flightBodies, nearestFlightBody, type FlightBody, type MotionInput } from './flightMotion';

/** Visual bridge between the authored solar layout and real relative star positions.
 * This is deliberately compressed: 1 pc = 10,000 authored solar units, not real AU.
 */
export const LOCAL_STAR_FACTOR = 1000;
export const LOCAL_RADIUS_PC = 25;
export const MIN_RANGE = 8;
export const MAX_RANGE = 500000;
export type LocalZoomCommand = 'in' | 'out' | 'system' | 'stars';
export interface LocalZoomRequest { sequence: number; command: LocalZoomCommand }
export type LocalBand = 'planet' | 'system' | 'stars';
export const EARTH_POSITION = bodyWorldPosition(SOLAR_BODIES.find(b => b.id === 'earth')!);
const LOCAL_SOLAR_BODIES = flightBodies('solar');
const up = new Vector3(0,1,0);
const matrix = new Matrix4();

export function isLocalDestination(destination: ExploreDestination) {
  return destination.environment === 'solar' || (destination.environment === 'stars' &&
    (destination.id === 'nearby-stars' || (STAR_INDEX.get(destination.bodyId ?? '')?.distancePc ?? Infinity) <= LOCAL_RADIUS_PC));
}
export function localStarPosition(id: string): [number,number,number] | null {
  const star = STAR_INDEX.get(id);
  return star ? starPosition(star).map(n => n * LOCAL_STAR_FACTOR) as [number,number,number] : null;
}
export function localBand(range: number): LocalBand {
  return range < 130 ? 'planet' : range < 7000 ? 'system' : 'stars';
}
export function localStarOpacity(range: number) {
  return MathUtils.smoothstep(Math.log10(Math.max(1,range)), 2.8, 4);
}
function poseFor(destination: ExploreDestination) {
  const object=LOCAL_OBJECT_INDEX.get(destination.bodyId ?? '');
  if(object)return {anchor:new Vector3(...object.position),position:new Vector3(...destination.spawn),id:object.id,name:object.name};
  const starPosition = localStarPosition(destination.bodyId ?? '');
  if (destination.environment === 'stars' && starPosition) {
    return { anchor: new Vector3(...starPosition), position: new Vector3(...starPosition).add(new Vector3(0,6,60)), id: destination.bodyId!, name: destination.label };
  }
  if (destination.environment === 'stars') return { anchor: new Vector3(), position: new Vector3(0,35000,120000), id: 'sun', name: 'Sun / Sol' };
  const body = SOLAR_BODIES.find(b => b.id === destination.bodyId) ?? SOLAR_BODIES.find(b => b.id === 'earth')!;
  return { anchor: new Vector3(...bodyWorldPosition(body)), position: new Vector3(...destination.spawn), id: body.id, name: body.name };
}
interface Travel {
  time: number; duration: number; startAnchor: Vector3; endAnchor: Vector3;
  startRotation: Quaternion; endRotation: Quaternion; startRange: number; endRange: number; arc: number;
}
export class LocalNavigation {
  motion = new FlightMotion();
  anchor = new Vector3(...EARTH_POSITION);
  focusId = 'earth';
  focusName = 'Earth';
  renderScale = 1;
  range = 22;
  band: LocalBand = 'planet';
  bodies: FlightBody[] = LOCAL_SOLAR_BODIES;
  private travel: Travel | null = null;
  private targetRange: number | null = null;
  private zoomDirection: Vector3 | null = null;
  private zoomMode: 'preset' | 'step' | 'wheel' = 'step';
  private wheelEffort = 0;
  private lastWheelAt = -Infinity;
  private wheelSign = 0;
  private offset = new Vector3();
  private desiredPosition = new Vector3();
  private lookRotation(position: Vector3, anchor: Vector3) {
    return new Quaternion().setFromRotationMatrix(matrix.lookAt(position,anchor,up));
  }
  get inTransit() { return this.travel !== null; }
  get zooming() { return this.targetRange !== null; }
  setDestination(destination: ExploreDestination, immediate: boolean, reducedMotion = false) {
    this.motion.resetInspection();
    const pose = poseFor(destination);
    this.focusId = pose.id; this.focusName = pose.name;
    const object=LOCAL_OBJECT_INDEX.get(pose.id);
    const p = localStarPosition(pose.id) ?? object?.position;
    this.bodies = p ? [...LOCAL_SOLAR_BODIES,{ id:pose.id, name:pose.name, position:p, radius:object?.radius ?? 14 }] : LOCAL_SOLAR_BODIES;
    this.motion.stop(); this.targetRange=null; this.zoomDirection=null; this.resetWheel();
    const endRange = pose.position.distanceTo(pose.anchor);
    const rotation = this.lookRotation(pose.position,pose.anchor);
    if (immediate) {
      this.travel = null; this.anchor.copy(pose.anchor); this.motion.position.copy(pose.position);
      this.motion.orientation.copy(rotation); this.motion.rotation.setFromQuaternion(rotation,'YXZ');
      this.updateScale(); return;
    }
    const distance = this.anchor.distanceTo(pose.anchor);
    this.travel = { time:0, duration:reducedMotion ? .35 : 2.8, startAnchor:this.anchor.clone(), endAnchor:pose.anchor,
      startRotation:this.motion.orientation.clone(), endRotation:rotation,
      startRange:this.motion.position.distanceTo(this.anchor), endRange, arc:distance * .35 };
  }
  private cancelTravel() {
    if(this.travel) this.anchor.copy(this.travel.endAnchor);
    this.travel=null;
  }
  zoom(command: LocalZoomCommand) {
    this.cancelTravel(); this.motion.stop(); this.zoomDirection=null;
    this.resetWheel();
    this.zoomMode=command==='system'||command==='stars' ? 'preset' : 'step';
    const current = this.targetRange ?? this.motion.position.distanceTo(this.anchor);
    if (command === 'system' || command === 'stars') {
      // Preserve the camera position when changing zoom focus to the Sun.
      this.anchor.set(0,0,0); this.focusId='sun'; this.focusName='Sun / Sol';
      this.targetRange=command === 'system' ? 600 : 170000;
      this.zoomDirection=new Vector3(0,.6,1).normalize();
    } else this.targetRange=MathUtils.clamp(current * (command === 'out' ? 4 : .25), MIN_RANGE,MAX_RANGE);
  }
  private resetWheel() { this.wheelEffort=0; this.lastWheelAt=-Infinity; this.wheelSign=0; }
  zoomBy(delta: number, timestampMs: number) {
    if (!Number.isFinite(delta) || !Number.isFinite(timestampMs) || delta===0) return;
    this.cancelTravel(); this.motion.stop(); this.zoomDirection=null;
    const sign=Math.sign(delta), actual=this.motion.position.distanceTo(this.anchor);
    const continuing=this.zoomMode==='wheel' && sign===this.wheelSign && timestampMs-this.lastWheelAt>=0 && timestampMs-this.lastWheelAt<180;
    // A reversal starts from the current camera, discarding queued outward travel.
    const range=continuing ? this.targetRange ?? actual : actual;
    this.wheelEffort=continuing ? Math.min(2,this.wheelEffort+Math.min(.35,Math.abs(delta))) : Math.min(.35,Math.abs(delta));
    this.lastWheelAt=timestampMs; this.wheelSign=sign; this.zoomMode='wheel';
    const boost=sign>0 ? Math.max(0,this.wheelEffort-.35) : 0;
    const amount=MathUtils.clamp(delta,-.35,.35)*(1+boost*2);
    // Limit queued travel so lifting a finger does not leave a long runaway zoom.
    const backlog=.4+boost;
    const requested=MathUtils.clamp(Math.log(Math.max(MIN_RANGE,range)/Math.max(MIN_RANGE,actual))+amount,-backlog,backlog);
    this.targetRange=MathUtils.clamp(actual*Math.exp(requested),MIN_RANGE,MAX_RANGE);
  }
  private faceAnchor(alpha = 1) {
    this.motion.orientation.slerp(this.lookRotation(this.motion.position,this.anchor),alpha);
    this.motion.rotation.setFromQuaternion(this.motion.orientation,'YXZ');
  }
  look(dx: number, dy: number) {
    if (this.travel) return;
    this.targetRange=null; this.resetWheel(); this.motion.look(dx,dy);
  }
  stop() { this.cancelTravel(); this.targetRange=null; this.zoomDirection=null; this.resetWheel(); this.motion.stop(); }
  pause() { this.resetWheel(); this.motion.stop(); }
  step(rawDelta: number, input: MotionInput, enabled: boolean) {
    const dt=Math.max(0,Math.min(rawDelta,.05));
    if (!enabled) { this.pause(); return; }
    this.wheelEffort*=Math.exp(-2*dt);
    if (input.brake || ((this.travel || this.targetRange !== null) && Math.abs(input.thrust)+Math.abs(input.strafe)+Math.abs(input.lift)+Math.abs(input.yaw)+Math.abs(input.pitch)>0)) this.stop();
    if (this.travel) {
      const t=this.travel;
      t.time=Math.min(t.duration,t.time+dt);
      const u=t.time/t.duration, eased=u*u*(3-2*u);
      this.anchor.lerpVectors(t.startAnchor,t.endAnchor,eased);
      this.motion.orientation.slerpQuaternions(t.startRotation,t.endRotation,eased);
      const range=Math.exp(MathUtils.lerp(Math.log(Math.max(MIN_RANGE,t.startRange)),Math.log(Math.max(MIN_RANGE,t.endRange)),eased)) + Math.sin(Math.PI*eased)*t.arc;
      this.motion.position.copy(this.anchor).add(this.offset.set(0,0,range).applyQuaternion(this.motion.orientation));
      this.motion.rotation.setFromQuaternion(this.motion.orientation,'YXZ');
      if (u>=1) this.travel=null;
    } else if (this.targetRange !== null) {
      const current=this.motion.position.distanceTo(this.anchor);
      const clearance=nearestFlightBody(this.motion.position,this.bodies)?.distance ?? current;
      const far=MathUtils.smoothstep(clearance,40,1200);
      const boost=this.targetRange>current ? Math.max(0,this.wheelEffort-.35) : 0;
      const rate=this.zoomMode==='preset' ? 4 : this.zoomMode==='step' ? 1.8 : .65+far*.9+boost*2.5;
      const error=Math.log(this.targetRange/Math.max(MIN_RANGE,current));
      const next=Math.exp(Math.log(Math.max(MIN_RANGE,current))+MathUtils.clamp(error*5,-rate,rate)*dt);
      this.offset.copy(this.motion.position).sub(this.anchor);
      if (this.offset.lengthSq()<1e-8) this.offset.set(0,0,1);
      if(this.zoomDirection) this.offset.normalize().lerp(this.zoomDirection,1-Math.exp(-4*dt)).normalize();
      this.desiredPosition.copy(this.anchor).add(this.offset.setLength(next));
      // Dolly can never cross the focused body's exclusion sphere.
      const focus=this.bodies.find(b=>b.id===this.focusId);
      const minimum=focus ? focus.radius+1 : MIN_RANGE;
      if (next>=minimum) this.motion.position.copy(this.desiredPosition);
      this.faceAnchor(1-Math.exp(-7*dt));
      if (Math.abs(Math.log(Math.max(MIN_RANGE,current)/this.targetRange))<.001 && this.targetRange>=minimum) {
        this.motion.position.copy(this.anchor).add(this.offset.setLength(this.targetRange)); this.targetRange=null; this.zoomDirection=null;
      } else if(next<minimum) { this.targetRange=null; this.zoomDirection=null; }
    } else {
      const clearance=nearestFlightBody(this.motion.position,this.bodies)?.distance ?? this.range;
      this.motion.step(dt,input,this.bodies,true,undefined,MathUtils.clamp(clearance*.45,1.5,120000));
    }
    this.updateScale();
  }
  syncMotion() { this.updateScale(); }
  private updateScale() {
    this.range=this.motion.position.distanceTo(this.anchor);
    this.band=localBand(this.range);
    const nearest=nearestFlightBody(this.motion.position,this.bodies)?.distance ?? this.range;
    this.renderScale=MathUtils.clamp(40/Math.max(40,nearest),.00008,1);
  }
}
