import { describe,it,expect } from 'vitest';
import { SOLAR_BODIES } from './bodies';
import { scienceForBodyId } from './bodiesScience';
import { DESTINATIONS,destinationById } from './destinations';
import { LOCAL_OBJECTS, LOCAL_OBJECT_INDEX, LOCAL_OBJECT_MANIFEST, orbitalPosition, compressedAu, objectOrbit } from './localObjects';
import { LocalNavigation } from './localNavigation';

describe('bounded local solar catalogs',()=> {
  it('includes all eight major planets and sourced learn/visit metadata',()=> {
    const planets=['mercury','venus','earth','mars','jupiter','saturn','uranus','neptune'];
    for(const id of planets) {
      expect(SOLAR_BODIES.some(b=>b.id===id)).toBe(true);
      expect(scienceForBodyId(id)?.kind).toBe('planet');
      expect(destinationById(`visit-${id}`).bodyId).toBe(id);
    }
    expect(SOLAR_BODIES.find(b=>b.id==='saturn')?.rings).toBe(true);
  });
  it('keeps unique real source identities and epoch metadata for every added destination',()=> {
    expect(new Set(LOCAL_OBJECTS.map(o=>o.id)).size).toBe(LOCAL_OBJECTS.length);
    for(const o of LOCAL_OBJECTS) {
      expect(o.position.every(Number.isFinite)).toBe(true);
      expect(o.elements.e).toBeGreaterThanOrEqual(0);expect(o.elements.e).toBeLessThan(1);
      expect(o.epoch.length).toBeGreaterThan(5);
      expect(scienceForBodyId(o.id)?.facts?.some(f=>f.label.toLowerCase().includes('epoch'))).toBe(true);
      expect(DESTINATIONS.find(d=>d.bodyId===o.id)?.category).toBe(o.kind==='satellite'?'Satellites':o.kind==='probe'?'Spacecraft':o.kind==='comet'?'Comets':'Asteroids');
    }
    expect(LOCAL_OBJECT_MANIFEST.sources.every(s=>s.sha256.length===64 && s.url.startsWith('https://'))).toBe(true);
  });
  it('ships ISS, Hubble, recent Starlink elements and named NASA mission targets',()=> {
    expect(LOCAL_OBJECT_INDEX.get('sat-25544')?.name).toBe('ISS');
    expect(LOCAL_OBJECT_INDEX.get('sat-20580')?.name).toContain('Hubble');
    const sample=LOCAL_OBJECTS.filter(o=>o.name.startsWith('STARLINK'));
    expect(sample.length).toBeGreaterThan(0);expect(sample.length).toBeLessThanOrEqual(48);
    for(const o of sample)expect(Date.parse(LOCAL_OBJECT_MANIFEST.retrievedAt)-Date.parse(o.epoch)).toBeLessThan(30*86400000);
    for(const name of ['Halley','Ceres','Bennu','Ryugu','Churyumov'])expect(LOCAL_OBJECTS.some(o=>o.name.includes(name))).toBe(true);
  });
  it('places elliptic perihelion/aphelion correctly and preserves radius under orientation',()=> {
    const orbit={a:10,e:.7,i:0,om:0,w:0,ma:0};
    expect(Math.hypot(...orbitalPosition(orbit))).toBeCloseTo(3,8);
    expect(Math.hypot(...orbitalPosition({...orbit,ma:180}))).toBeCloseTo(17,8);
    expect(Math.hypot(...orbitalPosition({...orbit,i:75,om:123,w:67}))).toBeCloseTo(3,8);
    expect(orbitalPosition({...orbit,e:0,ma:90})[2]).toBeCloseTo(-10,8);
  });
  it('compresses distance monotonically and closes selected display orbits',()=> {
    expect(compressedAu(1)).toBe(100);expect(compressedAu(30.069)).toBe(510);
    let previous=0;for(let au=.1;au<100;au+=.1){const current=compressedAu(au);expect(current).toBeGreaterThan(previous);previous=current;}
    for(const o of LOCAL_OBJECTS) {
      const path=objectOrbit(o);expect(path).toHaveLength(129);
      expect(Math.hypot(...path[0].map((n,i)=>n-path[128][i]))).toBeLessThan(1e-7);
    }
  });
  it('arrives safely at a spacecraft or small-body focus in the continuous scene',()=> {
    for(const o of [LOCAL_OBJECT_INDEX.get('sat-25544')!,LOCAL_OBJECTS.find(o=>o.name.includes('Halley'))!]) {
      const nav=new LocalNavigation();nav.setDestination(destinationById('sol'),true);
      nav.setDestination(destinationById(`visit-${o.id}`),false);
      for(let i=0;i<240;i++)nav.step(1/60,{thrust:0,strafe:0,lift:0,yaw:0,pitch:0,boost:false,brake:false},true);
      expect(nav.focusId).toBe(o.id);expect(nav.anchor.toArray()).toEqual(o.position);
      expect(nav.range).toBeGreaterThan(o.radius+1);expect(nav.inTransit).toBe(false);
    }
  });
});
