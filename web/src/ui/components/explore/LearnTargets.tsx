import { useMemo } from 'react';
import { SOLAR_BODIES, bodyWorldPosition } from './bodies';
import type { ExploreEnvironment } from './destinations';

/** Invisible clickable shells around bodies — Esc pointer-lock first, then click to learn. */
export function LearnTargets({
  environment,
  onLearn,
}: {
  environment: ExploreEnvironment;
  onLearn: (bodyId: string) => void;
}) {
  const targets = useMemo(() => {
    if (['galaxy','stars','galaxies','exoplanets'].includes(environment)) return [];
    if (environment === 'solar') {
      return SOLAR_BODIES.map((b) => ({ id: b.id, pos: bodyWorldPosition(b), r: b.radius * 1.35 }));
    }
    if (environment === 'moon-orbit') {
      return [
        { id: 'moon', pos: [0, 0, 0] as [number, number, number], r: 10 },
        { id: 'earth', pos: [48, -4, -10] as [number, number, number], r: 12 },
      ];
    }
    if (environment === 'mars-surface') {
      return [{ id: 'mars-surface', pos: [0, 0, 0] as [number, number, number], r: 40 }];
    }
    return [
      { id: 'exo-a', pos: [-25, 0, -40] as [number, number, number], r: 6 },
      { id: 'exo-b', pos: [35, 5, -70] as [number, number, number], r: 8 },
    ];
  }, [environment]);

  return (
    <group name="learn-targets">
      {targets.map((t) => (
        <mesh
          key={t.id}
          position={t.pos}
          onClick={(e) => {
            if (e.delta > 5) return;
            e.stopPropagation();
            if (document.pointerLockElement) document.exitPointerLock?.();
            onLearn(t.id);
          }}
          onPointerOver={() => {
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            document.body.style.cursor = '';
          }}
        >
          <sphereGeometry args={[t.r, 16, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
