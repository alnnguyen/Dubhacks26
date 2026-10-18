import { describe, expect, it } from 'vitest';
import { destinationProfile, logPosition } from './destinationProfile';
import { destinationById, destinationForBody } from './destinations';
import { LOCAL_OBJECT_INDEX, STARLINKS, orbitalPeriodSeconds, satellitePositionAt } from './localObjects';
import { orbitClock } from './orbitClock';

describe('destination profiles use real catalog values', () => {
  it('describes the ISS from its orbital elements', () => {
    const p = destinationProfile(destinationById('visit-sat-25544'));
    expect(p.kind).toBe('spacecraft');
    expect(p.orbit!.altitudeKm).toBeGreaterThan(350);
    expect(p.orbit!.altitudeKm).toBeLessThan(450);
    expect(p.orbit!.periodMin).toBeGreaterThan(90);
    expect(p.orbit!.periodMin).toBeLessThan(94);
    expect(p.orbit!.inclinationDeg).toBeCloseTo(51.6, 0);
  });

  it('labels Starlink satellites as SpaceX with their shell inclination', () => {
    expect(STARLINKS.length).toBeGreaterThan(10);
    const p = destinationProfile(destinationForBody(STARLINKS[0].id)!);
    expect(p.kind).toBe('starlink');
    expect(p.badge).toBe('SpaceX Starlink');
    // These early v1.0 satellites are being lowered for disposal; the snapshot is honest about it.
    expect(p.orbit!.altitudeKm).toBeGreaterThan(200);
    expect(p.orbit!.altitudeKm).toBeLessThan(600);
    expect(p.orbit!.inclinationDeg).toBeCloseTo(53, 0);
  });

  it('places planets, stars and galaxies on their distance scales', () => {
    expect(destinationProfile(destinationById('visit-jupiter')).scale!.value).toBeCloseTo(5.2, 1);
    const sirius = destinationForBody('hyg-32263')!;
    expect(sirius.label).toBe('Sirius');
    expect(destinationProfile(sirius).scale!.value).toBeCloseTo(8.6, 0);
    expect(destinationProfile(destinationById('galaxy-atlas')).kind).toBe('region');
  });

  it('maps values onto a clamped log axis', () => {
    expect(logPosition(1, 1, 100)).toBe(0);
    expect(logPosition(10, 1, 100)).toBeCloseTo(.5);
    expect(logPosition(1e6, 1, 100)).toBe(1);
  });
});

describe('satellite time-lapse', () => {
  const iss = LOCAL_OBJECT_INDEX.get('sat-25544')!;

  it('starts at the snapshot position and returns after one period', () => {
    expect(satellitePositionAt(iss, 0)).toEqual(iss.position);
    const period = orbitalPeriodSeconds(iss);
    const half = satellitePositionAt(iss, period / 2), full = satellitePositionAt(iss, period);
    expect(Math.hypot(...half.map((v, i) => v - iss.position[i]))).toBeGreaterThan(1);
    full.forEach((v, i) => expect(v).toBeCloseTo(iss.position[i], 4));
  });

  it('does not advance while paused or held at a spacecraft', () => {
    orbitClock.reset();
    orbitClock.setRate(60);
    orbitClock.tick(.05);
    expect(orbitClock.seconds).toBeCloseTo(3);
    orbitClock.setHeld(true);
    orbitClock.tick(.05);
    expect(orbitClock.seconds).toBeCloseTo(3);
    orbitClock.setHeld(false);
    orbitClock.toggle();
    orbitClock.tick(.05);
    expect(orbitClock.seconds).toBeCloseTo(3);
    orbitClock.toggle();
    orbitClock.reset();
  });
});
