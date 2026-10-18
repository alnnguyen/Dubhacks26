import { useMemo, useState } from 'react';
import { clearArenaJourney, journeyFor, matchesJourney, readArenaJourney, saveArenaJourney } from '../app/arenaJourney';
import {
  getGameClient,
  useGameLobby,
  useGameStatus,
  useGameView,
  type GameClient,
  type LobbyView,
  type Pilot,
  type PlayerView,
} from '../networking';
import { savePilotCallsign } from '../app/pilotIdentity';
import type { ChallengePhase, LobbyViewModel, NearbyPilot, PilotProfile } from '../ui/state/lobbyTypes';

/**
 * Real lobby adapter: the cockpit's pilots and challenge state come from the game
 * server's room. Only `launching` (the Engage transition) and dismissed
 * declined banners are local UI state.
 */
/**
 * Testing override: `?world=mars` or `?world=neptune` on the challenger's page
 * asks the server for that arena. Without it the server rolls 50/50.
 */
function devWorld(): "mars" | "neptune" | undefined {
  const world = typeof location === "undefined" ? null : new URLSearchParams(location.search).get("world");
  return world === "mars" || world === "neptune" ? world : undefined;
}

export function useServerLobby(client: GameClient = getGameClient()): LobbyViewModel {
  const connection = useGameStatus(client);
  const lobby = useGameLobby(client);
  const view = useGameView(client);
  const [launchingJourney, setLaunchingJourney] = useState(readArenaJourney);
  const launchingMatch = view && launchingJourney?.stage === "travel" && matchesJourney(view, launchingJourney) ? view.matchId : null;
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());

  const nearby = useMemo(() => (lobby && connection === 'online' ? lobby.pilots.map(toNearby) : []), [lobby, connection]);
  const challenge = challengePhase(lobby, view, nearby, launchingMatch, dismissed);
  const challengeId = lobby?.challenge?.id;

  const actions = useMemo<LobbyViewModel['actions']>(
    () => ({
      challenge: (pilotId) => void client.challenge(pilotId, devWorld()),
      cancelChallenge: () => challengeId && void client.cancelChallenge(challengeId),
      accept: () => challengeId && void client.acceptChallenge(challengeId),
      decline: () => challengeId && void client.declineChallenge(challengeId),
      dismiss: () => {
        clearArenaJourney();
        setLaunchingJourney(null);
        // Dismissing a ready match backs out of it on the server too.
        if (client.view()) void client.leaveMatch();
        if (challengeId) setDismissed((d) => new Set(d).add(challengeId));
      },
      launch: () => {
        const current = client.view();
        if (!current || current.phase === 'finished') return;
        const journey = journeyFor(current, 'travel');
        saveArenaJourney(journey);
        setLaunchingJourney(journey);
      },
      setLocation: (location) => void client.setLocation(location),
      setCallsign: (callsign) => {
        const saved = savePilotCallsign(callsign);
        if (saved) void client.setCallsign(saved);
      },
    }),
    [client, challengeId],
  );

  return {
    self: lobby ? toProfile(lobby.you) : { id: 'self', callsign: '…', rank: 'Pilot', record: { wins: 0, losses: 0 } },
    connection,
    discoveryLabel: 'Shared demo room · game server roster',
    nearby,
    challenge,
    actions,
  };
}

function challengePhase(
  lobby: LobbyView | null,
  view: PlayerView | null,
  nearby: NearbyPilot[],
  launchingMatch: string | null,
  dismissed: ReadonlySet<string>,
): ChallengePhase {
  // An unfinished match outranks the challenge that created it.
  if (view && view.phase !== 'finished') {
    const opponent = nearby.find((p) => p.id === view.rival.pilotId) ?? toNearby(rivalAsPilot(view), 0);
    return launchingMatch === view.matchId ? { kind: 'launching', opponent } : { kind: 'ready', opponent };
  }
  const c = lobby?.challenge;
  if (!c || dismissed.has(c.id)) return { kind: 'idle' };
  const opponent = nearby.find((p) => p.id === c.opponent.id) ?? toNearby(c.opponent, 0);
  if (c.status === 'pending') return { kind: c.role === 'challenger' ? 'outgoing' : 'incoming', opponent };
  // Only the challenger is told their challenge didn't happen.
  if (c.role === 'challenger' && c.status !== 'accepted') return { kind: 'declined', opponent, by: 'opponent' };
  return { kind: 'idle' };
}

function rivalAsPilot(view: PlayerView): Pilot {
  return { id: view.rival.pilotId, callsign: view.rival.callsign, status: 'in-duel', wins: 0, losses: 0 };
}

function toProfile(pilot: Pilot): PilotProfile {
  return { id: pilot.id, callsign: pilot.callsign, rank: 'Pilot', record: { wins: pilot.wins, losses: pilot.losses } };
}

// The room has no positions: ships are spread around the windshield by ID so each keeps its place.
function toNearby(pilot: Pilot, index: number): NearbyPilot {
  let hash = 0;
  for (const ch of pilot.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return {
    ...toProfile(pilot),
    status: pilot.status,
    distanceM: 4 + index * 5,
    bearingDeg: hash % 360,
    signal: 1,
    ...(pilot.location ? { location: pilot.location } : {}),
  };
}
