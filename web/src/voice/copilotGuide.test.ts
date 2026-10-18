import { describe, expect, it } from 'vitest';
import { guideAnswer, recommendPilot } from './copilotGuide';
import type { LobbyViewModel, NearbyPilot } from '../ui/state/lobbyTypes';

const pilot = (id: string, wins = 0, losses = 0, status: NearbyPilot['status'] = 'available'): NearbyPilot => ({id, callsign: id, rank: 'Pilot', record: {wins, losses}, status, distanceM: 0, bearingDeg: 0, signal: 1});
const lobby = (nearby: NearbyPilot[], connection: LobbyViewModel['connection'] = 'online'): LobbyViewModel => ({
  self: pilot('SELF', 4, 4), nearby, connection, discoveryLabel: 'test', challenge: {kind: 'idle'},
  actions: {challenge() {}, cancelChallenge() {}, accept() {}, decline() {}, dismiss() {}, launch() {}, setCallsign() {}},
});

describe('local copilot guide', () => {
  it('does not recommend busy or away pilots and never mutates the roster', () => {
    const state = lobby([pilot('BUSY', 4, 4, 'in-duel'), pilot('AWAY', 4, 4, 'away'), pilot('VETERAN', 20, 1), pilot('PEER', 5, 5)]);
    const ids = state.nearby.map(p => p.id);
    expect(recommendPilot(state)?.id).toBe('PEER');
    expect(state.nearby.map(p => p.id)).toEqual(ids);
  });
  it('does not invent opponents when the live room is empty or offline', () => {
    expect(guideAnswer('Who should I challenge?', lobby([]), false).pilotId).toBeUndefined();
    expect(guideAnswer('Who should I challenge?', lobby([pilot('OLD')], 'offline'), false).pilotId).toBeUndefined();
  });
  it('labels simulated opponents and missing skill history honestly', () => {
    const answer = guideAnswer('Who should I challenge?', lobby([pilot('DEMO')]), true);
    expect(answer.text).toContain('simulated');
    expect(answer.text).toContain('no match history');
  });
  it('guides players through Radar and challenging a rival', () => {
    const answer = guideAnswer('Help me navigate the galaxy', lobby([]), false);
    expect(answer.radar).toBe(true);
    expect(answer.text).toContain('Open Radar');
    expect(answer.text).toContain('press Challenge');
  });
});
