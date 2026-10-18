import { LOCAL_OBJECT_MANIFEST, LOCAL_OBJECTS } from './localObjects';
import { useId, useMemo, useRef, useState } from 'react';
import { BRAND_NAME } from '../../brand';
import { CATALOG_MANIFEST, CATALOG_STARS, CATALOG_PLANETS, CATALOG_GALAXIES, HOST_PLANETS, PLANET_INDEX, catalogDestination } from './catalog';
import type { LocalZoomCommand } from './localNavigation';
import { DESTINATIONS, type ExploreDestination } from './destinations';
import type { FlightInput, FlightTelemetry } from './ShipFlightController';
import type { NearbyPilot } from '../../state/lobbyTypes';
import { scienceForBodyId, type BodyScience } from './bodiesScience';
import { HoloButton } from '../hud/primitives';
import { AnimatePresence, motion } from 'motion/react';
import { OrbitTimeControl } from './OrbitTimeControl';
import { formatSceneDistance } from './cosmicScale';
import { DestinationsPanel } from './DestinationsPanel';

/** Flight: multiplayer-visible free flight. Explore: peaceful sightseeing with the scale/zoom controls. */
export type ExploreMode = 'flight' | 'explore';

export interface ExploreHudProps {
  destination: ExploreDestination;
  mode: ExploreMode;
  onMode: (mode: ExploreMode) => void;
  /** Leave free flight for the cockpit. */
  onBridge: () => void;
  onZoom?: (command: LocalZoomCommand) => void;
  ready: boolean;
  loadingAssets: boolean;
  assetProgress: number;
  assetErrors: number;
  flightEnabled: boolean;
  onLearnBody: (id: string) => void;
  telemetry: FlightTelemetry;
  pilots: NearbyPilot[];
  selectedId: string | null;
  navOpen: boolean;
  creditsOpen: boolean;
  learn: BodyScience | null;
  challengeBusy: boolean;
  input: FlightInput;
  isTouch: boolean;
  onInput: (patch: Partial<FlightInput>) => void;
  onSelectPilot: (id: string) => void;
  onChallenge: (id: string) => void;
  /** Jump to where a pilot reported they are flying. Omitted when that place has no destination. */
  onFlyToPilot?: (id: string) => void;
  onOpenNav: () => void;
  onCloseNav: () => void;
  onJump: (id: string) => void;
  onToggleCredits: () => void;
  onLearnNearest: () => void;
  onLearnClose: () => void;
  onOpenArena?: () => void;
  /** Reopen the controls lesson from the flight rail. */
  onOpenControls?: () => void;
}

function Stick({
  className,
  label,
  onAxis,
}: {
  className: string;
  label: string;
  onAxis: (x: number, y: number) => void;
}) {
  const origin = useRef<{ x: number; y: number; id: number } | null>(null);
  return (
    <div
      className={`ex-stick ${className}`}
      role="application"
      aria-label={label}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        origin.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
        onAxis(0, 0);
      }}
      onPointerMove={(e) => {
        const o = origin.current;
        if (!o || o.id !== e.pointerId) return;
        const dx = (e.clientX - o.x) / 54;
        const dy = (e.clientY - o.y) / 54;
        const len = Math.hypot(dx, dy) || 1;
        const s = Math.min(1, len);
        onAxis((dx / len) * s, (-dy / len) * s);
      }}
      onPointerUp={(e) => {
        if (origin.current?.id === e.pointerId) {
          origin.current = null;
          onAxis(0, 0);
        }
      }}
      onLostPointerCapture={() => { origin.current = null; onAxis(0, 0); }}
      onPointerCancel={() => {
        origin.current = null;
        onAxis(0, 0);
      }}
    >
      <span className="ex-stick__knob" /><span className="ex-stick__label">{label}</span>
    </div>
  );
}

export function ExploreHud({
  destination, mode, onMode, onBridge, onZoom, ready, loadingAssets, assetProgress, assetErrors, flightEnabled, onLearnBody,
  telemetry,
  pilots,
  selectedId,
  navOpen,
  creditsOpen,
  learn,
  challengeBusy,
  input,
  isTouch,
  onInput,
  onSelectPilot,
  onChallenge,
  onFlyToPilot,
  onOpenNav,
  onCloseNav,
  onJump,
  onToggleCredits,
  onLearnNearest,
  onLearnClose,
  onOpenArena,
  onOpenControls,
}: ExploreHudProps) {
  const [worldOpen, setWorldOpen] = useState(false);
  const worldDetails = useId();
  const relatedHost = learn ? (PLANET_INDEX.get(learn.id)?.host ?? (learn.id.startsWith('host:') ? learn.id.slice(5) : null)) : null;
  const relatedPlanets = relatedHost ? HOST_PLANETS.get(relatedHost) ?? [] : [];
  const learnDestination = learn ? catalogDestination(learn.id) ?? DESTINATIONS.find(d => d.bodyId === learn.id) : null;
  const catalogMode = ['stars','galaxies','exoplanets'].includes(destination.environment);
  const selected = pilots.find((p) => p.id === selectedId) ?? null;
  const available = pilots.filter((p) => p.status === 'available');
  const nearestScience = scienceForBodyId(telemetry.nearestId);

  return (
    <div className="ex-hud">
      <header className="ex-topbar">
        <p className="gx-mark">
          <span className="gx-mark__star" aria-hidden>✦</span>
          <strong className="ko-wordmark">{BRAND_NAME}</strong>
          <span className="gx-mark__slash" aria-hidden>/</span>
          <span className="gx-mark__sector">{destination.label} · {telemetry.scaleLabel}</span>
        </p>
        <div className="ex-modes" role="tablist" aria-label="Flight mode">
          <button type="button" role="tab" aria-selected={mode === 'flight'} onClick={() => onMode('flight')}>
            <strong>Flight</strong><small>Pilots can find you</small>
          </button>
          <button type="button" role="tab" aria-selected={mode === 'explore'} onClick={() => onMode('explore')}>
            <strong>Explore</strong><small>Peaceful · zoom &amp; views</small>
          </button>
        </div>
        <div className="ex-topbar__actions">
          <span className="gx-status" data-state={!ready ? 'loading' : assetErrors ? 'caution' : 'ready'} role="status">
            <i aria-hidden />{!ready ? 'Starting universe' : loadingAssets ? `Artwork ${Math.round(assetProgress)}%` : assetErrors ? 'Basic shapes active' : 'Universe ready'}
          </span>
          <HoloButton size="sm" onClick={onToggleCredits}>
            Data
          </HoloButton>
          <HoloButton size="sm" variant="primary" onClick={onOpenNav}>
            Destinations / N
          </HoloButton>
        </div>
      </header>

      <section className="ex-telemetry gx-world" aria-label="Destination in focus" data-ready={ready} data-expanded={worldOpen}
        onKeyDown={e => { if (e.key==='Escape' && worldOpen) { e.stopPropagation(); setWorldOpen(false); } }}>
        <h2 className="gx-world__heading"><button type="button" className="gx-world__toggle" aria-expanded={worldOpen} aria-controls={worldDetails}
          onKeyDown={event => { if (event.code === 'Space') event.stopPropagation(); }}
          aria-label={`Destination details: ${ready ? telemetry.nearestName : 'Loading'}`} onClick={() => setWorldOpen(open => !open)}>
          <span><span className="gx-eyebrow">Destination / {catalogMode || telemetry.localNavigation ? 'in focus' : 'nearest'}</span>
            <span className="gx-world__name">{ready ? telemetry.nearestName : 'Loading…'}</span></span>
          <svg className="gx-world__chevron" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button></h2>
        <div id={worldDetails} hidden={!worldOpen} className="gx-world__details">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={ready ? telemetry.nearestId : 'loading'} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: .22, ease: [.18, .92, .24, 1] }}>
            {ready && nearestScience && <p className="gx-world__blurb">{nearestScience.blurb}</p>}
            {ready && !nearestScience && <p className="gx-world__blurb">No catalog record for this object yet.</p>}
          </motion.div>
        </AnimatePresence>
        <dl className="gx-world__data">
          <div><dt>Range</dt><dd>{formatSceneDistance(telemetry.nearestDistance).value} <small>{formatSceneDistance(telemetry.nearestDistance).unit}</small></dd></div>
          <div><dt>Speed</dt><dd>{telemetry.speed.toFixed(0)} <small>u/s</small>{telemetry.boosting ? ' · boost' : ''}</dd></div>
          {nearestScience?.gravityMps2 != null && <div><dt>Gravity</dt><dd>{nearestScience.gravityMps2} <small>m/s²</small></dd></div>}
          {nearestScience?.meanTempC != null && <div><dt>Mean temp</dt><dd>{nearestScience.meanTempC} <small>°C</small></dd></div>}
        </dl>
        <p className="gx-world__effect">
          <span>Arena effect</span>
          {telemetry.nearestId === 'mars' || telemetry.nearestId === 'mars-surface' ? 'Live duels are fought on Mars' : 'Exploration only · no duel arena'}
        </p>
        {onZoom && (telemetry.nearestId === 'earth' || telemetry.nearestId.startsWith('sat-')) && <OrbitTimeControl compact />}
        <p className="gx-world__source">{nearestScience ? nearestScience.source : 'Visual units are compressed for navigation'}</p>
        <button type="button" className="gx-primary" onClick={onLearnNearest} disabled={!ready || !nearestScience}>
          <span>Inspect {ready ? telemetry.nearestName : ''}</span><b aria-hidden>↗</b>
        </button>
        </div>
      </section>

      {mode === 'explore' && !onZoom && (
        <section className="ex-local-zoom" aria-label="Explore mode">
          <p className="sd-eyebrow">Peaceful explore</p>
          <p>Zoom and system views work in the solar system and nearby stars. {CATALOG_STARS.length.toLocaleString()} stars · {CATALOG_PLANETS.length.toLocaleString()} planets · {CATALOG_GALAXIES.length.toLocaleString()} galaxies in Destinations.</p>
          <HoloButton size="sm" onClick={() => onJump('sol')}>Back to the solar system</HoloButton>
        </section>
      )}
      {mode === 'explore' && onZoom && <section className="ex-local-zoom" aria-label="Local zoom controls">
        <p className="sd-eyebrow">Peaceful explore · Earth → stars → galaxies</p>
        <div className="ex-local-zoom__buttons">
          <HoloButton size="sm" disabled={!flightEnabled} onClick={() => onZoom('in')}>Zoom in +</HoloButton>
          <HoloButton size="sm" disabled={!flightEnabled} onClick={() => onZoom('out')}>Zoom out −</HoloButton>
        </div>
        <div className="ex-local-zoom__buttons">
          <button type="button" disabled={!flightEnabled} onClick={() => onZoom('system')}>System view</button>
          <button type="button" disabled={!flightEnabled} onClick={() => onZoom('stars')}>Nearby stars view</button>
        </div>
        <div className="ex-local-zoom__buttons">
          <button type="button" disabled={!flightEnabled} onClick={() => onZoom('milkyway')}>Milky Way view</button>
          <button type="button" disabled={!flightEnabled} onClick={() => onZoom('galaxies')}>Galaxy view</button>
        </div>
        <p>Scroll to zoom continuously · hover stars, craft and galaxies for names</p>
        <OrbitTimeControl />
        <p data-testid="local-zoom-range">{telemetry.localNavigation ? telemetry.localNavigation.inTransit ? `Approaching ${telemetry.localNavigation.focus}` : `${formatSceneDistance(telemetry.localNavigation.range).value} ${formatSceneDistance(telemetry.localNavigation.range).unit} from ${telemetry.localNavigation.focus}` : 'Preparing local view'}</p>
      </section>}
      <footer className="gx-rail">
        <button type="button" className="ex-bridge" onClick={onBridge}>
          <span className="ex-bridge__arrow" aria-hidden>‹</span>
          <span className="ex-bridge__text"><strong>Return to bridge</strong><small>Cockpit · lobby · duels</small></span>
        </button>
        <div className="ex-flight-actions">
          {onOpenControls && <button type="button" className="ko-controls-chip" onClick={onOpenControls}>Controls</button>}
          <HoloButton disabled={!flightEnabled} variant={input.cruise ? 'accent' : 'ghost'} aria-pressed={!!input.cruise}
            onClick={() => onInput({ cruise: !input.cruise, brake: false })}>{input.cruise ? 'Cruise on' : 'Cruise'}</HoloButton>
          <HoloButton disabled={!ready} onClick={() => onInput({ thrust: 0, strafe: 0, pitch: 0, yaw: 0, cruise: false, brake: true })}>Stop</HoloButton>
          <HoloButton onClick={() => onJump('sol')}>Return to Earth</HoloButton>
        </div>
        <p className="gx-rail__status" role="status">
          {!flightEnabled ? 'Flight paused' : telemetry.localNavigation?.inTransit ? `Approaching ${telemetry.localNavigation.focus}` : telemetry.localNavigation?.zooming ? 'Zooming smoothly' : telemetry.speed > 0.1 ? 'Flying' : 'Stopped · press W or Cruise'}
          {!isTouch && <small>W/S thrust · A/D strafe · arrows or drag steer · Q/E rise · Shift boost · Space stop · N destinations</small>}
        </p>
      </footer>

      {mode === 'flight' && <details className="ex-contacts" aria-label="Nearby pilots">
        <summary className="sd-eyebrow">Pilot contacts</summary>
        <ul className="ex-contacts__list">
          {available.length === 0 && <li className="ex-contacts__empty">No connected pilots</li>}
          {available.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className={`ex-contact${selectedId === p.id ? ' is-selected' : ''}`}
                onClick={() => onSelectPilot(p.id)}
              >
                <span>{p.callsign}</span>
                <span className="ex-contact__dist">{p.location ? `near ${p.location.label}` : `${p.distanceM} m`}</span>
              </button>
            </li>
          ))}
        </ul>
        {selected && (
          <div className="ex-contacts__actions">
            <HoloButton variant="primary" disabled={challengeBusy} onClick={() => onChallenge(selected.id)}>
              Challenge {selected.callsign}
            </HoloButton>
            {selected.location && onFlyToPilot && (
              <HoloButton disabled={challengeBusy} onClick={() => onFlyToPilot(selected.id)}>
                Fly to {selected.location.label}
              </HoloButton>
            )}
          </div>
        )}
      </details>}

      {destination.environment === 'mars-surface' && onOpenArena && (
        <div className="ex-arena-link">
          <HoloButton variant="primary" onClick={onOpenArena}>
            Open Jezero arena
          </HoloButton>
        </div>
      )}

      {isTouch && flightEnabled && (
        <div className="ex-sticks" aria-label="Touch flight sticks">
          <Stick
            className="ex-stick--left"
            label="Thrust and strafe"
            onAxis={(x, y) => onInput({ strafe: x, thrust: y, brake: false, cruise: false })}
          />
          <Stick
            className="ex-stick--right"
            label="Steer"
            onAxis={(x, y) => onInput({ yaw: -x, pitch: y, brake: false })}
          />
        </div>
      )}


      <AnimatePresence>
        {navOpen && (
          <DestinationsPanel
            key="destinations"
            current={destination}
            onJump={onJump}
            onLearn={(id) => { onCloseNav(); onLearnBody(id); }}
            onClose={onCloseNav}
          />
        )}
      </AnimatePresence>

      {learn && (
        <div className="ex-learn" role="dialog" aria-modal="true" aria-labelledby="ex-learn-title">
          <div className="ex-nav__card">
            <p className="sd-eyebrow">{learn.kind} · {learn.realCatalog ? 'real catalog · illustrated view' : learn.kind === 'exo' || learn.kind === 'galaxy' ? 'illustrative model' : 'science guide'}</p>
            <h2 id="ex-learn-title">{learn.name}</h2>
            <p className="ex-nav__blurb">{learn.blurb}</p>
            <ul className="ex-learn__stats">
              {learn.facts?.map(f => <li key={f.label}><strong>{f.label}:</strong> {f.value}</li>)}
              {learn.gravityMps2 != null && <li>Gravity: {learn.gravityMps2} m/s²</li>}
              {learn.escapeKmS != null && <li>Escape velocity: {learn.escapeKmS} km/s</li>}
              {learn.dayHours != null && <li>Day length: {learn.dayHours} h</li>}
              {learn.meanTempC != null && <li>Mean temp: {learn.meanTempC} °C</li>}
              {learn.distanceAu != null && <li>Orbit: {learn.distanceAu} AU (real)</li>}
            </ul>
            <p className="ex-learn__source">{learn.source}</p>
            {learn.snapshot && <p className="ex-learn__source">Local catalog snapshot: {learn.snapshot} UTC · source versions in Data</p>}
            {(learn.sourceUrl || (learn.kind !== 'exo' && learn.kind !== 'galaxy')) && <p><a href={learn.sourceUrl ?? 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/'} target="_blank" rel="noreferrer">Open source catalog ↗</a></p>}
            {learnDestination && <HoloButton variant="primary" onClick={() => { onLearnClose(); onJump(learnDestination.id); }}>Visit {learn.name}</HoloButton>}
            {relatedPlanets.length > 0 && <div className="ex-system-list"><p className="sd-eyebrow">{relatedHost} · catalog planets</p>
              {relatedPlanets.map(p => <button type="button" key={p.id} onClick={() => onLearnBody(p.id)}>{p.name}</button>)}
            </div>}
            <HoloButton onClick={onLearnClose}>Resume exploring</HoloButton>
          </div>
        </div>
      )}

      {creditsOpen && (
        <div className="ex-credits" role="dialog" aria-modal="true" aria-labelledby="ex-credits-title">
          <div className="ex-nav__card">
            <p className="sd-eyebrow">Attribution</p>
            <h2 id="ex-credits-title">Data sources</h2>
            <ul className="ex-credits__list">
              <li>Local solar expansion: 8 major planets, Earth's Moon, {LOCAL_OBJECTS.filter(o=>o.kind==='satellite').length} spacecraft (ISS, Hubble and {LOCAL_OBJECTS.filter(o=>o.name.startsWith('STARLINK')).length} Starlink sample records), {LOCAL_OBJECTS.filter(o=>o.kind==='asteroid').length} asteroids and {LOCAL_OBJECTS.filter(o=>o.kind==='comet').length} comets.</li>
              <li>Orbital snapshot imported {LOCAL_OBJECT_MANIFEST.retrievedAt.slice(0,10)} UTC. Spacecraft and small bodies are frozen mean-element illustrations at each record's epoch, not live tracking or precise ephemerides. Planets use a designed static layout. Satellite altitude ×5; spacecraft, small-body sizes and comet tails exaggerated. Starlink is a small mirrored sample, not a complete operational fleet.</li>
              <li><a href="https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html" target="_blank" rel="noreferrer">NASA/JPL Small-Body Database ↗</a> · <a href="https://celestrak.org/NORAD/documentation/gp-data-formats.php" target="_blank" rel="noreferrer">CelesTrak GP ↗</a> · <a href="https://tle.ivanstanojevic.me/" target="_blank" rel="noreferrer">Community TLE API mirror ↗</a></li>
              <li>NASA Planetary Fact Sheet — gravity, escape, day, temperature (learn cards and planet inspect panel). Interior layers are simplified models with confidence badges (InSight / MESSENGER / Juno citations in the Dissection tab).</li>
              <li>Earth / body textures — Solar System Scope (CC BY 4.0) & NASA mosaics</li>
              <li>Milky Way skybox — three.js astronomy cubemap (upgrade path: NASA SVS Deep Star Maps 2020)</li>
              <li>Painted Milky Way disk — artistic spiral (not 2MRS/Gaia); shown at local-stars+ scale</li>
              <li>Local snapshots: {CATALOG_STARS.length.toLocaleString()} HYG stars, {CATALOG_PLANETS.length.toLocaleString()} NASA archive planets across {CATALOG_MANIFEST.hostCount.toLocaleString()} hosts, {CATALOG_GALAXIES.length.toLocaleString()} GALEX Atlas galaxies.</li>
              {CATALOG_MANIFEST.sources.map(s => <li key={s.id}><a href={s.documentation} target="_blank" rel="noreferrer">{s.title} ↗</a><br />{s.license}<br />Snapshot {s.retrievedAt.slice(0,10)} UTC</li>)}
              <li>HYG derived snapshot available under CC BY-SA 4.0. Star positions are source estimates; unknown-distance placeholders were excluded. Stellar and galaxy maps use equatorial coordinates with separate linear units.</li>
              <li>Galaxy distances come from an archival published table; many are velocity-derived, not direct measurements. This selection is not a complete cosmic census.</li>
              <li>The continuous local view links the authored solar layout to catalog stars within 25 pc using a compressed visual bridge (1 pc = 10,000 solar scene units), not true AU scaling. Planet surfaces, colors, galaxy shapes, exaggerated radii and exoplanet orbital phases are illustrative. Background points in the original solar scene remain procedural.</li>
            </ul>
            <HoloButton onClick={onToggleCredits}>Close</HoloButton>
          </div>
        </div>
      )}

      {/* silence unused input flag for boost visual if needed */}
      <span className="ex-sr" aria-hidden>
        {input.thrust}
      </span>
    </div>
  );
}
