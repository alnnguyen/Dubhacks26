import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { SpaceshipHome } from '../ui/screens/SpaceshipHome';
import { CameraDebugPage } from '../camera/CameraDebugPage';
import { useServerLobby } from '../lobby/useServerLobby';
import { getGameClient, useGameView, type ClientReply, type GameClient, type PlayerView } from '../networking';
import type { BattleCommand } from '../vision/types';
import './flight.css';

// Every match number below comes from the game server's view; this screen only displays it.
export function FlightApp({client: providedClient, cockpitControls}: {client?: GameClient; cockpitControls?: ReactNode} = {}) {
  const client = providedClient ?? getGameClient();
  const lobby = useServerLobby(client);
  const view = useGameView(client);
  // The match this phone engaged into. A reload lands back in the cockpit with the match ready to re-engage.
  const [entered, setEntered] = useState<string | null>(null);
  const [voiceWorld, setVoiceWorld] = useState('');
  const [entering, setEntering] = useState(false);
  const [note, setNote] = useState('');
  const frame = useRef<HTMLIFrameElement>(null);
  const launchTimer = useRef<number | undefined>(undefined);

  const beginBriefing = useCallback(() => {
    setVoiceWorld(''); setNote('');
    setEntered(client.view()?.matchId ?? null);
  }, [client]);

  const ready = useCallback(() => {
    clearTimeout(launchTimer.current); setEntering(false);
    void client.ready().then(reply => reply.status === 'rejected' && setNote(rejectionNote(reply)));
  }, [client]);

  useEffect(() => {
    function message(event: MessageEvent) {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === 'COPILOT_WORLD') setVoiceWorld(event.data.world);
      if (event.data?.type === 'COPILOT_STOPPED') ready();
    }
    window.addEventListener('message', message);
    return () => { window.removeEventListener('message', message); clearTimeout(launchTimer.current); };
  }, [ready]);

  useEffect(() => client.onProjectileLanded(event => {
    const mine = event.attackerSlot === client.view()?.you.slot;
    const weapon = event.weapon === 'rock' ? 'Rock' : 'Bolt';
    if (mine) setNote(event.blocked ? `${weapon} blocked by rival.` : `${weapon} hit: −${event.damage} rival health.`);
    else setNote(event.blocked ? `Blocked the incoming ${weapon.toLowerCase()}.` : `Hit: −${event.damage} health.`);
  }), [client]);

  // A match that ended while this phone was in the cockpit (e.g. after a reload) has no result
  // screen to leave from, so leave it here and stay challengeable.
  const finishedUnseen = view?.phase === 'finished' && entered !== view.matchId;
  useEffect(() => { if (finishedUnseen) void client.leaveMatch(); }, [client, finishedUnseen]);

  function launch() {
    setEntering(true);
    frame.current?.contentWindow?.postMessage({ type: 'COPILOT_STOP' }, location.origin);
    launchTimer.current = window.setTimeout(ready, 1500);
  }

  function leave() {
    clearTimeout(launchTimer.current); setEntering(false); setVoiceWorld(''); setNote('');
    setEntered(null);
    void client.leaveMatch();
  }

  // Same validated server commands for gestures and touch buttons.
  function onCommands(commands: BattleCommand[]) {
    for (const command of commands) {
      const send = command.name === 'startLift'
        ? (client.view()?.you.weapon === 'rock' ? null : client.rockActive)
        : command.name === 'releaseRock' ? client.throwRock
        : command.name === 'block' ? client.startBlock
        : null; // cancelLift: the held rock is local until thrown.
      void send?.().then(reply => reply.status === 'rejected' && setNote(rejectionNote(reply)));
    }
  }

  if (!view || entered !== view.matchId) return <SpaceshipHome lobby={lobby} onEnterBattle={beginBriefing} cockpitControls={cockpitControls} copilotClient={client} />;

  const { world, you, rival } = view;
  const flightSeconds = world.rockFlightMs / 1000;
  const screen = view.phase === 'finished' ? 'result' : view.phase === 'waiting' && !you.ready ? 'briefing' : 'duel';
  return <main className="flight-flow">
    <header className="flight-header">
      <span>FLIGHT SYSTEMS / {screen.toUpperCase()}</span>
      <button onClick={leave}>{view.phase === 'finished' ? 'Return to cockpit' : 'Forfeit & return'}</button>
    </header>
    {screen === 'briefing' && <>
      <section className="flight-panel">
        <p className="flight-eyebrow">JUMP COORDINATES CONFIRMED · VS {rival.callsign}</p>
        <h1>The server picked {world.name}. Listen to the briefing.</h1>
        <p><strong>{world.gravityMps2} m/s²</strong> · designed rock flight / defense window <strong>{flightSeconds.toFixed(2)} s</strong></p>
        <p>Rounded <a href="https://nssdc.gsfc.nasa.gov/planetary/factsheet/" target="_blank" rel="noreferrer">NASA gravity</a> values. Window = 0.8 × √(9.8 / gravity), a gameplay mapping.</p>
        <p className="flight-muted">Both pilots got the same world. Your copilot announces it automatically. If sound is paused by your browser, tap Play briefing below. Ask the copilot is optional for follow-up questions.</p>
        <p role="status">{voiceWorld === world.id ? `Copilot state synced: ${world.name}.` : 'Connecting briefing state… If unavailable, start the local Voice server; the duel still works.'}</p>
        <p role="status">{rival.ready ? `${rival.callsign} is ready.` : `${rival.callsign} is still in the briefing.`}</p>
        <button className="flight-primary" disabled={entering} onClick={launch}>{entering ? 'Stopping microphone…' : 'Ready — enter camera duel'}</button>
        {note && <p className="flight-muted">{note}</p>}
        <p className="flight-muted">Entering combat stops the briefing microphone and audio. Start camera explicitly on the next screen. The round begins when both pilots are ready.</p>
      </section>
      <iframe key={world.id} ref={frame} className="flight-voice" title="Grok Voice briefing" allow="microphone; autoplay" src={`/copilot/?world=${world.id}`} />
    </>}
    {screen === 'duel' && (
      <CameraDebugPage
        mode="duel"
        flightSeconds={flightSeconds}
        duel={{
          worldName: world.name,
          gravity: world.gravityMps2,
          rivalName: rival.callsign,
          health: you.health,
          rivalHealth: rival.health,
          note: duelNote(view, note),
          incoming: rival.projectile !== null,
        }}
        onCommands={onCommands}
      />
    )}
    {screen === 'result' && <section className="flight-panel">
      <p className="flight-eyebrow">DUEL COMPLETE</p>
      <h1>{resultTitle(view)}</h1>
      <p>You {you.health} · {rival.callsign} {rival.health}</p>
      <p>Camera stopped. Return to the cockpit to challenge again.</p>
      <button className="flight-primary" onClick={leave}>Back to bridge</button>
    </section>}
  </main>;
}

function duelNote(view: PlayerView, note: string): string {
  const { rival } = view;
  if (view.phase === 'waiting') return `Waiting for ${rival.callsign} to finish the briefing…`;
  if (!rival.connected) return `${rival.callsign} lost connection — they forfeit unless they return shortly.`;
  if (rival.projectile) return `Incoming ${rival.projectile.weapon}! Block before impact.`;
  return note || 'Lift then throw. Block when a rock is incoming.';
}

function resultTitle({ result, you, rival }: PlayerView): string {
  if (!result) return 'Duel over';
  const how = result.reason === 'forfeit' ? ' by forfeit' : '';
  if (result.winner === null) return 'Draw';
  return result.winner === you.slot ? `You win${how}` : `${rival.callsign} wins${how}`;
}

const REJECTION_NOTES: Record<string, string> = {
  on_cooldown: 'Still cooling down.',
  busy: 'Busy — wait for your throw or block to finish.',
  projectile_in_flight: 'Your last shot is still in flight.',
  match_not_active: 'The round has not started.',
  offline: 'Offline — command not sent.',
  no_response: 'Server did not answer in time.',
};

function rejectionNote(reply: ClientReply): string {
  const reason = reply.status === 'rejected' ? reply.reason : '';
  return REJECTION_NOTES[reason] ?? `Server rejected the command (${reason}).`;
}
