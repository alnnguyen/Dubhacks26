import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, MotionConfig, motion, useReducedMotion } from 'motion/react';
import { HoloButton } from '../hud/primitives';
import { scienceForBodyId } from './bodiesScience';
import { destinationForBody, type ExploreDestination } from './destinations';
import { destinationProfile } from './destinationProfile';
import { OrbitViz, RegionViz, ScaleViz } from './DestinationsPanel';

type Tab = 'overview' | 'data';

/**
 * The planet-archive side view for every other object: spacecraft, small bodies, stars,
 * exoplanets and galaxies. Same sheet, motion and HUD behavior as PlanetPanel; content comes
 * from the bundled catalog records (no invented values).
 */
export function ObjectPanel({ bodyId, onClose, onVisit, reducedMotion }: {
  bodyId: string;
  onClose: () => void;
  onVisit?: (destinationId: string) => void;
  reducedMotion?: boolean;
}) {
  const deviceQuiet = useReducedMotion(), quiet = !!reducedMotion || !!deviceQuiet;
  const [tab, setTab] = useState<Tab>('overview');
  const [portrait, setPortrait] = useState(() => window.matchMedia('(orientation: portrait), (max-width: 720px)').matches);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const query = window.matchMedia('(orientation: portrait), (max-width: 720px)');
    const change = () => setPortrait(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  useEffect(() => setTab('overview'), [bodyId]);
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.querySelector<HTMLButtonElement>('.ex-planet-close')?.focus();
    return () => before?.focus();
  }, []);

  const science = scienceForBodyId(bodyId);
  const destination: ExploreDestination = destinationForBody(bodyId) ?? { id: bodyId, label: science?.name ?? bodyId, bodyId, briefing: '', environment: 'solar', spawn: [0, 0, 0], yaw: 0 };
  const profile = destinationProfile(destination);
  if (!science && profile.kind === 'region') return null;
  const name = science?.name ?? destination.label;

  return (
    <MotionConfig reducedMotion={quiet ? 'always' : 'never'}>
      <motion.div className="ex-planet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: quiet ? 0 : .25 }} onClick={onClose}>
        <motion.aside ref={panel} className="ex-planet-panel gx-object-panel" role="dialog" aria-modal="true" aria-labelledby="ex-object-title" data-portrait={portrait}
          initial={quiet ? false : portrait ? { y: '105%', opacity: 0 } : { x: '105%', opacity: 0 }}
          animate={{ x: 0, y: 0, opacity: 1 }} exit={portrait ? { y: '105%', opacity: 0 } : { x: '105%', opacity: 0 }}
          transition={quiet ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30, delay: .15 }}
          onClick={(e) => e.stopPropagation()}>
          <header className="ex-planet-header">
            <div>
              <p className="sd-eyebrow">CATALOG ARCHIVE / {profile.badge}</p>
              <h2 id="ex-object-title">{name}</h2>
              {profile.metrics[0] && <p className="ex-planet-subtitle">{profile.metrics[0].label}: {profile.metrics[0].value}{profile.metrics[0].unit ? ` ${profile.metrics[0].unit}` : ''}</p>}
            </div>
            <button type="button" className="ex-planet-close" aria-label="Close" onClick={onClose}>✕</button>
          </header>
          <LayoutGroup id="object-inspect-tabs">
            <div className="ex-planet-tabs" role="tablist" aria-label="Object information">
              {(['overview', 'data'] as Tab[]).map((t) => (
                <button type="button" role="tab" key={t} aria-selected={tab === t} onClick={() => setTab(t)}>
                  {t === 'overview' ? 'Overview' : 'Catalog data'}
                  {tab === t && <motion.span className="ex-planet-uline" layoutId="object-tab-underline" />}
                </button>
              ))}
            </div>
          </LayoutGroup>
          <div className="ex-planet-scroll">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div className="ex-planet-body" role="tabpanel" key={`${bodyId}-${tab}`} initial={{ opacity: 0, y: quiet ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: quiet ? 0 : -6 }} transition={{ duration: quiet ? 0 : .16 }}>
                {tab === 'overview' ? (
                  <>
                    <div className="gx-dest__viz">
                      {profile.orbit ? <OrbitViz orbit={profile.orbit} starlink={profile.kind === 'starlink'} reduced={quiet} /> : profile.scale ? <ScaleViz scale={profile.scale} reduced={quiet} /> : <RegionViz />}
                    </div>
                    {profile.metrics.length > 0 && (
                      <div className="ex-planet-grid">
                        {profile.metrics.map((m, i) => (
                          <motion.div key={m.label} className="ex-planet-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .42, delay: .05 + i * .06, ease: [.2, .8, .2, 1] }}>
                            <small>{m.label}</small>
                            <b data-long={m.value.length > 10}>{m.value}{m.unit && <em> {m.unit}</em>}</b>
                          </motion.div>
                        ))}
                      </div>
                    )}
                    <p className="ex-planet-note">{science?.blurb ?? profile.blurb}</p>
                  </>
                ) : (
                  <>
                    {(science?.facts ?? []).map((f) => (
                      <p className="ex-planet-row" key={f.label}><span>{f.label}</span><span>{f.value}</span></p>
                    ))}
                    {!science?.facts?.length && <p className="ex-planet-note">No additional catalog fields for this record.</p>}
                    {science?.snapshot && <p className="ex-planet-caveat">Local catalog snapshot {science.snapshot} UTC.</p>}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
          <footer className="ex-planet-footer">
            <p className="ex-planet-source">
              {science?.sourceUrl ? <a href={science.sourceUrl} target="_blank" rel="noreferrer">{science.source} ↗</a> : profile.source ?? science?.source}
            </p>
            <div className="ex-planet-actions">
              {onVisit && destinationForBody(bodyId) && <HoloButton variant="primary" onClick={() => onVisit(destinationForBody(bodyId)!.id)}>Visit {name}</HoloButton>}
              <HoloButton onClick={onClose}>Resume flight</HoloButton>
            </div>
          </footer>
        </motion.aside>
      </motion.div>
    </MotionConfig>
  );
}
