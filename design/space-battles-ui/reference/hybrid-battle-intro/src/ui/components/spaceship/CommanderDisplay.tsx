import { useMemo } from 'react';
import type * as THREE from 'three';
import { Screen } from './Screen';
import { OVERHEAD_TRANSFORM } from './Cockpit';
import type { ConnectionStatus } from '../../state/lobbyTypes';

export interface CommanderDisplayProps {
  callsign: string;
  connection: ConnectionStatus;
  alert: boolean;
  fps: number;
  onActivate: () => void;
}

/** The overhead console's two screens: pilot ID (left) and signal telemetry (right). */
export function CommanderDisplay({ callsign, connection, alert, fps, onActivate }: CommanderDisplayProps) {
  const pilot = useMemo(() => ({ callsign, status: connection, alert }), [callsign, connection, alert]);
  const graph = useMemo(() => ({ alert }), [alert]);
  const click = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onActivate();
  };
  return (
    <group position={OVERHEAD_TRANSFORM.position as unknown as THREE.Vector3Tuple} rotation={[...OVERHEAD_TRANSFORM.rotation, 'YXZ']}>
      <Screen kind="pilot" size={[0.62, 0.32]} position={[-0.36, 0.03, 0.26]} fps={fps} data={pilot} onClick={click} />
      <Screen kind="graph" size={[0.62, 0.32]} position={[0.36, 0.03, 0.26]} fps={fps} data={graph} onClick={click} />
    </group>
  );
}
