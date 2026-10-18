import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadPilotIdentity, savePilotCallsign } from '../../app/pilotIdentity';
import type { ChallengePhase, ConnectionStatus, LobbyViewModel, NearbyPilot, PilotProfile } from './lobbyTypes';

/**
 * Local-only mock of the lobby. No network calls, no endpoints.
 * Replace with a real adapter from web/src/lobby + web/src/networking when ready.
 */

export const MOCK_SELF: PilotProfile = {
  id: 'self',
  callsign: 'STARHAWK',
  shipName: 'Quiet Lance',
  accent: 'cyan',
  rank: 'Knight',
  record: { wins: 12, losses: 5 },
};

function selfFromStorage(): PilotProfile {
  const saved = loadPilotIdentity();
  if (!saved) return MOCK_SELF;
  return {
    ...MOCK_SELF,
    callsign: saved.callsign,
    shipName: saved.shipName,
    accent: saved.accent,
  };
}

/** `declines` marks pilots that will reject an outgoing challenge in the mock. */
type MockPilot = NearbyPilot & { declines?: boolean };

export const MOCK_NEARBY: MockPilot[] = [
  { id: 'p-nova', callsign: 'NOVA-7', rank: 'Knight', record: { wins: 9, losses: 4 }, status: 'available', distanceM: 4, bearingDeg: 35, signal: 0.94, location: { bodyId: 'jupiter', label: 'Jupiter' } },
  { id: 'p-vex', callsign: 'VEX', rank: 'Padawan', record: { wins: 3, losses: 6 }, status: 'available', distanceM: 9, bearingDeg: 145, signal: 0.78, location: { bodyId: 'mars', label: 'Mars' } },
  { id: 'p-kestrel', callsign: 'KESTREL', rank: 'Master', record: { wins: 31, losses: 7 }, status: 'in-duel', distanceM: 14, bearingDeg: 238, signal: 0.61 },
  { id: 'p-orbit', callsign: 'ORBIT', rank: 'Padawan', record: { wins: 1, losses: 2 }, status: 'available', distanceM: 21, bearingDeg: 310, signal: 0.42, location: { bodyId: 'moon', label: 'Moon' }, declines: true },
];

const T = {
  connect: 1600,
  firstIncoming: 14000,
  opponentResponse: 3200,
  syncToReady: 2000,
  declinedDismiss: 3200,
};

export interface MockLobbyDev {
  simulateIncoming: () => void;
  setOffline: (offline: boolean) => void;
}

export function useMockLobby(opts: { enabled?: boolean } = {}) {
  const enabled = opts.enabled ?? true;
  const [self, setSelf] = useState<PilotProfile>(selfFromStorage);
  const [connection, setConnection] = useState<ConnectionStatus>('connecting');
  const [challenge, setChallenge] = useState<ChallengePhase>({ kind: 'idle' });
  const autoIncomingDone = useRef(false);

  const nearby = useMemo<NearbyPilot[]>(() => (connection === 'online' ? MOCK_NEARBY : []), [connection]);

  // Simulated connect.
  useEffect(() => {
    if (!enabled || connection !== 'connecting') return;
    const id = setTimeout(() => setConnection('online'), T.connect);
    return () => clearTimeout(id);
  }, [enabled, connection]);

  const simulateIncoming = useCallback(() => {
    setChallenge((c) => (c.kind === 'idle' || c.kind === 'declined' ? { kind: 'incoming', opponent: MOCK_NEARBY[1] } : c));
  }, []);

  // One automatic incoming challenge to showcase the flow.
  useEffect(() => {
    if (!enabled || connection !== 'online' || autoIncomingDone.current) return;
    const id = setTimeout(() => {
      autoIncomingDone.current = true;
      simulateIncoming();
    }, T.firstIncoming);
    return () => clearTimeout(id);
  }, [enabled, connection, simulateIncoming]);

  // Phase timers.
  useEffect(() => {
    if (!enabled) return;
    let id: ReturnType<typeof setTimeout> | undefined;
    if (challenge.kind === 'outgoing') {
      const opp = challenge.opponent as MockPilot;
      id = setTimeout(() => {
        setChallenge(opp.declines ? { kind: 'declined', opponent: opp, by: 'opponent' } : { kind: 'accepted', opponent: opp, initiatedBy: 'self' });
      }, T.opponentResponse);
    } else if (challenge.kind === 'accepted') {
      id = setTimeout(() => setChallenge({ kind: 'ready', opponent: challenge.opponent }), T.syncToReady);
    } else if (challenge.kind === 'declined') {
      id = setTimeout(() => setChallenge({ kind: 'idle' }), T.declinedDismiss);
    }
    return () => clearTimeout(id);
  }, [enabled, challenge]);

  const actions = useMemo<LobbyViewModel['actions']>(
    () => ({
      challenge: (pilotId) => {
        const opp = MOCK_NEARBY.find((p) => p.id === pilotId);
        if (!opp || opp.status !== 'available') return;
        setChallenge((c) => (c.kind === 'idle' || c.kind === 'declined' ? { kind: 'outgoing', opponent: opp } : c));
      },
      cancelChallenge: () => setChallenge((c) => (c.kind === 'outgoing' ? { kind: 'idle' } : c)),
      accept: () => setChallenge((c) => (c.kind === 'incoming' ? { kind: 'accepted', opponent: c.opponent, initiatedBy: 'opponent' } : c)),
      decline: () => setChallenge((c) => (c.kind === 'incoming' ? { kind: 'idle' } : c)),
      dismiss: () => setChallenge({ kind: 'idle' }),
      launch: () => setChallenge((c) => (c.kind === 'ready' ? { kind: 'launching', opponent: c.opponent } : c)),
      setCallsign: (callsign) =>
        setSelf((s) => ({ ...s, callsign: savePilotCallsign(callsign) ?? s.callsign })),
    }),
    [],
  );

  const lobby: LobbyViewModel = {
    self,
    connection,
    discoveryLabel: 'Mock discovery · mechanism TBD',
    nearby,
    challenge,
    actions,
  };

  const dev: MockLobbyDev = {
    simulateIncoming,
    setOffline: (offline) => setConnection(offline ? 'offline' : 'connecting'),
  };

  return { lobby, dev };
}
