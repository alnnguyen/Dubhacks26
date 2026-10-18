import { useEffect, useState } from 'react';
import { clearPilotIdentity, loadPilotIdentity, type PilotIdentity } from '../../app/pilotIdentity';
import { FlightApp } from '../../app/FlightApp';
import { createGameClient, useGameLobby, useGameStatus, useGameView, type GameClient } from '../../networking';
import '../../app/flight.css';
import { OnboardingFlow } from '../../onboarding';
import { SpaceshipHome } from './SpaceshipHome';
import './bridge-mode.css';
import { gameServerUrl } from '../../networking/gameEndpoint';

type LobbyMode = 'demo' | 'live';
const MODE_KEY = 'sd.lobby.mode.v1';

function savedMode(): LobbyMode {
  try { return localStorage.getItem(MODE_KEY) === 'demo' ? 'demo' : 'live'; }
  catch { return 'live'; }
}

function ModeControls({mode, identity, locked = false, connection, onMode, onReset}: {
  mode: LobbyMode;
  identity: PilotIdentity;
  locked?: boolean;
  connection?: string;
  onMode: (mode: LobbyMode) => void;
  onReset: () => void;
}) {
  const serverName = new URL(gameServerUrl() || location.origin).host;
  const status = locked ? 'Finish or cancel challenge to switch' : mode === 'demo' ? 'Demo: simulated pilots, no multiplayer' : connection === 'online' ? `Live: shared server ${serverName}` : connection === 'offline' ? 'Server offline; switch to Demo' : 'Connecting to game server';
  return <>
    <div className="sd-shortcut bridge-mode" title={status}>
      <span className="sd-shortcut__label bridge-mode__label">Lobby</span>
      <div className="bridge-mode__switch" role="group" aria-label="Lobby mode">
        <button type="button" aria-pressed={mode === 'demo'} disabled={locked} onClick={() => onMode('demo')}>Demo</button>
        <button type="button" aria-pressed={mode === 'live'} disabled={locked} onClick={() => onMode('live')}>Live</button>
      </div>
      <span className="bridge-mode__status" role="status">{status}</span>
    </div>
    <button className="sd-shortcut bridge-mode__reset" type="button" disabled={locked} onClick={onReset} aria-label="Reset pilot" title={`Reset ${identity.callsign}'s pilot`}>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </button>
  </>;
}

/** Own the live connection only while Live is selected. Demo never joins the room. */
function LiveBridge({identity, onMode, onReset}: {
  identity: PilotIdentity;
  onMode: (mode: LobbyMode) => void;
  onReset: () => void;
}) {
  const [client, setClient] = useState<GameClient | null>(null);
  useEffect(() => {
    const next = createGameClient();
    setClient(next);
    return () => next.close();
  }, []);
  if (!client) return <p className="bridge-mode__loading">Connecting flight systems…</p>;
  return <LiveSession client={client} identity={identity} onMode={onMode} onReset={onReset} />;
}

function LiveSession({client, identity, onMode, onReset}: {
  client: GameClient;
  identity: PilotIdentity;
  onMode: (mode: LobbyMode) => void;
  onReset: () => void;
}) {
  const connection = useGameStatus(client);
  const lobby = useGameLobby(client);
  const view = useGameView(client);
  useEffect(() => {
    // Read from storage, not the identity loaded at startup: a callsign changed in the cockpit is saved
    // there, and a reconnect mustn't put the onboarding one back.
    if (connection === 'online') void client.setCallsign(loadPilotIdentity()?.callsign ?? identity.callsign);
  }, [client, connection, identity.callsign]);
  const locked = !!view || lobby?.challenge?.status === 'pending';
  return <FlightApp client={client} cockpitControls={<ModeControls mode="live" identity={identity} locked={locked} connection={connection} onMode={onMode} onReset={onReset} />} />;
}

/** Onboarding once, then the same cockpit with a clearly labeled Demo / Live switch. */
export function BridgeApp() {
  const [identity, setIdentity] = useState<PilotIdentity | null>(() => loadPilotIdentity());
  const [mode, setMode] = useState<LobbyMode>(savedMode);
  function changeMode(next: LobbyMode) {
    setMode(next);
    try { localStorage.setItem(MODE_KEY, next); } catch { /* private mode */ }
  }
  function reset() { clearPilotIdentity(); setIdentity(null); }
  if (!identity) return <OnboardingFlow onComplete={setIdentity} />;
  if (mode === 'live') return <LiveBridge identity={identity} onMode={changeMode} onReset={reset} />;
  return <SpaceshipHome cockpitControls={<ModeControls mode="demo" identity={identity} onMode={changeMode} onReset={reset} />} />;
}
