import type { CSSProperties } from 'react';
import { motion, useReducedMotion } from 'motion/react';

/** Each line flies as a single slanted type-and-plate unit. */
export function KeywordBlock({ text, delay = 0 }: { text: string; delay?: number }) {
  const reduce = useReducedMotion() ?? false;
  return <span className="obn-kw" aria-label={text}>
    {text.split(' ').map((word, index) => <motion.span
      className="obn-kw__flight" aria-hidden="true" key={word + index}
      style={{ '--letters': word.length, '--line': index } as CSSProperties}
      initial={reduce ? { opacity: 0 } : { x: '110vw', y: 75, scale: .65, rotate: -7, opacity: 0, filter: 'blur(10px)' }}
      animate={reduce ? { opacity: 1 } : { x: ['110vw', '-1.8vw', '0vw'], y: [75, -6, 0], scale: [.65, 1.025, 1], rotate: [-7, -.7, 0], opacity: [0, 1, 1], filter: ['blur(10px)', 'blur(0px)', 'blur(0px)'] }}
      transition={reduce ? { duration: .16 } : { duration: .85, delay: delay + index * .13, times: [0, .77, 1], ease: [.15, .85, .2, 1] }}>
      <motion.span className="obn-kw__plate"
        initial={reduce ? undefined : { clipPath: 'polygon(0 0, 0 0, 0 100%, 0 100%)' }}
        animate={{ clipPath: 'polygon(0 0,100% 0,100% 100%,0 100%)' }}
        transition={{ duration: reduce ? 0 : .48, delay: delay + index * .13, ease: [.2,.8,.2,1] }}>
        <span className="obn-kw__text">{word}</span>
      </motion.span>
    </motion.span>)}
  </span>;
}
