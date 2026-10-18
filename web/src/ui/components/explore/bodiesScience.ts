import { catalogScience } from './catalog';
import { localObjectScience } from './localObjects';
import planetsFactsData from './data/planets-facts.json';

/**
 * NASA Planetary Fact Sheet (metric) — baked for in-flight “learn” cards.
 * Source: https://nssdc.gsfc.nasa.gov/planetary/factsheet/
 * Values rounded for UI; credit NASA NSSDCA.
 */

export interface PlanetInteriorLayer {
  name: string;
  outerRadiusFraction: number;
  color: string;
  state: string;
  note?: string;
}

export interface PlanetFacts {
  id: string;
  name: string;
  type: string;
  mass_1e24kg: number;
  radius_km: number;
  diameter_km: number;
  density_kgm3: number;
  gravity: number;
  gravityVsEarth: number;
  escapeVelocity: number;
  rotationPeriod_h: number;
  lengthOfDay_h: number;
  orbitalPeriod_d: number;
  distanceFromSun_1e6km: number | null;
  obliquity_deg: number;
  meanTemp_C: number;
  surfacePressure_bar: number | null;
  moons: number;
  rings: boolean;
  globalMagneticField: boolean;
  atmosphere: { summary: string; major: [string, number][] };
  interior: { layers: PlanetInteriorLayer[]; confidence: string; sources: string[] };
  funFact: string;
  duelFlightTimeMs: number;
  source: string;
}

const PLANET_FACTS_INDEX = new Map(
  (planetsFactsData.bodies as PlanetFacts[]).map((b) => [b.id, b]),
);

/** Rich inspect-panel facts (8 planets + Moon). Null for Sun and non-solar catalog IDs. */
export function planetFacts(id: string): PlanetFacts | null {
  return PLANET_FACTS_INDEX.get(id === 'mars-sky' ? 'mars' : id) ?? null;
}

export function planetFactsEarth(): PlanetFacts {
  return PLANET_FACTS_INDEX.get('earth')!;
}

export interface BodyScience {
  id: string;
  name: string;
  kind: 'star' | 'planet' | 'moon' | 'surface' | 'exo' | 'galaxy' | 'satellite' | 'asteroid' | 'comet' | 'probe';
  gravityMps2: number | null;
  escapeKmS: number | null;
  dayHours: number | null;
  meanTempC: number | null;
  distanceAu?: number | null;
  blurb: string;
  source: string;
  sourceUrl?: string;
  facts?: { label: string; value: string }[];
  realCatalog?: boolean;
  snapshot?: string;
}

export const BODIES_SCIENCE: Record<string, BodyScience> = {
  'milky-way': {
    id: 'milky-way', name: 'Milky Way', kind: 'galaxy', gravityMps2: null, escapeKmS: null,
    dayHours: null, meanTempC: null,
    blurb: 'Explore a spiral galaxy from above or fly toward its disk. This is an artistic model: its stars and spiral arms are procedural, and distances are compressed for exploration. Use Destinations to return to the solar system.',
    source: 'Artistic visualization · not a measured star catalog',
  },
  sun: {
    id: 'sun',
    name: 'Sun',
    kind: 'star',
    gravityMps2: 274,
    escapeKmS: 617.7,
    dayHours: 609.12,
    meanTempC: 5500,
    blurb: 'G-type star at the center of the system. Surface gravity ~274 m/s² (Fact Sheet / solar params).',
    source: 'NASA NSSDCA / solar physical parameters',
  },
  mercury: {
    id: 'mercury',
    name: 'Mercury',
    kind: 'planet',
    gravityMps2: 3.7,
    escapeKmS: 4.3,
    dayHours: 4222.6,
    meanTempC: 167,
    distanceAu: 0.39,
    blurb: 'Innermost planet. Gravity similar to Mars (~3.7 m/s²); a Mercurian day lasts ~176 Earth days.',
    source: 'NASA Planetary Fact Sheet',
  },
  venus: {
    id: 'venus',
    name: 'Venus',
    kind: 'planet',
    gravityMps2: 8.9,
    escapeKmS: 10.4,
    dayHours: 2802.0,
    meanTempC: 464,
    distanceAu: 0.72,
    blurb: 'Earth’s dense twin. Surface ~464 °C with a crushing CO₂ atmosphere; gravity 8.9 m/s².',
    source: 'NASA Planetary Fact Sheet',
  },
  earth: {
    id: 'earth',
    name: 'Earth',
    kind: 'planet',
    gravityMps2: 9.8,
    escapeKmS: 11.2,
    dayHours: 24.0,
    meanTempC: 15,
    distanceAu: 1.0,
    blurb: 'Home world. g = 9.8 m/s², escape 11.2 km/s — the reference for duel rock timing.',
    source: 'NASA Planetary Fact Sheet',
  },
  moon: {
    id: 'moon',
    name: 'Moon',
    kind: 'moon',
    gravityMps2: 1.6,
    escapeKmS: 2.4,
    dayHours: 708.7,
    meanTempC: -20,
    blurb: 'Earth’s satellite. Low gravity 1.6 m/s² stretches rock flight windows in arena duels.',
    source: 'NASA Planetary Fact Sheet',
  },
  mars: {
    id: 'mars',
    name: 'Mars',
    kind: 'planet',
    gravityMps2: 3.7,
    escapeKmS: 5.0,
    dayHours: 24.7,
    meanTempC: -65,
    distanceAu: 1.52,
    blurb: 'The Red Planet. g ≈ 3.7 m/s², thin atmosphere ~0.01 bar, mean temp about −65 °C.',
    source: 'NASA Planetary Fact Sheet',
  },
  jupiter: {
    id: 'jupiter',
    name: 'Jupiter',
    kind: 'planet',
    gravityMps2: 24.8,
    escapeKmS: 59.5,
    dayHours: 9.9,
    meanTempC: -110,
    distanceAu: 5.2,
    blurb: 'Gas giant. Gravity 24.8 m/s² and a ~10-hour day; bands are real storm systems.',
    source: 'NASA Planetary Fact Sheet',
  },
  saturn: {
    id:'saturn',name:'Saturn',kind:'planet',gravityMps2:10.4,escapeKmS:35.5,dayHours:10.7,meanTempC:-140,distanceAu:9.537,
    blurb:'Gas giant surrounded by rings made mostly of ice and rocky particles. The visible bands and rings here are procedural illustrations; sizes and orbit phase are designed for exploration.',source:'NASA Planetary Fact Sheet / NASA Science',sourceUrl:'https://science.nasa.gov/saturn/facts/',
  },
  uranus: {
    id:'uranus',name:'Uranus',kind:'planet',gravityMps2:8.7,escapeKmS:21.3,dayHours:17.2,meanTempC:-195,distanceAu:19.191,
    blurb:'An ice giant with a methane-tinted blue-green atmosphere and an extreme axial tilt. The color and layout here are illustrative.',source:'NASA Planetary Fact Sheet / NASA Science',sourceUrl:'https://science.nasa.gov/uranus/facts/',
  },
  neptune: {
    id:'neptune',name:'Neptune',kind:'planet',gravityMps2:11.2,escapeKmS:23.5,dayHours:16.1,meanTempC:-200,distanceAu:30.069,
    blurb:'The outermost major planet, an ice giant with a dynamic atmosphere. This blue globe is an illustrative rendering, not a live telescope view.',source:'NASA Planetary Fact Sheet / NASA Science',sourceUrl:'https://science.nasa.gov/neptune/neptune-facts/',
  },
  'mars-surface': {
    id: 'mars-surface',
    name: 'Mars surface',
    kind: 'surface',
    gravityMps2: 3.7,
    escapeKmS: 5.0,
    dayHours: 24.7,
    meanTempC: -65,
    blurb: 'Gameplay landing zone inspired by Jezero crater (Perseverance). Science numbers match Mars Fact Sheet.',
    source: 'NASA Planetary Fact Sheet · Mars Trek / Jezero context',
  },
  'exo-a': {
    id: 'exo-a',
    name: 'Kepler-proxy',
    kind: 'exo',
    gravityMps2: null,
    escapeKmS: null,
    dayHours: null,
    meanTempC: null,
    blurb: 'Placeholder deep-field world for hyperspace demos — not a catalogued exoplanet.',
    source: 'Fictional explore POI',
  },
  'exo-b': {
    id: 'exo-b',
    name: 'Gliese-proxy',
    kind: 'exo',
    gravityMps2: null,
    escapeKmS: null,
    dayHours: null,
    meanTempC: null,
    blurb: 'Placeholder deep-field world for hyperspace demos — not a catalogued exoplanet.',
    source: 'Fictional explore POI',
  },
};

export function scienceForBodyId(id: string): BodyScience | null {
  const key = id === 'mars-sky' ? 'mars' : id;
  return BODIES_SCIENCE[key] ?? localObjectScience(key) ?? catalogScience(key);
}
