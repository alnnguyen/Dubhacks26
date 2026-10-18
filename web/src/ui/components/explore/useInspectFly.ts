import { useEffect, useRef } from 'react';
import { SOLAR_BODIES } from './bodies';
import { inspectTarget } from './inspectTargets';
import { orbitClock } from './orbitClock';
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
      // Only the continuous local view shares the frame these positions live in.
      const target = navigation ? inspectTarget(next) : null;
      // A moving spacecraft holds still while you look at it.
      orbitClock.setInspectHold(next.startsWith('sat-'));
      if (!target) return;
      const portrait = typeof window !== 'undefined' && window.matchMedia('(orientation: portrait), (max-width: 720px)').matches;
      navigation?.stop();
      // Planets are already flight bodies; anything else counts while you're parked beside it.
      navigation?.setTransientBody(SOLAR_BODIES.some((b) => b.id === next) ? null : target);
      const { pos, look } = inspectStandoff(target.position, target.radius, portrait, window.innerWidth/window.innerHeight);
      ship.flyTo(pos, look, reducedMotion ? .05 : 1.2);
    } else if (!next && was) {
      orbitClock.setInspectHold(false);
      navigation?.setTransientBody(null);
      ship.flyBack(reducedMotion ? .05 : 1.2);
    }
  }, [inspectId, motion, reducedMotion, navigation]);
}
