import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { FlightInput } from './ShipFlightController';

/**
 * Minimal pilot chrome for free-flight: thin dash + steering wheel at the bottom
 * of the view so most of the frame is open space.
 */
export function DriveConsole({ input, speed }: { input: FlightInput; speed: number }) {
  const wheel = useRef<THREE.Group>(null);
  const glow = useRef<THREE.MeshStandardMaterial>(null);
  const targetYaw = useRef(0);
  // FlightInput.strafe reserved for future wheel lean visual
  void input.strafe;

  const rim = useMemo(() => new THREE.TorusGeometry(0.28, 0.028, 10, 48), []);
  const hub = useMemo(() => new THREE.CylinderGeometry(0.06, 0.07, 0.04, 16), []);
  const spoke = useMemo(() => new THREE.BoxGeometry(0.22, 0.018, 0.022), []);

  useFrame((_, dt) => {
    targetYaw.current = THREE.MathUtils.damp(targetYaw.current, input.yaw * 0.55, 8, dt);
    if (wheel.current) {
      wheel.current.rotation.z = -targetYaw.current;
      wheel.current.rotation.x = -0.35 + input.thrust * 0.04;
    }
    if (glow.current) {
      glow.current.emissiveIntensity = 0.35 + Math.min(speed / 55, 1) * 0.9;
    }
  });

  return (
    <group name="drive-console" position={[0, 0.55, -0.85]}>
      {/* Lower dash slab */}
      <mesh position={[0, -0.22, 0.15]} rotation={[-0.55, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.65, 0.12, 0.55]} />
        <meshStandardMaterial color="#12161c" metalness={0.55} roughness={0.4} />
      </mesh>
      <mesh position={[0, -0.14, 0.02]} rotation={[-0.55, 0, 0]}>
        <boxGeometry args={[1.35, 0.02, 0.28]} />
        <meshStandardMaterial color="#0a1018" metalness={0.3} roughness={0.5} emissive="#123040" emissiveIntensity={0.4} />
      </mesh>

      {/* Soft side pillars — framing only */}
      {([-1, 1] as const).map((s) => (
        <mesh key={s} position={[s * 0.95, 0.35, 0.35]} rotation={[0, 0, s * 0.08]}>
          <boxGeometry args={[0.06, 1.1, 0.08]} />
          <meshStandardMaterial color="#0d1116" metalness={0.4} roughness={0.55} transparent opacity={0.85} />
        </mesh>
      ))}

      {/* Steering wheel */}
      <group ref={wheel} position={[0, -0.02, 0.28]} rotation={[-0.35, 0, 0]}>
        <mesh geometry={rim}>
          <meshStandardMaterial ref={glow} color="#1a222c" metalness={0.65} roughness={0.35} emissive="#5fe1ff" emissiveIntensity={0.4} />
        </mesh>
        <mesh geometry={hub} rotation={[Math.PI / 2, 0, 0]}>
          <meshStandardMaterial color="#2a3340" metalness={0.7} roughness={0.3} emissive="#ff9a4a" emissiveIntensity={0.25} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} geometry={spoke} rotation={[0, 0, (i * Math.PI) / 3]} position={[0, 0, 0]}>
            <meshStandardMaterial color="#24303c" metalness={0.5} roughness={0.4} />
          </mesh>
        ))}
      </group>

      {/* Tiny HUD strip on the dash */}
      <mesh position={[0, -0.08, 0.2]} rotation={[-0.55, 0, 0]}>
        <planeGeometry args={[0.55, 0.08]} />
        <meshBasicMaterial color="#5fe1ff" transparent opacity={0.35} toneMapped={false} />
      </mesh>
    </group>
  );
}
