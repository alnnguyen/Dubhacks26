import { useCallback, useEffect, useState, type ReactNode } from 'react';
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
  const [entering, setEntering] = useState(false);
  const [note, setNote] = useState('');
  const [travelDestination, setTravelDestination] = useState<'mars' | null>(null);

  const beginBriefing = useCallback((destination: 'mars') => {
    setNote('Travel complete. Connecting to the Mars match…');
    setTravelDestination(destination);
  }, []);

  useEffect(() => {
    if (!travelDestination || !view) return;
    if (view.phase === 'finished') {
      setTravelDestination(null);
      setNote('The match ended before arrival. Return to the cockpit to challenge again.');
      return;
    }
    if (view.world.id !== travelDestination) {
      setTravelDestination(null);
      setNote(`The server selected ${view.world.name}, not Mars. This arena flow requires Mars.`);
      return;
    }
    setNote('');
    setEntered(view.matchId);
    setTravelDestination(null);
  }, [travelDestination, view]);

  useEffect(() => client.onSaberResolved(event => {
    const mine = event.attackerSlot === client.view()?.you.slot;
    if (event.outcome === 'blocked') setNote(mine ? 'Clash! Your swing hit their blade.' : 'You blocked their swing.');
    else setNote(mine ? `Hit! −${event.damage} rival health.` : `You were hit: −${event.damage} health.`);
  }), [client]);

  // A match that ended while this phone was in the cockpit (e.g. after a reload) has no result
  // screen to leave from, so leave it here and stay challengeable.
  const finishedUnseen = view?.phase === 'finished' && entered !== view.matchId;
  useEffect(() => { if (finishedUnseen) void client.leaveMatch(); }, [client, finishedUnseen]);

  async function launch() {
    if (entering) return;
    setEntering(true);
    try {
      const reply = await client.ready();
      if (reply.status === 'rejected') setNote(rejectionNote(reply));
    } finally {
      setEntering(false);
    }
  }
  function leave() {
    setEntering(false); setNote('');
    setEntered(null);
    void client.leaveMatch();
  }

  if (!view || entered !== view.matchId) {
    return (
      <>
        <SpaceshipHome
          lobby={lobby}
          onTravelComplete={beginBriefing}
          cockpitControls={cockpitControls}
          copilotClient={client}
        />
        {note && <p className="flight-muted" role="status">{note}</p>}
      </>
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
        <h1>The server picked {world.name}. Prepare for the duel.</h1>
        <p><strong>{world.gravityMps2} m/s²</strong> surface gravity (rounded <a href="https://nssdc.gsfc.nasa.gov/planetary/factsheet/" target="_blank" rel="noreferrer">NASA</a> value) · lightsaber duel</p>
        <p>Your laptop camera tracks your body and your iPhone is your lightsaber. Swing fast through your rival to hit; put your blade in the way of theirs to block. Pinch and nudge your free hand, or use WASD / arrow keys to move.</p>
        <p className="flight-muted">Both pilots got the same world. Press Ready to open the arena, then start your camera and pair your phone.</p>
        <p role="status">{rival.ready ? `${rival.callsign} is ready.` : `${rival.callsign} is still in the briefing.`}</p>
        <button className="flight-primary" disabled={entering} onClick={launch}>{entering ? 'Entering arena…' : 'Ready — enter the arena'}</button>
        {note && <p className="flight-muted">{note}</p>}
        <p className="flight-muted">The round begins when both pilots are ready. Saber hits remain disabled until both players finish camera and phone setup.</p>
      </section>
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
