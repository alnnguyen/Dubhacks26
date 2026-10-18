import { describe, expect, it } from 'vitest';
import { CATALOG_STARS, CATALOG_PLANETS, CATALOG_GALAXIES, CATALOG_MANIFEST, HOST_PLANETS, equatorialPosition, starPosition, galaxyPosition, catalogScience, catalogDestination, hostLayout } from './catalog';
import { destinationById, DESTINATIONS } from './destinations';
import { flightBodies } from './flightMotion';

const norm = (p: number[]) => Math.hypot(...p);
describe('real offline catalogs', () => {
  it('ships exactly the imported snapshot counts, with unique IDs', () => {
    const groups=[CATALOG_STARS,CATALOG_PLANETS,CATALOG_GALAXIES];
    groups.forEach((rows,i) => {
      expect(rows.length).toBe(CATALOG_MANIFEST.sources[i].count);
      expect(new Set(rows.map(r => r.id)).size).toBe(rows.length);

    });
    expect(CATALOG_GALAXIES.length).toBe(1034);
    expect(CATALOG_STARS.length).toBe(24835);
    expect(CATALOG_PLANETS.length).toBe(5301);
    expect(HOST_PLANETS.size).toBe(3894);
  });
  it('excludes unknown-distance placeholders and invalid positions', () => {
    expect(CATALOG_STARS.every(star => star.distancePc > 0 && star.distancePc < 100000 && star.ra >= 0 && star.ra < 360 && Math.abs(star.dec) <= 90 && Math.abs(norm(starPosition(star))-star.distancePc*10) < 1e-5)).toBe(true);
    expect(CATALOG_GALAXIES.every(g => Math.abs(norm(galaxyPosition(g))-g.distanceMpc*50) < 1e-5)).toBe(true);
  });
  it('has Sirius, seven TRAPPIST-1 planets and the Andromeda source record', () => {
    expect(CATALOG_STARS.find(s => s.name==='Sirius')?.distancePc).toBeCloseTo(2.6371,4);
    expect(HOST_PLANETS.get('TRAPPIST-1')).toHaveLength(7);
    const m31=CATALOG_GALAXIES.find(g => g.name==='MESSIER 031')!;
    expect(m31.alias).toContain('Andromeda'); expect(m31.distanceMpc).toBe(0.78);
    expect(m31.ra).toBeCloseTo(10.685,2);
  });
  it('keeps explicit unit frames and cardinal directions', () => {
    expect(equatorialPosition(0,0,1,10)).toEqual([10,0,-0]);
    expect(equatorialPosition(90,0,1,10)[2]).toBeCloseTo(-10);
    expect(equatorialPosition(0,90,1,10)[1]).toBeCloseTo(10);
  });
  it('keeps minimum mass, equilibrium temperature and archival galaxy methods labeled', () => {
    const prox=CATALOG_PLANETS.find(p => p.name==='Proxima Cen b')!;
    const facts=catalogScience(prox.id)!.facts!;
    expect(facts.some(f => f.label.includes('Minimum mass'))).toBe(true);
    expect(facts.some(f => f.label==='Equilibrium temperature (not surface)')).toBe(true);
    const g=CATALOG_GALAXIES.find(g => g.distanceReference===1)!;
    expect(catalogScience(g.id)!.facts!.some(f => f.value.includes('H0=70'))).toBe(true);
    const missing=CATALOG_PLANETS.find(p => p.radiusEarth===null);
    if (missing) expect(catalogScience(missing.id)!.facts!.find(f => f.label==='Radius (archive value)')?.value).toBe('Unknown');
  });
  it('links every destination to real metadata and resolves old deep-field URLs to the star atlas', () => {
    expect(new Set(DESTINATIONS.map(d => d.id)).size).toBe(DESTINATIONS.length);
    expect([...CATALOG_STARS,...CATALOG_PLANETS,...CATALOG_GALAXIES].every(r => catalogDestination(r.id)?.bodyId === r.id && catalogScience(r.id)?.realCatalog === true)).toBe(true);
    expect(destinationById('deep-field').id).toBe('nearby-stars');
  });
  it('uses host metadata at the center of an exoplanet system and a safe ordered planet layout', () => {
    const p=CATALOG_PLANETS.find(p => p.name==='TRAPPIST-1 e')!;
    const dest=catalogDestination(p.id)!;
    const bodies=flightBodies(dest.environment,dest);
    expect(bodies[0].id).toBe('host:TRAPPIST-1');
    expect(catalogScience(bodies[0].id)?.name).toBe('TRAPPIST-1');
    const layout=hostLayout('TRAPPIST-1');
    for (let i=1;i<layout.length;i++) expect(layout[i].orbit).toBeGreaterThan(layout[i-1].orbit);
  });
});
