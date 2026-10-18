import { useEffect, useRef, useState } from 'react';
import type { LobbyView, PlayerView, Weapon } from '../networking';
import { createGameClient, type ClientReply, type ConnectionStatus, type GameClient } from '../networking';
import type { BattleCommand } from '../vision/types';
import { CameraDebugPage } from '../camera/CameraDebugPage';
import { describeCombatReply, dispatchBattleCommand } from './liveCommands';
import { accentCss, loadPilotIdentity } from './pilotIdentity';
import './flight.css';

const GUN_FLIGHT_MS = 800;

/**
 * /?pvp=1 rehearsal: lobby has no auto-match, so we challenge / accept / ready ourselves.
 * Only one pairing attempt at a time so two tabs don't spam challenges.
 */
async function autoPairFromLobby(client: GameClient, lobby: LobbyView): Promise<string | null> {
  const challenge = lobby.challenge;
  if (challenge?.status === 'pending' && challenge.role === 'defender') {
    const reply = await client.acceptChallenge(challenge.id);
    return reply.status === 'accepted'
      ? `Accepted ${challenge.opponent.callsign}'s challenge.`
      : `Accept failed: ${reply.status === 'rejected' ? reply.reason : 'unknown'}`;
  }
  if (challenge?.status === 'pending' && challenge.role === 'challenger') {
    return `Waiting for ${challenge.opponent.callsign} to accept… (${lobby.pilots.length} other pilot(s) in lobby)`;
  }
  if (client.view()) return null;

  const available = lobby.pilots.filter((p) => p.status === 'available');
  const names = lobby.pilots.map((p) => `${p.callsign}${p.status === 'in-duel' ? '*' : ''}`).join(', ');

  if (available.length === 0) {
    return lobby.pilots.length === 0
      ? 'In lobby alone — open the SAME ngrok /?pvp=1 URL on the other device.'
      : `Lobby has ${lobby.pilots.length} busy pilot(s) [${names}]. Restart game server to clear ghosts.`;
  }

  // Extra leftover tabs/phones make auto-pair pick the wrong rival.
  if (available.length > 1) {
    return `Too many pilots in lobby (${available.length} available: ${names}). Close extra /?pvp=1 tabs, restart \`server\` (Ctrl+C → node dist/index.js), then reopen exactly 2 clients on the ngrok URL.`;
  }

  const rival = available[0]!;
  const reply = await client.challenge(rival.id);
  return reply.status === 'accepted'
    ? `Challenged ${rival.callsign}. Waiting for accept…`
    : `Challenge failed: ${reply.status === 'rejected' ? reply.reason : 'unknown'}`;
}

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
  const [view, setView] = useState<PlayerView | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [note, setNote] = useState('Connecting to Justin’s match server…');
  const [receivedAt, setReceivedAt] = useState(0);
  const [now, setNow] = useState(performance.now());
  const [busy, setBusy] = useState(false);
  const [bolt, setBolt] = useState<{ startedAt: number } | null>(null);
  const [slashAt, setSlashAt] = useState<number | null>(null);
  const [rockResolvedAt, setRockResolvedAt] = useState(0);
  const [lobbyInfo, setLobbyInfo] = useState<string>('—');

  useEffect(() => {
    const client = createGameClient({ storage: tabStorage() });
    clientRef.current = client;
    viewRef.current = client.view();
    let pairing = false;
    let pairingNote = '';

    // Distinct callsigns help you see which device is which in the lobby list.
    void client.setCallsign(callsign);

    const offStatus = client.onStatus((next) => {
      setStatus(next);
      setJoinError(client.joinError());
      if (next === 'connecting') setNote('Joining the lobby…');
      if (next === 'offline') {
        const err = client.joinError();
        setNote(
          err
            ? `Join rejected: ${err}`
            : 'Connection lost (is the game server on :3001?). Reload after it is up.',
        );
      }
      if (next === 'online') {
        const lobby = client.lobby();
        if (lobby && !client.view()) {
          void (async () => {
            if (pairing) return;
            pairing = true;
            try {
              pairingNote = (await autoPairFromLobby(client, lobby)) ?? pairingNote;
              if (pairingNote) setNote(pairingNote);
            } finally {
              pairing = false;
            }
          })();
        }
      }
    });

    const offLobby = client.onLobby((lobby) => {
      const others = lobby.pilots.map((p) => p.callsign).join(', ') || 'none';
      setLobbyInfo(`you=${lobby.you.callsign} · others=[${others}] · challenge=${lobby.challenge?.status ?? 'none'}`);
      if (client.view()) return;
      void (async () => {
        if (pairing) return;
        pairing = true;
        try {
          pairingNote = (await autoPairFromLobby(client, lobby)) ?? pairingNote;
          if (pairingNote) setNote(pairingNote);
        } finally {
          pairing = false;
        }
      })();
    });

    const offView = client.onView((next) => {
      const previous = viewRef.current?.phase;
      viewRef.current = next;
      setView(next);
      setReceivedAt(performance.now());
      if (!next) {
        setNote(pairingNote || 'In lobby — waiting for a second /?pvp=1 client to pair.');
        return;
      }
      if (next.phase === 'waiting' && !next.you.ready) {
        setNote('Match created — pressing Ready…');
        void client.ready().then((reply) => {
          if (reply.status === 'rejected') setNote(`Ready failed: ${reply.reason}`);
        });
      }
      if (previous === 'waiting' && next.phase === 'active') {
        setNote(
          'Duel active. Rock: palm→fist→fling. Gun: fist→index+middle. Saber: swing to slash (timing window) · Block works.',
        );
      } else if (next.phase === 'waiting') {
        setNote(
          next.you.ready
            ? `Ready — waiting for ${next.rival.callsign}…`
            : 'Match created — pressing Ready…',
        );
      } else if (next.phase === 'active') {
        setNote('Connected. Health and attacks are server-controlled.');
      } else if (next.phase === 'finished') {
        setNote('Match finished. Reload both clients for a new round.');
      }
    });

    const offLanded = client.onProjectileLanded((event) => {
      if (!viewRef.current) return;
      const mine = viewRef.current.you.slot === event.attackerSlot;
      const weapon =
        event.weapon === 'gun' ? 'gun bolt' : event.weapon === 'saber' ? 'saber slash' : 'rock';
      setNote(
        event.blocked
          ? `Pilot ${event.attackerSlot} ${weapon} blocked — no damage.`
          : `Pilot ${event.attackerSlot} hit with ${weapon} for ${event.damage}.`,
      );
      if (!mine) return;
      if (event.weapon === 'rock') setRockResolvedAt(performance.now());
      if (event.weapon === 'gun') setBolt(null);
      if (event.weapon === 'saber') setSlashAt(null);
    });

    const timer = window.setInterval(() => setNow(performance.now()), 100);
    return () => {
      clearInterval(timer);
      offStatus();
      offLobby();
      offView();
      offLanded();
      client.close();
      clientRef.current = null;
    };
  }, [callsign]);

  async function run(label: string, action: () => Promise<ClientReply>) {
    const client = clientRef.current;
    if (!client || client.status() !== 'online' || viewRef.current?.phase !== 'active') {
      setNote('Wait until both pilots are connected and the match is active.');
      return;
    }
    setBusy(true);
    try {
      const reply = await action();
      setNote(describeReply(label, reply));
      if (label === 'fireGun' && reply.status === 'accepted') {
        setBolt({ startedAt: performance.now() });
      }
      if (label === 'slash' && reply.status === 'accepted') {
        setSlashAt(performance.now());
      }
    } finally {
      setBusy(false);
    }
  }

  /** Gun starts active on the server — select the matching weapon before firing. */
  async function ensureWeapon(weapon: Weapon) {
    const client = clientRef.current;
    if (!client) return;
    const current = client.view()?.you.weapon;
    if (current === weapon) return;
    if (weapon === 'rock') await client.rockActive();
    else if (weapon === 'saber') await client.saberActive();
    else await client.gunActive();
  }

  async function cameraCommands(commands: BattleCommand[]) {
    const client = clientRef.current;
    if (!client || client.status() !== 'online' || viewRef.current?.phase !== 'active') {
      setNote('Wait until both pilots are connected and the match is active.');
      return;
    }
    for (const command of commands) {
      const reply = await dispatchBattleCommand(client, command);
      if (!reply) continue;
      setNote(describeCombatReply(command.name, reply));
      if (command.name === 'fireGun' && reply.status === 'accepted') {
        setBolt({ startedAt: performance.now() });
      }
      if (command.name === 'slash' && reply.status === 'accepted') {
        setSlashAt(performance.now());
      }
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
  const saberCd = remaining(you?.cooldowns.saber);
  const incoming = remaining(rival?.projectile?.landsInMs) > 0;

  return (
    <main className="flight-flow" style={{ ['--ob-accent' as string]: accentCss(accent) }}>
      <header className="flight-header">
        <span>LIVE TWO-PLAYER / MARS</span>
        <a href="/">Back to cockpit</a>
      </header>
      <section className="flight-panel">
        <h1>Two-player duel</h1>
        <p>
          Both players open <code>/?pvp=1</code>. This page auto-challenges, accepts, and presses Ready — keep the
          game server on port 3001.
        </p>
        <p className="flight-notice" style={{ borderColor: accentCss(accent) }}>
          Flying as <strong>{callsign}</strong> aboard <strong>{shipName}</strong>. Real shared combat · one demo room · Mars
          arena. Cockpit challenges can route here; rehearsal link is <code>/?pvp=1</code>.
        </p>
        <p role="status">{note}</p>
        <p className="flight-muted" role="status">
          Lobby: {lobbyInfo}
        </p>
        {!online && (
          <button className="flight-primary" type="button" onClick={() => window.location.reload()}>
            Reconnect
          </button>
        )}
        <p>
          <strong data-testid="live-phase">{view?.phase ?? (online ? 'lobby' : 'offline')}</strong>
          {' · '}
          {you ? `You are Pilot ${you.slot} (${callsign})` : online ? `Lobby as ${callsign}` : 'Not connected'}
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
          rock CD {(rockCd / 1000).toFixed(1)}s · gun CD {(gunCd / 1000).toFixed(1)}s · saber CD{' '}
          {(saberCd / 1000).toFixed(1)}s
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
              onClick={() => void run('saberActive', () => clientRef.current!.saberActive())}
            >
              Select saber
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
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run('slash', async () => {
                  await ensureWeapon('saber');
                  return clientRef.current!.slash();
                })
              }
            >
              Slash
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
            {new URLSearchParams(window.location.search).get('from') === 'explore' && (
              <p>
                <a href="/?explore=1">Return to free-flight explore</a>
              </p>
            )}
          </div>
        )}
        <p className="flight-muted">
          Server owns damage. Saber hits are a short timing window (Wii-style), not physical blade contact. Mars arena
          composites the opponent cutout.
        </p>
      </section>
      {active && you && (
        <CameraDebugPage
          mode="duel"
          flightSeconds={1.302}
          duel={{
            worldName: 'Mars',
            gravity: 3.7,
            rivalName: `Pilot ${rival?.slot ?? '?'}`,
            health: you.health,
            rivalHealth: rival?.health ?? 100,
            incoming,
            note,
            serverNote: note,
            weapon: you.weapon,
            onSelectRock: () => void run('rockActive', () => clientRef.current!.rockActive()),
            onSelectGun: () => void run('gunActive', () => clientRef.current!.gunActive()),
            onSelectSaber: () => void run('saberActive', () => clientRef.current!.saberActive()),
            onFireGun: () =>
              void run('fireGun', async () => {
                await ensureWeapon('gun');
                return clientRef.current!.fireGun();
              }),
            onSlash: () =>
              void run('slash', async () => {
                await ensureWeapon('saber');
                return clientRef.current!.slash();
              }),
            boltStartedAt: bolt?.startedAt ?? null,
            boltFlightMs: GUN_FLIGHT_MS,
            slashStartedAt: slashAt,
            rockResolvedAt,
            immersive: true,
          }}
          onCommands={(commands) => void cameraCommands(commands)}
        />
      )}
    </main>
  );
}
