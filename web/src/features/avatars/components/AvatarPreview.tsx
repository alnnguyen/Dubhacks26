import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei';
import { Suspense } from 'react';
import * as THREE from 'three';
import type { AvatarAction } from '../types/avatar';
import { AstronautAvatar, type AvatarLook } from './AstronautAvatar';

export interface AvatarPreviewProps {
  look: AvatarLook;
  faceTexture: THREE.Texture | null;
  action: AvatarAction;
  actionTrigger: number;
  onActionComplete?: (action: AvatarAction) => void;
  saberIgnited?: boolean;
  displayName?: string;
}

/** Studio environment built from local light panels (no HDRI download). */
function Studio() {
  return (
    <Environment resolution={256} frames={1}>
      <color attach="background" args={['#0a1520']} />
      <Lightformer form="rect" intensity={2.2} color="#dff3ff" position={[0, 4, 2]} rotation-x={Math.PI / 2} scale={[6, 3, 1]} />
      <Lightformer form="rect" intensity={1.6} color="#7fdcff" position={[-4, 1.5, 1]} rotation-y={Math.PI / 2} scale={[3, 4, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#ffb070" position={[4, 1.5, -1]} rotation-y={-Math.PI / 2} scale={[3, 4, 1]} />
      <Lightformer form="ring" intensity={1.2} color="#ffffff" position={[0, 1.5, 5]} scale={2.5} />
    </Environment>
  );
}

function Platform() {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.002} receiveShadow>
        <circleGeometry args={[0.95, 96]} />
        <meshStandardMaterial color="#132433" roughness={0.55} metalness={0.4} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.001}>
        <ringGeometry args={[0.9, 0.93, 128]} />
        <meshBasicMaterial color="#5fe1ff" toneMapped={false} transparent opacity={0.85} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.001}>
        <ringGeometry args={[0.6, 0.605, 128]} />
        <meshBasicMaterial color="#5fe1ff" transparent opacity={0.25} />
      </mesh>
    </group>
  );
}

/** Interactive turntable for the creator: drag/touch to rotate, idle animation, studio light. */
export function AvatarPreview({ look, faceTexture, action, actionTrigger, onActionComplete, saberIgnited, displayName }: AvatarPreviewProps) {
  return (
    <Canvas
      className="av-preview__canvas"
      shadows="soft"
      dpr={[1, 2]}
      camera={{ position: [1.1, 1.35, 4.2], fov: 32, near: 0.05, far: 50 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
    >
      <color attach="background" args={['#06101a']} />
      <fog attach="fog" args={['#06101a', 6, 14]} />
      <hemisphereLight args={['#bfe8ff', '#1a1410', 0.5]} />
      <directionalLight
        position={[2.5, 4.5, 3]}
        intensity={2.4}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-1.5}
        shadow-camera-right={1.5}
        shadow-camera-top={2.2}
        shadow-camera-bottom={-0.5}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[-3, 2, -2.5]} intensity={1.2} color="#7fdcff" />
      <Suspense fallback={null}>
        <Studio />
        <AstronautAvatar
          look={look}
          faceTexture={faceTexture}
          action={action}
          actionTrigger={actionTrigger}
          onActionComplete={onActionComplete}
          saberIgnited={saberIgnited}
          displayName={displayName}
        />
      </Suspense>
      <Platform />
      <ContactShadows position={[0, 0.002, 0]} scale={2.4} blur={2.4} opacity={0.55} far={1.2} resolution={512} />
      <OrbitControls
        target={[0, 0.78, 0]}
        enablePan={false}
        minDistance={1.6}
        maxDistance={4.5}
        minPolarAngle={Math.PI * 0.28}
        maxPolarAngle={Math.PI * 0.56}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.7}
      />
    </Canvas>
  );
}
