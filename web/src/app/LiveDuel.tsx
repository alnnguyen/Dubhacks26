import { useEffect, useRef, useState } from 'react';
import type { PlayerView, Weapon } from '../networking';
import { createGameClient, type ClientReply, type ConnectionStatus, type GameClient } from '../networking';
import type { BattleCommand } from '../vision/types';
import { CameraDebugPage } from '../camera/CameraDebugPage';
import { commandBridge } from './liveCommands';
import { accentCss, loadPilotIdentity } from './pilotIdentity';
import './flight.css';

/** Per-tab identity so two tabs on one laptop can still be two pilots. Phones keep their own storage naturally. */
function tabStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  try {
    return sessionStorage;
  } catch {
    return {
      getItem: () => null,
      setItem: () => undefined,
    };
  }
}

function describeReply(label: string, reply: ClientReply): string {
  if (reply.status === 'accepted') return `${label} accepted by server.`;
  return `${label} rejected: ${reply.reason}`;
}

export function LiveDuel() {
  const identity = loadPilotIdentity();
  const callsign = identity?.callsign ?? 'PILOT';
  const shipName = identity?.shipName ?? 'UNNAMED HULL';
  const accent = identity?.accent ?? 'cyan';

  const clientRef = useRef<GameClient | null>(null);
  const viewRef = useRef<PlayerView | null>(null);
  const bridge = useRef(commandBridge());
  const [view, setView] = useState<PlayerView | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [note, setNote] = useState('Connecting to Justin’s match server…');
  const [receivedAt, setReceivedAt] = useState(0);
  const [now, setNow] = useState(performance.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const client = createGameClient({ storage: tabStorage() });
    clientRef.current = client;
    viewRef.current = client.view();

    const offStatus = client.onStatus((next) => {
      setStatus(next);
      setJoinError(client.joinError());
      if (next === 'connecting') setNote('Joining the shared match…');
      if (next === 'offline') {
        const err = client.joinError();
        setNote(
          err === 'match_full'
            ? 'Two pilots already occupy this demo. Close extra tabs and restart the demo server for a fresh round.'
            : err
              ? `Join rejected: ${err}`
              : 'Connection lost. Reloading this page reclaims the same pilot; no offline attacks are queued.',
        );
      }
    });

    const offView = client.onView((next) => {
      const previous = viewRef.current?.phase;
      viewRef.current = next;
      setView(next);
      setReceivedAt(performance.now());
      if (previous === 'waiting' && next.phase === 'active') {
        setNote('Both pilots joined. Switch weapon, throw, or raise your shield.');
      } else if (next.phase === 'waiting') {
        setNote('You joined. Waiting for the second player on this same link.');
      } else if (next.phase === 'active') {
        setNote('Connected. Health and attacks are server-controlled.');
      } else if (next.phase === 'finished') {
        setNote('Match finished.');
      }
    });

    const offLanded = client.onProjectileLanded((event) => {
      if (!viewRef.current) return;
      const weapon = event.weapon === 'gun' ? 'gun bolt' : 'rock';
      setNote(
        event.blocked
          ? `Pilot ${event.attackerSlot} ${weapon} blocked — no damage.`
          : `Pilot ${event.attackerSlot} hit with ${weapon} for ${event.damage}.`,
      );
    });

    const timer = window.setInterval(() => setNow(performance.now()), 100);
    return () => {
      clearInterval(timer);
      offStatus();
      offView();
      offLanded();
      client.close();
      clientRef.current = null;
    };
  }, []);

  async function run(label: string, action: () => Promise<ClientReply>) {
    const client = clientRef.current;
    if (!client || client.status() !== 'online' || viewRef.current?.phase !== 'active') {
      setNote('Wait until both pilots are connected and the match is active.');
      return;
    }
    setBusy(true);
    try {
      setNote(describeReply(label, await action()));
    } finally {
      setBusy(false);
    }
  }

  /** Gun starts active on the server — select rock before a throw. */
  async function ensureWeapon(weapon: Weapon) {
    const client = clientRef.current;
    if (!client) return;
    const current = client.view()?.you.weapon;
    if (current === weapon) return;
    await (weapon === 'rock' ? client.rockActive() : client.gunActive());
  }

  function cameraCommands(commands: BattleCommand[]) {
    const client = clientRef.current;
    if (!client) return;
    for (const input of commands) {
      const action = bridge.current(input);
      if (!action) continue;
      void run(action, async () => {
        if (action === 'throwRock') {
          await ensureWeapon('rock');
          return client.throwRock();
        }
        return client.startBlock();
      });
    }
  }

  const you = view?.you;
  const rival = view?.rival;
  const online = status === 'online';
  const active = online && view?.phase === 'active';
  const elapsed = Math.max(0, now - receivedAt);
  const remaining = (ms: number | null | undefined) => Math.max(0, (ms ?? 0) - elapsed);
  const result = view?.result;
  const rockCd = remaining(you?.cooldowns.rock);
  const gunCd = remaining(you?.cooldowns.gun);
  const incoming = remaining(rival?.projectile?.landsInMs) > 0;

  return (
    <main className="flight-flow" style={{ ['--ob-accent' as string]: accentCss(accent) }}>
      <header className="flight-header">
        <span>LIVE TWO-PLAYER / MARS</span>
        <a href="/">Back to cockpit</a>
      </header>
      <section className="flight-panel">
        <h1>Two-player duel</h1>
        <p>Both players open this same link. The second join starts the round automatically (Justin’s createGameClient).</p>
        <p className="flight-notice" style={{ borderColor: accentCss(accent) }}>
          Flying as <strong>{callsign}</strong> aboard <strong>{shipName}</strong>. Real shared combat · one demo room · Mars
          only. Cockpit ship challenges do not open this page yet — use <code>/?pvp=1</code> on both devices.
        </p>
        <p role="status">{note}</p>
        {!online && (
          <button className="flight-primary" type="button" onClick={() => window.location.reload()}>
            Reconnect
          </button>
        )}
        <p>
          <strong data-testid="live-phase">{view?.phase ?? 'not joined'}</strong>
          {' · '}
          {you ? `You are Pilot ${you.slot} (${callsign})` : 'No pilot slot'}
          {' · '}
          {status}
          {joinError ? ` (${joinError})` : ''}
        </p>
        <div className="flight-health">
          <strong data-testid="self-health">
            {callsign}: {you?.health ?? '—'}
          </strong>
          <strong data-testid="rival-health">Rival health: {rival?.health ?? '—'}</strong>
        </div>
        <p>
          Weapon: <strong>{you?.weapon ?? '—'}</strong>
          {' · '}
          rock CD {(rockCd / 1000).toFixed(1)}s · gun CD {(gunCd / 1000).toFixed(1)}s
          {' · '}
          shield {you?.block.active ? 'UP' : 'down'}
          {' · '}
          rival {rival?.connected ? 'connected' : 'not connected'}
        </p>
        {active && (
          <div className="controls">
            <button type="button" disabled={busy} onClick={() => void run('rockActive', () => clientRef.current!.rockActive())}>
              Select rock
            </button>
            <button type="button" disabled={busy} onClick={() => void run('gunActive', () => clientRef.current!.gunActive())}>
              Select gun
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run('throwRock', async () => {
                  await ensureWeapon('rock');
                  return clientRef.current!.throwRock();
                })
              }
            >
              Throw rock
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run('fireGun', async () => {
                  await ensureWeapon('gun');
                  return clientRef.current!.fireGun();
                })
              }
            >
              Fire gun
            </button>
            <button type="button" disabled={busy} onClick={() => void run('startBlock', () => clientRef.current!.startBlock())}>
              Block (up to 1.5s)
            </button>
            <button type="button" disabled={busy} onClick={() => void run('endBlock', () => clientRef.current!.endBlock())}>
              Lower shield
            </button>
          </div>
        )}
        {view?.phase === 'waiting' && <p>Send this link to your opponent. Their join activates the match.</p>}
        {view?.phase === 'finished' && (
          <div>
            <h2>{result?.winner === null ? 'Draw' : result?.winner === you?.slot ? 'You win!' : 'Rival wins'}</h2>
            <p>Reason: {result?.reason}. Restart the demo server for a new round; rematch is not implemented yet.</p>
          </div>
        )}
        <p className="flight-muted">
          Buttons check the shared server first. Then Start camera: palm lifts locally, fist sends throwRock (after selecting
          rock), Block raises a server-timed shield. Camera effects are previews; server views own damage/results.
        </p>
      </section>
      {active && (
        <CameraDebugPage
          mode="duel"
          flightSeconds={1.302}
          duel={{
            worldName: 'Mars',
            gravity: 3.7,
            rivalName: `Pilot ${rival?.slot ?? '?'}`,
            health: you?.health ?? 100,
            rivalHealth: rival?.health ?? 100,
            incoming,
            note,
          }}
          onCommands={cameraCommands}
        />
      )}
    </main>
  );
}
