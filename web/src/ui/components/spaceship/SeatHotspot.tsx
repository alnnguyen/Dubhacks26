import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { LAYOUT } from './cockpitLayout';

/** Left pilot seat — matches Cockpit seat group at (−LAYOUT.seats.x, 0, seats.z). */
const HOTSPOT = {
  center: [-LAYOUT.seats.x, 0.72, LAYOUT.seats.z + 0.05] as const,
  size: [0.78, 1.15, 0.95] as const,
};

export interface SeatHotspotProps {
  interactive: boolean;
  onActivate: () => void;
}

/** Invisible click target on the pilot seat; hover shows an edge outline like the console. */
export function SeatHotspot({ interactive, onActivate }: SeatHotspotProps) {
  const [hover, setHover] = useState(false);
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(...HOTSPOT.size)), []);
  useEffect(() => () => edges.dispose(), [edges]);

  useEffect(() => {
    if (!interactive) setHover(false);
  }, [interactive]);

  return (
    <group position={HOTSPOT.center as unknown as THREE.Vector3Tuple} name="seat-hotspot">
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
