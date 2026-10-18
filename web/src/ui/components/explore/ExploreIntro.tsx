import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import type { ExploreMode } from './ExploreHud';
import { BRAND_NAME } from '../../brand';
import '../../styles/exploreIntro.css';

/** Quiet mode selection; the cinematic KO.rbit reveal belongs to the main welcome. */
export function ExploreIntro({ initialMode, reducedMotion=false, onEnter, onBack }: {
  initialMode: ExploreMode; reducedMotion?: boolean; onEnter: (mode: ExploreMode) => void; onBack: () => void;
}) {
  const [mode, setMode] = useState(initialMode);
  const reduce=!!useReducedMotion()||reducedMotion;
  const depart=(x=0,y=0,delay=0)=>({opacity:0,x:reduce?0:x,y:reduce?0:y,transition:{duration:reduce?.15:.55,delay:reduce?0:delay,ease:'easeIn' as const}});
  return <motion.main className="ko-mode-entry" exit={{pointerEvents:'none'}}>
    <motion.header exit={depart(0,-32,.1)}><span className="ko-wordmark">✦ {BRAND_NAME}</span><span>EXPLORATION</span></motion.header>
    <section className="ko-mode-entry__content" aria-labelledby="mode-heading">
      <motion.p exit={depart(-90,0)} className="ko-mode-entry__eyebrow">FLIGHT DECK</motion.p>
      <motion.h1 exit={depart(-140,0,.05)} id="mode-heading">Choose a mode.</motion.h1>
      <div className="ko-mode-entry__choices" role="group" aria-label="Choose exploration mode">
        <motion.button exit={{...depart(-100,-24,.05),rotateY:reduce?0:-28,rotateZ:reduce?0:-3}} type="button" data-mode="explore" aria-pressed={mode==='explore'} onClick={()=>setMode('explore')}>
          <span className="ko-mode-entry__label"><strong>Explore</strong><span aria-hidden="true">{mode==='explore'?'✓':'↗'}</span></span>
          <span className="ko-mode-entry__description">Discover planets, stars and galaxies at your own pace.</span>
        </motion.button>
        <motion.button exit={{...depart(100,-24,.1),rotateY:reduce?0:28,rotateZ:reduce?0:3}} type="button" data-mode="flight" aria-pressed={mode==='flight'} onClick={()=>setMode('flight')}>
          <span className="ko-mode-entry__label"><strong>Flight</strong><span aria-hidden="true">{mode==='flight'?'✓':'↗'}</span></span>
          <span className="ko-mode-entry__description">Find other pilots and send challenges.</span>
        </motion.button>
      </div>
      <motion.button exit={depart(140,0,.15)} className="ko-mode-entry__enter" type="button" onClick={()=>onEnter(mode)}><span>{mode==='explore'?'Enter exploration':'Enter flight'}</span><span aria-hidden="true">↗</span></motion.button>
      <motion.button exit={depart(0,30,.1)} className="ko-mode-entry__back" type="button" onClick={onBack}>← Back to bridge</motion.button>
    </section>
  </motion.main>;
}
