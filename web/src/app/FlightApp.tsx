import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { SpaceshipHome } from '../ui/screens/SpaceshipHome';
import { ArenaDuel } from '../arena3d/ArenaDuel';
import { useServerLobby } from '../lobby/useServerLobby';
import { getGameClient, useGameLobby, useGameView, type ClientReply, type GameClient, type PlayerView } from '../networking';
import './flight.css';
import { clearArenaJourney, journeyFor, matchesJourney, readArenaJourney, saveArenaJourney } from './arenaJourney';
import { useAudioScene } from '../audio/useAudioScene';

// Every match number below comes from the game server's view; this screen only displays it.
export function FlightApp({client: providedClient, cockpitControls}: {client?: GameClient; cockpitControls?: ReactNode} = {}) {
  const client = providedClient ?? getGameClient();
  const lobby = useServerLobby(client);
  const view = useGameView(client);
  // Private pair code: a phone opening /?saber=<code> becomes this pilot's lightsaber.
  const pairCode = useGameLobby(client)?.pairCode ?? '';
  // Preserve this tab's entered match across development reloads; verify both pilot IDs before restoring it.
  const [journey, setJourney] = useState(readArenaJourney);
  const entered = !!view && journey?.stage === "arena" && matchesJourney(view, journey);
  const [entering, setEntering] = useState(false);
  const [note, setNote] = useState('');
  const [travelDestination, setTravelDestination] = useState<'mars' | null>(null);
  const readyAttempt = useRef<{ matchId: string; client: GameClient } | null>(null);
  const [entryError, setEntryError] = useState('');
  const audioScene = !view || !entered ? null : view.phase === 'finished' ? 'result' : 'battle';
  useAudioScene(audioScene);

  const beginArena = useCallback((destination: 'mars') => {
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
    const nextJourney = journeyFor(view, "arena");
    saveArenaJourney(nextJourney);
    setJourney(nextJourney);
    setTravelDestination(null);
  }, [travelDestination, view]);

  // Travel completion is the player's entry action. Keep the same server ready
  // command, once per arrival, without a second briefing page or voice iframe.
  const readyForArrival = useCallback((matchId: string) => {
    const attempt = { matchId, client };
    readyAttempt.current = attempt;
    setEntryError('');
    setEntering(true);
    void client.ready().then(reply => {
      if (readyAttempt.current !== attempt) return;
      if (reply.status === 'rejected') setEntryError(rejectionNote(reply));
    }).catch(() => {
      if (readyAttempt.current === attempt) setEntryError('Could not connect to the arena. Try again.');
    }).finally(() => {
      if (readyAttempt.current === attempt) setEntering(false);
    });
  }, [client]);

  const arrivedMatch = view && entered ? view.matchId : null;
  const needsReady = view?.phase === 'waiting' && !view.you.ready;
  useEffect(() => {
    if (!arrivedMatch || !needsReady) return;
    if (readyAttempt.current?.matchId === arrivedMatch && readyAttempt.current.client === client) return;
    readyForArrival(arrivedMatch);
  }, [arrivedMatch, needsReady, client, readyForArrival]);

  useEffect(() => client.onSaberResolved(event => {
    const mine = event.attackerSlot === client.view()?.you.slot;
    if (event.outcome === 'blocked') setNote(mine ? 'Clash! Your swing hit their blade.' : 'You blocked their swing.');
    else setNote(mine ? `Hit! −${event.damage} rival health.` : `You were hit: −${event.damage} health.`);
  }), [client]);

  // A finished match is shown explicitly, including a forfeit during travel.
  // Never auto-leave it and silently replace the travel screen with the cockpit.
  function leave() {
    readyAttempt.current = null;
    setEntering(false); setEntryError(''); setNote(''); setJourney(null); clearArenaJourney();
    void client.leaveMatch();
  }

  if (!view || (!entered && view.phase !== 'finished')) {
    return (
      <>
        <SpaceshipHome
          lobby={lobby}
          onTravelComplete={beginArena}
          cockpitControls={cockpitControls}
          copilotClient={client}
        />
        {note && <p className="flight-muted" role="status">{note}</p>}
      </>
    );
  }

  const { you, rival } = view;
  if (view.phase !== 'finished') return <>
    <ArenaDuel client={client} view={view} pairCode={pairCode} note={duelNote(view, note)} onLeave={leave} />
    {entryError && <aside className="flight-entry-error" role="alert"><p>{entryError}</p><button type="button" disabled={entering} onClick={() => readyForArrival(view.matchId)}>{entering ? 'Connecting…' : 'Retry arena entry'}</button></aside>}
  </>;

  return <main className="flight-flow">
    <header className="flight-header"><span>FLIGHT SYSTEMS / RESULT</span><button onClick={leave}>Return to cockpit</button></header>
    <section className="flight-panel">
      <p className="flight-eyebrow">DUEL COMPLETE</p>
      <h1>{resultTitle(view)}</h1>
      <p>You {you.health} · {rival.callsign} {rival.health}</p>
      <p>Camera stopped. Return to the cockpit to challenge again.</p>
      <button className="flight-primary" onClick={leave}>Back to bridge</button>
    </section>
  </main>;
}

function duelNote(view: PlayerView, note: string): string {
  const { rival } = view;
  if (view.phase === 'waiting') return `Waiting for ${rival.callsign} to arrive in the arena…`;
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
