import { BRAND_NAME } from '../brand';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnchorRegistry } from '../components/spaceship/anchors';
import { ProfileChip, ProfilePanel } from '../components/hud/PlayerProfile';
import { BlipLabels, NearbyPlayersPanel } from '../components/hud/NearbyPlayers';
import { CommandConsole, CockpitShortcuts } from '../components/hud/CommandConsole';
import { ChallengeModal } from '../components/hud/ChallengeModal';
import { SettingsPanel } from '../components/hud/SettingsPanel';
import { HoloButton } from '../components/hud/primitives';
import { HologramCopilot } from '../../voice/HologramCopilot';
import type { GameClient } from '../../networking';
import { useMockLobby } from '../state/useMockLobby';
import type { LobbyView, LobbyViewModel, NearbyPilot, SceneSettings } from '../state/lobbyTypes';
import { preloadPlanetaryTextures } from '../cinematics/PlanetaryRoulette';
import { PlanetaryTransition } from '../cinematics/PlanetaryTransition';
import { PlanetarySound } from '../cinematics/PlanetarySound';
import type { PlanetaryCinematicState } from '../cinematics/sequence';
import type { DestinationId } from '../../destinations/config';
import '../styles/spaceship.css';
import '../styles/explore.css';
import '../../onboarding/onboarding.css';

const SpaceshipScene = lazy(() => import('../components/spaceship/SpaceshipScene').then((m) => ({ default: m.SpaceshipScene })));
const ExploreApp = lazy(() => import('./ExploreApp').then((m) => ({ default: m.ExploreApp })));

export interface SpaceshipHomeProps {
  /** Real lobby adapter from the multiplayer module. Uses local mocks when omitted. */
  lobby?: LobbyViewModel;
  /** Development-only local rehearsal callback; normal gameplay uses onTravelComplete. */
  onEnterBattle?: (opponent: NearbyPilot) => void;
  /** Server world for this match. Travel plays that destination, Mars when omitted. */
  destination?: DestinationId;
  /** Called once after travel ends or is skipped, with the destination that played. */
  onTravelComplete?: (destination: DestinationId) => void;
  /** Optional GLB cockpit to replace the procedural prototype. */
  cockpitModelUrl?: string;
  /** Optional compact controls in the existing Radar / Console dock. */
  cockpitControls?: ReactNode;
  /** Read-only Grok access through this live player connection; omitted in Demo. */
  copilotClient?: GameClient;
}

/** Time for CameraController to ease into the seat before the drive warp. */
const SEAT_EASE_MS = 1600;
/** Forward push + fade from the seat into flight (replaces the hyperspace tunnel cut). */
const SEAT_PUSH_MS = 1100;

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

export function SpaceshipHome({ lobby: external, destination = 'mars', onEnterBattle, onTravelComplete, cockpitModelUrl, cockpitControls, copilotClient }: SpaceshipHomeProps) {
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
  const [rouletteAssetsReady, setRouletteAssetsReady] = useState(false);
  const [rouletteReady, setRouletteReady] = useState(false);
  const markRouletteReady = useCallback((ready: boolean) => setRouletteReady(ready), []);
  useEffect(() => {
    let cancelled = false;
    const finish = () => { if (!cancelled) setRouletteAssetsReady(true); };
    const timeout = window.setTimeout(finish, 10000);
    void preloadPlanetaryTextures().then(finish);
    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, []);
  const [handoff, setHandoff] = useState<NearbyPilot | null>(null);
  const [travelActive, setTravelActive] = useState(false);
  const [cinematic, setCinematic] = useState<PlanetaryCinematicState>({ phase: 'idle', selectedPlanet: 'earth' });
  const cinematicTick = useRef<((delta: number) => void) | null>(null);
  const tickCinematic = useCallback((delta: number) => cinematicTick.current?.(delta), []);
  const travelOpponent = useRef<NearbyPilot | null>(null);
  const sound = useMemo(() => new PlanetarySound(), []);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioUnavailable, setAudioUnavailable] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('sd.settings', JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }, [settings]);

  // An authoritative lobby adapter must only report launching after match acceptance.
  useEffect(() => {
    if (challenge.kind === 'launching') {
      travelOpponent.current = challenge.opponent;
      setTravelActive(true);
      return;
    }
    setTravelActive(false);
    setCinematic({ phase: 'idle', selectedPlanet: 'earth' });
    travelOpponent.current = null;
  }, [challenge]);

  useEffect(() => () => sound.dispose(), [sound]);

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

  const updateCinematic = useCallback((state: PlanetaryCinematicState) => setCinematic(state), []);
  const enableCinematicAudio = useCallback(() => {
    void sound.unlock().then((enabled) => {
      setAudioEnabled(enabled);
      setAudioUnavailable(!enabled);
      if (enabled) sound.activation();
    });
  }, [sound]);
  const launch = useCallback(() => {
    enableCinematicAudio();
    actions.launch();
  }, [actions, enableCinematicAudio]);
  const finishTravel = useCallback(
    (destination: DestinationId) => {
      setTravelActive(false);
      setCinematic({ phase: 'idle', selectedPlanet: 'mars' });
      const opponent = travelOpponent.current;
      travelOpponent.current = null;
      if (onTravelComplete) onTravelComplete(destination);
      else if (onEnterBattle && opponent) onEnterBattle(opponent);
      else if (opponent) setHandoff(opponent);
    },
    [onEnterBattle, onTravelComplete],
  );

  // Sit → ease camera into seat → hyperspace transport → open-universe drive.
  useEffect(() => {
    if (view !== 'pilot' || phase !== 'boarding') return;
    const easeMs = settings.reducedMotion ? 280 : SEAT_EASE_MS;
    const id = window.setTimeout(() => setPhase('warping'), easeMs);
    return () => clearTimeout(id);
  }, [view, phase, settings.reducedMotion]);

  const sitInPilot = useCallback(() => {
    // Warm the flight-mode code while the camera eases into the seat.
    void import('./ExploreApp');
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
      void import('./ExploreApp');
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
    phase === 'warping' || (challenge.kind === 'launching' && cinematic.phase !== 'idle')
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
    // The cockpit scene remounts; travel waits for it (and the roulette) to report ready again.
    setSceneReady(false);
    setRouletteReady(false);
  };

  if (phase === 'drive') {
    return (
      <Suspense fallback={<p className="sd-boot__line">Engaging drive…</p>}>
        <ExploreApp
          lobby={lobby}
          settings={settings}
          onSettingsChange={setSettings}
          onExit={exitDrive}
          onMatchLaunch={exitDrive}
          onEngage={launch}
          copilotClient={copilotClient}
        />
      </Suspense>
    );
  }

  return (
    <div
      className="sd-root"
      data-quality={settings.quality}
      data-reduced-motion={settings.reducedMotion}
      data-mood={mood}
      data-ready={sceneReady}
      data-travel-active={travelActive}
    >
      <Suspense fallback={null}>
        <SpaceshipScene
          settings={settings}
          view={view}
          mood={mood}
          cinematic={cinematic}
          prepareRoulette={rouletteAssetsReady}
          onRoulettePrepared={markRouletteReady}
          onCinematicFrame={tickCinematic}
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

      <div className="sd-hud" aria-hidden={travelActive}>
        <header className="sd-topbar">
          <p className="sd-brand">
            <span className="ko-wordmark">{BRAND_NAME}</span>
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
          controls={cockpitControls}
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

        <HologramCopilot lobby={lobby} client={copilotClient} hidden={!lobbyView} onNavigate={navigate} onSelectPilot={select} />

        <ChallengeModal
          phase={challenge}
          self={lobby.self}
          onAccept={actions.accept}
          onDecline={actions.decline}
          onCancel={actions.cancelChallenge}
          onDismiss={actions.dismiss}
          onLaunch={launch}
        />
      </div>

      <div
        className="sd-launch"
        data-active={challenge.kind === 'launching' && !travelActive}
        aria-hidden={challenge.kind !== 'launching' || travelActive}
      >
        <p>Expanding domain…</p>
      </div>

      {/* Seat → flight: the camera pushes toward the glass while the cockpit fades into the void flight mode boots from. */}
      {phase === 'warping' && (
        <div className="sd-seat-launch" aria-hidden style={{ animationDuration: `${settings.reducedMotion ? 250 : SEAT_PUSH_MS}ms` }}
          onAnimationEnd={(e) => { if (e.target === e.currentTarget) setPhase('drive'); }}>
          <p>Engaging flight systems</p>
        </div>
      )}

      <div className="sd-launch" data-active={challenge.kind === 'launching' && !travelActive} aria-hidden={challenge.kind !== 'launching' || travelActive}>
        <p>Expanding domain…</p>
      </div>

      {travelActive && (
        <PlanetaryTransition
          destination={destination}
          sceneReady={sceneReady && rouletteReady}
          frameTick={cinematicTick}
          reducedMotion={settings.reducedMotion}
          audio={sound}
          audioEnabled={audioEnabled}
          audioUnavailable={audioUnavailable}
          onEnableAudio={enableCinematicAudio}
          onStateChange={updateCinematic}
          onComplete={finishTravel}
        />
      )}

      {handoff && (
        <div className="sd-handoff" role="dialog" aria-modal="true" aria-labelledby="sd-handoff-title">
          <div className="sd-challenge__card">
            <p className="sd-eyebrow">Destination locked // Mars</p>
            <h2 id="sd-handoff-title" className="sd-challenge__title">
              Mars arena connection
            </h2>
            <p className="sd-challenge__desc">
              Planetary travel is complete. Connect the accepted match to its server-backed briefing and readiness flow to enter the live Mars arena.
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
        <p className="sd-eyebrow ko-wordmark">{BRAND_NAME}</p>
        <p className="sd-boot__line">Powering bridge systems…</p>
      </div>
    </div>
  );
}
