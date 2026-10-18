import { describe, expect, it } from 'vitest';
import spacex from './data/spacex.json';
import { DOCKED_AT_ISS, LOCAL_OBJECT_INDEX, MODEL_SATELLITES, PROBES, displayRadius, satellitePositionAt } from './localObjects';
import { SOLAR_BODIES, bodyWorldPosition } from './bodies';
import { destinationForBody } from './destinations';
import { destinationProfile } from './destinationProfile';

const earth = bodyWorldPosition(SOLAR_BODIES.find((b) => b.id === 'earth')!);
const moon = bodyWorldPosition(SOLAR_BODIES.find((b) => b.id === 'moon')!);
const dist = (a: number[], b: number[]) => Math.hypot(...a.map((v, i) => v - b[i]));

describe('SpaceX snapshot', () => {
  it('records a checksum and retrieval time for every source', () => {
    expect(spacex.sources.length).toBeGreaterThanOrEqual(15);
    for (const s of spacex.sources) {
      expect(s.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(s.url.startsWith('https://')).toBe(true);
      expect(Number.isNaN(Date.parse(s.retrievedAt))).toBe(false);
    }
  });

  it('puts the Roadster on its JPL orbit (Kepler period matches Horizons)', () => {
    const roadster = LOCAL_OBJECT_INDEX.get('sx-roadster')!;
    const h = spacex.heliocentric.find((x) => x.id === 'sx-roadster')!;
    expect(roadster.kind).toBe('probe');
    expect(Math.pow(h.a, 1.5) * 365.25 / h.periodDays).toBeCloseTo(1, 2);
    expect(h.perihelionAu).toBeLessThan(1.05);
    expect(h.a * (1 + h.e)).toBeGreaterThan(1.5); // reaches beyond Mars's orbit
    expect(destinationProfile(destinationForBody('sx-roadster')!).badge).toMatch(/Falcon Heavy/);
    expect(PROBES.map((p) => p.id).sort()).toEqual(['sx-europa-clipper', 'sx-hera', 'sx-psyche', 'sx-roadster']);
  });

  it('keeps docked Dragons on the ISS through the time-lapse and off the separate model list', () => {
    expect(DOCKED_AT_ISS.length).toBe(spacex.dockedAtIss.length);
    const iss = LOCAL_OBJECT_INDEX.get('sat-25544')!;
    for (const dragon of DOCKED_AT_ISS) {
      expect(MODEL_SATELLITES).not.toContain(dragon);
      for (const t of [0, 1234, 5678]) expect(satellitePositionAt(dragon, t)).toEqual(satellitePositionAt(iss, t));
      expect(destinationProfile(destinationForBody(dragon.id)!).badge).toMatch(/docked at ISS/);
    }
  });

  it('shows TESS beyond the low-orbit shell but inside the Moon’s display distance', () => {
    const tess = LOCAL_OBJECT_INDEX.get('sat-43435')!;
    expect(displayRadius(6791)).toBeCloseTo(3.2 + (420 / 6371) * 16, 5); // ISS altitude formula unchanged
    const r = dist(tess.position, earth);
    expect(r).toBeGreaterThan(displayRadius(7000));
    expect(r).toBeLessThan(dist(moon, earth) + .5);
  });

  it('keeps fleet records honest: no placeholder boosters, flown vs planned Starship flights', () => {
    const real = spacex.boosters.filter((b) => b.serial_number && !/^Unknown/i.test(b.serial_number) && b.flights);
    expect(real.length).toBeGreaterThan(5);
    expect(real.every((b) => (b.flights ?? 0) > 0)).toBe(true);
    expect(spacex.starshipFlights.some((f) => f.status === 'TBD')).toBe(true);
    expect(spacex.note).toMatch(/Starshield payload orbits are not public/);
  });
});
