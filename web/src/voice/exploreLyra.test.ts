import { describe, expect, it } from 'vitest';
import { exploreGuideAnswer, exploreToolState, factsFor, idleThought, noticeChange, type ExploreSnapshot } from './exploreLyra';
import { destinationForBody, destinationInText } from '../ui/components/explore/destinations';
import { exploreLocation } from '../ui/components/explore/pilotLocation';
import type { NearbyPilot } from '../ui/state/lobbyTypes';

const rival = (id: string, callsign: string, bodyId?: string, label?: string): NearbyPilot => ({
  id, callsign, rank: 'Pilot', record: { wins: 0, losses: 0 }, status: 'available', distanceM: 4, bearingDeg: 0, signal: 1,
  ...(bodyId ? { location: { bodyId, label: label ?? bodyId } } : {}),
});

const base: ExploreSnapshot = {
  nearestId: 'earth', nearestName: 'Earth', nearestDistance: 20, speed: 0, boosting: false,
  scaleBand: 'planet', scaleLabel: 'Near Earth', destinationId: 'sol', destinationLabel: 'Sol system',
  inspectId: null, rivals: [], challenge: 'idle',
};

describe('LYRA exploration awareness', () => {
  it('knows real facts about planets and catalog objects', () => {
    expect(factsFor('jupiter').join(' ')).toMatch(/gravity is 23\.1 m\/s²/);
    expect(factsFor('saturn').join(' ')).toMatch(/ring system/);
    expect(factsFor('not-a-body')).toEqual([]);
  });

  it('comments on arriving somewhere new, once', () => {
    const said = new Set<string>();
    const arrive = noticeChange(base, { ...base, nearestId: 'mars', nearestName: 'Mars' }, said)!;
    expect(arrive.text).toMatch(/^Mars\. /);
    expect(arrive.action).toEqual({ kind: 'learn', bodyId: 'mars', label: 'Learn about Mars' });
    said.add(arrive.key);
    expect(noticeChange(base, { ...base, nearestId: 'mars', nearestName: 'Mars' }, said)).toBeNull();
  });

  it('notices scale changes and stays quiet when nothing changes', () => {
    expect(noticeChange(base, base, new Set())).toBeNull();
    expect(noticeChange(base, { ...base, scaleBand: 'catalogStars' }, new Set())?.text).toMatch(/HYG/);
  });

  it('puts multiplayer first: a rival at the same body or an incoming challenge', () => {
    const here = noticeChange(base, { ...base, rivals: [rival('p1', 'NOVA', 'earth', 'Earth')] }, new Set())!;
    expect(here.priority).toBe(2);
    expect(here.action).toEqual({ kind: 'pilot', pilotId: 'p1', label: 'Challenge NOVA' });
    const incoming = noticeChange(base, { ...base, challenge: 'incoming', challenger: 'VEX' }, new Set())!;
    expect(incoming.text).toMatch(/VEX/);
  });

  it('fills quiet moments with more facts, then distant rivals, then tips', () => {
    const said = new Set<string>();
    const first = idleThought(base, said)!;
    expect(first.key).toBe('fact-earth-1');
    for (let i = 1; i < factsFor('earth').length; i++) said.add(`fact-earth-${i}`);
    const far = idleThought({ ...base, rivals: [rival('p2', 'ORBIT', 'jupiter', 'Jupiter')] }, said)!;
    expect(far.text).toMatch(/ORBIT is out near Jupiter/);
    expect(far.action).toMatchObject({ kind: 'jump', destinationId: 'visit-jupiter' });
  });
});

describe('LYRA local guide answers', () => {
  it('plots a course to a named place but never jumps by itself', () => {
    const answer = exploreGuideAnswer('take me to Saturn', base);
    expect(answer.action).toEqual({ kind: 'jump', destinationId: 'visit-saturn', label: 'Jump to Saturn' });
  });

  it('explains where you are from bundled data', () => {
    expect(exploreGuideAnswer('what are we looking at?', { ...base, nearestId: 'jupiter', nearestName: 'Jupiter' }).text).toMatch(/near Jupiter/);
  });

  it('finds other pilots from the live roster', () => {
    expect(exploreGuideAnswer('who else is flying?', base).text).toMatch(/No other pilots/);
    const answer = exploreGuideAnswer('who else is flying?', { ...base, rivals: [rival('p3', 'KESTREL', 'mars', 'Mars')] });
    expect(answer.text).toMatch(/KESTREL near Mars/);
    expect(answer.action).toMatchObject({ kind: 'jump', destinationId: 'visit-mars' });
  });

  it('gives Grok only read-only, labeled state', () => {
    const state = exploreToolState({ ...base, rivals: [rival('p4', 'LYNX', 'moon', 'Moon')] });
    expect(state.otherPilots).toEqual([{ callsign: 'LYNX', status: 'available', location: 'Moon' }]);
    expect(state.note).toMatch(/compressed/);
    expect(JSON.stringify(state)).not.toContain('p4');
  });
});

describe('destination and location helpers', () => {
  it('maps bodies and free text to destinations without falling back to Earth', () => {
    expect(destinationForBody('jupiter')?.id).toBe('visit-jupiter');
    expect(destinationForBody('nowhere')).toBeUndefined();
    expect(destinationInText('fly me to TRAPPIST-1 e please')?.id).toBe('exo-trappist-1-e');
    expect(destinationInText('hello there')).toBeUndefined();
  });

  it('reports a server-safe coarse location', () => {
    const sol = destinationForBody('earth')!;
    expect(exploreLocation('jupiter', 'Jupiter', sol)).toEqual({ bodyId: 'jupiter', label: 'Jupiter' });
    expect(exploreLocation('—', '—', sol)).toEqual({ bodyId: 'earth', label: 'Earth' });
    expect(exploreLocation('a2000101955', '(101955) Bennu', sol)).toEqual({ bodyId: 'a2000101955', label: '101955) Bennu' });
  });
});
