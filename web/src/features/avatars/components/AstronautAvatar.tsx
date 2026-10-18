import { createPortal, type ThreeElements } from '@react-three/fiber';
import { Html, useGLTF } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useAvatarAnimations } from '../hooks/useAvatarAnimations';
import type { AvatarAction, AvatarConfig } from '../types/avatar';
import { ASTRONAUT_MODEL_URL, atlasOf, createAstronautRig, recoloredAtlas } from '../utils/astronautModel';
import { ACCENT_PALETTES, SABER_PALETTES, SUIT_PALETTES } from '../utils/palette';
import { Helmet } from './Helmet';
import { Lightsaber } from './Lightsaber';
import { Backpack, Cape, Jetpack, ShoulderPatch } from './SuitAddons';

/** Visual part of AvatarConfig; the renderer never needs the name or storage keys. */
export type AvatarLook = Pick<AvatarConfig, 'suit' | 'accent' | 'saber' | 'accessories'>;

export interface AstronautAvatarProps {
  look: AvatarLook;
  /** Processed photo face (oval, transparent edges). Null shows the default face. */
  faceTexture?: THREE.Texture | null;
  action?: AvatarAction;
  /** Bump to replay the same action (e.g. two attacks in a row). */
  actionTrigger?: number;
  onActionComplete?: (action: AvatarAction) => void;
  position?: ThreeElements['group']['position'];
  rotation?: ThreeElements['group']['rotation'];
  scale?: ThreeElements['group']['scale'];
  /** Floating name tag above the helmet. */
  displayName?: string;
  saberIgnited?: boolean;
  /** Colored light from the blade. Disable when many avatars share a scene. */
  saberLight?: boolean;
  /** Freeze the action at this time in seconds (static poses, thumbnails). */
  poseTime?: number;
}

/**
 * One astronaut. Pure presentation: takes a look, a face texture and an action,
 * and knows nothing about combat rules, networking or input devices.
 */
export function AstronautAvatar({
  look,
  faceTexture = null,
  action = 'idle',
  actionTrigger = 0,
  onActionComplete,
  position,
  rotation,
  scale,
  displayName,
  saberIgnited = true,
  saberLight = true,
  poseTime,
}: AstronautAvatarProps) {
  const gltf = useGLTF(ASTRONAUT_MODEL_URL);
  const rig = useMemo(() => createAstronautRig(gltf), [gltf]);
  useEffect(() => () => rig.dispose(), [rig]);
  useAvatarAnimations(rig, gltf.animations, action, actionTrigger, onActionComplete, poseTime);

  const suit = SUIT_PALETTES[look.suit];
  const accent = ACCENT_PALETTES[look.accent].color;
  useEffect(() => {
    rig.suitMaterial.map = recoloredAtlas(atlasOf(gltf), { main: suit.main, shade: suit.dark, accent });
    rig.suitMaterial.needsUpdate = true;
  }, [accent, gltf, rig, suit]);

  const has = (id: AvatarLook['accessories'][number]) => look.accessories.includes(id);
  const R = rig.helmetRadius;

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <primitive object={rig.root} />
      {createPortal(
        <Helmet radius={R} shellColor={suit.main} accentColor={accent} faceTexture={faceTexture} antenna={has('antenna')} />,
        rig.helmetAnchor,
      )}
      {createPortal(<Lightsaber color={SABER_PALETTES[look.saber].glow} ignited={saberIgnited} castLight={saberLight} hiltScale={1.7} />, rig.saberWrist)}
      {createPortal(
        <>
          {has('jetpack') ? (
            <Jetpack shell={suit.main} trim={suit.trim} accent={accent} />
          ) : (
            <Backpack shell={suit.main} trim={suit.trim} accent={accent} />
          )}
          {has('cape') && (
            <group position={[0, 0.2, -0.1]}>
              <Cape color={suit.dark} />
            </group>
          )}
        </>,
        rig.backAnchor,
      )}
      {has('patch') && createPortal(<ShoulderPatch accent={accent} />, rig.shoulderAnchorL)}
      {displayName && createPortal(
        <Html center position={[0, R * 1.55, 0]} className="avatar-nametag" zIndexRange={[10, 0]}>
          {displayName}
        </Html>,
        rig.helmetAnchor,
      )}
    </group>
  );
}

useGLTF.preload(ASTRONAUT_MODEL_URL);
