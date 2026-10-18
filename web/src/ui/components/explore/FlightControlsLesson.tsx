import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

type Step = { keys: string[]; title: string; detail: string };

const DESKTOP: Step[] = [
  { keys: ['W'], title: 'Thrust', detail: 'W moves you forward.' },
  { keys: ['S'], title: 'Reverse', detail: 'S backs away.' },
  { keys: ['A', 'D'], title: 'Strafe', detail: 'A and D slide sideways.' },
  { keys: ['Q', 'E'], title: 'Rise', detail: 'Q rises. E drops.' },
  { keys: ['↑', '←', '↓', '→'], title: 'Steer', detail: 'Arrow keys look around.' },
  { keys: ['Drag'], title: 'Steer', detail: 'Or drag on the view.' },
  { keys: ['Shift'], title: 'Boost', detail: 'Hold Shift to go faster.' },
  { keys: ['Space'], title: 'Stop', detail: 'Space stops you. Cruise holds a steady speed.' },
  { keys: ['Scroll'], title: 'Zoom', detail: 'Scroll zooms from Earth out to galaxies.' },
  { keys: ['N'], title: 'Destinations', detail: 'N opens planets, stars, and catalogs.' },
];

const TOUCH: Step[] = [
  { keys: ['Left'], title: 'Move', detail: 'The left stick thrusts and strafes.' },
  { keys: ['Right'], title: 'Steer', detail: 'The right stick looks around.' },
  { keys: ['Zoom'], title: 'Zoom', detail: 'Zoom in and Zoom out change scale.' },
  { keys: ['N'], title: 'Destinations', detail: 'Destinations opens planets, stars, and catalogs.' },
];

/** Lesson for Explore and Flight. It does not fly the ship or invent a second simulation. */
export function FlightControlsLesson({
  open, isTouch, reducedMotion, replay = false, onDismiss,
}: {
  open: boolean;
  isTouch: boolean;
  reducedMotion: boolean;
  /** Reopening shows the full legend instead of playing the sequence again. */
  replay?: boolean;
  onDismiss: () => void;
}) {
  return <AnimatePresence>
    {open && <ControlsCard key="controls-card" isTouch={isTouch} reducedMotion={reducedMotion || replay} onDismiss={onDismiss} />}
  </AnimatePresence>;
}

function ControlsCard({ isTouch, reducedMotion, onDismiss }: { isTouch: boolean; reducedMotion: boolean; onDismiss: () => void }) {
  const steps = isTouch ? TOUCH : DESKTOP;
  const [index, setIndex] = useState(reducedMotion ? -1 : 0);
  const lit = index < 0 ? null : new Set(steps[index]?.keys ?? []);
  useEffect(() => {
    if (reducedMotion) return;
    let step = 0;
    let finish = 0;
    const tick = window.setInterval(() => {
      step += 1;
      if (step >= steps.length) {
        window.clearInterval(tick);
        finish = window.setTimeout(onDismiss, 900);
        return;
      }
      setIndex(step);
    }, isTouch ? 900 : 520);
    return () => { window.clearInterval(tick); window.clearTimeout(finish); };
  }, [isTouch, onDismiss, reducedMotion, steps.length]);

  return <motion.div className="ko-controls-scrim" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0.12 : 0.25 }}>
    <motion.section className="ko-controls" role="dialog" aria-modal="true" aria-labelledby="ko-controls-title"
      initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0.12 : 0.35 }}>
      <header>
        <p>Flight controls</p>
        <h2 id="ko-controls-title">{index < 0 ? 'How to fly' : steps[index].title}</h2>
      </header>
      <div className="ko-controls__groups">
        {steps.map(step => {
          const active = index < 0 || step.keys.some(key => lit?.has(key));
          return <div key={step.title + step.keys[0]} className="ko-controls__group" data-on={active && (index < 0 || step === steps[index])}>
            <span className="ko-controls__keys">{step.keys.map(key => <i key={key} data-on={index < 0 || lit?.has(key)}>{key}</i>)}</span>
            <span><strong>{step.title}</strong><small>{step.detail}</small></span>
          </div>;
        })}
      </div>
      <footer>
        <button type="button" className="ko-controls__skip" onClick={onDismiss}>Skip</button>
        <button type="button" className="ko-controls__done" autoFocus onClick={onDismiss}>Got it</button>
      </footer>
    </motion.section>
  </motion.div>;
}
