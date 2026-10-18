import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { AnchorRegistry } from '../components/spaceship/anchors';
import { ProfileChip, ProfilePanel } from '../components/hud/PlayerProfile';
import { BlipLabels, NearbyPlayersPanel } from '../components/hud/NearbyPlayers';
import { CommandConsole, CockpitShortcuts } from '../components/hud/CommandConsole';
import { ChallengeModal } from '../components/hud/ChallengeModal';
import { SettingsPanel } from '../components/hud/SettingsPanel';
import { HoloButton } from '../components/hud/primitives';
import { useMockLobby } from '../state/useMockLobby';
import type { LobbyView, LobbyViewModel, NearbyPilot, SceneSettings } from '../state/lobbyTypes';
import '../styles/spaceship.css';
import '../styles/explore.css';
import '../../onboarding/onboarding.css';

const SpaceshipScene = lazy(() => import('../components/spaceship/SpaceshipScene').then((m) => ({ default: m.SpaceshipScene })));
const ExploreApp = lazy(() => import('./ExploreApp').then((m) => ({ default: m.ExploreApp })));
const HyperspaceTunnel = lazy(() =>
  import('../../onboarding/HyperspaceTunnel').then((m) => ({ default: m.HyperspaceTunnel })),
);

export interface SpaceshipHomeProps {
  /** Real lobby adapter from the multiplayer module. Uses local mocks when omitted. */
  lobby?: LobbyViewModel;
  /**
   * Called once the launch transition finishes. Integration point for the
   * battle setup flow (owned by the game lead). If omitted, a placeholder
   * hand-off screen is shown.
   */
  onEnterBattle?: (opponent: NearbyPilot) => void;
  /** Optional GLB cockpit to replace the procedural prototype. */
  cockpitModelUrl?: string;
}

const LAUNCH_MS = 1700;
/** Time for CameraController to ease into the seat before the drive warp. */
const SEAT_EASE_MS = 1600;
const SEAT_WARP_MS = 2000;

type BridgePhase = 'bridge' | 'boarding' | 'warping' | 'drive';

function initialSettings(): SceneSettings {
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let saved: Partial<SceneSettings> = {};
  try {
    saved = JSON.parse(localStorage.getItem('sd.settings') ?? '{}');
  } catch {
    /* storage unavailable */
  }
  return { quality: 'high', reducedMotion: !!reduced, parallax: true, ...saved };
}

export function SpaceshipHome({ lobby: external, onEnterBattle, cockpitModelUrl }: SpaceshipHomeProps) {
  const mock = useMockLobby({ enabled: !external });
  const lobby = external ?? mock.lobby;
  const { challenge, actions } = lobby;

  const anchors = useMemo(() => new AnchorRegistry(), []);
  const [view, setView] = useState<LobbyView>('lobby');
  const [phase, setPhase] = useState<BridgePhase>('bridge');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settings, setSettings] = useState<SceneSettings>(initialSettings);
  const [autoDowngraded, setAutoDowngraded] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [handoff, setHandoff] = useState<NearbyPilot | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('sd.settings', JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }, [settings]);

  // Launch transition -> hand off to battle setup.
  useEffect(() => {
    if (challenge.kind !== 'launching') return;
    const opp = challenge.opponent;
    const id = setTimeout(() => {
      if (onEnterBattle) onEnterBattle(opp);
      else setHandoff(opp);
    }, settings.reducedMotion ? 300 : LAUNCH_MS);
    return () => clearTimeout(id);
  }, [challenge, onEnterBattle, settings.reducedMotion]);

  // Close side panels when a challenge takes over the bridge.
  useEffect(() => {
    if (challenge.kind === 'outgoing' || challenge.kind === 'incoming' || challenge.kind === 'accepted') {
      setView('lobby');
      if (phase === 'boarding' || phase === 'warping') setPhase('bridge');
    }
  }, [challenge.kind, phase]);

  // Drop the selection if that pilot leaves range.
  useEffect(() => {
    if (selectedId && !lobby.nearby.some((p) => p.id === selectedId)) setSelectedId(null);
  }, [lobby.nearby, selectedId]);

  // Sit → ease camera into seat → hyperspace transport → open-universe drive.
  useEffect(() => {
    if (view !== 'pilot' || phase !== 'boarding') return;
    const easeMs = settings.reducedMotion ? 280 : SEAT_EASE_MS;
    const id = window.setTimeout(() => setPhase('warping'), easeMs);
    return () => clearTimeout(id);
  }, [view, phase, settings.reducedMotion]);

  const sitInPilot = useCallback(() => {
    setView('pilot');
    setPhase('boarding');
  }, []);

  const leaveSeatOrBridge = useCallback(() => {
    if (phase === 'boarding' || phase === 'warping') {
      setPhase('bridge');
      setView('lobby');
      return;
    }
    setView('lobby');
  }, [phase]);

  const navigate = useCallback((v: LobbyView) => {
    if (v === 'pilot') {
      setView('pilot');
      setPhase('boarding');
      return;
    }
    setView(v);
  }, []);
  const closePanel = useCallback(() => leaveSeatOrBridge(), [leaveSeatOrBridge]);

  useEffect(() => {
    if (view !== 'console' && view !== 'pilot') return;
    if (phase === 'warping') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      leaveSeatOrBridge();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, phase, leaveSeatOrBridge]);

  const select = useCallback((id: string) => {
    setSelectedId(id);
    setView('radar');
  }, []);

  const mood =
    phase === 'warping' || challenge.kind === 'launching'
      ? 'launch'
      : challenge.kind === 'incoming'
        ? 'alert'
        : challenge.kind === 'ready' || challenge.kind === 'accepted'
          ? 'ready'
          : 'calm';
  const busy = challenge.kind !== 'idle' && challenge.kind !== 'declined';
  const lobbyView = view === 'lobby' && !busy && phase === 'bridge';

  const returnToBridge = () => {
    setHandoff(null);
    actions.dismiss();
    setView('lobby');
    setPhase('bridge');
  };

  const exitDrive = () => {
    setPhase('bridge');
    setView('lobby');
    setSceneReady(false);
  };

  if (phase === 'drive') {
    return (
      <Suspense fallback={<p className="sd-boot__line">Engaging drive…</p>}>
        <ExploreApp lobby={lobby} settings={settings} onSettingsChange={setSettings} onExit={exitDrive} />
      </Suspense>
    );
  }

  return (
    <div className="sd-root" data-quality={settings.quality} data-reduced-motion={settings.reducedMotion} data-mood={mood} data-ready={sceneReady}>
      <Suspense fallback={null}>
        <SpaceshipScene
          settings={settings}
          view={view}
          mood={mood}
          pilots={lobby.nearby}
          selectedId={selectedId}
          callsign={lobby.self.callsign}
          connection={lobby.connection}
          anchors={anchors}
          cockpitModelUrl={cockpitModelUrl}
          onNavigate={navigate}
          onSelectPilot={select}
          onReady={() => setSceneReady(true)}
          onLowPerformance={() => {
            setAutoDowngraded(true);
            setSettings((s) => ({ ...s, quality: 'low' }));
          }}
        />
      </Suspense>

      <div className="sd-hud">
        <header className="sd-topbar">
          <p className="sd-brand">
            <span>Jedi Space Duels</span>
            <span className="sd-brand__sub">
              {phase === 'boarding' || view === 'pilot' ? 'Pilot seat // Boarding' : 'Bridge // Lobby'}
            </span>
          </p>
          {view !== 'lobby' ? (
            <HoloButton size="sm" onClick={closePanel} aria-label="Back to bridge">
              {view === 'pilot' ? '‹ Leave seat' : '‹ Bridge'}
            </HoloButton>
          ) : (
            <button type="button" className="sd-icon-btn sd-icon-btn--lg" onClick={() => setView('settings')} aria-label="Open systems settings">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
                <path d="M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </header>

        <ProfileChip self={lobby.self} connection={lobby.connection} hidden={!lobbyView} onOpen={() => setView('profile')} />
        <CockpitShortcuts
          count={lobby.nearby.length}
          connection={lobby.connection}
          hidden={!lobbyView}
          onRadar={() => setView('radar')}
          onConsole={() => setView('console')}
          onPilot={sitInPilot}
        />
        <CommandConsole hidden={view !== 'console'} onNavigate={navigate} />
        {view === 'pilot' && phase === 'boarding' && (
          <p className="sd-pilot-hint" aria-live="polite">
            Seated · engaging flight systems…
          </p>
        )}
        {view === 'radar' && <BlipLabels anchors={anchors} pilots={lobby.nearby} selectedId={selectedId} onSelect={setSelectedId} />}

        <NearbyPlayersPanel
          open={view === 'radar'}
          pilots={lobby.nearby}
          connection={lobby.connection}
          selectedId={selectedId}
          challengeBusy={busy}
          onSelect={setSelectedId}
          onChallenge={(id) => actions.challenge(id)}
          onClose={closePanel}
        />
        <ProfilePanel
          open={view === 'profile'}
          self={lobby.self}
          connection={lobby.connection}
          discoveryLabel={lobby.discoveryLabel}
          onClose={closePanel}
          onOpenSettings={() => setView('settings')}
        />
        <SettingsPanel
          open={view === 'settings'}
          settings={settings}
          callsign={lobby.self.callsign}
          connection={lobby.connection}
          autoDowngraded={autoDowngraded}
          onChange={(s) => {
            if (s.quality !== settings.quality) setAutoDowngraded(false);
            setSettings(s);
          }}
          onCallsign={actions.setCallsign}
          onClose={closePanel}
          dev={external ? undefined : mock.dev}
        />

        <ChallengeModal
          phase={challenge}
          self={lobby.self}
          onAccept={actions.accept}
          onDecline={actions.decline}
          onCancel={actions.cancelChallenge}
          onDismiss={actions.dismiss}
          onLaunch={actions.launch}
        />
      </div>

      <div className="sd-launch" data-active={challenge.kind === 'launching' || phase === 'warping'} aria-hidden={challenge.kind !== 'launching' && phase !== 'warping'}>
        <p>{phase === 'warping' ? 'Opening the void…' : 'Expanding domain…'}</p>
      </div>

      {phase === 'warping' && (
        <Suspense fallback={<div className="ob-warp" />}>
          <HyperspaceTunnel
            active
            caption="Launching free flight…"
            durationMs={settings.reducedMotion ? 400 : SEAT_WARP_MS}
            onFinished={() => setPhase('drive')}
          />
        </Suspense>
      )}

      {handoff && (
        <div className="sd-handoff" role="dialog" aria-modal="true" aria-labelledby="sd-handoff-title">
          <div className="sd-challenge__card">
            <p className="sd-eyebrow">Hand-off point</p>
            <h2 id="sd-handoff-title" className="sd-challenge__title">
              Battle setup vs {handoff.callsign}
            </h2>
            <p className="sd-challenge__desc">
              The lobby is finished here. Pass <code>onEnterBattle</code> to <code>SpaceshipHome</code> to continue into shared battle setup (owned by the game client).
            </p>
            <div className="sd-challenge__actions">
              <HoloButton variant="primary" onClick={returnToBridge} data-autofocus autoFocus>
                Return to bridge
              </HoloButton>
            </div>
          </div>
        </div>
      )}

      <div className="sd-boot" data-done={sceneReady} aria-hidden={sceneReady}>
        <p className="sd-eyebrow">Jedi Space Duels</p>
        <p className="sd-boot__line">Powering bridge systems…</p>
      </div>
    </div>
  );
}
