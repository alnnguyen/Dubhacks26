import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { destinationById } from './destinations';
import { LocalNavigation, isLocalDestination, localStarOpacity, localStarPosition, LOCAL_STAR_FACTOR } from './localNavigation';
import { STAR_INDEX, starPosition } from './catalog';
import type { MotionInput } from './flightMotion';
const idle:MotionInput={thrust:0,strafe:0,lift:0,yaw:0,pitch:0,brake:false,boost:false};
function advance(nav:LocalNavigation,seconds=4) { for(let i=0;i<seconds*60;i++)nav.step(1/60,idle,true); }
function earth() { const nav=new LocalNavigation();nav.setDestination(destinationById('sol'),true);return nav; }

describe('one local universe navigation frame',()=> {
  it('flies precisely near a planet and crosses open space faster',()=> {
    const close=earth(), far=earth();
    far.motion.position.set(0,0,20000);
    for(let i=0;i<60;i++) {
      close.step(1/60,{...idle,strafe:1},true);
      far.step(1/60,{...idle,strafe:1},true);
    }
    expect(close.motion.velocity.length()).toBeLessThan(15);
    expect(close.motion.velocity.length()).toBeGreaterThan(1);
    expect(far.motion.velocity.length()).toBeGreaterThan(5000);
  });
  it('sheds fast incoming momentum before entering the solar system',()=> {
    const nav=earth();nav.motion.position.set(0,0,1000);nav.motion.velocity.set(0,0,-100000);
    nav.motion.orientation.identity();nav.motion.rotation.set(0,0,0);
    nav.step(1/60,{...idle,thrust:1},true);
    const entrySpeed=nav.motion.velocity.length();
    expect(entrySpeed).toBeLessThan(450);
    // The outer planets now extend the approach path; continue into the inner system.
    for(let i=0;i<12*60;i++)nav.step(1/60,{...idle,thrust:1},true);
    expect(nav.motion.velocity.length()).toBeLessThan(entrySpeed/10);
    expect(nav.motion.position.length()).toBeGreaterThan(15);
  });
  it('uses a slower wheel dolly near bodies than in open space',()=> {
    const close=earth(), far=earth();far.motion.position.set(0,0,20000);
    const closeStart=close.motion.position.distanceTo(close.anchor), farStart=far.motion.position.distanceTo(far.anchor);
    close.zoomBy(.35,0);far.zoomBy(.35,0);advance(close,.1);advance(far,.1);
    expect(close.range/closeStart).toBeLessThan(1.08);
    expect(far.range/farStart).toBeGreaterThan(close.range/closeStart);
  });
  it('recognizes sustained outward scroll and reverses without queued outward drift',()=> {
    const gentle=earth(), fast=earth();
    for(let i=0;i<60;i++) {
      if(i<24 && i%3===0) {gentle.zoomBy(.03,i*1000/60);fast.zoomBy(.3,i*1000/60);}
      gentle.step(1/60,idle,true);fast.step(1/60,idle,true);
    }
    expect(fast.range).toBeGreaterThan(gentle.range*2);
    const before=fast.range;fast.zoomBy(-.03,1000);fast.step(1/60,idle,true);
    expect(fast.range).toBeLessThan(before);
    advance(fast,4);expect(fast.zooming).toBe(false);
    const stopped=fast.range;advance(fast);expect(fast.range).toBe(stopped);
  });
  it('bounds a huge wheel event and clears acceleration across pauses',()=> {
    const nav=earth(), initial=nav.range;
    nav.zoomBy(100,0);advance(nav,3);
    expect(nav.range).toBeLessThan(initial*1.5);
    for(let i=0;i<8;i++) {nav.zoomBy(.3,i*50+4000);advance(nav,.05);}
    nav.step(1/60,idle,false);
    const before=nav.range;nav.zoomBy(.03,4400);advance(nav,3);
    expect(nav.range/before).toBeCloseTo(Math.exp(.03),2);
    nav.zoomBy(.3,8000);nav.stop();const stopped=nav.motion.position.clone();advance(nav);
    expect(nav.motion.position.equals(stopped)).toBe(true);
  });
  it('accelerates a rapid outward burst more than the same scroll spaced apart',()=> {
    const rapid=earth(), spaced=earth();
    for(let i=0;i<180;i++) {
      if(i<24 && i%3===0)rapid.zoomBy(.3,i*1000/60);
      if(i<144 && i%18===0)spaced.zoomBy(.3,i*1000/60);
      rapid.step(1/60,idle,true);spaced.step(1/60,idle,true);
    }
    advance(rapid);advance(spaced);
    expect(rapid.range).toBeGreaterThan(spaced.range*1.5);
  });
  it('keeps wheel/button zoom smooth and reversible without resetting the camera',()=> {
    const nav=earth(), before=nav.motion.position.clone(), orientation=nav.motion.orientation.clone(), initial=nav.range;
    nav.zoom('out');expect(nav.motion.position.equals(before)).toBe(true);expect(nav.motion.orientation.equals(orientation)).toBe(true);
    nav.step(1/60,idle,true);expect(nav.range).toBeGreaterThan(initial);expect(nav.range).toBeLessThan(initial*4);
    advance(nav);expect(nav.range).toBeCloseTo(initial*4,0);
    nav.zoom('in');advance(nav);expect(nav.range).toBeCloseTo(initial,0);
    expect(nav.motion.position.distanceTo(before)).toBeLessThan(.1);
  });
  it('zooms through system and star scales, preserving an anchored source coordinate',()=> {
    const nav=earth();nav.zoom('system');advance(nav);expect(nav.band).toBe('system');expect(nav.range).toBeCloseTo(600,0);
    nav.zoom('stars');advance(nav);expect(nav.band).toBe('stars');expect(nav.range).toBeCloseTo(170000,-3);expect(nav.renderScale).toBeLessThan(.001);
    expect(localStarOpacity(nav.range)).toBe(1);
    const source=STAR_INDEX.get('hyg-32263')!;
    expect(localStarPosition(source.id)).toEqual(starPosition(source).map(n=>n*LOCAL_STAR_FACTOR));
  });
  it('approaches Sirius and returns to the exact Earth pose without a hard reset',()=> {
    const nav=earth(), initial=nav.motion.position.clone();
    nav.zoom('stars');advance(nav);const beforeTravel=nav.motion.position.clone();
    nav.setDestination(destinationById('hyg-32263'),false);
    expect(nav.motion.position.equals(beforeTravel)).toBe(true);expect(nav.inTransit).toBe(true);
    advance(nav);expect(nav.inTransit).toBe(false);expect(nav.focusId).toBe('hyg-32263');
    expect(nav.anchor.toArray()).toEqual(localStarPosition('hyg-32263'));
    expect(nav.motion.position.distanceTo(nav.anchor)).toBeCloseTo(Math.hypot(6,60),5);
    const beforeHome=nav.motion.position.clone();nav.setDestination(destinationById('sol'),false);
    expect(nav.motion.position.equals(beforeHome)).toBe(true);advance(nav);
    expect(nav.motion.position.distanceTo(initial)).toBeLessThan(1e-8);expect(nav.renderScale).toBe(1);
  });
  it('pauses a transition behind learning dialogs or background tabs',()=> {
    const nav=earth();nav.setDestination(destinationById('hyg-32263'),false);advance(nav,.4);
    const position=nav.motion.position.clone();for(let i=0;i<60;i++)nav.step(1,idle,false);
    expect(nav.motion.position.equals(position)).toBe(true);expect(nav.inTransit).toBe(true);
    advance(nav);expect(nav.inTransit).toBe(false);
  });
  it('clamps resume delta and can stop a transition where it is',()=> {
    const nav=earth();nav.setDestination(destinationById('hyg-32263'),false);
    nav.step(90,idle,true);expect(nav.inTransit).toBe(true);
    const position=nav.motion.position.clone();nav.step(1/60,{...idle,brake:true},true);advance(nav);
    expect(nav.motion.position.equals(position)).toBe(true);expect(nav.inTransit).toBe(false);
    expect(nav.anchor.toArray()).toEqual(localStarPosition('hyg-32263'));
  });
  it('keeps local flight usable after a close zoom and never enters the focused Sun',()=> {
    const nav=earth();nav.zoom('system');advance(nav);
    for(let i=0;i<8;i++){nav.zoom('in');advance(nav);}
    expect(nav.motion.position.length()).toBeGreaterThan(15);
    const before=nav.motion.position.clone();for(let i=0;i<60;i++)nav.step(1/60,{...idle,thrust:-1},true);
    expect(nav.motion.position.distanceTo(before)).toBeGreaterThan(1);
  });
  it('preserves world position after changing camera-relative render scale',()=> {
    const nav=earth();nav.zoom('stars');advance(nav);
    const point=new Vector3(...localStarPosition('hyg-32263')!);
    const relative=point.clone().sub(nav.motion.position).multiplyScalar(nav.renderScale);
    expect(relative.clone().divideScalar(nav.renderScale).add(nav.motion.position).distanceTo(point)).toBeLessThan(1e-8);
  });
  it('limits seamless travel to the solar scene and catalog stars within 25 pc',()=> {
    expect(isLocalDestination(destinationById('sol'))).toBe(true);expect(isLocalDestination(destinationById('nearby-stars'))).toBe(true);
    expect(isLocalDestination(destinationById('hyg-32263'))).toBe(true);expect(isLocalDestination(destinationById('gal-messier-031'))).toBe(false);
    expect(isLocalDestination(destinationById('exo-trappist-1-e'))).toBe(false);
  });
});
