import type { CSSProperties } from 'react';
import { motion, useReducedMotion } from 'motion/react';

/** Each line flies as a single slanted type-and-plate unit. */
export function KeywordBlock({ text, delay = 0, preserveCase = false }: { text: string; delay?: number; preserveCase?: boolean }) {
  const reduce = useReducedMotion() ?? false;
  return (
    <span className={`obn-kw${preserveCase ? ' obn-kw--brand' : ''}`} aria-label={text}>
      {text.split(' ').map((word, index) => (
        <motion.span
          className="obn-kw__flight"
          aria-hidden="true"
          key={word + index}
          style={{ '--letters': word.length, '--line': index } as CSSProperties}
          initial={
            reduce
              ? { opacity: 0 }
              : { x: '110vw', y: 56, scale: 0.72, rotate: -6, opacity: 0, filter: 'blur(8px)' }
          }
          animate={
            reduce
              ? { opacity: 1 }
              : { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1, filter: 'blur(0px)' }
          }
          transition={
            reduce
              ? { duration: 0.16 }
              : {
                  delay: delay + index * 0.12,
                  // One continuous spring — no overshoot keyframes that snap on the last frame.
                  type: 'spring',
                  stiffness: 92,
                  damping: 16,
                  mass: 0.85,
                  opacity: { type: 'tween', duration: 0.22, ease: 'easeOut', delay: delay + index * 0.12 },
                  filter: { type: 'tween', duration: 0.3, ease: 'easeOut', delay: delay + index * 0.12 },
                }
          }
        >
          <motion.span
            className="obn-kw__plate"
            initial={reduce ? undefined : { clipPath: 'polygon(0 0, 0 0, 0 100%, 0 100%)' }}
            animate={{ clipPath: 'polygon(0 0,100% 0,100% 100%,0 100%)' }}
            transition={{ duration: reduce ? 0 : 0.45, delay: delay + index * 0.12, ease: [0.22, 0.82, 0.2, 1] }}
          >
            <span className="obn-kw__text">{word}</span>
          </motion.span>
        </motion.span>
      ))}
    </span>
  );
}
