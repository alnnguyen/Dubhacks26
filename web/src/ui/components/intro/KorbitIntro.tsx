import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';
import { BRAND_NAME } from '../../brand';
import { createKorbitAnimation } from './korbitAnimation';
import './korbitIntro.css';

/** Shared welcome artwork. Flight and camera effects mount only after the real entry action. */
export function KorbitIntro({ context = 'PILOT UPLINK', actionLabel, onContinue, children, onBack, reducedMotion = false }: {
  context?: string; actionLabel: string; onContinue: () => void; children?: ReactNode; onBack?: () => void; reducedMotion?: boolean;
}) {
  const root = useRef<HTMLElement>(null);
  const playback = useRef<ReturnType<typeof createKorbitAnimation> | null>(null);
  const systemReduce = useReducedMotion();
  const [motionOff, setMotionOff] = useState(reducedMotion);
  const reduce = motionOff || reducedMotion || !!systemReduce;
  const [settled, setSettled] = useState(reduce);
  useEffect(() => {
    if (!root.current) return;
    const animation = createKorbitAnimation(root.current, () => setSettled(true));
    playback.current = animation;
    setSettled(reduce);
    if (reduce) animation.finish(); else animation.play();
    return () => { animation.destroy(); playback.current=null; };
  }, [reduce]);
  return <main className="korbit-intro" ref={root} data-settled={settled} data-reduced-motion={reduce}>
    <div id="k-shake">
      <div className="k-glass k-glass--red" aria-hidden="true"/><div className="k-glass k-glass--blue" aria-hidden="true"/>
      <div className="k-line l1" aria-hidden="true"/><div className="k-line l2" aria-hidden="true"/><div className="k-line l3" aria-hidden="true"/>
      <svg className="k-planet" viewBox="-110 -110 220 220" fill="none" stroke="#87dcff" strokeWidth=".6" aria-hidden="true">
        <circle r="100" strokeWidth="1"/><g className="k-planet-mer"/>
        <g opacity=".55">{[-80,-55,-28,0,28,55,80].map(y => <ellipse key={y} rx={Math.sqrt(10000-y*y)} ry={Math.sqrt(10000-y*y)/10} transform={`translate(0,${y})`}/>)}</g>
      </svg>
      <header className="k-hud k-tl"><span className="ko-wordmark">✦ {BRAND_NAME}</span><span className="k-context">/ {context}</span></header>
      <div className="k-hud k-tr" aria-hidden="true">{onBack ? 'EXPLORATION' : '01 / 04'}</div>
      <footer className="k-hud k-bl"><b>{onBack ? 'EARTH → STARS → GALAXIES' : 'PILOT REGISTRATION'}</b>{onBack ? 'CHOOSE A FLIGHT MODE' : 'FLIGHT PREPARATION'}</footer>
      <div className="k-hero">
        <p className="k-welcome">{onBack ? 'CHOOSE YOUR ORBIT' : 'WELCOME TO'}</p>
        <h1 className="k-logo" aria-label={BRAND_NAME}>
          <span className="k-logo-bg" aria-hidden="true"><i/><b/></span>
          <span className="k-K" aria-hidden="true">K</span><span className="k-O" aria-hidden="true">O</span><span className="k-dot" aria-hidden="true"/>
          {['r','b','i','t'].map((letter,i)=><span className="k-r" aria-hidden="true" key={i}>{letter}</span>)}
        </h1>
        <div className="k-actions" inert={!settled}>
          {children}
          <button className="k-btn" type="button" onClick={onContinue}>{actionLabel}<span aria-hidden="true">↗</span></button>
          {onBack && <button className="k-back" type="button" onClick={onBack}>← Back to bridge</button>}
        </div>
      </div>
      <div id="k-band" aria-hidden="true"><p className="t"/><p className="b"/></div>
      <div id="k-big" aria-hidden="true"><span className="bk">K</span><span className="bd bd1"/><span className="bo">O</span><span className="bd bd2"/></div>
      <canvas id="k-fx" aria-hidden="true"/>
    </div>
    <div className="k-utilities">
      {!settled && <button type="button" onClick={()=>playback.current?.finish()}>Skip animation</button>}
      {settled && !reduce && <button type="button" onClick={()=>{setSettled(false); playback.current?.play();}}>↻ Replay</button>}
      <button type="button" aria-pressed={reduce} disabled={!!systemReduce || reducedMotion} onClick={()=>setMotionOff(v=>!v)}>Reduced motion: {reduce?'on':'off'}</button>
    </div>
  </main>;
}
