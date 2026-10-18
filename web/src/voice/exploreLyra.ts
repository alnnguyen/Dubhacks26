import { planetFacts, scienceForBodyId, type BodyScience } from '../ui/components/explore/bodiesScience';
import { destinationForBody, destinationInText } from '../ui/components/explore/destinations';
import type { ScaleBand } from '../ui/components/explore/scaleLevels';
import type { ChallengePhase, NearbyPilot } from '../ui/state/lobbyTypes';

/**
 * LYRA's exploration "awareness". Everything here is local and deterministic: thoughts and
 * typed answers come from the bundled NASA / JPL / HYG / Exoplanet Archive snapshots, never
 * from a model. Grok Voice (when the server has a key) gets the same snapshot as a read-only tool.
 */

export interface ExploreSnapshot {
  nearestId: string;
  nearestName: string;
  nearestDistance: number;
  speed: number;
  boosting: boolean;
  scaleBand: ScaleBand;
  scaleLabel: string;
  destinationId: string;
  destinationLabel: string;
  inspectId: string | null;
  rivals: NearbyPilot[];
  challenge: ChallengePhase['kind'];
  challenger?: string;
}

export interface Thought {
  /** Dedupe key: the same thought is not repeated within a session. */
  key: string;
  text: string;
  /** Higher interrupts sooner. 2 = multiplayer, 1 = arrival/discovery, 0 = ambient. */
  priority: 0 | 1 | 2;
  action?: LyraAction;
}

export type LyraAction =
  | { kind: 'jump'; destinationId: string; label: string }
  | { kind: 'learn'; bodyId: string; label: string }
  | { kind: 'pilot'; pilotId: string; label: string };

export interface GuideReply {
  text: string;
  action?: LyraAction;
}

const fmt = (n: number, digits = 1) => n.toLocaleString('en-US', { maximumFractionDigits: digits });

/** Short spoken-style facts for one body, most interesting first. Empty when nothing is known. */
export function factsFor(bodyId: string): string[] {
  const planet = planetFacts(bodyId);
  if (planet) {
    const lines = [planet.funFact];
    lines.push(`${planet.name}'s surface gravity is ${fmt(planet.gravity)} m/s², ${fmt(planet.gravityVsEarth, 2)}× Earth's.`);
    if (Math.abs(planet.lengthOfDay_h) >= 1) lines.push(`One solar day on ${planet.name} lasts about ${fmt(planet.lengthOfDay_h, 0)} hours.`);
    if (planet.moons > 0) lines.push(`${planet.name} has ${planet.moons} known moon${planet.moons === 1 ? '' : 's'}${planet.rings ? ' and a ring system' : ''}.`);
    lines.push(`Mean temperature: about ${fmt(planet.meanTemp_C, 0)} °C. ${planet.atmosphere.summary}.`);
    return lines.filter(Boolean);
  }
  const science = scienceForBodyId(bodyId);
  return science ? scienceLines(science) : [];
}

function scienceLines(s: BodyScience): string[] {
  const lines = [s.blurb];
  for (const fact of s.facts ?? []) lines.push(`${fact.label}: ${fact.value}.`);
  if (s.gravityMps2 != null) lines.push(`Surface gravity there is about ${fmt(s.gravityMps2)} m/s².`);
  if (s.realCatalog === false || /illustrat|artistic|fictional/i.test(s.source)) lines.push('Heads up: this view is illustrative, not a measured catalog position.');
  return lines.filter(Boolean);
}

const BAND_LINES: Partial<Record<ScaleBand, string>> = {
  system: 'We just pulled out to system scale. Distances here are compressed so the planets stay findable — real orbits are far emptier.',
  catalogStars: 'Those points are real stars from the HYG catalog, placed at their measured directions and distances. Pick one and I’ll tell you about it.',
  localStars: 'Nearby stars are coming into view. The closest, Proxima Centauri, is about 4.2 light-years from the Sun.',
  milkyWay: 'That’s the Milky Way as an artistic model — the real disk is about 100,000 light-years across.',
  catalogGalaxies: 'You’re looking at galaxies from the GALEX Atlas. Each point is an entire galaxy.',
  exoSystem: 'This planetary system comes from the NASA Exoplanet Archive. The orbits are drawn for readability; published values are on each card.',
};

/** What LYRA would say about the change from `prev` to `next`, or null to stay quiet. */
export function noticeChange(prev: ExploreSnapshot | null, next: ExploreSnapshot, said: ReadonlySet<string>): Thought | null {
  const fresh = (t: Thought) => (said.has(t.key) ? null : t);

  if (next.challenge === 'incoming' && prev?.challenge !== 'incoming') {
    return { key: `incoming-${next.challenger}-${Date.now()}`, priority: 2, text: `Incoming challenge from ${next.challenger ?? 'a pilot'}! Accept and I’ll plot the jump to the Mars arena.` };
  }
  const prevRivals = new Set(prev?.rivals.filter((r) => r.location?.bodyId === prev.nearestId).map((r) => r.id));
  const rivalHere = next.rivals.find((r) => r.status === 'available' && r.location?.bodyId === next.nearestId && !prevRivals.has(r.id));
  if (rivalHere) {
    const t = fresh({ key: `rival-${rivalHere.id}-${next.nearestId}`, priority: 2, text: `${rivalHere.callsign} is flying near ${next.nearestName} with us. Want to challenge them?`, action: { kind: 'pilot', pilotId: rivalHere.id, label: `Challenge ${rivalHere.callsign}` } });
    if (t) return t;
  }
  if (next.inspectId && next.inspectId !== prev?.inspectId) {
    const planet = planetFacts(next.inspectId);
    if (planet) {
      const core = planet.interior.layers[0];
      const t = fresh({ key: `inspect-${planet.id}`, priority: 1, text: `Opening ${planet.name}’s archive. Try the Dissection tab — its innermost layer is the ${core.name.toLowerCase()} (${core.state}).` });
      if (t) return t;
    }
  }
  if (next.nearestId && next.nearestId !== prev?.nearestId && next.nearestName !== '—') {
    const line = factsFor(next.nearestId)[0];
    if (line) {
      const t = fresh({ key: `arrive-${next.nearestId}`, priority: 1, text: `${next.nearestName}. ${line}`, action: { kind: 'learn', bodyId: next.nearestId, label: `Learn about ${next.nearestName}` } });
      if (t) return t;
    }
  }
  if (prev && next.scaleBand !== prev.scaleBand && BAND_LINES[next.scaleBand]) {
    const t = fresh({ key: `band-${next.scaleBand}`, priority: 1, text: BAND_LINES[next.scaleBand]! });
    if (t) return t;
  }
  if (next.boosting && !prev?.boosting) {
    const t = fresh({ key: 'boost', priority: 0, text: 'Boost engaged. Ease off near planets — flight slows automatically so you can line up an approach.' });
    if (t) return t;
  }
  return null;
}

/** An ambient thought for when nothing has happened for a while. Cycles through facts, then tips. */
export function idleThought(snapshot: ExploreSnapshot, said: ReadonlySet<string>): Thought | null {
  const facts = factsFor(snapshot.nearestId);
  for (let i = 1; i < facts.length; i++) {
    const key = `fact-${snapshot.nearestId}-${i}`;
    if (!said.has(key)) return { key, priority: 0, text: facts[i] };
  }
  const elsewhere = snapshot.rivals.find((r) => r.status === 'available' && r.location && r.location.bodyId !== snapshot.nearestId);
  if (elsewhere?.location) {
    const dest = destinationForBody(elsewhere.location.bodyId);
    const key = `rival-far-${elsewhere.id}-${elsewhere.location.bodyId}`;
    if (!said.has(key)) {
      return { key, priority: 0, text: `${elsewhere.callsign} is out near ${elsewhere.location.label}.`, action: dest ? { kind: 'jump', destinationId: dest.id, label: `Fly to ${elsewhere.location.label}` } : undefined };
    }
  }
  const tips: Thought[] = [
    { key: 'tip-search', priority: 0, text: 'Press N to search 24,835 stars, 5,301 exoplanets and 1,034 galaxies. Try TRAPPIST-1 e.', action: { kind: 'jump', destinationId: 'exo-trappist-1-e', label: 'Jump to TRAPPIST-1 e' } },
    { key: 'tip-roadster', priority: 0, text: 'Fun one: the Tesla Roadster from the first Falcon Heavy is still orbiting the Sun, with Starman at the wheel. Its orbit here comes from NASA/JPL Horizons.', action: { kind: 'jump', destinationId: 'visit-sx-roadster', label: 'Fly to the Roadster' } },
    { key: 'tip-starlink', priority: 0, text: 'Those moving craft around Earth are real Starlink satellites from a dated CelesTrak snapshot, on a time-lapse. Open Destinations → SpaceX & ISS to fly up to one.', action: { kind: 'jump', destinationId: 'visit-sat-44768', label: 'Visit STARLINK-1063' } },
    { key: 'tip-zoom', priority: 0, text: 'Scroll outward fast and I’ll keep accelerating — all the way from Earth to the nearby stars.' },
    { key: 'tip-iss', priority: 0, text: 'The ISS is in our snapshot. Its orbit is dated, not live tracking, but it’s a fun flyby.', action: { kind: 'jump', destinationId: 'visit-sat-25544', label: 'Visit the ISS' } },
  ];
  return tips.find((t) => !said.has(t.key)) ?? null;
}

/** Typed / spoken questions answered from local data. Used in Demo, offline, or when Grok is unavailable. */
export function exploreGuideAnswer(question: string, snapshot: ExploreSnapshot): GuideReply {
  const q = question.toLowerCase();
  const named = destinationInText(question);
  const wantsTravel = /\b(take me|fly|go|jump|travel|head|visit|navigate|bring me)\b/.test(q);

  if (/\b(who|pilot|rival|player|opponent|fight|duel|challenge|anyone)\b/.test(q)) {
    const available = snapshot.rivals.filter((r) => r.status === 'available');
    if (!available.length) return { text: 'No other pilots are flying right now. When someone joins in Live mode, I’ll show their ship and where they are.' };
    const here = available.find((r) => r.location?.bodyId === snapshot.nearestId);
    if (here) return { text: `${here.callsign} is right here near ${snapshot.nearestName}.`, action: { kind: 'pilot', pilotId: here.id, label: `Challenge ${here.callsign}` } };
    const located = available.find((r) => r.location);
    const list = available.map((r) => (r.location ? `${r.callsign} near ${r.location.label}` : `${r.callsign} (location unknown)`)).join(', ');
    const dest = located?.location && destinationForBody(located.location.bodyId);
    return { text: `Pilots online: ${list}.`, action: dest && located ? { kind: 'jump', destinationId: dest.id, label: `Fly to ${located.location!.label}` } : undefined };
  }
  if (named && wantsTravel) return { text: `Plotting a course to ${named.label}. Confirm and I’ll jump us there.`, action: { kind: 'jump', destinationId: named.id, label: `Jump to ${named.label}` } };
  if (named) {
    const id = named.bodyId ?? named.id;
    const facts = factsFor(id);
    if (facts.length) return { text: `${named.label}: ${facts.slice(0, 2).join(' ')}`, action: { kind: 'jump', destinationId: named.id, label: `Jump to ${named.label}` } };
  }
  if (/\b(control|fly|steer|move|how do i|keys?|thrust)\b/.test(q)) {
    return { text: 'W and S thrust forward and back, arrows or drag to steer, Space stops, Shift boosts, N opens Destinations. Scroll to zoom out from planets to the stars.' };
  }
  if (/\b(where|what|this|here|fact|tell me|about|learn)\b/.test(q) && snapshot.nearestId) {
    const facts = factsFor(snapshot.nearestId);
    if (facts.length) return { text: `We’re near ${snapshot.nearestName}. ${facts.slice(0, 2).join(' ')}`, action: { kind: 'learn', bodyId: snapshot.nearestId, label: `Open ${snapshot.nearestName}` } };
  }
  if (/\b(real|data|source|accurate|nasa)\b/.test(q)) {
    return { text: 'Planet facts come from the NASA Planetary Fact Sheet, stars from HYG, exoplanets from the NASA Exoplanet Archive, galaxies from the GALEX Atlas, and small bodies from NASA/JPL. Distances in this view are compressed so everything stays reachable.' };
  }
  return { text: `I can tell you about anything we pass, find other pilots, or plot a course — try “take me to Saturn” or “what’s special about ${snapshot.nearestName !== '—' ? snapshot.nearestName : 'Mars'}?”` };
}

/** Read-only state given to Grok Voice's getExploreState tool. */
export function exploreToolState(snapshot: ExploreSnapshot) {
  return {
    mode: 'free-flight exploration',
    nearest: { id: snapshot.nearestId, name: snapshot.nearestName, distanceUnits: Math.round(snapshot.nearestDistance), facts: factsFor(snapshot.nearestId).slice(0, 5) },
    speedUnitsPerSecond: Math.round(snapshot.speed * 10) / 10,
    scale: snapshot.scaleLabel,
    destination: snapshot.destinationLabel,
    inspecting: snapshot.inspectId,
    otherPilots: snapshot.rivals.map((r) => ({ callsign: r.callsign, status: r.status, location: r.location?.label ?? null })),
    challenge: snapshot.challenge,
    note: 'Distances and sizes in the view are compressed for navigation. Facts come from bundled NASA/JPL/HYG/Exoplanet Archive/GALEX snapshots.',
  };
}

export const EXPLORE_INSTRUCTIONS = `The player is now in free-flight exploration of a real-data universe, not the cockpit lobby. Before answering anything about where they are, what they see, nearby objects or other pilots, call getExploreState and use only its facts; never invent coordinates, distances or pilots. Speak like an enthusiastic but precise ship guide in 1–3 short sentences. Controls: W/S thrust, arrows or drag steer, Space stops, Shift boosts, N opens Destinations search, scroll zooms between planet, system and star scales. To fight another pilot, open Pilot contacts (or click their ship) and press Challenge; the match then travels to the Mars arena. You cannot fly the ship, jump, or send challenges yourself. Say that view distances are compressed when relevant.`;
