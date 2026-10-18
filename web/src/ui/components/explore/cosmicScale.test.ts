import { describe, expect, it } from 'vitest';
import { GALACTIC_CENTER, GALACTIC_NORTH, GALAXY_VIEW_RANGE, LOCAL_GALAXIES, MILKY_WAY_VIEW_RANGE, UNITS_PER_PC, galaxyLayerOpacity, milkyWayOpacity, nearbyStarFade } from './cosmicScale';
import { LocalNavigation, localBand } from './localNavigation';
import { Vector3 } from 'three';
import { destinationById } from './destinations';

const still = { thrust: 0, strafe: 0, lift: 0, yaw: 0, pitch: 0, boost: false, brake: false };
const length = (p: number[]) => Math.hypot(...p);

describe('real-geometry cosmic scale', () => {
  it('puts the galactic center 8.18 kpc away and the pole on a unit vector', () => {
    expect(length(GALACTIC_CENTER) / UNITS_PER_PC).toBeCloseTo(8178, 0);
    expect(length(GALACTIC_NORTH)).toBeCloseTo(1, 9);
  });

  it('places Andromeda at its catalog distance', () => {
    const m31 = LOCAL_GALAXIES.find((g) => /Andromeda/.test(g.name))!;
    expect(length(m31.position) / UNITS_PER_PC / 1e6).toBeCloseTo(m31.distanceMpc, 6);
  });

  it('orders the zoom bands from planets out to galaxies', () => {
    expect([20, 600, 50000, MILKY_WAY_VIEW_RANGE, GALAXY_VIEW_RANGE].map(localBand)).toEqual(['planet', 'system', 'stars', 'milkyWay', 'galaxies']);
    expect(milkyWayOpacity(MILKY_WAY_VIEW_RANGE)).toBe(1);
    expect(galaxyLayerOpacity(MILKY_WAY_VIEW_RANGE)).toBe(0);
    expect(galaxyLayerOpacity(GALAXY_VIEW_RANGE)).toBe(1);
    expect(nearbyStarFade(50000)).toBe(1);
    expect(nearbyStarFade(MILKY_WAY_VIEW_RANGE)).toBe(0);
  });

  it('flies the Milky Way and galaxy presets all the way out and keeps the scene in depth range', () => {
    for (const [command, target, band] of [['milkyway', MILKY_WAY_VIEW_RANGE, 'milkyWay'], ['galaxies', GALAXY_VIEW_RANGE, 'galaxies']] as const) {
      const nav = new LocalNavigation();
      nav.setDestination(destinationById('sol'), true);
      nav.zoom(command);
      for (let i = 0; i < 400 && nav.zooming; i++) nav.step(.05, still, true);
      expect(nav.zooming).toBe(false);
      expect(nav.range / target).toBeCloseTo(1, 2);
      expect(nav.band).toBe(band);
      // Camera-relative scaling: the anchor stays within the camera's far plane (50,000).
      expect(nav.range * nav.renderScale).toBeLessThan(50_000);
    }
  });

  it('zooms from the nearby stars to the Milky Way without a jump, and back home again', () => {
    const nav = new LocalNavigation();
    nav.setDestination(destinationById('nearby-stars'), true);
    const homeFocus = nav.focusId;
    nav.zoom('milkyway');
    let last = nav.motion.position.clone(), worst = 0;
    for (let i = 0; i < 400 && nav.zooming; i++) {
      nav.step(1 / 60, still, true);
      const moved = nav.motion.position.distanceTo(last) / Math.max(1, nav.range);
      worst = Math.max(worst, moved);
      last = nav.motion.position.clone();
    }
    expect(nav.band).toBe('milkyWay');
    expect(nav.focusName).toBe('Milky Way');
    // Each frame moves the camera by well under its own distance from the pivot: a smooth dolly.
    expect(worst).toBeLessThan(.25);
    nav.zoom('stars');
    for (let i = 0; i < 600 && nav.zooming; i++) nav.step(1 / 60, still, true);
    expect(nav.band).toBe('stars');
    expect(new Vector3().distanceTo(nav.anchor)).toBeLessThan(1e-6);
    expect(nav.focusId === 'sun' || nav.focusId === homeFocus).toBe(true);
  });
});
