import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { ScreenTexture, type ScreenData, type ScreenKind } from './textures';

export interface ScreenProps {
  kind: ScreenKind;
  size: [number, number];
  position?: [number, number, number];
  rotation?: [number, number, number];
  /** Canvas resolution. */
  res?: [number, number];
  /** Max redraws per second. */
  fps: number;
  data: ScreenData;
  brightness?: number;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
}

/** An emissive display surface backed by an animated canvas texture. */
export function Screen({ kind, size, position, rotation, res = [512, 320], fps, data, brightness = 1.15, onClick }: ScreenProps) {
  const screen = useMemo(() => new ScreenTexture(kind, res[0], res[1]), [kind, res[0], res[1]]);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ map: screen.texture, toneMapped: false, color: new THREE.Color(brightness, brightness, brightness) }),
    [screen, brightness],
  );
  useEffect(() => () => (screen.dispose(), material.dispose()), [screen, material]);

  // Force a redraw when the data changes (e.g. callsign edited, alert raised).
  const dataKey = JSON.stringify(data);
  useEffect(() => {
    screen.update(performance.now() / 1000, data, fps, true);
  }, [dataKey, screen]);

  useFrame(({ clock }) => screen.update(clock.elapsedTime, data, fps));

  return (
    <mesh
      position={position}
      rotation={rotation}
      material={material}
      onClick={onClick}
      onPointerOver={onClick ? () => (document.body.style.cursor = 'pointer') : undefined}
      onPointerOut={onClick ? () => (document.body.style.cursor = '') : undefined}
    >
      <planeGeometry args={size} />
    </mesh>
  );
}
