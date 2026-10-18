import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';

/** Invisible touch target over the center console (world meters, matches LAYOUT). */
const HOTSPOT = { center: [0, 1.02, -1.25] as const, size: [0.94, 0.42, 1.6] as const };

export interface ConsoleHotspotProps {
  /** Only active on the main cockpit view, so it never competes with the globe or panels. */
  interactive: boolean;
  onActivate: () => void;
}

/**
 * Independent click target for the center console. It is separate from the
 * hologram globe: each stops propagation, so a tap activates exactly one.
 */
export function ConsoleHotspot({ interactive, onActivate }: ConsoleHotspotProps) {
  const [hover, setHover] = useState(false);
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(...HOTSPOT.size)), []);
  useEffect(() => () => edges.dispose(), [edges]);

  useEffect(() => {
    if (!interactive) setHover(false);
  }, [interactive]);

  return (
    <group position={HOTSPOT.center as unknown as THREE.Vector3Tuple} name="console-hotspot">
      <mesh
        visible={interactive}
        onClick={(e) => {
          if (!interactive) return;
          e.stopPropagation();
          onActivate();
        }}
        onPointerOver={(e) => {
          if (!interactive) return;
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = '';
        }}
      >
        <boxGeometry args={HOTSPOT.size as unknown as [number, number, number]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
      {interactive && hover && (
        <lineSegments geometry={edges}>
          <lineBasicMaterial color={[0.5, 1.6, 2.2]} toneMapped={false} transparent opacity={0.8} depthWrite={false} />
        </lineSegments>
      )}
    </group>
  );
}
