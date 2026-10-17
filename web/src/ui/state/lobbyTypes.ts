/**
 * UI view-model for the spaceship lobby.
 *
 * These types describe what the *lobby UI* needs to render. They are NOT the
 * multiplayer wire contract (see AGENTS.md "Shared contracts"). The networking
 * owner can implement `LobbyViewModel` with a real adapter and pass it to
 * <SpaceshipHome lobby={...} />; until then `useMockLobby` provides it.
 */

export type ConnectionStatus = 'connecting' | 'online' | 'offline';

export type PilotStatus = 'available' | 'in-duel' | 'away';

export interface PilotProfile {
  id: string;
  callsign: string;
  rank: string;
  /** Wins / losses, display only. */
  record: { wins: number; losses: number };
}

export interface NearbyPilot extends PilotProfile {
  status: PilotStatus;
  /** Approximate distance in meters (display only; discovery mechanism TBD). */
  distanceM: number;
  /** Bearing in degrees, 0 = ahead, clockwise. Used to place radar blips. */
  bearingDeg: number;
  /** 0..1 signal quality. */
  signal: number;
}

/**
 * Challenge flow. Maps onto the agreed message intents:
 *  outgoing  -> sent `challenge(playerName)`, waiting for `accept` / `decline`
 *  incoming  -> received `challenge(playerName)`
 *  accepted  -> both sides accepted; shared battle setup can begin
 *  ready     -> UI is ready to hand off to battle setup
 *  launching -> transition animation playing; `onEnterBattle` fires after
 */
export type ChallengePhase =
  | { kind: 'idle' }
  | { kind: 'outgoing'; opponent: NearbyPilot }
  | { kind: 'incoming'; opponent: NearbyPilot }
  | { kind: 'declined'; opponent: NearbyPilot; by: 'opponent' | 'self' }
  | { kind: 'accepted'; opponent: NearbyPilot; initiatedBy: 'self' | 'opponent' }
  | { kind: 'ready'; opponent: NearbyPilot }
  | { kind: 'launching'; opponent: NearbyPilot };

export interface LobbyViewModel {
  self: PilotProfile;
  connection: ConnectionStatus;
  /** Free-form label for the discovery mechanism (TBD), shown in the UI. */
  discoveryLabel: string;
  nearby: NearbyPilot[];
  challenge: ChallengePhase;
  actions: {
    challenge: (pilotId: string) => void;
    cancelChallenge: () => void;
    accept: () => void;
    decline: () => void;
    dismiss: () => void;
    launch: () => void;
    setCallsign: (callsign: string) => void;
  };
}

/** Which console/panel the camera is focused on. Pure UI state. */
export type LobbyView = 'lobby' | 'console' | 'radar' | 'profile' | 'settings';

export type GraphicsQuality = 'high' | 'low';

export interface SceneSettings {
  quality: GraphicsQuality;
  reducedMotion: boolean;
  parallax: boolean;
}
