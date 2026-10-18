import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Vector3, type Group } from 'three';
import { SOLAR_BODIES, bodyWorldPosition } from './bodies';
import { LocalNavigation } from './localNavigation';
import type { NearbyPilot } from '../../state/lobbyTypes';

type Anchor = { id: 'mars' | 'neptune'; position: Vector3; radius: number; label: string };

function arenaAnchor(bodyId: 'mars' | 'neptune'): Anchor {
  const body = SOLAR_BODIES.find((b) => b.id === bodyId)!;
  return {
    id: bodyId,
    position: new Vector3(...bodyWorldPosition(body)),
    radius: body.radius,
    label: body.name,
  };
}

function phaseOf(id: string) {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (hash % 628) / 100;
}

/** Stable Mars / Neptune home for a pilot. Not live pose — illustrative orbit only. */
function arenaHome(id: string): 'mars' | 'neptune' {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash % 2 === 0 ? 'mars' : 'neptune';
}

/**
 * Other pilots' ships orbit Mars or Neptune. Positions are illustrative:
 * the server never streams free-flight coordinates.
 */
export function RivalShips({ navigation, rivals, onSelect }: { navigation: LocalNavigation; rivals: NearbyPilot[]; onSelect: (id: string) => void }) {
  const mars = useMemo(() => arenaAnchor('mars'), []);
  const neptune = useMemo(() => arenaAnchor('neptune'), []);
  const placed = useMemo(() => {
    const perBody = new Map<string, number>();
    return rivals.map((pilot) => {
      const home = arenaHome(pilot.id);
      const anchor = home === 'mars' ? mars : neptune;
      const slot = perBody.get(home) ?? 0;
      perBody.set(home, slot + 1);
      return { pilot, anchor, slot, phase: phaseOf(pilot.id) };
    });
  }, [rivals, mars, neptune]);
  return (
    <group name="rival-ships">
      {placed.map((p) => <RivalShip key={p.pilot.id} {...p} navigation={navigation} onSelect={onSelect} />)}
    </group>
  );
}

function RivalShip({ pilot, anchor, slot, phase, navigation, onSelect }: {
  pilot: NearbyPilot; anchor: Anchor; slot: number; phase: number; navigation: LocalNavigation; onSelect: (id: string) => void;
}) {
  const ship = useRef<Group>(null);
  const label = useRef<HTMLButtonElement>(null);
  const next = useMemo(() => new Vector3(), []);
  const toShip = useMemo(() => new Vector3(), []);
  const toBody = useMemo(() => new Vector3(), []);
  const orbit = anchor.radius * 2.2 + 3 + slot * anchor.radius * 0.8;
  const inDuel = pilot.status !== 'available';
  useFrame(({ clock }) => {
    const g = ship.current;
    if (!g) return;
    const angle = phase + clock.elapsedTime * (0.22 / (1 + slot * 0.3));
    g.position.set(anchor.position.x + Math.cos(angle) * orbit, anchor.position.y + Math.sin(angle * 0.7) * orbit * 0.15, anchor.position.z + Math.sin(angle) * orbit);
    next.set(anchor.position.x + Math.cos(angle + 0.05) * orbit, g.position.y, anchor.position.z + Math.sin(angle + 0.05) * orbit);
    g.lookAt(next);
    // Keep the ship readable at every zoom: roughly constant screen size, never smaller than true scale.
    const distance = g.position.distanceTo(navigation.motion.position);
    g.scale.setScalar(Math.max(anchor.radius * 0.12, distance * 0.03));
    if (label.current) {
      label.current.hidden = distance > 60000;
      // Fade the label while the ship passes behind its planet (the mesh itself is depth-occluded).
      toShip.copy(g.position).sub(navigation.motion.position).normalize();
      toBody.copy(anchor.position).sub(navigation.motion.position);
      const along = toBody.dot(toShip);
      const behind = along > 0 && along < distance && toBody.lengthSq() - along * along < anchor.radius * anchor.radius;
      label.current.dataset.behind = String(behind);
    }
  });
  return (
    <group ref={ship}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.45, 2, 10]} />
        <meshStandardMaterial color={inDuel ? '#8c8c8c' : '#ff6b4a'} emissive={inDuel ? '#222' : '#ff3b1f'} emissiveIntensity={0.8} metalness={0.4} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, -0.35]}>
        <boxGeometry args={[2.1, 0.08, 0.6]} />
        <meshStandardMaterial color="#d8dde6" emissive="#ff6b4a" emissiveIntensity={0.25} metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, -1.05]}>
        <sphereGeometry args={[0.22, 10, 8]} />
        <meshBasicMaterial color="#ffb38a" toneMapped={false} />
      </mesh>
      <Html center position={[0, 2.2, 0]} zIndexRange={[20, 0]} wrapperClass="ex-rival-wrap">
        <button ref={label} type="button" className="ex-rival-label" data-duel={inDuel}
          onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onSelect(pilot.id); }}
          aria-label={inDuel ? `${pilot.callsign} is in a duel` : `Select ${pilot.callsign} to challenge`}>
          <span className="ex-rival-label__mark" aria-hidden>⚔</span>{pilot.callsign}
          <small>{inDuel ? 'IN DUEL' : `near ${anchor.label}`}</small>
        </button>
      </Html>
    </group>
  );
}
