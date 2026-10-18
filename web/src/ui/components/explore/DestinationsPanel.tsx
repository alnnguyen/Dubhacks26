import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { DESTINATIONS, type ExploreDestination } from './destinations';
import { destinationProfile, logPosition, type LogScale, type OrbitSketch } from './destinationProfile';
import { LOCAL_OBJECT_INDEX } from './localObjects';
import { FleetView } from './FleetView';

type Category = { id: string; label: string; hint: string; match: (d: ExploreDestination) => boolean };
const HIGHLIGHT_IDS = new Set(['sol', 'nearby-stars', 'galaxy-atlas', 'galaxy', 'visit-moon', 'visit-mars', 'visit-jupiter', 'visit-saturn', 'visit-uranus', 'visit-neptune', 'visit-sat-25544', 'visit-sb-1000036']);
/** Starlink, the ISS (Dragon's port), docked Dragons, and anything flown on a Falcon rocket. */
const isSpaceX = (d: ExploreDestination) => d.label.startsWith('STARLINK') || d.bodyId === 'sat-25544' || !!LOCAL_OBJECT_INDEX.get(d.bodyId ?? '')?.launch;
const CATEGORIES: Category[] = [
  { id: 'Highlights', label: 'Highlights', hint: 'Curated tour', match: (d) => HIGHLIGHT_IDS.has(d.id) || /Sirius|Proxima|TRAPPIST-1 e|Andromeda|Whirlpool|Halley|Ceres|Bennu/.test(d.label) },
  { id: 'SpaceX', label: 'SpaceX & ISS', hint: 'Dragon · Roadster · Starlink · Falcon-launched', match: isSpaceX },
  { id: 'Fleet', label: 'SpaceX fleet', hint: 'Rockets · boosters · Dragons · Starship', match: () => false },
  { id: 'Spacecraft', label: 'Deep-space craft', hint: 'JPL Horizons', match: (d) => d.category === 'Spacecraft' },
  { id: 'Solar system', label: 'Solar system', hint: 'Planets & Moon', match: (d) => (d.category ?? 'Solar system') === 'Solar system' },
  { id: 'Satellites', label: 'Satellites', hint: 'CelesTrak snapshot', match: (d) => d.category === 'Satellites' },
  { id: 'Asteroids', label: 'Asteroids', hint: 'NASA/JPL SBDB', match: (d) => d.category === 'Asteroids' },
  { id: 'Comets', label: 'Comets', hint: 'NASA/JPL SBDB', match: (d) => d.category === 'Comets' },
  { id: 'Stars', label: 'Stars', hint: 'HYG catalog', match: (d) => d.category === 'Stars' },
  { id: 'Exoplanets', label: 'Exoplanets', hint: 'NASA archive', match: (d) => d.category === 'Exoplanets' },
  { id: 'Galaxies', label: 'Galaxies', hint: 'GALEX Atlas', match: (d) => d.category === 'Galaxies' },
];
const LIMIT = 60;

export function DestinationsPanel({ current, onJump, onLearn, onClose }: {
  current: ExploreDestination;
  onJump: (id: string) => void;
  onLearn: (bodyId: string) => void;
  onClose: () => void;
}) {
  const reduced = useReducedMotion();
  const [category, setCategory] = useState('Highlights');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const list = useRef<HTMLUListElement>(null);
  const counts = useMemo(() => new Map(CATEGORIES.map((c) => [c.id, DESTINATIONS.filter(c.match).length])), []);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const cat = CATEGORIES.find((c) => c.id === category)!;
    // Typing searches every catalog; the category only shapes the list when the search box is empty.
    const pool = q ? DESTINATIONS : DESTINATIONS.filter(cat.match);
    const found = q ? pool.filter((d) => `${d.label} ${d.briefing}`.toLowerCase().includes(q)) : pool;
    // Names that start with the query first, then the rest in catalog order.
    return q ? [...found].sort((a, b) => Number(!a.label.toLowerCase().startsWith(q)) - Number(!b.label.toLowerCase().startsWith(q))) : found;
  }, [category, query]);
  useEffect(() => setActive(0), [category, query]);
  const selected = results[Math.min(active, results.length - 1)];
  useEffect(() => { list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' }); }, [active]);

  function onKey(e: KeyboardEvent) {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, Math.min(results.length, LIMIT) - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && selected) { e.preventDefault(); onJump(selected.id); }
  }

  return (
    <motion.div className="gx-dest" role="dialog" aria-modal="true" aria-labelledby="gx-dest-title" onKeyDown={onKey}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .2 }}>
      <motion.div className="gx-dest__card" initial={reduced ? false : { y: 24, opacity: 0, scale: .98 }} animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}>
        <header className="gx-dest__head">
          <div>
            <p className="gx-eyebrow">Hyperspace / chart a course</p>
            <h2 id="gx-dest-title">Choose your <span className="gx-dest__plate"><span>destination</span></span></h2>
          </div>
          <button type="button" className="gx-dest__close" onClick={onClose} aria-label="Close destinations">×</button>
        </header>

        <nav className="gx-dest__rail" aria-label="Catalog categories">
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" aria-pressed={category === c.id} onClick={() => setCategory(c.id)} data-spacex={c.id === 'SpaceX'}>
              {category === c.id && <motion.span layoutId="gx-dest-rail" className="gx-dest__rail-on" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
              <strong>{c.label}</strong>
              <small>{c.hint}{c.id === 'Fleet' ? '' : ` · ${counts.get(c.id)?.toLocaleString()}`}</small>
            </button>
          ))}
        </nav>

        {category === 'Fleet' && !query.trim() ? (
          <div className="gx-dest__fleet">
            <input className="gx-dest__search" aria-label="Search destinations" placeholder="Search ISS, Starlink, Saturn, Halley, Sirius, TRAPPIST-1…" value={query}
              onChange={(e) => setQuery(e.target.value)} />
            <FleetView />
          </div>
        ) : <>
        <section className="gx-dest__results" aria-label="Destinations">
          <input className="gx-dest__search" aria-label="Search destinations" placeholder="Search ISS, Starlink, Saturn, Halley, Sirius, TRAPPIST-1…" value={query}
            onChange={(e) => setQuery(e.target.value)} autoFocus />
          <p className="gx-dest__count">{query.trim() ? 'All catalogs · ' : ''}{results.length.toLocaleString()} {results.length === 1 ? 'result' : 'results'}{results.length > LIMIT ? ` · showing ${LIMIT}, search to narrow` : ''} · ↑↓ to browse · Enter to jump</p>
          <ul ref={list} className="gx-dest__list">
            <AnimatePresence initial={false} mode="popLayout">
              {results.slice(0, LIMIT).map((d, i) => {
                const p = destinationProfile(d);
                return (
                  <motion.li key={d.id} layout={!reduced} initial={reduced ? false : { opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                    transition={{ duration: .18, delay: reduced ? 0 : Math.min(i, 12) * .018 }}>
                    <button type="button" data-index={i} data-active={i === active} data-here={d.id === current.id} data-kind={p.kind}
                      onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onClick={() => onJump(d.id)}>
                      <span className="gx-dest__glyph" aria-hidden />
                      <span className="gx-dest__name">{d.label}{d.id === current.id && <em> · you are here</em>}</span>
                      <span className="gx-dest__badge">{p.badge}</span>
                    </button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
            {!results.length && <li className="gx-dest__empty">No matches in the imported catalogs. Try a planet, star, exoplanet or galaxy name.</li>}
          </ul>
        </section>

        <aside className="gx-dest__preview" aria-live="polite">
          <AnimatePresence mode="wait">
            {selected && <Preview key={selected.id} d={selected} reduced={!!reduced} onJump={onJump} onLearn={onLearn} />}
          </AnimatePresence>
        </aside>
        </>}
      </motion.div>
    </motion.div>
  );
}

function Preview({ d, reduced, onJump, onLearn }: { d: ExploreDestination; reduced: boolean; onJump: (id: string) => void; onLearn: (id: string) => void }) {
  const p = destinationProfile(d);
  return (
    <motion.div className="gx-dest__pv" initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .2 }}>
      <p className="gx-eyebrow" data-kind={p.kind}>{p.badge}</p>
      <h3>{d.label}</h3>
      <div className="gx-dest__viz">
        {p.orbit ? <OrbitViz orbit={p.orbit} starlink={p.kind === 'starlink'} reduced={reduced} /> : p.scale ? <ScaleViz scale={p.scale} reduced={reduced} /> : <RegionViz />}
      </div>
      {p.metrics.length > 0 && (
        <dl className="gx-dest__metrics" data-kind={p.kind}>
          {p.metrics.map((m, i) => (
            <motion.div key={m.label} initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduced ? 0 : .08 + i * .05 }}>
              <dt>{m.label}</dt><dd>{m.value}{m.unit && <small> {m.unit}</small>}</dd>
            </motion.div>
          ))}
        </dl>
      )}
      <p className="gx-dest__blurb">{p.blurb}</p>
      {p.source && <p className="gx-dest__source">Source · {p.source}</p>}
      <div className="gx-dest__actions">
        <button type="button" className="gx-primary" onClick={() => onJump(d.id)}><span>Jump to {d.label}</span><b aria-hidden>↗</b></button>
        {d.bodyId && <button type="button" className="gx-dest__learn" onClick={() => onLearn(d.bodyId!)}>Learn</button>}
      </div>
    </motion.div>
  );
}

/** Earth with the orbit drawn to scale in altitude (×5 like the scene), tilted by inclination, one lap = real period ÷ 600. */
export function OrbitViz({ orbit, starlink, reduced }: { orbit: OrbitSketch; starlink: boolean; reduced: boolean }) {
  const R = 46;
  const rx = R + Math.max(6, (orbit.altitudeKm / 6371) * R * 5);
  const ry = rx * Math.max(.18, Math.cos((orbit.inclinationDeg * Math.PI) / 180));
  const path = `M ${150 - rx} 80 a ${rx} ${ry} 0 1 0 ${rx * 2} 0 a ${rx} ${ry} 0 1 0 ${-rx * 2} 0`;
  const lap = Math.max(2, (orbit.periodMin * 60) / 600);
  return (
    <svg viewBox="0 0 300 160" role="img" aria-label={`Orbit sketch: ${Math.round(orbit.altitudeKm)} km altitude, ${orbit.inclinationDeg.toFixed(1)}° inclination`}>
      <defs>
        <radialGradient id="gx-earth" cx="35%" cy="30%"><stop offset="0" stopColor="#a1e5ff" /><stop offset=".55" stopColor="#175dff" /><stop offset="1" stopColor="#020711" /></radialGradient>
      </defs>
      <g transform={`rotate(${-Math.min(60, orbit.inclinationDeg / 2)} 150 80)`}>
        <path d={path} fill="none" stroke="#87dcff55" strokeDasharray="3 4" />
      </g>
      <circle cx="150" cy="80" r={R} fill="url(#gx-earth)" />
      <g transform={`rotate(${-Math.min(60, orbit.inclinationDeg / 2)} 150 80)`}>
        <path d={path} fill="none" stroke="#87dcff" strokeWidth="1.2" strokeDasharray={`${rx * 1.6} ${rx * 9}`} opacity=".9" />
        <g>
          <rect x="-7" y="-2" width="14" height="4" fill={starlink ? '#4d7fd6' : '#e3a74a'} />
          <rect x="-2" y="-3" width="4" height="6" fill="#e9f6ff" />
          {!reduced && <animateMotion dur={`${lap}s`} repeatCount="indefinite" path={path} rotate="auto" />}
        </g>
      </g>
      <text x="8" y="150" className="gx-viz-label">{Math.round(orbit.altitudeKm)} km · {orbit.inclinationDeg.toFixed(1)}° · lap shown ×600</text>
    </svg>
  );
}

export function ScaleViz({ scale, reduced }: { scale: LogScale; reduced: boolean }) {
  const x = (v: number) => 16 + logPosition(v, scale.min, scale.max) * 268;
  return (
    <svg viewBox="0 0 300 120" role="img" aria-label={`${scale.label}: ${scale.value.toPrecision(3)} ${scale.unit} on a logarithmic scale`}>
      <text x="16" y="22" className="gx-viz-label">{scale.label} · log scale</text>
      <line x1="16" x2="284" y1="64" y2="64" stroke="#2b4766" strokeWidth="2" />
      {scale.ticks.map((t, i) => (
        <g key={t.label}>
          {/* Alternate label rows so close reference points (Proxima, Sirius, Vega) never overlap. */}
          <line x1={x(t.value)} x2={x(t.value)} y1="58" y2={i % 2 ? 84 : 70} stroke="#6f96b8" />
          <text x={x(t.value)} y={i % 2 ? 96 : 84} textAnchor="middle" className="gx-viz-tick">{t.label}</text>
        </g>
      ))}
      <motion.line x1="16" y1="64" y2="64" stroke="#87dcff" strokeWidth="2" initial={reduced ? false : { x2: 16 }} animate={{ x2: x(scale.value) }} transition={{ duration: .6, ease: [.18, .92, .24, 1] }} />
      <motion.g initial={reduced ? false : { opacity: 0, scale: .4 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: reduced ? 0 : .45 }} style={{ transformOrigin: `${x(scale.value)}px 64px` }}>
        <circle cx={x(scale.value)} cy="64" r="7" fill="#020711" stroke="#87dcff" strokeWidth="2" />
        <circle cx={x(scale.value)} cy="64" r="2.5" fill="#f4fbff" />
      </motion.g>
      <text x="284" y="110" textAnchor="end" className="gx-viz-value">{scale.value < 10 ? scale.value.toFixed(2) : Math.round(scale.value).toLocaleString()} {scale.unit}</text>
    </svg>
  );
}

export function RegionViz() {
  return (
    <svg viewBox="0 0 300 120" role="img" aria-label="Region overview">
      {[18, 34, 52].map((r, i) => <ellipse key={r} cx="150" cy="60" rx={r * 2.2} ry={r * .7} fill="none" stroke="#87dcff" strokeOpacity={.5 - i * .12} strokeDasharray="2 5" />)}
      <circle cx="150" cy="60" r="6" fill="#f4fbff" />
    </svg>
  );
}
