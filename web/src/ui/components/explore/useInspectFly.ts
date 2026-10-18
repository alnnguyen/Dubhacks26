import { useEffect, useRef } from 'react';
import { SOLAR_BODIES, bodyWorldPosition } from './bodies';
import type { FlightMotion } from './flightMotion';
import { inspectStandoff } from './inspectPose';
import type { LocalNavigation } from './localNavigation';

/** Trigger flyTo / flyBack when inspect id changes. */
export function useInspectFly(motion: { current: FlightMotion }, inspectId: string | null | undefined, reducedMotion=false, navigation?:LocalNavigation) {
  const prev = useRef<string | null>(null);
  useEffect(() => {
    const ship = motion.current;
    const next = inspectId ?? null;
    const was = prev.current;
    prev.current = next;
    if (next && next !== was) {
      const body = SOLAR_BODIES.find((b) => b.id === next);
      if (!body) return;
      const portrait = typeof window !== 'undefined' && window.matchMedia('(orientation: portrait), (max-width: 720px)').matches;
      navigation?.stop();
      const { pos, look } = inspectStandoff(bodyWorldPosition(body), body.radius, portrait, window.innerWidth/window.innerHeight);
      ship.flyTo(pos, look, reducedMotion ? .05 : 1.2);
    } else if (!next && was) {
      ship.flyBack(reducedMotion ? .05 : 1.2);
    }
  }, [inspectId, motion, reducedMotion, navigation]);
}
