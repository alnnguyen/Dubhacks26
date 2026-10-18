import type { ExploreDestination } from './destinations';
import type { ExploreLocation } from '../../state/lobbyTypes';

const LOCATION_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

/** The coarse place other pilots see. Labels are trimmed to what the server accepts. */
export function exploreLocation(nearestId: string, nearestName: string, destination: ExploreDestination): ExploreLocation | null {
  const bodyId = LOCATION_ID.test(nearestId) ? nearestId : destination.bodyId && LOCATION_ID.test(destination.bodyId) ? destination.bodyId : destination.id;
  const raw = LOCATION_ID.test(nearestId) && nearestName !== '—' ? nearestName : destination.label;
  const label = raw.replace(/[^\p{L}\p{N}\p{Pd} .,'()+/·*]/gu, '').replace(/^[^\p{L}\p{N}]+/u, '').replace(/\s+/g, ' ').trim().slice(0, 48);
  return LOCATION_ID.test(bodyId) && label ? { bodyId, label } : null;
}

export function sameLocation(a: ExploreLocation | null, b: ExploreLocation | null) {
  return a?.bodyId === b?.bodyId && a?.label === b?.label;
}
