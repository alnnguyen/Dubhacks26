import starData from './data/stars.json';
import planetData from './data/exoplanets.json';
import galaxyData from './data/galaxies.json';
import manifest from './data/manifest.json';
import type { ExploreDestination } from './destinations';
import type { BodyScience } from './bodiesScience';

export interface CatalogStar { id: string; name: string; named: boolean; ra: number; dec: number; distancePc: number; magnitude: number | null; spectralType: string | null; hip: string | null }
export interface CatalogPlanet {
  id: string; name: string; host: string; ra: number; dec: number; distancePc: number;
  distanceErrorPlusPc: number | null; distanceErrorMinusPc: number | null;
  radiusEarth: number | null; radiusLimit: number | null; massEarth: number | null; massLimit: number | null; massType: string | null;
  periodDays: number | null; orbitAu: number | null; equilibriumK: number | null;
  discovery: string | null; year: number | null; starTemperatureK: number | null; starRadiusSolar: number | null;
}
export interface CatalogGalaxy { id: string; name: string; alias: string | null; ra: number; dec: number; distanceMpc: number; distanceReference: number; distanceMethod: string; morphology: string | null; majorArcmin: number | null; minorArcmin: number | null }
const numberFormatters = new Map<number, Intl.NumberFormat>();

export const CATALOG_STARS: CatalogStar[] = starData;
export const CATALOG_PLANETS: CatalogPlanet[] = planetData;
export const CATALOG_GALAXIES: CatalogGalaxy[] = galaxyData;
export const CATALOG_MANIFEST = manifest;
export const PC_TO_LY = 3.26156;
export type CatalogFrame = 'stars' | 'galaxies';
export const FRAME_UNITS = { stars: 10, galaxies: 50 } as const; // scene units per pc / Mpc
export const STAR_INDEX = new Map(CATALOG_STARS.map(s => [s.id, s]));
export const PLANET_INDEX = new Map(CATALOG_PLANETS.map(s => [s.id, s]));
export const GALAXY_INDEX = new Map(CATALOG_GALAXIES.map(s => [s.id, s]));
export const HOST_PLANETS = new Map<string, CatalogPlanet[]>();
for (const planet of CATALOG_PLANETS) {
  const existing = HOST_PLANETS.get(planet.host);
  if (existing) existing.push(planet); else HOST_PLANETS.set(planet.host, [planet]);
}
export const CATALOG_HOSTS = [...HOST_PLANETS.values()].map(p => p[0]);
export function equatorialPosition(raDeg: number, decDeg: number, distance: number, units: number): [number, number, number] {
  const ra = raDeg * Math.PI / 180, dec = decDeg * Math.PI / 180;
  const r = distance * units;
  // ICRS/J2000 equatorial axes: +X=RA 0, +Y=north, -Z=RA 90. Common to both catalog layers.
  return [r * Math.cos(dec) * Math.cos(ra), r * Math.sin(dec), -r * Math.cos(dec) * Math.sin(ra)];
}
export function starPosition(star: CatalogStar | CatalogPlanet) { return equatorialPosition(star.ra, star.dec, star.distancePc, FRAME_UNITS.stars); }
export function galaxyPosition(galaxy: CatalogGalaxy) { return equatorialPosition(galaxy.ra, galaxy.dec, galaxy.distanceMpc, FRAME_UNITS.galaxies); }
export function formatNumber(n: number, digits = 2) {
  let formatter = numberFormatters.get(digits);
  if (!formatter) { formatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }); numberFormatters.set(digits, formatter); }
  return formatter.format(n);
}
export function distanceText(pc: number) { return `${formatNumber(pc * PC_TO_LY)} light-years`; }
export function hostLayout(host: string) {
  const planets = [...(HOST_PLANETS.get(host) ?? [])].sort((a,b) => (a.orbitAu ?? a.periodDays ?? Infinity) - (b.orbitAu ?? b.periodDays ?? Infinity));
  return planets.map((planet, i) => {
    // Ordered display layout. Source AU values remain in the card; phases are authored, not ephemerides.
    const orbit = 10 + i * 7 + (planet.orbitAu ? Math.log1p(planet.orbitAu) * 6 : 0);
    const angle = i * 2.4;
    return { planet, position: [Math.cos(angle) * orbit, 0, Math.sin(angle) * orbit] as [number, number, number], orbit, radius: Math.max(0.55, Math.min(2.6, (planet.radiusEarth ?? 1) * 0.35)) };
  });
}
export function catalogDestination(id: string): ExploreDestination | null {
  const star = STAR_INDEX.get(id);
  if (star) { const p = starPosition(star); return { id, label: star.name, bodyId: id, category: 'Stars', environment: 'stars', spawn: [p[0], p[1]+1, p[2]+14], yaw: 0, pitch: -0.07, briefing: `${distanceText(star.distancePc)} · HYG catalog star` }; }
  const galaxy = GALAXY_INDEX.get(id);
  if (galaxy) { const p = galaxyPosition(galaxy); return { id, label: galaxy.alias ?? galaxy.name, bodyId: id, category: 'Galaxies', environment: 'galaxies', spawn: [p[0],p[1]+10,p[2]+60], yaw: 0, pitch: -0.16, briefing: `${formatNumber(galaxy.distanceMpc)} Mpc · ${galaxy.name} · published distance estimate` }; }
  const planet = PLANET_INDEX.get(id);
  if (planet) {
    const item = hostLayout(planet.host).find(p => p.planet.id === id)!;
    return { id, label: planet.name, bodyId: id, host: planet.host, category: 'Exoplanets', environment: 'exoplanets', spawn: [item.position[0],1.2,item.position[2]+12], yaw: 0, pitch: -0.1, briefing: `${distanceText(planet.distancePc)} · ${planet.host} system · NASA archive` };
  }
  return null;
}
export const CATALOG_DESTINATIONS: ExploreDestination[] = [
  ...CATALOG_STARS.filter(s => s.named).map(s => catalogDestination(s.id)!),
  ...CATALOG_PLANETS.map(s => catalogDestination(s.id)!),
  ...CATALOG_GALAXIES.map(s => catalogDestination(s.id)!),
  ...CATALOG_STARS.filter(s => !s.named).map(s => catalogDestination(s.id)!),
];
const scienceCache = new Map<string, BodyScience>();
export function catalogScience(id: string): BodyScience | null {
  if (scienceCache.has(id)) return scienceCache.get(id)!;
  const hostPlanet = id.startsWith('host:') ? HOST_PLANETS.get(id.slice(5))?.[0] : null;
  const star = STAR_INDEX.get(id), planet = PLANET_INDEX.get(id), galaxy = GALAXY_INDEX.get(id);
  if (!star && !planet && !galaxy && !hostPlanet) return null;
  const facts: { label: string; value: string }[] = [];
  const add = (label: string, value: string | null | undefined) => { if (value) facts.push({ label, value }); };
  const base = { id, gravityMps2: null, escapeKmS: null, dayHours: null, meanTempC: null, facts, realCatalog: true, snapshot: manifest.sources[0].retrievedAt.slice(0,10) };
  let result: BodyScience;
  if (hostPlanet) {
    add('System distance', distanceText(hostPlanet.distancePc));
    add('Confirmed planets in this snapshot', String(HOST_PLANETS.get(hostPlanet.host)?.length ?? 0));
    add('Stellar temperature (archive)', hostPlanet.starTemperatureK != null ? `${formatNumber(hostPlanet.starTemperatureK)} K` : null);
    add('Stellar radius (archive)', hostPlanet.starRadiusSolar != null ? `${formatNumber(hostPlanet.starRadiusSolar,3)} × Sun` : null);
    result = { ...base, name: hostPlanet.host, kind: 'star', source: 'NASA Exoplanet Archive · PSCompPars host parameters', sourceUrl: `https://exoplanetarchive.ipac.caltech.edu/overview/${encodeURIComponent(hostPlanet.host)}`,
      blurb: 'Host star of the confirmed planets listed below. The system uses sourced parameters with illustrative spacing, sizes and phases. Missing values remain unknown.' };
  } else if (star) {
    add('Distance from Sun', `${distanceText(star.distancePc)} (${formatNumber(star.distancePc)} pc)`);
    add('Spectral type', star.spectralType);
    add('Apparent magnitude', star.magnitude != null ? formatNumber(star.magnitude) : null);
    add('Right ascension / declination', `${formatNumber(star.ra,5)}° / ${formatNumber(star.dec,5)}°`);
    result = { ...base, name: star.name, kind: 'star', source: 'HYG v4.1 · David Nash / Astronexus · CC BY-SA 4.0', sourceUrl: 'https://github.com/astronexus/HYG-Database',
      blurb: 'A real catalog star placed using its source direction and distance. HYG combines astronomical catalogs; distances are estimates and positions are a static snapshot. Marker sizes and colors are illustrative. The atlas and continuous local view use different rendering scales; the local bridge is visually compressed.' };
  } else if (planet) {
    add('Host star', planet.host); add('System distance', distanceText(planet.distancePc));
    const limit = (n: number | null) => n === 1 ? '> ' : n === -1 ? '< ' : '';
    add('Radius (archive value)', planet.radiusEarth != null ? `${limit(planet.radiusLimit)}${formatNumber(planet.radiusEarth,3)} × Earth` : 'Unknown');
    add(planet.massType === 'Msini' ? 'Minimum mass (M sin i)' : 'Mass (archive value)', planet.massEarth != null ? `${limit(planet.massLimit)}${formatNumber(planet.massEarth,3)} × Earth` : 'Unknown');
    add('Orbital period', planet.periodDays != null ? `${formatNumber(planet.periodDays,4)} days` : 'Unknown');
    add('Semi-major axis', planet.orbitAu != null ? `${formatNumber(planet.orbitAu,5)} AU` : 'Unknown');
    add('Equilibrium temperature (not surface)', planet.equilibriumK != null ? `${formatNumber(planet.equilibriumK)} K` : null);
    add('Discovery', `${planet.discovery ?? 'Unknown method'}${planet.year ? ' · '+planet.year : ''}`);
    add('Distance uncertainty', planet.distanceErrorPlusPc != null && planet.distanceErrorMinusPc != null ? `+${formatNumber(planet.distanceErrorPlusPc,4)} / ${formatNumber(planet.distanceErrorMinusPc,4)} pc` : null);
    result = { ...base, name: planet.name, kind: 'exo', source: 'NASA Exoplanet Archive · Planetary Systems Composite Parameters', sourceUrl: `https://exoplanetarchive.ipac.caltech.edu/overview/${encodeURIComponent(planet.host)}`,
      blurb: `Confirmed catalog planet in the ${planet.host} system. Explore its sibling planets using the system list. Archive values can combine publications and estimates. Planet appearances, spacing and orbital phases are illustrative; this is not a reconstructed photograph or current orbital solution.` };
  } else {
    const g = galaxy!;
    add('Catalog identifier', g.name); add('Published distance', `${formatNumber(g.distanceMpc)} Mpc · ${formatNumber(g.distanceMpc * PC_TO_LY)} million light-years`);
    add('Distance method', g.distanceMethod); add('Morphological classification', g.morphology);
    add('Angular major axis', g.majorArcmin != null ? `${formatNumber(g.majorArcmin)} arcmin` : null);
    add('J2000 RA / declination', `${formatNumber(g.ra,5)}° / ${formatNumber(g.dec,5)}°`);
    result = { ...base, name: g.alias ?? g.name, kind: 'galaxy', source: 'Gil de Paz et al., GALEX Ultraviolet Atlas · Table 1 · NASA/IPAC NED', sourceUrl: 'https://ned.ipac.caltech.edu/level5/GALEX_Atlas/Gildepaz2.html',
      blurb: 'A published galaxy in the GALEX Atlas sample, positioned by its table coordinates and distance estimate. This archival, selection-limited sample is not a complete map of the universe. Distances are uncertain; many are velocity-derived. Galaxy glyphs are artistic, with exaggerated sizes. This map uses 50 scene units per Mpc.' };
  }
  scienceCache.set(id,result); return result;
}
