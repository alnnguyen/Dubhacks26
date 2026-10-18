import { useState } from 'react';
import type { ExploreMode } from './ExploreHud';
import { BRAND_NAME } from '../../brand';
import '../../styles/exploreIntro.css';

/** Quiet mode selection; the cinematic KO.rbit reveal belongs to the main welcome. */
export function ExploreIntro({ initialMode, onEnter, onBack }: {
  initialMode: ExploreMode; reducedMotion?: boolean; onEnter: (mode: ExploreMode) => void; onBack: () => void;
}) {
  const [mode, setMode] = useState(initialMode);
  return <main className="ko-mode-entry">
    <header><span className="ko-wordmark">✦ {BRAND_NAME}</span><span>EXPLORATION</span></header>
    <section className="ko-mode-entry__content" aria-labelledby="mode-heading">
      <p className="ko-mode-entry__eyebrow">FLIGHT DECK</p>
      <h1 id="mode-heading">Choose a mode.</h1>
      <div className="ko-mode-entry__choices" role="group" aria-label="Choose exploration mode">
        <button type="button" data-mode="explore" aria-pressed={mode==='explore'} onClick={()=>setMode('explore')}>
          <span className="ko-mode-entry__label"><strong>Explore</strong><span aria-hidden="true">{mode==='explore'?'✓':'↗'}</span></span>
          <span className="ko-mode-entry__description">Discover planets, stars and galaxies at your own pace.</span>
        </button>
        <button type="button" data-mode="flight" aria-pressed={mode==='flight'} onClick={()=>setMode('flight')}>
          <span className="ko-mode-entry__label"><strong>Flight</strong><span aria-hidden="true">{mode==='flight'?'✓':'↗'}</span></span>
          <span className="ko-mode-entry__description">Find other pilots and send challenges.</span>
        </button>
      </div>
      <button className="ko-mode-entry__enter" type="button" onClick={()=>onEnter(mode)}><span>{mode==='explore'?'Enter exploration':'Enter flight'}</span><span aria-hidden="true">↗</span></button>
      <button className="ko-mode-entry__back" type="button" onClick={onBack}>← Back to bridge</button>
    </section>
  </main>;
}
