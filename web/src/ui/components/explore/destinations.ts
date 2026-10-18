import { LOCAL_OBJECT_DESTINATIONS } from './localObjects';
import { CATALOG_DESTINATIONS } from './catalog';
import { SOLAR_BODIES, bodyWorldPosition } from './bodies';
import type { Vec3 } from '../spaceship/CockpitBuilder';

export type ExploreEnvironment = 'solar' | 'mars-surface' | 'moon-orbit' | 'deep-field' | 'galaxy' | 'stars' | 'exoplanets' | 'galaxies';

export interface ExploreDestination {
  id: string;
  label: string;
  briefing: string;
  environment: ExploreEnvironment;
  /** Ship world spawn when arriving here. */
  spawn: Vec3;
  /** Initial yaw (rad) looking toward interesting content. */
  yaw: number;
  pitch?: number;
  bodyId?: string;
  category?: 'Solar system' | 'Stars' | 'Exoplanets' | 'Galaxies' | 'Satellites' | 'Asteroids' | 'Comets' | 'Spacecraft';
  host?: string;
}

/** Compressed solar-system home and hyperspace POIs. */
export const DESTINATIONS: ExploreDestination[] = [
  {
    id: 'sol',
    label: 'Sol system',
    briefing: 'Gameplay-scale solar system · real NASA-derived textures.',
    environment: 'solar',
    spawn: [98.877, 0.8, 37],
    yaw: 0,
    bodyId: 'earth',
  },
  {
    id: 'moon-orbit',
    label: 'Lunar orbit',
    briefing: 'Close pass of the Moon · CGI Moon Kit lineage textures.',
    environment: 'moon-orbit',
    spawn: [0, 1, 32],
    yaw: 0,
    bodyId: 'moon',
  },
  {
    id: 'mars-surface',
    label: 'Mars surface',
    briefing: 'Jezero-inspired landing zone · open full arena for duel terrain.',
    environment: 'mars-surface',
    spawn: [0, 12, 40],
    yaw: 0,
    bodyId: 'mars-surface',
  },
  {
    id: 'galaxy', label: 'Milky Way overview',
    briefing: 'Fly around an artistic galaxy model. The star layout is illustrative.',
    environment: 'galaxy', spawn: [0, 2100, 3400], yaw: 0, pitch: -0.55, bodyId: 'milky-way',
  },
  ...SOLAR_BODIES.map((body): ExploreDestination => {
    const [x, y, z] = bodyWorldPosition(body);
    return { id: `visit-${body.id}`, label: body.name, environment: 'solar', bodyId: body.id,
      briefing: `Visit ${body.name} and explore its science card.`,
      spawn: [x, y + body.radius * 0.15, z + Math.max(10, body.radius * 4)], yaw: 0 };
  }),
  { id: 'nearby-stars', label: 'Nearby star atlas', category: 'Stars', environment: 'stars', spawn: [0, 30, 110], yaw: 0, pitch: -0.15, briefing: '24,835 real HYG stars · solar neighborhood and named stars' },
  { id: 'galaxy-atlas', label: 'Galaxy atlas', category: 'Galaxies', environment: 'galaxies', spawn: [0, 35, 130], yaw: 0, pitch: -0.18, briefing: '1,034 published galaxies · GALEX Atlas / NASA-IPAC NED' },
  ...LOCAL_OBJECT_DESTINATIONS,
  ...CATALOG_DESTINATIONS,
];

const DESTINATION_INDEX = new Map(DESTINATIONS.map(d => [d.id,d]));

export function destinationById(id: string): ExploreDestination {
  return DESTINATION_INDEX.get(id === 'deep-field' ? 'nearby-stars' : id) ?? DESTINATIONS[0];
}

/** The flyable destination for a body/object ID, if one exists (no fallback to Earth). */
export function destinationForBody(bodyId: string): ExploreDestination | undefined {
  return DESTINATION_INDEX.get(`visit-${bodyId}`) ?? DESTINATION_INDEX.get(bodyId) ?? DESTINATIONS.find((d) => d.bodyId === bodyId);
}

/** Best destination whose name appears in free text, e.g. "take me to Saturn". Longest name wins. */
export function destinationInText(text: string): ExploreDestination | undefined {
  const q = ` ${text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ')} `;
  let best: ExploreDestination | undefined;
  for (const d of DESTINATIONS) {
    const name = d.label.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (name.length < 3 || !q.includes(` ${name} `)) continue;
    if (!best || name.length > best.label.length) best = d;
  }
  return best;
}
