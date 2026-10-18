import { SOLAR_BODIES, bodyWorldPosition } from './bodies';
import { LOCAL_OBJECT_INDEX, livePosition } from './localObjects';
import { localStarPosition } from './localNavigation';

/** Display radius of each spacecraft model (span × display scale ÷ 2). */
const CRAFT_RADIUS: Record<string, number> = { 'sat-25544': 1.4, 'sat-20580': .8, 'sat-43435': .7, 'sx-roadster': .6, 'sx-europa-clipper': .7, 'sx-psyche': .7, 'sx-hera': .6 };

/**
 * Where the camera can fly to frame an object beside the side panel, in the continuous local frame.
 * Galaxies and far catalog layers return null: they open the panel without moving the ship.
 */
export function inspectTarget(id: string): { id: string; name: string; position: [number, number, number]; radius: number } | null {
  const body = SOLAR_BODIES.find((b) => b.id === id);
  if (body) return { id, name: body.name, position: bodyWorldPosition(body), radius: body.radius };
  const object = LOCAL_OBJECT_INDEX.get(id);
  if (object) {
    // Docked craft are framed with their host station.
    const radius = object.dockedTo ? 1.6 : CRAFT_RADIUS[id] ?? (object.kind === 'satellite' ? .65 : Math.max(object.radius, .5));
    return { id, name: object.name, position: livePosition(id) ?? object.position, radius };
  }
  const star = localStarPosition(id);
  if (star) return { id, name: id, position: star, radius: 14 };
  return null;
}
