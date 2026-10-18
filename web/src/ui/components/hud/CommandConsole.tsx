import type { ReactNode } from 'react';
import type { ConnectionStatus, LobbyView } from '../../state/lobbyTypes';

const KEYS: { view: LobbyView; label: string; hint: string; icon: string }[] = [
  { view: 'radar', label: 'Radar', hint: 'Find pilots', icon: 'M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5M12 12l7-7' },
  { view: 'profile', label: 'Pilot ID', hint: 'Profile', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0' },
  { view: 'settings', label: 'Systems', hint: 'Settings', icon: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6' },
];

/**
 * Compact entry points for the two cockpit hotspots, docked at the bottom edge
 * so nothing floats over the globe, windshield or console.
 */
export function CockpitShortcuts({
  count,
  connection,
  hidden,
  onRadar,
  onConsole,
  onPilot,
  controls,
}: {
  count: number;
  connection: ConnectionStatus;
  hidden: boolean;
  onRadar: () => void;
  onConsole: () => void;
  onPilot?: () => void;
  controls?: ReactNode;
}) {
  const radarMeta = connection === 'online' ? `${count} nearby` : connection === 'connecting' ? 'Scanning…' : 'No link';
  return (
    <nav className={`sd-dock sd-dock--bottom sd-shortcuts${controls ? ' sd-shortcuts--with-mode' : ''}`} data-hidden={hidden} aria-label="Cockpit shortcuts">
      <button type="button" className="sd-shortcut" data-ui-sound="commit" onClick={onRadar} aria-label={`Proximity radar, ${radarMeta}`}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
          <path d={KEYS[0].icon} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="sd-shortcut__text">
          <span className="sd-shortcut__label">Radar</span>
          <span className="sd-shortcut__meta">{radarMeta}</span>
        </span>
      </button>
      <button type="button" className="sd-shortcut" onClick={onConsole} aria-label="Open command console">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
          <path d="M4 6h16v9H4zM9 19h6M12 15v4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="sd-shortcut__text">
          <span className="sd-shortcut__label">Console</span>
          <span className="sd-shortcut__meta">Controls</span>
        </span>
      </button>
      {onPilot && <button type="button" className="sd-shortcut" onClick={onPilot} aria-label="Sit in pilot seat and explore">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M6 19v-6a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v6M4 19h16M9 9V5a3 3 0 0 1 6 0v4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
        <span className="sd-shortcut__text"><span className="sd-shortcut__label">Seat</span><span className="sd-shortcut__meta">Explore</span></span>
      </button>}
      {controls}
    </nav>
  );
}

/** Holographic command keys, shown while the camera is zoomed to the center console. */
export function CommandConsole({ hidden, onNavigate }: { hidden: boolean; onNavigate: (v: LobbyView) => void }) {
  return (
    <nav className="sd-dock sd-dock--center sd-command" data-hidden={hidden} aria-label="Command console">
      <p className="sd-command__title" aria-hidden>
        <span>Command console</span>
        <span className="sd-command__blink">●</span>
      </p>
      <div className="sd-command__keys">
        {KEYS.map((k) => (
          <button key={k.view} type="button" className="sd-key" data-ui-sound={k.view === 'radar' || k.view === 'profile' ? 'commit' : undefined} onClick={() => onNavigate(k.view)} aria-label={`${k.label}: ${k.hint}`}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
              <path d={k.icon} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="sd-key__label">{k.label}</span>
            <span className="sd-key__hint">{k.hint}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
