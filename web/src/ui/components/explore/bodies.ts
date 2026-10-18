/** Compressed heliocentric layout (scene units, not AU). Earth orbit ~100. */

export interface BodyDef {
  id: string;
  name: string;
  /** Orbit radius from sun (0 = sun). */
  orbit: number;
  /** Orbital angle (rad) for static placement. */
  angle: number;
  radius: number;
  color: string;
  /** Optional equirect map under /textures/bodies/ or /textures/earth/. */
  map?: string;
  emissive?: string;
  emissiveIntensity?: number;
  spin: number;
  /** Atmosphere rim color; omit for airless. */
  atmosphere?: string;
  rings?: boolean;
}

export const SOLAR_BODIES: BodyDef[] = [
  {
    id: 'sun',
    name: 'Sun',
    orbit: 0,
    angle: 0,
    radius: 14,
    color: '#ffcc66',
    emissive: '#ffaa33',
    emissiveIntensity: 1.4,
    spin: 0.02,
  },
  {
    id: 'mercury',
    name: 'Mercury',
    orbit: 28,
    angle: 0.4,
    radius: 1.4,
    color: '#9a958c',
    map: '/textures/bodies/mercury_1k.jpg',
    spin: 0.08,
  },
  {
    id: 'venus',
    name: 'Venus',
    orbit: 42,
    angle: 1.8,
    radius: 2.4,
    color: '#c4a46a',
    map: '/textures/bodies/venus_1k.jpg',
    spin: 0.03,
    atmosphere: '#e8c98a',
  },
  {
    id: 'earth',
    name: 'Earth',
    orbit: 100,
    angle: 0.15,
    radius: 3.2,
    color: '#3a6ea5',
    map: 'earth-special',
    spin: 0.05,
    atmosphere: '#4a90ff',
  },
  {
    id: 'moon',
    name: 'Moon',
    orbit: 100,
    angle: 0.15,
    radius: 0.9,
    color: '#b0b0b0',
    map: '/textures/bodies/moon_1k.jpg',
    spin: 0.01,
  },
  {
    id: 'mars',
    name: 'Mars',
    orbit: 140,
    angle: -0.9,
    radius: 2.0,
    color: '#c1440e',
    map: '/textures/bodies/mars_1k.jpg',
    spin: 0.045,
    atmosphere: '#e07040',
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    orbit: 220,
    angle: 2.4,
    radius: 9.5,
    color: '#c9a882',
    map: '/textures/bodies/jupiter_1k.jpg',
    spin: 0.12,
    atmosphere: '#d4b896',
  },
  { id:'saturn', name:'Saturn', orbit:310, angle:-2.2, radius:8, color:'#d7bc87', spin:.1, atmosphere:'#e4d7b6', rings:true },
  { id:'uranus', name:'Uranus', orbit:410, angle:1.15, radius:5, color:'#9bdcde', spin:.06, atmosphere:'#b4eff1' },
  { id:'neptune', name:'Neptune', orbit:510, angle:-.3, radius:4.8, color:'#397bda', spin:.07, atmosphere:'#72a8ee' },
];

export function bodyWorldPosition(body: BodyDef): [number, number, number] {
  if (body.id === 'moon') {
    const earth = SOLAR_BODIES.find((b) => b.id === 'earth')!;
    const ex = Math.cos(earth.angle) * earth.orbit;
    const ez = Math.sin(earth.angle) * earth.orbit;
    const mx = Math.cos(earth.angle + 0.35) * 6;
    const mz = Math.sin(earth.angle + 0.35) * 6;
    return [ex + mx, 0.4, ez + mz];
  }
  if (body.orbit === 0) return [0, 0, 0];
  return [Math.cos(body.angle) * body.orbit, 0, Math.sin(body.angle) * body.orbit];
}

export function nearestBody(
  x: number,
  y: number,
  z: number,
  bodies: BodyDef[] = SOLAR_BODIES,
): { body: BodyDef; distance: number } | null {
  let best: { body: BodyDef; distance: number } | null = null;
  for (const body of bodies) {
    const [bx, by, bz] = bodyWorldPosition(body);
    const d = Math.hypot(x - bx, y - by, z - bz) - body.radius;
    if (!best || d < best.distance) best = { body, distance: Math.max(0, d) };
  }
  return best;
}
