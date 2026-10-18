import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { SpaceshipHome } from '../ui/screens/SpaceshipHome';
import { ArenaDuel } from '../arena3d/ArenaDuel';
import { useServerLobby } from '../lobby/useServerLobby';
import { getGameClient, useGameLobby, useGameView, type ClientReply, type GameClient, type PlayerView } from '../networking';
import './flight.css';

// Every match number below comes from the game server's view; this screen only displays it.
export function FlightApp({client: providedClient, cockpitControls}: {client?: GameClient; cockpitControls?: ReactNode} = {}) {
  const client = providedClient ?? getGameClient();
  const lobby = useServerLobby(client);
  const view = useGameView(client);
  // Private pair code: a phone opening /?saber=<code> becomes this pilot's lightsaber.
  const pairCode = useGameLobby(client)?.pairCode ?? '';
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

  useEffect(() => client.onSaberResolved(event => {
    const mine = event.attackerSlot === client.view()?.you.slot;
    if (event.outcome === 'blocked') setNote(mine ? 'Clash! Your swing hit their blade.' : 'You blocked their swing.');
    else setNote(mine ? `Hit! −${event.damage} rival health.` : `You were hit: −${event.damage} health.`);
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

  if (!view || entered !== view.matchId) {
    return (
      <SpaceshipHome
        lobby={lobby}
        onEnterBattle={beginBriefing}
        cockpitControls={cockpitControls}
        copilotClient={client}
      />
    );
  }

  const { world, you, rival } = view;
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
        <p><strong>{world.gravityMps2} m/s²</strong> surface gravity (rounded <a href="https://nssdc.gsfc.nasa.gov/planetary/factsheet/" target="_blank" rel="noreferrer">NASA</a> value) · lightsaber duel</p>
        <p>Your laptop camera tracks your body and your iPhone is your lightsaber. Swing fast through your rival to hit; put your blade in the way of theirs to block. Step to move in the arena.</p>
        <p className="flight-muted">Both pilots got the same world. Your copilot announces it automatically. If sound is paused by your browser, tap Play briefing below. Ask the copilot is optional for follow-up questions.</p>
        <p role="status">{voiceWorld === world.id ? `Copilot state synced: ${world.name}.` : 'Connecting briefing state… If unavailable, start the local Voice server; the duel still works.'}</p>
        <p role="status">{rival.ready ? `${rival.callsign} is ready.` : `${rival.callsign} is still in the briefing.`}</p>
        <button className="flight-primary" disabled={entering} onClick={launch}>{entering ? 'Stopping microphone…' : 'Ready — enter the arena'}</button>
        {note && <p className="flight-muted">{note}</p>}
        <p className="flight-muted">Entering combat stops the briefing microphone and audio. Start camera explicitly on the next screen. The round begins when both pilots are ready.</p>
      </section>
      <iframe key={world.id} ref={frame} className="flight-voice" title="Grok Voice briefing" allow="microphone; autoplay" src={`/copilot/?world=${world.id}`} />
    </>}
    {screen === 'duel' && (
      <ArenaDuel client={client} view={view} pairCode={pairCode} note={duelNote(view, note)} onLeave={leave} />
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
  return note || 'Swing fast through your rival. Block with your blade.';
}

function resultTitle({ result, you, rival }: PlayerView): string {
  if (!result) return 'Duel over';
  const how = result.reason === 'forfeit' ? ' by forfeit' : '';
  if (result.winner === null) return 'Draw';
  return result.winner === you.slot ? `You win${how}` : `${rival.callsign} wins${how}`;
}

const REJECTION_NOTES: Record<string, string> = {
  match_not_active: 'The round has not started.',
  offline: 'Offline — command not sent.',
  no_response: 'Server did not answer in time.',
};

function rejectionNote(reply: ClientReply): string {
  const reason = reply.status === 'rejected' ? reply.reason : '';
  return REJECTION_NOTES[reason] ?? `Server rejected the command (${reason}).`;
}
