import { destinationFromWorld, DESTINATIONS, type DestinationId } from '../destinations/config';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { SpaceshipHome } from '../ui/screens/SpaceshipHome';
import { ArenaDuel } from '../arena3d/ArenaDuel';
import { useServerLobby } from '../lobby/useServerLobby';
import { getGameClient, useGameLobby, useGameView, type ClientReply, type GameClient, type PlayerView } from '../networking';
import './flight.css';
import { clearArenaJourney, journeyFor, matchesJourney, readArenaJourney, saveArenaJourney } from './arenaJourney';
import { useAudioScene } from '../audio/useAudioScene';
import { useReplay } from '../replay/useReplay';
import { ReplayPanel } from '../replay/ReplayPanel';

// Every match number below comes from the game server's view; this screen only displays it.
export function FlightApp({client: providedClient, cockpitControls}: {client?: GameClient; cockpitControls?: ReactNode} = {}) {
  const client = providedClient ?? getGameClient();
  const lobby = useServerLobby(client);
  const view = useGameView(client);
  const [replayEnabled, setReplayEnabled] = useState(false);
  const replay = useReplay(view?.matchId, client, replayEnabled, view?.round ?? 1);
  useEffect(() => { setReplayEnabled(false); }, [view?.matchId, view?.round]);
  // Private pair code: a phone opening /?saber=<code> becomes this pilot's lightsaber.
  const pairCode = useGameLobby(client)?.pairCode ?? '';
  // Preserve this tab's entered match across development reloads; verify both pilot IDs before restoring it.
  const [journey, setJourney] = useState(readArenaJourney);
  const entered = !!view && journey?.stage === "arena" && matchesJourney(view, journey);
  const [entering, setEntering] = useState(false);
  const [note, setNote] = useState('');
  // The world the cockpit travel sequence flew to; the server's view must agree before we enter.
  const [travelDestination, setTravelDestination] = useState<DestinationId | null>(null);
  const readyAttempt = useRef<{ matchId: string; client: GameClient } | null>(null);
  const [entryError, setEntryError] = useState('');
  const audioScene = !view || !entered ? null : view.phase === 'finished' ? 'result' : 'battle';
  useAudioScene(audioScene);

  const beginArena = useCallback((destination: DestinationId) => {
    setNote(`Travel complete. Connecting to ${DESTINATIONS[destination].displayName}…`);
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
      setNote(`The server selected ${view.world.name}, not the arrival destination. Return to the cockpit and try again.`);
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
    if (event.outcome === 'guardBreak') setNote(mine ? 'Guard broken! Strike now.' : "Your guard was broken — you're stunned.");
    else if (event.outcome === 'blocked') setNote(mine ? 'Clash! Your swing hit their blade.' : 'You blocked their swing.');
    else setNote(mine ? `Hit! −${event.damage} rival health.` : `You were hit: −${event.damage} health.`);
  }), [client]);

  const phase = view?.phase;
  useEffect(() => { if (phase === 'finished') setNote(''); }, [phase]);
  // Ends the round but stays in the match, so both pilots can still rematch.
  function forfeit() {
    void client.forfeit().then(reply => reply.status === 'rejected' && setNote(rejectionNote(reply)));
  }
  function rematch() {
    setNote('');
    void client.rematch().then(reply => reply.status === 'rejected' && setNote(rejectionNote(reply)));
  }
  function leave() {
    readyAttempt.current = null;
    setEntering(false); setEntryError(''); setNote(''); setJourney(null); clearArenaJourney();
    replay.discard(); setReplayEnabled(false);
    void client.leaveMatch();
  }

  if (!view || (!entered && view.phase !== 'finished')) {
    return (
      <>
        <SpaceshipHome
          lobby={lobby}
          destination={view ? destinationFromWorld(view.world.id) : undefined}
          onTravelComplete={beginArena}
          cockpitControls={cockpitControls}
          copilotClient={client}
        />
        {note && <p className="flight-muted" role="status">{note}</p>}
      </>
    );
  }

  // One mounted arena preserves the camera and calibration through the result and rematch.
  return <>
    <ArenaDuel client={client} view={view} pairCode={pairCode} note={duelNote(view, note)} onLeave={leave} onForfeit={forfeit} onRematch={rematch} replayEnabled={replayEnabled} onReplayEnabled={setReplayEnabled} onReplaySource={replay.start}
      resultExtra={<ReplayPanel key={`${view.matchId}:${view.round ?? 1}`} client={client} matchId={view.matchId} clip={replay.clip} arena={replay.arena} board={view.board} mySlot={view.you.slot} destination={destinationFromWorld(view.world.id)} status={replay.status} onDiscard={replay.discard} />} />
    {entryError && <aside className="flight-entry-error" role="alert"><p>{entryError}</p><button type="button" disabled={entering} onClick={() => readyForArrival(view.matchId)}>{entering ? 'Connecting…' : 'Retry arena entry'}</button></aside>}
  </>;
}

function duelNote(view: PlayerView, note: string): string {
  const { rival } = view;
  if (view.phase === "finished") return note;
  if (view.phase === 'waiting') return `Waiting for ${rival.callsign} to arrive in the arena…`;
  if (!rival.connected) return `${rival.callsign} lost connection — they forfeit unless they return shortly.`;
  return note || 'Swing fast through your rival. Block with your blade.';
}

const REJECTION_NOTES: Record<string, string> = {
  pilot_unavailable: 'Your rival has left — no rematch.',
  match_not_active: 'The round has not started.',
  offline: 'Offline — command not sent.',
  no_response: 'Server did not answer in time.',
};

function rejectionNote(reply: ClientReply): string {
  const reason = reply.status === 'rejected' ? reply.reason : '';
  return REJECTION_NOTES[reason] ?? `Server rejected the command (${reason}).`;
}
