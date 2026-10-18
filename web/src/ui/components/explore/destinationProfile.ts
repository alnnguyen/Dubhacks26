import { planetFacts, scienceForBodyId } from './bodiesScience';
import { GALAXY_INDEX, PC_TO_LY, PLANET_INDEX, STAR_INDEX } from './catalog';
import { LOCAL_OBJECT_INDEX, orbitalPeriodSeconds } from './localObjects';
import type { ExploreDestination } from './destinations';

export interface Metric { label: string; value: string; unit?: string }
export interface LogScale { label: string; unit: string; value: number; min: number; max: number; ticks: { label: string; value: number }[] }
export interface OrbitSketch { altitudeKm: number; inclinationDeg: number; periodMin: number }
export interface DestinationProfile {
  kind: 'spacecraft' | 'starlink' | 'dragon' | 'probe' | 'small-body' | 'planet' | 'moon' | 'star' | 'exoplanet' | 'galaxy' | 'region';
  badge: string;
  blurb: string;
  metrics: Metric[];
  scale?: LogScale;
  orbit?: OrbitSketch;
  source?: string;
}

const n = (v: number, digits = 1) => v.toLocaleString('en-US', { maximumFractionDigits: digits });
const AU_TICKS = [{ label: 'Earth', value: 1 }, { label: 'Jupiter', value: 5.2 }, { label: 'Neptune', value: 30.1 }];
const LY_TICKS = [{ label: 'Proxima', value: 4.25 }, { label: 'Sirius', value: 8.6 }, { label: 'Vega', value: 25 }, { label: 'Pleiades', value: 444 }];

/** Real, sourced numbers for the destination preview; nothing here is invented or sampled. */
export function destinationProfile(d: ExploreDestination): DestinationProfile {
  if (d.id === 'sol' || d.environment === 'galaxy' || d.id === 'nearby-stars' || d.id === 'galaxy-atlas') {
    return { kind: 'region', badge: d.category ?? 'Region · overview', blurb: d.briefing, metrics: [] };
  }
  const id = d.bodyId ?? d.id;
  const science = scienceForBodyId(id);
  const blurb = science?.blurb ?? d.briefing;
  const object = LOCAL_OBJECT_INDEX.get(id);
  if (object?.kind === 'satellite') {
    const altitudeKm = object.elements.a * (1 - object.elements.e) - 6371;
    const periodMin = orbitalPeriodSeconds(object) / 60;
    const starlink = object.name.startsWith('STARLINK');
    const badge = starlink ? 'SpaceX Starlink' : object.dockedTo ? 'SpaceX Dragon · docked at ISS' : object.launch ? `Launched on SpaceX ${object.launch.vehicle}` : 'Spacecraft';
    return {
      kind: starlink ? 'starlink' : object.dockedTo ? 'dragon' : 'spacecraft', badge, blurb,
      metrics: [
        { label: 'Perigee altitude', value: n(altitudeKm, 0), unit: 'km' },
        { label: 'Inclination', value: n(object.elements.i), unit: '°' },
        { label: 'Orbital period', value: n(periodMin), unit: 'min' },
        { label: 'Orbits per day', value: n(1440 / periodMin) },
      ],
      orbit: { altitudeKm, inclinationDeg: object.elements.i, periodMin },
      source: `${object.source} · epoch ${object.epoch}`,
    };
  }
  if (object?.kind === 'probe') {
    return {
      kind: 'probe', badge: `Launched on SpaceX ${object.launch?.vehicle} · ${object.launch?.operator}`, blurb,
      metrics: [
        { label: 'Launched', value: object.launch?.date ?? 'Not listed' },
        { label: 'Perihelion', value: n(object.elements.a * (1 - object.elements.e), 3), unit: 'AU' },
        { label: 'Aphelion', value: n(object.elements.a * (1 + object.elements.e), 3), unit: 'AU' },
        { label: 'Orbital period', value: n(Math.pow(object.elements.a, 1.5) * 365.25, 0), unit: 'days' /* Kepler: T(years) = a(AU)^1.5 */ },
      ],
      scale: { label: 'Average distance from the Sun', unit: 'AU', value: object.elements.a, min: .3, max: 100, ticks: AU_TICKS },
      source: `${object.source} · ${object.epoch}`,
    };
  }
  if (object) {
    return {
      kind: 'small-body', badge: object.kind === 'comet' ? 'Comet' : 'Asteroid', blurb,
      metrics: [
        { label: 'Semimajor axis', value: n(object.elements.a, 2), unit: 'AU' },
        { label: 'Eccentricity', value: n(object.elements.e, 3) },
        { label: 'Inclination', value: n(object.elements.i), unit: '°' },
      ],
      scale: { label: 'Average distance from the Sun', unit: 'AU', value: object.elements.a, min: .3, max: 100, ticks: AU_TICKS },
      source: object.source,
    };
  }
  const planet = planetFacts(id);
  if (planet) {
    const au = planet.distanceFromSun_1e6km ? planet.distanceFromSun_1e6km / 149.6 : null;
    return {
      kind: id === 'moon' ? 'moon' : 'planet', badge: id === 'moon' ? 'Moon' : `Planet · ${planet.type}`, blurb,
      metrics: [
        { label: 'Surface gravity', value: n(planet.gravity), unit: 'm/s²' },
        { label: 'Day length', value: n(Math.abs(planet.lengthOfDay_h), 1), unit: 'h' },
        { label: 'Moons', value: String(planet.moons) },
        { label: 'Mean temperature', value: n(planet.meanTemp_C, 0), unit: '°C' },
      ],
      scale: au ? { label: 'Distance from the Sun', unit: 'AU', value: au, min: .3, max: 100, ticks: AU_TICKS } : undefined,
      source: 'NASA Planetary Fact Sheet',
    };
  }
  const star = STAR_INDEX.get(id);
  if (star) {
    const ly = star.distancePc * PC_TO_LY;
    return {
      kind: 'star', badge: 'Star · HYG catalog', blurb,
      metrics: [
        { label: 'Distance', value: n(ly, ly < 100 ? 2 : 0), unit: 'ly' },
        { label: 'Spectral type', value: star.spectralType ?? 'Not listed' },
        { label: 'Apparent magnitude', value: star.magnitude == null ? 'Not listed' : n(star.magnitude, 2) },
      ],
      scale: { label: 'Distance from the Sun', unit: 'ly', value: ly, min: 1, max: 3000, ticks: LY_TICKS },
      source: 'HYG v4.1 star catalog',
    };
  }
  const exo = PLANET_INDEX.get(id);
  if (exo) {
    const ly = exo.distancePc * PC_TO_LY;
    return {
      kind: 'exoplanet', badge: `Exoplanet · ${exo.host}`, blurb,
      metrics: [
        { label: 'Distance', value: n(ly, 1), unit: 'ly' },
        { label: 'Radius', value: exo.radiusEarth == null ? 'Not measured' : n(exo.radiusEarth, 2), unit: exo.radiusEarth == null ? undefined : '× Earth' },
        { label: 'Orbital period', value: exo.periodDays == null ? 'Not listed' : n(exo.periodDays, 2), unit: exo.periodDays == null ? undefined : 'days' },
        { label: 'Discovered', value: exo.year ? `${exo.year}${exo.discovery ? ` · ${exo.discovery}` : ''}` : 'Not listed' },
      ],
      scale: { label: 'Distance from the Sun', unit: 'ly', value: ly, min: 1, max: 3000, ticks: LY_TICKS },
      source: 'NASA Exoplanet Archive',
    };
  }
  const galaxy = GALAXY_INDEX.get(id);
  if (galaxy) {
    const mly = galaxy.distanceMpc * PC_TO_LY;
    return {
      kind: 'galaxy', badge: `Galaxy${galaxy.morphology ? ` · ${galaxy.morphology}` : ''}`, blurb,
      metrics: [
        { label: 'Distance', value: n(mly, mly < 10 ? 2 : 0), unit: 'million ly' },
        { label: 'Distance method', value: galaxy.distanceMethod },
      ],
      scale: { label: 'Distance from the Milky Way', unit: 'Mly', value: mly, min: .1, max: 1000, ticks: [{ label: 'Andromeda', value: 2.5 }, { label: 'Virgo cluster', value: 54 }] },
      source: 'GALEX Atlas · NASA/IPAC NED',
    };
  }
  return { kind: 'region', badge: d.category ?? 'Region', blurb, metrics: [] };
}

/** 0..1 position on a log axis. */
export function logPosition(value: number, min: number, max: number) {
  const t = (Math.log10(value) - Math.log10(min)) / (Math.log10(max) - Math.log10(min));
  return Math.min(1, Math.max(0, t));
}
