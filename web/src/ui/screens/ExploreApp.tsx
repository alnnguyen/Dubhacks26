import { AnimatePresence } from 'motion/react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExploreBoundary } from '../components/explore/ExploreBoundary';
import { useProgress } from '@react-three/drei';
import { isLocalDestination, type LocalZoomCommand, type LocalZoomRequest } from '../components/explore/localNavigation';
import { ExploreHud, type ExploreMode } from '../components/explore/ExploreHud';
import { MissionBanner, type Mission } from '../components/explore/MissionBanner';
import { DESTINATIONS, destinationById, type ExploreDestination } from '../components/explore/destinations';
import type { FlightInput, FlightTelemetry } from '../components/explore/ShipFlightController';
import { planetFacts, scienceForBodyId, type BodyScience } from '../components/explore/bodiesScience';
import { PlanetPanel, type PlanetPanelTab } from '../components/explore/PlanetPanel';
import { ObjectPanel } from '../components/explore/ObjectPanel';
import { ChallengeModal } from '../components/hud/ChallengeModal';
import { HoloButton } from '../components/hud/primitives';
import { destinationForBody } from '../components/explore/destinations';
import { exploreLocation, sameLocation } from '../components/explore/pilotLocation';
import { ExploreCopilot } from '../../voice/ExploreCopilot';
import type { ExploreSnapshot, LyraAction } from '../../voice/exploreLyra';
import type { GameClient } from '../../networking';
import { useMockLobby } from '../state/useMockLobby';
import type { ExploreLocation, LobbyViewModel, NearbyPilot, SceneSettings } from '../state/lobbyTypes';
import '../styles/spaceship.css';
import '../styles/explore.css';
import '../styles/galaxyBrand.css';
import '../../onboarding/onboarding.css';
import { gameAudio } from '../../audio/gameAudio';
import { useAudioScene } from '../../audio/useAudioScene';

const ExploreScene = lazy(() =>
  import('../components/explore/ExploreScene').then((m) => ({ default: m.ExploreScene })),
);
const HyperspaceTunnel = lazy(() =>
  import('../../onboarding/HyperspaceTunnel').then((m) => ({ default: m.HyperspaceTunnel })),
);


function initialSettings(): SceneSettings {
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let saved: Partial<SceneSettings> = {};
  try {
    saved = JSON.parse(localStorage.getItem('sd.settings') ?? '{}');
  } catch {
    /* ignore */
  }
  // Prefer high on desktop-class devices
  const desktop = typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches;
  return { quality: desktop ? 'high' : 'low', reducedMotion: !!reduced, parallax: true, ...saved };
}

const MODE_KEY = 'sd.explore.mode';
const NO_PILOTS: NearbyPilot[] = [];
function initialMode(): ExploreMode {
  try { return localStorage.getItem(MODE_KEY) === 'explore' ? 'explore' : 'flight'; } catch { return 'flight'; }
}

function initialDestination(): ExploreDestination {
  const id = new URLSearchParams(window.location.search).get('dest');
  return destinationById(id ?? 'sol');
}

const EMPTY_INPUT: FlightInput = { thrust: 0, yaw: 0, pitch: 0, strafe: 0, brake: false };

export interface ExploreAppProps {
  lobby?: LobbyViewModel;
  settings?: SceneSettings;
  onSettingsChange?: (s: SceneSettings) => void;
  onExit?: () => void;
  onBattleLaunch?: () => void;
  copilotClient?: GameClient;
}

export function ExploreApp({ lobby: external, settings: settingsProp, onSettingsChange, onExit, onBattleLaunch, copilotClient }: ExploreAppProps = {}) {
  const mock = useMockLobby({ enabled: false });
  const lobby = external ?? mock.lobby;
  const { challenge, actions } = lobby;

  const [localSettings, setLocalSettings] = useState<SceneSettings>(initialSettings);
  const settings = settingsProp ?? localSettings;
  const setSettings = (next: SceneSettings | ((s: SceneSettings) => SceneSettings)) => {
    const value = typeof next === 'function' ? next(settings) : next;
    onSettingsChange?.(value);
    if (!settingsProp) setLocalSettings(value);
  };

  const isTouch = useMemo(
    () => typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window),
    [],
  );

  const [destination, setDestination] = useState<ExploreDestination>(initialDestination);
  const [mission, setMission] = useState<Mission | null>(null);
  const missionSeq = useRef(0);
  const announce = useCallback((m: Omit<Mission, 'id'>) => setMission({ ...m, id: ++missionSeq.current }), []);
  const clearMission = useCallback(() => setMission(null), []);
  const [mode, setMode] = useState<ExploreMode>(initialMode);
  const entered = useRef(false);
  useEffect(() => { try { localStorage.setItem(MODE_KEY, mode); } catch { /* private mode */ } }, [mode]);
  // Peaceful explore: other pilots' ships and contacts are hidden, and you stop sharing your location.
  const peaceful = mode === 'explore';
  const visiblePilots = peaceful ? NO_PILOTS : lobby.nearby;
  const [pendingJump, setPendingJump] = useState<ExploreDestination | null>(null);
  const [jumping, setJumping] = useState(false);
  useAudioScene(jumping ? 'travel' : 'cockpit');
  useEffect(() => jumping ? gameAudio.play('jump') : undefined, [jumping]);
  const [resetToken, setResetToken] = useState(0);
  const [zoomRequest, setZoomRequest] = useState<LocalZoomRequest>();
  const zoomSequence = useRef(0);
  const [navOpen, setNavOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [learn, setLearn] = useState<BodyScience | null>(null);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [cutawayOpen, setCutawayOpen] = useState(false);
  const [highlightLayer,setHighlightLayer]=useState(-1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneAttempt, setSceneAttempt] = useState(0);
  const [slowLoad, setSlowLoad] = useState(false);
  const { active: loadingAssets, progress: assetProgress, errors: assetErrors } = useProgress();
  const jumpPending = useRef<ExploreDestination | null>(null);
  useEffect(() => {
    if (sceneReady) { setSlowLoad(false); return; }
    const timer = setTimeout(() => setSlowLoad(true), 12000);
    return () => clearTimeout(timer);
  }, [sceneReady, sceneAttempt]);
  const [telemetry, setTelemetry] = useState<FlightTelemetry>({
    speed: 0,
    nearestName: '—',
    nearestId: '',
    nearestDistance: 0,
    position: [...DESTINATIONS[0].spawn],
    absoluteDistance: 0,
    scaleBand: 'planet',
    scaleLabel: 'Solar system',
    showMilkyWay: false,
    boosting: false,
    pointerLocked: false,
  });
  const [input, setInput] = useState<FlightInput>(EMPTY_INPUT);

  useEffect(() => {
    if (settingsProp) return;
    try {
      localStorage.setItem('sd.settings', JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }, [settings, settingsProp]);

  useEffect(() => {
    if (selectedId && !lobby.nearby.some((p) => p.id === selectedId)) setSelectedId(null);
  }, [lobby.nearby, selectedId]);

  const startJump = useCallback(
    (id: string) => {
      const dest = destinationById(id);
      if (jumping) return;
      setInput(EMPTY_INPUT);
      setZoomRequest(undefined);
      if (isLocalDestination(destination) && isLocalDestination(dest)) {
        setNavOpen(false); setLearn(null); setDestination(dest); setResetToken(n => n+1);
        announce({ eyebrow: 'Course plotted / local flight', lead: 'Approaching', word: dest.label, holdMs: 2200 });
        const url = new URL(window.location.href);
        if (url.searchParams.has('explore')) { url.searchParams.set('dest', dest.id); window.history.replaceState({}, '', url); }
        return;
      }
      jumpPending.current = dest;
      announce({ eyebrow: 'Hyperspace / confirmed', lead: 'Destination', word: 'Locked', detail: dest.label, laser: true, holdMs: 2100 });
      setNavOpen(false);
      setLearn(null);
      setPendingJump(dest);
      setJumping(true);
    },
    [destination, jumping, announce],
  );

  const openNav = useCallback(() => {
    if (document.pointerLockElement) document.exitPointerLock?.();
    setNavOpen(true);
  }, []);

  const onWarpFinished = useCallback(() => {
    const pending = jumpPending.current;
    if (!pending) return;
    jumpPending.current = null;
    announce({ eyebrow: 'Hyperspace / complete', lead: 'Arriving', word: pending.label, detail: pending.briefing, holdMs: 2400 });
    setDestination(pending);
    setResetToken(n => n + 1);
    setSceneReady(false);
    setJumping(false);
    setPendingJump(null);
    const url = new URL(window.location.href);
    if (url.searchParams.has('explore')) {
      url.searchParams.set('dest', pending.id);
      window.history.replaceState({}, '', url);
    }
  }, [announce]);

  useEffect(() => {
    if (!jumping) return;
    const timer = setTimeout(onWarpFinished, settings.reducedMotion ? 450 : 2400);
    return () => clearTimeout(timer);
  }, [jumping, onWarpFinished, settings.reducedMotion]);

  const closeInspect = useCallback(() => {
    setCutawayOpen(false);
    setInspectId(null);
  }, []);

  const onLearn = useCallback((bodyId: string) => {
    if (document.pointerLockElement) document.exitPointerLock?.();
    if (planetFacts(bodyId) && isLocalDestination(destination)) {
      setLearn(null);
      setCutawayOpen(false);
      setInspectId(bodyId);
      return;
    }
    // Every other cataloged object opens the same side view (the camera frames it when it's in the local view).
    if (scienceForBodyId(bodyId)) {
      setLearn(null);
      setCutawayOpen(false);
      setInspectId(bodyId);
    }
  }, [destination]);

  const onInspectTab = useCallback((tab: PlanetPanelTab) => {
    setCutawayOpen(tab === 'dissect');
  }, []);

  const busy = challenge.kind !== 'idle' && challenge.kind !== 'declined';
  const warp = jumping || challenge.kind === 'launching' ? 1 : 0;
  const flightEnabled = sceneReady && !jumping && !navOpen && !creditsOpen && !learn && !inspectId && !busy;
  useEffect(() => { if (!flightEnabled) setInput(EMPTY_INPUT); }, [flightEnabled]);
  useEffect(() => {
    const clear = () => setInput(EMPTY_INPUT);
    const visibility = () => { if (document.hidden) clear(); };
    const key = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !(event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]'))) clear();
      if (['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE'].includes(event.code) && !(event.target instanceof HTMLElement && event.target.closest('input, textarea'))) setInput(i => ({ ...i, brake: false }));
      if (event.code === 'Escape') {
        setNavOpen(false);
        setCreditsOpen(false);
        setLearn(null);
        closeInspect();
        clear();
      }
    };
    window.addEventListener('blur', clear);
    window.addEventListener('keydown', key);
    document.addEventListener('visibilitychange', visibility);
    return () => { window.removeEventListener('blur', clear); window.removeEventListener('keydown', key); document.removeEventListener('visibilitychange', visibility); };
  }, [closeInspect]);
  const requestZoom = (command: LocalZoomCommand) => { setInput(EMPTY_INPUT); setZoomRequest({ sequence: ++zoomSequence.current, command }); };
  const sceneKey = isLocalDestination(destination) ? 'local' : destination.id;
  useEffect(() => {
    if (!sceneReady || entered.current) return;
    entered.current = true;
    announce({ eyebrow: 'Flight deck / free flight', lead: 'Choose your', word: 'Destination', detail: 'Press N to search the real catalogs · scroll to zoom', holdMs: 2800 });
  }, [sceneReady, announce]);

  // Tell other pilots roughly where you are (debounced; only real changes are sent).
  const setLocation = actions.setLocation;
  const reported = useRef<ExploreLocation | null>(null);
  const place = sceneReady && !jumping && !peaceful ? exploreLocation(telemetry.nearestId, telemetry.nearestName, destination) : null;
  const placeKey = place ? `${place.bodyId}|${place.label}` : '';
  useEffect(() => {
    if (!setLocation || !place || sameLocation(place, reported.current)) return;
    const id = setTimeout(() => { reported.current = place; setLocation(place); }, 1200);
    return () => clearTimeout(id);
    // placeKey captures the value of `place`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeKey, setLocation]);
  useEffect(() => {
    if (peaceful && reported.current) { reported.current = null; setLocation?.(null); }
  }, [peaceful, setLocation]);
  useEffect(() => () => { if (reported.current) setLocation?.(null); }, [setLocation]);

  const [rivalPrompt, setRivalPrompt] = useState<string | null>(null);
  const prompted = lobby.nearby.find((p) => p.id === rivalPrompt) ?? null;
  const flyToPilot = useCallback((id: string) => {
    const pilot = lobby.nearby.find((p) => p.id === id);
    const dest = pilot?.location && destinationForBody(pilot.location.bodyId);
    if (dest) startJump(dest.id);
  }, [lobby.nearby, startJump]);

  const snapshot = useMemo<ExploreSnapshot>(() => ({
    nearestId: telemetry.nearestId,
    nearestName: telemetry.nearestName,
    nearestDistance: telemetry.nearestDistance,
    speed: telemetry.speed,
    boosting: telemetry.boosting,
    scaleBand: telemetry.scaleBand,
    scaleLabel: telemetry.scaleLabel,
    destinationId: destination.id,
    destinationLabel: destination.label,
    inspectId,
    rivals: visiblePilots,
    challenge: challenge.kind,
    challenger: challenge.kind === 'idle' ? undefined : challenge.opponent.callsign,
  }), [telemetry, destination, inspectId, visiblePilots, challenge]);
  const onLyraAction = useCallback((action: LyraAction) => {
    if (action.kind === 'jump') startJump(action.destinationId);
    else if (action.kind === 'learn') onLearn(action.bodyId);
    else setRivalPrompt(action.pilotId);
  }, [startJump, onLearn]);
  const retryScene = () => { setSceneReady(false); setSlowLoad(false); setSceneAttempt(n => n + 1); setSettings(s => ({ ...s, quality: 'low' })); };

  return (
    <div
      className="sd-root ex-root galaxy-exploration"
      data-quality={settings.quality}
      data-reduced-motion={settings.reducedMotion}
      data-ready={sceneReady}
      data-chrome="drive"
    >
      <ExploreBoundary key={`${sceneAttempt}-${sceneKey}`} fallback={
        <div className="ex-load-error" role="alert"><h2>Flight view could not start</h2>
          <p>Try simpler graphics to reload the universe.</p><HoloButton onClick={retryScene}>Retry flight view</HoloButton>
          <HoloButton onClick={() => onExit ? onExit() : window.location.assign('/')}>Back to bridge</HoloButton>
        </div>
      }>
      <Suspense fallback={null}>
        <ExploreScene
          settings={settings}
          zoomRequest={zoomRequest}
          destination={destination}
          warp={warp}
          flightEnabled={flightEnabled}
          input={input}
          resetToken={resetToken}
          callsign={lobby.self.callsign}
          chrome="drive"
          onTelemetry={setTelemetry}
          onWarpRequest={openNav}
          onLearn={onLearn}
          inspectId={inspectId}
          cutawayOpen={cutawayOpen}
          highlightLayer={highlightLayer}
          onReady={() => setSceneReady(true)}
          onLowPerformance={() => setSettings((s) => ({ ...s, quality: 'low' }))}
          rivals={visiblePilots}
          onSelectRival={(id) => { setSelectedId(id); setRivalPrompt(id); }}
        />
      </Suspense>
      </ExploreBoundary>

      <ExploreHud
        destination={destination}
        mode={mode}
        onMode={setMode}
        onBridge={() => onExit ? onExit() : window.location.assign('/')}
        onZoom={isLocalDestination(destination) ? requestZoom : undefined}
        ready={sceneReady}
        loadingAssets={loadingAssets}
        assetProgress={assetProgress}
        assetErrors={assetErrors.length}
        flightEnabled={flightEnabled}
        onLearnBody={onLearn}
        telemetry={telemetry}
        pilots={visiblePilots}
        selectedId={selectedId}
        navOpen={navOpen}
        creditsOpen={creditsOpen}
        learn={learn}
        challengeBusy={busy}
        input={input}
        isTouch={isTouch}
        onInput={(patch) => setInput((i) => ({ ...i, ...patch }))}
        onSelectPilot={setSelectedId}
        onChallenge={(id) => actions.challenge(id)}
        onFlyToPilot={flyToPilot}
        onOpenNav={openNav}
        onCloseNav={() => setNavOpen(false)}
        onJump={startJump}
        onToggleCredits={() => setCreditsOpen((c) => !c)}
        onLearnNearest={() => onLearn(telemetry.nearestId)}
        onLearnClose={() => setLearn(null)}
        onOpenArena={() => {
          window.location.href = '/?arena=mars&from=explore';
        }}
      />

      <AnimatePresence>
      {inspectId && !planetFacts(inspectId) && (
        <ObjectPanel
          key={`object-${inspectId}`}
          bodyId={inspectId}
          reducedMotion={settings.reducedMotion}
          onClose={closeInspect}
          onVisit={(id) => { closeInspect(); startJump(id); }}
        />
      )}
      {inspectId && planetFacts(inspectId) && (
        <PlanetPanel
          key="planet-inspector"
          bodyId={inspectId}
          reducedMotion={settings.reducedMotion}
          onTabChange={onInspectTab}
          onSelectBody={onLearn}
          onHighlight={setHighlightLayer}
          onClose={closeInspect}
          onVisit={() => {
            const dest = destinationById(`visit-${inspectId}`);
            closeInspect();
            startJump(dest.id);
          }}
        />
      )}
      </AnimatePresence>


      <ChallengeModal
        phase={challenge}
        self={lobby.self}
        onAccept={actions.accept}
        onDecline={actions.decline}
        onCancel={actions.cancelChallenge}
        onDismiss={actions.dismiss}
        onLaunch={onBattleLaunch ?? actions.launch}
      />

      <MissionBanner mission={mission} onDone={clearMission} />

      <ExploreCopilot
        snapshot={snapshot}
        client={copilotClient}
        callsign={lobby.self.callsign}
        hidden={!sceneReady || jumping || challenge.kind === "launching"}
        onAction={onLyraAction}
      />

      {prompted && !busy && (
        <div className="sd-handoff ex-rival-prompt" role="dialog" aria-modal="false" aria-labelledby="ex-rival-title">
          <div className="sd-challenge__card">
            <p className="sd-eyebrow">{prompted.location ? `Contact near ${prompted.location.label}` : 'Pilot contact'}</p>
            <h2 id="ex-rival-title" className="sd-challenge__title">{prompted.callsign}</h2>
            <p className="sd-challenge__desc">
              {prompted.status === 'available'
                ? `${prompted.record.wins}W ${prompted.record.losses}L · Challenge them to a lightsaber duel on Mars?`
                : 'This pilot is already in a duel.'}
            </p>
            <div className="sd-challenge__actions">
              <HoloButton variant="primary" autoFocus disabled={prompted.status !== 'available'}
                onClick={() => { actions.challenge(prompted.id); setRivalPrompt(null); }}>
                Challenge
              </HoloButton>
              <HoloButton onClick={() => setRivalPrompt(null)}>Keep flying</HoloButton>
            </div>
          </div>
        </div>
      )}

      <div className="sd-launch" data-active={challenge.kind === 'launching'} aria-hidden={challenge.kind !== 'launching'}>
        <p>Expanding domain…</p>
      </div>

      {jumping && (
        <Suspense fallback={<div className="ob-warp" />}>
          <HyperspaceTunnel
            active
            caption={pendingJump ? `Jumping to ${pendingJump.label}…` : 'Hyperspace…'}
            onFinished={onWarpFinished}
            durationMs={settings.reducedMotion ? 400 : 2200}
          />
        </Suspense>
      )}

      <div className="sd-boot" data-done={sceneReady} aria-hidden={sceneReady}>
        <p className="sd-eyebrow">Jedi Space Duels</p>
        <p className="sd-boot__line">{slowLoad ? 'Flight is taking longer to load' : 'Preparing your flight view…'}</p>
        {!sceneReady && <p>{loadingAssets ? `Loading artwork · ${Math.round(assetProgress)}%` : 'Starting 3D renderer'}</p>}
        {slowLoad && !sceneReady && <HoloButton onClick={retryScene}>Retry with simpler graphics</HoloButton>}
      </div>
    </div>
  );
}
