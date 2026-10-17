import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { SpaceshipHome } from '../ui/screens/SpaceshipHome';
import type { NearbyPilot } from '../ui/state/lobbyTypes';
import { CameraDebugPage } from '../camera/CameraDebugPage';
import { flightSeconds, initialState, reduceDemo, worlds, type World } from './state';
import './flight.css';

export function FlightApp() {
  const [state, dispatch] = useReducer(reduceDemo, undefined, initialState);
  const [opponent, setOpponent] = useState<NearbyPilot | null>(null);
  const [voiceWorld, setVoiceWorld] = useState('');
  const [entering, setEntering] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const launchTimer = useRef<number | undefined>(undefined);
  const sequence = useRef(0);
  const beginBriefing = useCallback((pilot: NearbyPilot) => {
    setOpponent(pilot); setVoiceWorld('');
    dispatch({ type: 'challenge' }); dispatch({ type: 'accept' });
  }, []);
  useEffect(() => {
    if (state.phase !== 'duel') return;
    const id = window.setInterval(() => dispatch({ type: 'tick', now: performance.now() }), 50);
    return () => clearInterval(id);
  }, [state.phase]);
  useEffect(() => {
    function message(event: MessageEvent) {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === 'COPILOT_WORLD') setVoiceWorld(event.data.world);
      if (event.data?.type === 'COPILOT_STOPPED') {
        clearTimeout(launchTimer.current); setEntering(false); dispatch({ type: 'launch' });
      }
    }
    window.addEventListener('message', message);
    return () => { window.removeEventListener('message', message); clearTimeout(launchTimer.current); };
  }, []);
  function launch() {
    setEntering(true);
    frame.current?.contentWindow?.postMessage({ type: 'COPILOT_STOP' }, location.origin);
    // Removing the iframe also destroys its media context if the service is unavailable.
    launchTimer.current = window.setTimeout(() => { setEntering(false); dispatch({ type: 'launch' }); }, 1500);
  }
  function command(name: 'startLift' | 'releaseRock' | 'cancelLift' | 'block') {
    dispatch({ type: 'command', name, id: `touch-${++sequence.current}`, now: performance.now() });
  }
  function reset() { clearTimeout(launchTimer.current); setEntering(false); setVoiceWorld(''); dispatch({ type: 'reset' }); }

  if (state.phase === 'cockpit') return <>
    <SpaceshipHome onEnterBattle={beginBriefing} />
    <div className="flight-demo-label">LOCAL REHEARSAL · mock pilots · real Grok Voice in briefing</div>
  </>;
  return <main className="flight-flow">
    <header className="flight-header"><span>FLIGHT SYSTEMS / {state.phase.toUpperCase()}</span><button onClick={reset}>Return to cockpit</button></header>
    <p className="flight-notice">Local rehearsal vs {opponent?.callsign ?? 'training rival'}. Challenge replies, opponent actions and health are simulated. Photon is not connected to this match yet.</p>
    {state.phase === 'briefing' && <>
      <section className="flight-panel">
        <p className="flight-eyebrow">JUMP COORDINATES CONFIRMED</p><h1>Choose your world. Brief your copilot.</h1>
        <label>Training world <select disabled={entering} value={state.world} onChange={e => { setVoiceWorld(''); dispatch({ type: 'world', world: e.target.value as World }); }}>
          {Object.entries(worlds).map(([key, value]) => <option key={key} value={key}>{value.name}</option>)}
        </select></label>
        <p><strong>{worlds[state.world].gravity} m/s²</strong> · designed rock flight / defense window <strong>{flightSeconds(state.world)} s</strong></p>
        <p>Rounded <a href="https://nssdc.gsfc.nasa.gov/planetary/factsheet/" target="_blank" rel="noreferrer">NASA gravity</a> values. Window = 0.8 × √(9.8 / gravity), a gameplay mapping.</p>
        <p className="flight-muted">Connect below, Start speaking, ask “What world did we get?”, then Send speech. Grok reads this selected world through the local fixture. Changing the world disconnects the previous voice session.</p>
        <p role="status">{voiceWorld === state.world ? `Copilot state synced: ${worlds[state.world].name}.` : 'Connecting briefing state… If unavailable, start the local Voice server; camera training still works.'}</p>
        <button className="flight-primary" disabled={entering} onClick={launch}>{entering ? 'Stopping microphone…' : 'Enter camera duel'}</button>
        <p className="flight-muted">Entering combat stops the briefing microphone and audio. Start camera explicitly on the next screen.</p>
      </section>
      <iframe key={state.world} ref={frame} className="flight-voice" title="Grok Voice briefing" allow="microphone" src={`/copilot/?world=${state.world}`} />
    </>}
    {state.phase === 'duel' && <>
      <section className="flight-panel">
        <h1>{worlds[state.world].name} camera duel</h1>
        <div className="flight-health"><strong>You {state.health}/100</strong><strong>{opponent?.callsign} {state.rivalHealth}/100</strong><span>{flightSeconds(state.world)} s rock window</span></div>
        <p role="status">{state.note}</p>
        {state.incomingAt !== null && <p className="flight-warning" role="alert">INCOMING TRAINING ROCK — BLOCK</p>}
        <div className="controls"><button onClick={() => command('startLift')}>Training Lift</button><button onClick={() => command('releaseRock')}>Training Throw</button><button onClick={() => command('block')}>Training Block</button><button onClick={() => command('cancelLift')}>Training Cancel</button><button disabled={state.incomingAt !== null} onClick={() => dispatch({ type: 'rival', now: performance.now() })}>Simulate rival attack</button></div>
        <p className="flight-muted">Training buttons work without camera permission. Camera gestures below drive the same rehearsal health. Hits apply immediately on release; the green pose health bar is still a visual placeholder.</p>
      </section>
      <CameraDebugPage flightSeconds={flightSeconds(state.world)} onCommands={commands => commands.forEach(c => dispatch({ type: 'command', name: c.name, id: c.commandId, now: performance.now() }))} />
    </>}
    {state.phase === 'result' && <section className="flight-panel"><p className="flight-eyebrow">TRAINING COMPLETE</p><h1>{state.result}</h1><p>You {state.health} · rival {state.rivalHealth}</p><p>Camera stopped. Return to the cockpit to challenge again.</p><button className="flight-primary" onClick={reset}>Back to bridge</button></section>}
  </main>;
}
