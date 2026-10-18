import { MathUtils } from 'three';
import { CATALOG_GALAXIES, equatorialPosition, type CatalogGalaxy } from './catalog';

/**
 * Real-geometry placement of the Milky Way and the galaxy atlas in the continuous local frame.
 * Same compression as the nearby-star bridge (1 pc = 10,000 scene units), so Earth → stars →
 * Milky Way → galaxies is one zoom. Directions and distances are real; the disk art is illustrative.
 */
export const UNITS_PER_PC = 10_000;
/** Sgr A* (ICRS) at ~8.18 kpc (GRAVITY Collaboration 2019). */
export const GALACTIC_CENTER = equatorialPosition(266.405, -28.936, 8178, UNITS_PER_PC);
/** North galactic pole (J2000): RA 192.859°, Dec 27.128°. */
export const GALACTIC_NORTH = ((): [number, number, number] => {
  const p = equatorialPosition(192.859, 27.128, 1, 1);
  const l = Math.hypot(...p);
  return [p[0] / l, p[1] / l, p[2] / l];
})();
/** Stellar disk drawn to ~15 kpc radius. */
export const MILKY_WAY_RADIUS = 15_000 * UNITS_PER_PC;
export function galaxyLocalPosition(g: CatalogGalaxy): [number, number, number] {
  return equatorialPosition(g.ra, g.dec, g.distanceMpc * 1e6, UNITS_PER_PC);
}
export const LOCAL_GALAXIES = CATALOG_GALAXIES.map((g) => ({ id: g.id, name: g.alias ?? g.name, position: galaxyLocalPosition(g), distanceMpc: g.distanceMpc }));

const log = (range: number) => Math.log10(Math.max(1, range));
/** The disk appears once you are well outside the nearby stars. */
export function milkyWayOpacity(range: number) { return MathUtils.smoothstep(log(range), 6.4, 7.6); }
/** Other galaxies appear once the Milky Way is a whole object in view. */
export function galaxyLayerOpacity(range: number) { return MathUtils.smoothstep(log(range), 8.7, 9.7); }
/** Nearby-star points fade away once the Milky Way takes over. */
export function nearbyStarFade(range: number) { return 1 - MathUtils.smoothstep(log(range), 6.8, 7.8); }

/** Scene units → a readable distance: units below ~10 pc, then light-years / thousands / millions. */
export function formatSceneDistance(units: number): { value: string; unit: string } {
  if (units < 1e5) return { value: Math.round(units).toLocaleString('en-US'), unit: 'u' };
  const ly = (units / UNITS_PER_PC) * 3.26156;
  if (ly < 1e3) return { value: ly.toFixed(ly < 100 ? 1 : 0), unit: 'ly' };
  if (ly < 1e6) return { value: (ly / 1e3).toFixed(ly < 1e4 ? 1 : 0), unit: 'thousand ly' };
  return { value: (ly / 1e6).toFixed(ly < 1e7 ? 1 : 0), unit: 'million ly' };
}

export const MILKY_WAY_VIEW_RANGE = 3.2e8;
export const GALAXY_VIEW_RANGE = 6e11;
