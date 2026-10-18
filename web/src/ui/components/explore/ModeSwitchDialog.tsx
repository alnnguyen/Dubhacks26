import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { ExploreMode } from './ExploreHud';

const COPY: Record<ExploreMode, { eyebrow: string; title: string; points: string[]; note: string; enter: string }> = {
  flight: {
    eyebrow: 'Mode / multiplayer flight',
    title: 'Flight',
    points: [
      'Other pilots appear near Mars or Neptune so you can challenge them.',
      'Find rivals in Pilot contacts or by clicking their ships.',
      'Challenge someone to a lightsaber duel on Mars.',
    ],
    note: 'Zoom and view controls move to Explore mode.',
    enter: 'Enter Flight',
  },
  explore: {
    eyebrow: 'Mode / peaceful explore',
    title: 'Explore',
    points: [
      'Other pilots stop seeing your ship, and theirs are hidden from you.',
      'Zoom from Earth out to the Milky Way and the galaxy atlas.',
      'Hover and click anything — planets, craft, stars, galaxies — to learn about it.',
    ],
    note: 'Challenges sent to you can still arrive.',
    enter: 'Enter Explore',
  },
};

/** Confirms a Flight / Explore switch: explains the mode, then the app resets you to the starting point. */
export function ModeSwitchDialog({ mode, onEnter, onBack }: { mode: ExploreMode; onEnter: () => void; onBack: () => void }) {
  const reduced = useReducedMotion();
  const enter = useRef<HTMLButtonElement>(null);
  const copy = COPY[mode];
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    enter.current?.focus();
    return () => before?.focus();
  }, []);
  return (
    <motion.div className="gx-mode" role="dialog" aria-modal="true" aria-labelledby="gx-mode-title"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .2 }}
      onClick={onBack}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') onBack(); }}>
      <motion.div className="gx-mode__card" data-mode={mode} onClick={(e) => e.stopPropagation()}
        initial={reduced ? false : { y: 18, opacity: 0, scale: .97 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 10, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}>
        <p className="gx-eyebrow">{copy.eyebrow}</p>
        <h2 id="gx-mode-title">Switch to <span className="gx-dest__plate"><span>{copy.title}</span></span></h2>
        <ul>
          {copy.points.map((point, i) => (
            <motion.li key={point} initial={reduced ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: reduced ? 0 : .1 + i * .06 }}>{point}</motion.li>
          ))}
        </ul>
        <p className="gx-mode__note">{copy.note} You'll restart at the starting point near Earth.</p>
        <div className="gx-mode__actions">
          <button ref={enter} type="button" className="gx-primary" onClick={onEnter}><span>{copy.enter}</span><b aria-hidden>↗</b></button>
          <button type="button" className="gx-dest__learn" onClick={onBack}>Go back</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
