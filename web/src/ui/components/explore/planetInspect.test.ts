import {describe,it,expect} from 'vitest';
import {PerspectiveCamera,Vector3} from 'three';
import {inspectStandoff} from './inspectPose';
import {planetFacts} from './bodiesScience';
import {SOLAR_BODIES,bodyWorldPosition} from './bodies';
import {LocalNavigation} from './localNavigation';
import {destinationById} from './destinations';
const idle={thrust:0,strafe:0,lift:0,yaw:0,pitch:0,boost:false,brake:false};
function tickInspect(nav:LocalNavigation,n=90) {for(let i=0;i<n;i++){nav.motion.step(1/60,idle,[],false);nav.syncMotion();}}

describe('integrated planet inspection',()=> {
  it('frames every planet beside a desktop sheet or above a portrait sheet',()=> {
    for(const body of SOLAR_BODIES.filter(b=>b.id!=='sun'))for(const portrait of [false,true]) {
      const aspect=portrait?.6:16/9,center=new Vector3(...bodyWorldPosition(body));
      const pose=inspectStandoff(center,body.radius,portrait,aspect);
      const camera=new PerspectiveCamera(78,aspect,.05,50000);camera.position.copy(pose.pos);camera.lookAt(pose.look);camera.updateMatrixWorld();
      const point=center.clone().project(camera);
      expect(pose.pos.distanceTo(center)).toBeGreaterThan(body.radius*3);
      if(portrait){expect(point.y).toBeGreaterThan(.4);expect(point.y).toBeLessThan(.65);}
      else{expect(point.x).toBeLessThan(-.3);expect(point.x).toBeGreaterThan(-.6);}
    }
  });
  it('refreshes floating scale during a long inspect trip and returns exactly home',()=> {
    const nav=new LocalNavigation();nav.setDestination(destinationById('nearby-stars'),true);
    const home=nav.motion.position.clone(),rotation=nav.motion.orientation.clone(),scale=nav.renderScale;
    const earth=SOLAR_BODIES.find(b=>b.id==='earth')!,pose=inspectStandoff(bodyWorldPosition(earth),earth.radius);
    nav.stop();nav.motion.flyTo(pose.pos,pose.look,1.2);tickInspect(nav);
    expect(nav.motion.position.distanceTo(pose.pos)).toBeLessThan(1e-8);expect(nav.renderScale).toBe(1);
    nav.motion.flyBack(1.2);tickInspect(nav);
    expect(nav.motion.position.distanceTo(home)).toBeLessThan(1e-8);
    expect(nav.motion.orientation.angleTo(rotation)).toBeLessThan(1e-7);expect(nav.renderScale).toBeCloseTo(scale,10);
  });
  it('preserves the original home when switching bodies or closing mid-flight',()=> {
    const nav=new LocalNavigation();nav.setDestination(destinationById('sol'),true);const home=nav.motion.position.clone();
    const mars=SOLAR_BODIES.find(b=>b.id==='mars')!,jupiter=SOLAR_BODIES.find(b=>b.id==='jupiter')!;
    let pose=inspectStandoff(bodyWorldPosition(mars),mars.radius);nav.motion.flyTo(pose.pos,pose.look);tickInspect(nav,20);
    pose=inspectStandoff(bodyWorldPosition(jupiter),jupiter.radius);nav.motion.flyTo(pose.pos,pose.look);tickInspect(nav,10);
    nav.motion.flyBack();tickInspect(nav);expect(nav.motion.position.distanceTo(home)).toBeLessThan(1e-8);
  });
  it('cancels an inspect return when Visit changes destination',()=> {
    const nav=new LocalNavigation();nav.setDestination(destinationById('sol'),true);
    const pose=inspectStandoff([80,0,0],2);nav.motion.flyTo(pose.pos,pose.look);tickInspect(nav);
    nav.setDestination(destinationById('visit-jupiter'),false);
    nav.motion.flyBack();expect(nav.motion.flying).toBe(false);
    for(let i=0;i<240;i++)nav.step(1/60,idle,true);
    expect(nav.focusId).toBe('jupiter');expect(nav.inTransit).toBe(false);
  });
  it('keeps imported layer boundaries ordered, bounded and attributed for the shader',()=> {
    for(const body of SOLAR_BODIES.filter(b=>b.id!=='sun')) {
      const f=planetFacts(body.id)!;expect(f).not.toBeNull();expect(f.interior.sources.length).toBeGreaterThan(0);
      expect(f.interior.layers.length).toBeLessThanOrEqual(6);
      let previous=0;for(const layer of f.interior.layers){expect(layer.outerRadiusFraction).toBeGreaterThan(previous);previous=layer.outerRadiusFraction;}
      expect(previous).toBe(1);expect(f.source.startsWith('https://')).toBe(true);
    }
    for(const id of ['jupiter','saturn','uranus','neptune'])expect(planetFacts(id)?.interior.confidence).toContain('model');
  });
});
