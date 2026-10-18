import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { animate, AnimatePresence, LayoutGroup, MotionConfig, motion, useReducedMotion } from 'motion/react';
import { HoloButton } from '../hud/primitives';
import { SOLAR_BODIES } from './bodies';
import { planetFacts, planetFactsEarth, type PlanetFacts } from './bodiesScience';

export type PlanetPanelTab = 'overview' | 'dissect' | 'facts' | 'compare' | 'duel';

export interface PlanetPanelProps {
  bodyId: string;
  onClose: () => void;
  onVisit?: () => void;
  onTabChange?: (tab: PlanetPanelTab) => void;
  reducedMotion?: boolean;
  onSelectBody?: (id:string)=>void;
  onHighlight?: (index:number)=>void;
}

const TABS: { id: PlanetPanelTab; label: string; hideFor?: string[] }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'dissect', label: 'Dissection', hideFor: ['moon', 'sun'] },
  { id: 'facts', label: 'Facts' },
  { id: 'compare', label: 'vs Earth' },
  { id: 'duel', label: 'Duel' },
];

function fmt(n: number, d = 0) {
  return n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
}

const QuietMotion=createContext(false);
function NumberTicker({value,decimals=0,delay=0}:{value:number;decimals?:number;delay?:number}) {
  const el=useRef<HTMLSpanElement>(null), quiet=useContext(QuietMotion);
  useEffect(()=> {
    if(quiet) {if(el.current)el.current.textContent=fmt(value,decimals);return;}
    const controls=animate(0,value,{duration:.8,delay,ease:'easeOut',onUpdate:n=>{if(el.current)el.current.textContent=fmt(n,decimals);}});
    return ()=>controls.stop();
  },[value,decimals,delay,quiet]);
  return <span ref={el} aria-label={fmt(value,decimals)}>{fmt(value,decimals)}</span>;
}

function Card({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <motion.div
      className="ex-planet-card"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, delay, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

function OverviewTab({ f }: { f: PlanetFacts }) {
  const stats: [string, number, string, number][] = [
    ['Radius', f.radius_km, 'km', 0],
    ['Gravity', f.gravity, 'm/s²', 1],
    ['Day', f.lengthOfDay_h, 'h', 1],
    ['Year', f.orbitalPeriod_d, 'days', 0],
    ['Moons', f.moons, '', 0],
    ['Mean temp', f.meanTemp_C, '°C', 0],
  ];
  return (
    <>
      <div className="ex-planet-grid">
        {stats.map(([k, v, u, d], i) => (
          <Card key={k} delay={0.06 * i}>
            <small>{k}</small>
            <b>
              <NumberTicker value={v} decimals={d} delay={0.1 + i * 0.06} />
              {u ? <em> {u}</em> : null}
            </b>
          </Card>
        ))}
      </div>
      <Card delay={0.4}>
        <p className="ex-planet-note">
          <b>{f.atmosphere.summary}.</b> {f.funFact}
        </p>
      </Card>
    </>
  );
}

function DissectTab({ f, onHighlight }: { f: PlanetFacts; onHighlight?: (index:number)=>void }) {
  const conf = f.interior.confidence;
  const col = conf.startsWith('high') ? 'var(--go, #6dffb0)' : conf.startsWith('medium') ? 'var(--holo-strong)' : 'var(--accent)';
  const layers = [...f.interior.layers].reverse();
  return (
    <>
      <Card>
        <span className="ex-planet-badge" style={{ color: col }}>
          confidence: {conf}
        </span>
      </Card>
      {layers.map((l, i) => (
        <Card key={l.name} delay={0.45 + i * 0.06}>
          <button type="button" className="ex-planet-layer" onClick={()=>onHighlight?.(f.interior.layers.length-1-i)}>
            <i style={{ background: l.color }} />
            <div>
              <b>{f.interior.layers.length-i} · {l.name}</b>
              <span>
                {l.state} · to {fmt(l.outerRadiusFraction * f.radius_km)} km
                {l.note ? ` · ${l.note}` : ''}
              </span>
            </div>
          </button>
        </Card>
      ))}
      <p className="ex-planet-note">Simplified interior model · radius fractions are approximate. Select a layer to highlight it.</p>
      {f.interior.sources.map((url,i)=><a className="ex-interior-source" key={url} href={url} target="_blank" rel="noreferrer">Interior research {i+1} ↗</a>)}
    </>
  );
}

function FactsTab({ f }: { f: PlanetFacts }) {
  const rows: [string, string][] = [
    ['Mass', `${f.mass_1e24kg} × 10²⁴ kg`],
    ['Density', `${fmt(f.density_kgm3)} kg/m³`],
    ['Escape velocity', `${f.escapeVelocity} km/s`],
    ['Rotation', `${fmt(Math.abs(f.rotationPeriod_h), 1)} h${f.rotationPeriod_h < 0 ? ' (retrograde)' : ''}`],
    ['Axial tilt', `${f.obliquity_deg}°`],
    ['Surface pressure', f.surfacePressure_bar == null ? 'no solid surface' : `${f.surfacePressure_bar} bar`],
    ['Rings', f.rings ? 'yes' : 'no'],
    ['Magnetic field', f.globalMagneticField ? 'global' : 'none'],
  ];
  return (
    <>
      {rows.map(([k, v], i) => (
        <Card key={k} delay={i * 0.05}>
          <div className="ex-planet-row">
            <span>{k}</span>
            <span>{v}</span>
          </div>
        </Card>
      ))}
      {f.atmosphere.major.length > 0 && (
        <Card delay={0.45}>
          <small className="ex-planet-note">ATMOSPHERE</small>
          {f.atmosphere.major.slice(0, 4).map(([g, pct]) => (
            <div key={g} className="ex-planet-atm">
              <div className="ex-planet-row">
                <span>{g}</span>
                <span>{pct}%</span>
              </div>
              <div className="ex-planet-bar">
                <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: Math.max(0.01, pct / 100) }} transition={{ duration: 0.8, delay: 0.5 }} />
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

function CompareTab({ f }: { f: PlanetFacts }) {
  const E = planetFactsEarth();
  const rr = f.radius_km / E.radius_km;
  return (
    <>
      <Card>
        <p className="ex-planet-note">
          A 70 kg pilot experiences about <b>{fmt(70*f.gravity)} N</b> of gravitational force here. Mass remains 70 kg.
        </p>
      </Card>
      <div className="ex-planet-compare" aria-label="Planet sizes compared with Earth">
        {[{name:'Earth',r:1},{name:f.name,r:rr}].map((p,i)=><div key={i}><motion.span initial={{scale:0}} animate={{scale:1}} style={{width:Math.max(4,130*p.r/Math.max(1,rr)),height:Math.max(4,130*p.r/Math.max(1,rr))}} /><small>{p.name}</small></div>)}
      </div>
      <div className="ex-planet-grid">
        {(
          [
            ['Size', rr, '× Earth', 2],
            ['Gravity', f.gravityVsEarth, '× Earth', 2],
            ['Day', f.lengthOfDay_h / 24, '× Earth', 1],
            ['Year', f.orbitalPeriod_d / E.orbitalPeriod_d, '× Earth', 2],
          ] as const
        ).map(([k, v, u, d], i) => (
          <Card key={k} delay={0.1 + i * 0.06}>
            <small>{k}</small>
            <b>
              <NumberTicker value={v} decimals={d} delay={0.2 + i * 0.06} />
              <em> {u}</em>
            </b>
          </Card>
        ))}
      </div>
    </>
  );
}

function DuelTab({ f }: { f: PlanetFacts }) {
  const E = planetFactsEarth();
  const quiet=useContext(QuietMotion);
  const ms = f.duelFlightTimeMs;
  const em = E.duelFlightTimeMs;
  return (
    <>
      <Card>
        <p className="ex-planet-note">
          Illustrative gravity timing = 0.8 s × √(9.8 / g). NASA reference gravity: <b>{f.gravity} m/s²</b>. Educational preview; active match rules are unchanged.
        </p>
      </Card>
      <div className="ex-planet-grid">
        <Card delay={0.1}>
          <small>{f.name} flight</small>
          <b>
            <NumberTicker value={ms} delay={0.2} />
            <em> ms</em>
          </b>
        </Card>
        <Card delay={0.16}>
          <small>vs Earth</small>
          <b>
            <NumberTicker value={ms / em} decimals={2} delay={0.25} />
            <em> × time</em>
          </b>
        </Card>
      </div>
      <div className="ex-gravity-preview" aria-label="Illustrative rock flight animation">
        <svg viewBox="0 0 300 100" role="img" aria-label="Gravity timing arc"><path d="M 20 80 Q 150 -50 280 80" fill="none" stroke="#80cddd55" strokeDasharray="4 5" /><motion.circle r="7" fill="#e8b37b" animate={quiet?{cx:150,cy:15}:{cx:[20,85,150,215,280],cy:[80,31,15,31,80]}} transition={{duration:ms/1000,repeat:quiet?0:Infinity,repeatDelay:.8,ease:'linear'}} /></svg>
      </div>
      <Card delay={0.3}>
        <p className="ex-planet-note">
          Earth reference: {fmt(em / 1000, 2)} s · {f.name}: {fmt(ms / 1000, 2)} s
        </p>
      </Card>
    </>
  );
}

export function PlanetPanel({bodyId,onClose,onVisit,onTabChange,onSelectBody,onHighlight,reducedMotion}:PlanetPanelProps) {
  const facts=planetFacts(bodyId), deviceQuiet=useReducedMotion(), quiet=!!reducedMotion || !!deviceQuiet;
  const [tab,setTab]=useState<PlanetPanelTab>('overview');
  const [portrait,setPortrait]=useState(()=>window.matchMedia('(orientation: portrait), (max-width: 720px)').matches);
  const panel=useRef<HTMLElement>(null), firstFocus=useRef<HTMLElement|null>(null);
  useEffect(()=> {
    const query=window.matchMedia('(orientation: portrait), (max-width: 720px)');
    const change=()=>setPortrait(query.matches);query.addEventListener('change',change);return ()=>query.removeEventListener('change',change);
  },[]);
  useEffect(()=>{setTab('overview');onHighlight?.(-1);},[bodyId,onHighlight]);
  useEffect(()=>{onTabChange?.(tab);},[tab,onTabChange]);
  useEffect(()=> {
    firstFocus.current=document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.querySelector<HTMLButtonElement>('.ex-planet-close')?.focus();
    return ()=>firstFocus.current?.focus();
  },[]);
  const trap=(event:React.KeyboardEvent)=> {
    if(event.key!=='Tab')return;
    const controls=panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],[tabindex="0"]');
    if(!controls?.length)return;
    const first=controls[0],last=controls[controls.length-1];
    if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
  };
  if(!facts)return null;
  const visibleTabs=TABS.filter(t=>!t.hideFor?.includes(bodyId));
  return <QuietMotion.Provider value={quiet}><MotionConfig reducedMotion={quiet?'always':'never'}>
    <motion.div className="ex-planet-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:quiet?0:.25}} onClick={onClose}>
      <motion.aside ref={panel} className="ex-planet-panel" role="dialog" aria-modal="true" aria-labelledby="ex-planet-title" data-portrait={portrait}
        initial={quiet?false:portrait?{y:'105%',opacity:0}:{x:'105%',opacity:0}}
        animate={{x:0,y:0,opacity:1}} exit={portrait?{y:'105%',opacity:0}:{x:'105%',opacity:0}}
        transition={quiet?{duration:0}:{type:'spring',stiffness:260,damping:30,delay:.15}}
        onKeyDown={trap} onClick={e=>e.stopPropagation()}>
        <header className="ex-planet-header"><div><p className="sd-eyebrow">PLANETARY ARCHIVE / {facts.type}</p><h2 id="ex-planet-title">{facts.name}</h2>
          <p className="ex-planet-subtitle">{facts.distanceFromSun_1e6km!=null?`${fmt(facts.distanceFromSun_1e6km)} million km from Sun`:'Earth’s natural satellite'}</p></div>
          <button type="button" className="ex-planet-close" aria-label="Close planet inspection" onClick={onClose}>✕</button></header>
        <div className="ex-planet-switcher" aria-label="Choose a planet">{SOLAR_BODIES.filter(b=>b.id!=='sun').map(b=><button type="button" key={b.id} aria-label={`Inspect ${b.name}`} aria-pressed={b.id===bodyId} onClick={()=>onSelectBody?.(b.id)}>{b.name.slice(0,2)}</button>)}</div>
        <LayoutGroup id="planet-inspect-tabs"><div className="ex-planet-tabs" role="tablist" aria-label="Planet information">
          {visibleTabs.map(t=><button type="button" role="tab" id={`planet-tab-${t.id}`} aria-controls="planet-tab-content" key={t.id} aria-selected={tab===t.id} onClick={()=>setTab(t.id)}>
            {t.label}{tab===t.id && <motion.span className="ex-planet-uline" layoutId="planet-tab-underline" />}
          </button>)}
        </div></LayoutGroup>
        <div className="ex-planet-scroll"><AnimatePresence mode="wait" initial={false}>
          <motion.div className="ex-planet-body" role="tabpanel" id="planet-tab-content" aria-labelledby={`planet-tab-${tab}`} key={`${bodyId}-${tab}`} initial={{opacity:0,y:quiet?0:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:quiet?0:-6}} transition={{duration:quiet?0:.16}}>
            {tab==='overview' && <><OverviewTab f={facts} /><p className="ex-planet-caveat">Reference snapshot · planet sizes and spacing are compressed. Moon counts reflect the provided fact-sheet snapshot.</p></>}
            {tab==='dissect' && <DissectTab f={facts} onHighlight={onHighlight} />}
            {tab==='facts' && <FactsTab f={facts} />}
            {tab==='compare' && <CompareTab f={facts} />}
            {tab==='duel' && <DuelTab f={facts} />}
          </motion.div>
        </AnimatePresence></div>
        <footer className="ex-planet-footer"><p className="ex-planet-source"><a href={facts.source} target="_blank" rel="noreferrer">NASA Planetary Fact Sheet ↗</a></p><div className="ex-planet-actions">{onVisit && <HoloButton variant="primary" onClick={onVisit}>Visit {facts.name}</HoloButton>}<HoloButton onClick={onClose}>Resume flight</HoloButton></div></footer>
      </motion.aside>
    </motion.div>
  </MotionConfig></QuietMotion.Provider>;
}
