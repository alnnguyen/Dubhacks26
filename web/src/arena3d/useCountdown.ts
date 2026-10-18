import { useEffect, useRef, useState } from "react";

// How long "FIGHT" stays up once a countdown ends.
export const FIGHT_FLASH_MS = 800;

/**
 * Milliseconds left on the server's round countdown (negative just after it
 * ends, so "FIGHT" can linger), or null when there is none. Measured from when
 * each view arrived, since phone and server clocks don't match.
 */
export function useCountdown(startsInMs: number | null, unlocked: boolean): number | null {
  const endsAtRef = useRef<number | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (startsInMs === null && !unlocked) {
      endsAtRef.current = null;
      setLeft(null);
      return;
    }
    if (startsInMs !== null) endsAtRef.current = performance.now() + startsInMs;
    const endsAt = endsAtRef.current;
    if (endsAt === null) return;
    const update = () => {
      const remaining = endsAt - performance.now();
      setLeft(!unlocked ? Math.max(1, remaining) : remaining > -FIGHT_FLASH_MS ? remaining : null);
      if (unlocked && remaining <= -FIGHT_FLASH_MS) {
        endsAtRef.current = null;
        window.clearInterval(timer);
      }
    };
    const timer = window.setInterval(update, 100);
    update();
    return () => window.clearInterval(timer);
  }, [startsInMs, unlocked]);
  return left;
}
