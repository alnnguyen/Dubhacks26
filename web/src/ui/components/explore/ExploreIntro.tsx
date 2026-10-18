import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { BRAND_NAME } from '../../brand';
import type { ExploreMode } from './ExploreHud';
import '../../styles/exploreIntro.css';

/** Entry page, not a modal over a running ship. The flight scene mounts after confirmation. */
export function ExploreIntro({ initialMode, reducedMotion = false, onEnter, onBack }: {
  initialMode: ExploreMode; reducedMotion?: boolean; onEnter: (mode: ExploreMode) => void; onBack: () => void;
}) {
  const [mode, setMode] = useState(initialMode);
  const reduce = !!useReducedMotion() || reducedMotion;
  const enter = useRef<HTMLButtonElement>(null);
  useEffect(() => { enter.current?.focus(); }, []);
  return <motion.main className="ko-intro" data-reduced-motion={reduce}
    initial={reduce ? false : { opacity: 0 }} animate={{opacity:1}} transition={{duration:.35}}>
    <div className="ko-intro__stars" aria-hidden="true" />
    <div className="ko-intro__planet" aria-hidden="true"><i/><i/><span/></div>
    <header className="ko-intro__masthead"><span className="ko-wordmark">✦ {BRAND_NAME}</span><span>EXPLORATION / UPLINK</span></header>
    <div className="ko-intro__content">
      <p className="ko-intro__eyebrow">ONE UNIVERSE. YOUR NEXT MOVE.</p>
      <motion.h1 className="ko-wordmark" initial={reduce ? false : {y:22,opacity:0}} animate={{y:0,opacity:1}} transition={{duration:.5,delay:.08}}>{BRAND_NAME}</motion.h1>
      <p className="ko-intro__lead">Go beyond the fight.</p>
      <p className="ko-intro__copy">From Earth's orbit to distant galaxies. Pick a destination, discover the story behind it, and find your next adventure.</p>
      <div className="ko-intro__modes" role="group" aria-label="Choose exploration mode">
        <button type="button" aria-pressed={mode==='explore'} onClick={()=>setMode('explore')}><span>01 / DISCOVER</span><strong>Explore</strong><small>Peaceful flight · zoom &amp; views</small></button>
        <button type="button" aria-pressed={mode==='flight'} onClick={()=>setMode('flight')}><span>02 / CONNECT</span><strong>Flight</strong><small>Pilot contacts · challenges</small></button>
      </div>
      <button ref={enter} type="button" className="ko-intro__enter" onClick={()=>onEnter(mode)}><span>{mode==='explore'?'Enter exploration':'Enter flight'}</span><b aria-hidden="true">↗</b></button>
      <button type="button" className="ko-intro__back" onClick={onBack}>← Back to bridge</button>
    </div>
    <footer className="ko-intro__footer"><span>EARTH → STARS → GALAXIES</span><span>CHOOSE YOUR OWN ORBIT.</span></footer>
  </motion.main>;
}
