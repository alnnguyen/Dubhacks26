import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents, MatchSnapshot, Command, CommandType, PlayerSlot } from '../../../server/src/contracts';
import type { BattleCommand } from '../vision/types';
import { CameraDebugPage } from '../camera/CameraDebugPage';
import { commandBridge } from './liveCommands';
import { accentCss, loadPilotIdentity } from './pilotIdentity';
import './flight.css';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
function storedPilot() {
  try {
    const saved = sessionStorage.getItem('duel.live.pilot');
    if (saved && /^[A-Za-z0-9_-]{8,64}$/.test(saved)) return saved;
    const id = crypto.randomUUID(); sessionStorage.setItem('duel.live.pilot', id); return id;
  } catch { return crypto.randomUUID(); }
}
export function LiveDuel() {
  const [pilot] = useState(storedPilot);
  const identity = loadPilotIdentity();
  const callsign = identity?.callsign ?? 'PILOT';
  const shipName = identity?.shipName ?? 'UNNAMED HULL';
  const accent = identity?.accent ?? 'cyan';
  const socketRef = useRef<GameSocket | null>(null);
  const snapshotRef = useRef<MatchSnapshot | null>(null);
  const slotRef = useRef<PlayerSlot | null>(null);
  const readyRef = useRef(false);
  const bridge = useRef(commandBridge());
  const [snapshot, setSnapshot] = useState<MatchSnapshot | null>(null);
  const [slot, setSlot] = useState<PlayerSlot | null>(null);
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const [note, setNote] = useState('Both players: open this same link and press Join duel.');
  const [receivedAt, setReceivedAt] = useState(0);
  const [now, setNow] = useState(performance.now());
  const [lastCommand, setLastCommand] = useState<Command | null>(null);
  useEffect(() => {
    const socket: GameSocket = io({ autoConnect: false, transports: ['websocket'], reconnectionAttempts: 5, timeout: 5000 });
    socketRef.current = socket;
    const acceptSnapshot = (s: MatchSnapshot) => { snapshotRef.current = s; setSnapshot(s); setReceivedAt(performance.now()); };
    socket.on('snapshot', s => {
      if (!readyRef.current) return;
      const previous = snapshotRef.current?.phase;
      acceptSnapshot(s);
      if (previous === 'waiting' && s.phase === 'active') {
        setNote('Both pilots joined. Throw a rock or raise your shield.');
      }
    });
    socket.on('connect', () => {
      setConnected(true); setNote('Joining the shared match…');
      socket.timeout(5000).emit('join', { playerId: pilot }, (error, reply) => {
        if (error) { readyRef.current = false; setJoined(false); setNote('Join timed out. Reconnect to retry.'); return; }
        if (!reply.ok) { readyRef.current = false; setJoined(false); setNote(reply.reason === 'match_full' ? 'Two pilots already occupy this demo. Close test tabs and restart the demo server for a fresh round.' : 'Join rejected: ' + reply.reason); return; }
        readyRef.current = true; slotRef.current = reply.slot; setSlot(reply.slot); setJoined(true); acceptSnapshot(reply.snapshot);
        setNote(reply.snapshot.phase === 'waiting' ? 'You joined. Waiting for the second player to press Join duel.' : 'Connected. Your health and attacks are now server-controlled.');
      });
    });
    socket.on('disconnect', () => { readyRef.current = false; setJoined(false); setConnected(false); setNote('Connection lost. Reconnecting with the same pilot; no offline attacks are queued.'); });
    socket.on('connect_error', () => { setConnected(false); setNote('Game server unavailable. Check the Node server and reconnect.'); });
    socket.on('rockLanded', e => { if (readyRef.current) setNote(e.blocked ? `Pilot ${e.attackerSlot} rock blocked — no damage.` : `Pilot ${e.attackerSlot} hit for ${e.damage}.`); });
    const timer = window.setInterval(() => setNow(performance.now()), 100);
    return () => { clearInterval(timer); readyRef.current = false; socket.removeAllListeners(); socket.disconnect(); socketRef.current = null; };
  }, [pilot]);
  function send(command: Command) {
    const socket = socketRef.current;
    if (!socket?.connected || !readyRef.current || snapshotRef.current?.phase !== 'active') { setNote('Wait until both pilots are connected and the match is active.'); return; }
    setLastCommand(command);
    socket.volatile.timeout(4000).emit('command', command, (error, reply) => {
      if (error) { setNote('Acknowledgement timed out. Retry last command uses the same ID.'); return; }
      setNote(reply.status === 'accepted' ? `${command.type} accepted by server.` : `${command.type} rejected: ${reply.reason}`);
    });
  }
  const sendType = (type: CommandType) => send({ type, commandId: crypto.randomUUID() });
  function cameraCommands(commands: BattleCommand[]) {
    for (const c of commands) { const command = bridge.current(c); if (command) send(command); }
  }
  const self = snapshot?.players.find(p => p.slot === slot);
  const rival = snapshot?.players.find(p => p.slot !== slot);
  const active = joined && connected && snapshot?.phase === 'active';
  const elapsed = Math.max(0, now - receivedAt);
  const remaining = (ms: number | null | undefined) => Math.max(0, (ms ?? 0) - elapsed);
  const result = snapshot?.result;
  return <main className="flight-flow" style={{ ['--ob-accent' as string]: accentCss(accent) }}>
    <header className="flight-header"><span>LIVE TWO-PLAYER / MARS</span><a href="/">Back to cockpit</a></header>
    <section className="flight-panel">
      <h1>Two-player duel</h1>
      <p>Both players open this same link. Each presses Join duel. The second join starts the round automatically.</p>
      <p className="flight-notice" style={{ borderColor: accentCss(accent) }}>
        Flying as <strong>{callsign}</strong> aboard <strong>{shipName}</strong>. Real shared combat · one demo room · Mars only. Cockpit invitations, Photon and Voice are not connected to this live mode yet.
      </p>
      <p role="status">{note}</p>
      {!joined && <button className="flight-primary" onClick={() => { const s = socketRef.current; if (s?.connected) { s.disconnect(); s.connect(); } else s?.connect(); }}>Join duel / Reconnect</button>}
      <p><strong data-testid="live-phase">{snapshot?.phase ?? 'not joined'}</strong> · {slot ? `You are Pilot ${slot} (${callsign})` : 'No pilot slot'} · {connected ? 'network connected' : 'network disconnected'}</p>
      <div className="flight-health"><strong data-testid="self-health">{callsign}: {self?.health ?? '—'}</strong><strong data-testid="rival-health">Rival health: {rival?.health ?? '—'}</strong></div>
      <p>Throw cooldown: {(remaining(self?.throwCooldownEndsInMs) / 1000).toFixed(1)} s · shield {self?.block.active ? 'UP' : 'down'} · rival {rival?.connected ? 'connected' : 'not connected'}</p>
      {active && <div className="controls"><button onClick={() => sendType('throwRock')}>Throw rock</button><button onClick={() => sendType('startBlock')}>Block (up to 1.5s)</button><button onClick={() => sendType('endBlock')}>Lower shield</button><button disabled={!lastCommand} onClick={() => lastCommand && send(lastCommand)}>Retry last command</button></div>}
      {snapshot?.phase === 'waiting' && <p>Send this link to Alan. His Join duel will activate your match.</p>}
      {snapshot?.phase === 'finished' && <div><h2>{result?.winner === null ? 'Draw' : result?.winner === slot ? 'You win!' : 'Rival wins'}</h2><p>Reason: {result?.reason}. Restart the demo server for a new round; rematch is not implemented yet.</p></div>}
      <p className="flight-muted">First use Throw/Block above to check both screens. Then Start camera below: palm lifts locally, fist sends throwRock, Block raises a server-timed shield. Camera effects are previews; server snapshots own damage/results. A refresh reclaims this tab’s pilot; use separate devices or independently opened tabs for separate pilots.</p>
    </section>
    {active && <CameraDebugPage mode="duel" flightSeconds={1.302} duel={{worldName:'Mars', gravity:3.7, rivalName:`Pilot ${rival?.slot ?? '?'}`, health:self?.health ?? 100, rivalHealth:rival?.health ?? 100, incoming:remaining(rival?.rock?.landsInMs) > 0, note}} onCommands={cameraCommands} />}
  </main>;
}
