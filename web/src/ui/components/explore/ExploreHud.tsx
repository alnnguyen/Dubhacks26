import { LOCAL_OBJECT_MANIFEST, LOCAL_OBJECTS } from './localObjects';
import { useMemo, useRef, useState } from 'react';
import { CATALOG_MANIFEST, CATALOG_STARS, CATALOG_PLANETS, CATALOG_GALAXIES, HOST_PLANETS, PLANET_INDEX, catalogDestination } from './catalog';
import type { LocalZoomCommand } from './localNavigation';
import { DESTINATIONS, type ExploreDestination } from './destinations';
import type { FlightInput, FlightTelemetry } from './ShipFlightController';
import type { NearbyPilot } from '../../state/lobbyTypes';
import { scienceForBodyId, type BodyScience } from './bodiesScience';
import { HoloButton } from '../hud/primitives';

export interface ExploreHudProps {
  destination: ExploreDestination;
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
  onOpenNav: () => void;
  onCloseNav: () => void;
  onJump: (id: string) => void;
  onToggleCredits: () => void;
  onLearnNearest: () => void;
  onLearnClose: () => void;
  onOpenArena?: () => void;
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
  destination, onZoom, ready, loadingAssets, assetProgress, assetErrors, flightEnabled, onLearnBody,
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
  onOpenNav,
  onCloseNav,
  onJump,
  onToggleCredits,
  onLearnNearest,
  onLearnClose,
  onOpenArena,
}: ExploreHudProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Highlights');
  const filteredDestinations = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DESTINATIONS.filter(d => {
      if (category !== 'Highlights' && (d.category ?? 'Solar system') !== category) return false;
      if (!q && category === 'Highlights') return ['sol','nearby-stars','galaxy-atlas','galaxy','visit-moon','visit-mars','visit-jupiter','visit-saturn','visit-uranus','visit-neptune','visit-sat-25544','visit-sb-1000036'].includes(d.id) || /Sirius|Proxima|TRAPPIST-1 e|Andromeda|Whirlpool|Halley|Ceres|Bennu/.test(d.label);
      return !q || `${d.label} ${d.briefing}`.toLowerCase().includes(q);
    });
  }, [query, category]);
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
        <p className="sd-brand">
          <span>Jedi Space Duels</span>
          <span className="sd-brand__sub">Drive // Free flight</span>
        </p>
        <div className="ex-topbar__actions">
          <HoloButton size="sm" onClick={onToggleCredits}>
            Data
          </HoloButton>
          <HoloButton size="sm" variant="primary" onClick={onOpenNav}>
            Destinations / N
          </HoloButton>
        </div>
      </header>

      <button type="button" className="ex-telemetry" onClick={onLearnNearest} aria-label="Learn about nearest body" disabled={!ready || !nearestScience}>
        <p className="sd-eyebrow">{catalogMode || telemetry.localNavigation ? 'Navigation focus' : 'Nearest'} · tap to learn</p>
        <p className="ex-telemetry__name">{telemetry.nearestName}</p>
        <p className="ex-telemetry__meta">
          {telemetry.nearestDistance.toFixed(0)} u · {telemetry.speed.toFixed(0)} u/s
          {telemetry.boosting ? ' · BOOST' : ''}
        </p>
        <p className="ex-telemetry__dest">{destination.label}</p>
        <p className="ex-telemetry__meta" data-testid="flight-position">Position {telemetry.position.map(n => n.toFixed(1)).join(' / ')}</p>
        {nearestScience?.gravityMps2 != null && (
          <p className="ex-telemetry__science">g {nearestScience.gravityMps2} m/s² · NASA Fact Sheet</p>
        )}
      </button>

      <div className="ex-scale" data-band={telemetry.scaleBand} aria-live="polite">
        <p className="ex-scale__eyebrow">{onZoom ? 'Continuous local zoom' : 'Scale (gameplay)'}</p>
        <p className="ex-scale__label">{telemetry.scaleLabel}</p>
        <p className="ex-scale__hint">
          {onZoom ? 'Solar layout + catalog stars · visual compression' : destination.environment === 'stars' ? 'HYG positions + NASA host stars' : destination.environment === 'galaxies' ? 'Published coordinates / estimated distances' : destination.environment === 'exoplanets' ? 'NASA parameters · illustrative orbits' : telemetry.showMilkyWay ? 'Artistic galaxy model' : 'Solar neighborhood'}
        </p>
      </div>

      <div className="ex-flight-status" role="status">
        <strong>{ready ? 'Universe ready' : 'Starting universe…'}</strong>
        <span>{loadingAssets ? `Artwork loading ${Math.round(assetProgress)}%` : assetErrors ? 'Some artwork unavailable · basic shapes active' : 'Artwork loaded'}</span>
        <span className="ex-catalog-status">{CATALOG_STARS.length.toLocaleString()} stars · {CATALOG_PLANETS.length.toLocaleString()} planets · {CATALOG_GALAXIES.length.toLocaleString()} galaxies</span>
        <span>{!flightEnabled ? 'Flight paused' : telemetry.localNavigation?.inTransit ? `Approaching ${telemetry.localNavigation.focus}` : telemetry.localNavigation?.zooming ? 'Zooming smoothly' : telemetry.speed > 0.1 ? 'Flying' : 'Stopped · press W or Cruise'}</span>
      </div>
      {onZoom && <section className="ex-local-zoom" aria-label="Local zoom controls">
        <p className="sd-eyebrow">Earth → system → stars</p>
        <div className="ex-local-zoom__buttons">
          <HoloButton size="sm" disabled={!flightEnabled} onClick={() => onZoom('in')}>Zoom in +</HoloButton>
          <HoloButton size="sm" disabled={!flightEnabled} onClick={() => onZoom('out')}>Zoom out −</HoloButton>
        </div>
        <div className="ex-local-zoom__buttons">
          <button type="button" disabled={!flightEnabled} onClick={() => onZoom('system')}>System view</button>
          <button type="button" disabled={!flightEnabled} onClick={() => onZoom('stars')}>Nearby stars view</button>
        </div>
        <p>Gentle scroll for precision · scroll faster to zoom out · + / −</p>
        <p data-testid="local-zoom-range">{telemetry.localNavigation ? telemetry.localNavigation.inTransit ? `Approaching ${telemetry.localNavigation.focus}` : `${telemetry.localNavigation.range.toFixed(0)} visual units from ${telemetry.localNavigation.focus}` : 'Preparing local view'}</p>
      </section>}
      <div className="ex-flight-actions">
        <HoloButton disabled={!flightEnabled} variant={input.cruise ? 'accent' : 'primary'} aria-pressed={!!input.cruise}
          onClick={() => onInput({ cruise: !input.cruise, brake: false })}>{input.cruise ? 'Cruise on' : 'Cruise'}</HoloButton>
        <HoloButton disabled={!ready} onClick={() => onInput({ thrust: 0, strafe: 0, pitch: 0, yaw: 0, cruise: false, brake: true })}>Stop</HoloButton>
        <HoloButton onClick={() => onJump('sol')}>Return to Earth</HoloButton>
      </div>

      <details className="ex-contacts" aria-label="Nearby pilots">
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
                <span className="ex-contact__dist">{p.distanceM} m</span>
              </button>
            </li>
          ))}
        </ul>
        {selected && (
          <HoloButton variant="primary" disabled={challengeBusy} onClick={() => onChallenge(selected.id)}>
            Challenge {selected.callsign}
          </HoloButton>
        )}
      </details>

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

      {!isTouch && (
        <p className="ex-hints">
          W/S forward / reverse · A/D strafe · arrows or drag to steer · Q/E rise / descend · Shift boost · Space stop · N destinations
        </p>
      )}

      {navOpen && (
        <div className="ex-nav" role="dialog" aria-modal="true" aria-labelledby="ex-nav-title">
          <div className="ex-nav__card">
            <p className="sd-eyebrow">Hyperspace</p>
            <h2 id="ex-nav-title">Explore and learn</h2>
            <p className="ex-nav__blurb">Explore real catalog objects. Jump between solar, stellar and galaxy scales, then fly locally. Object sizes and system layouts are illustrative.</p>
            <div className="ex-categories" aria-label="Catalog categories">
              {['Highlights','Solar system','Satellites','Asteroids','Comets','Stars','Exoplanets','Galaxies'].map(c => <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>)}
            </div>
            <input className="ex-search" aria-label="Search destinations" placeholder="ISS, Starlink, Saturn, Halley, Ceres, Sirius…" value={query} onChange={e => setQuery(e.target.value)} autoFocus />
            <p className="ex-nav__blurb">{category === 'Highlights' && query ? 'All catalogs · ' : category + ' · '}{filteredDestinations.length.toLocaleString()} results{filteredDestinations.length > 50 ? ' · showing the first 50; search to narrow' : ''}</p>
            <ul className="ex-nav__list">
              {filteredDestinations.slice(0,50).map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    className={`ex-nav__item${d.id === destination.id ? ' is-here' : ''}`}
                    onClick={() => onJump(d.id)}
                  >
                    <span className="ex-nav__label">Visit {d.label}</span>
                    <span className="ex-nav__brief">{d.briefing}</span>
                  </button>
                  {d.bodyId && <button type="button" className="ex-learn-link" onClick={() => { onCloseNav(); onLearnBody(d.bodyId!); }}>Learn about {d.label}</button>}
                </li>
              ))}
            </ul>
            {filteredDestinations.length === 0 && <div><p>No matches in {category === 'Highlights' ? 'the imported catalogs' : category}.</p>
              {category !== 'Highlights' && <HoloButton onClick={() => setCategory('Highlights')}>Search all catalogs</HoloButton>}
            </div>}
            <HoloButton onClick={onCloseNav}>Close</HoloButton>
          </div>
        </div>
      )}

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
