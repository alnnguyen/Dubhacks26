import { useEffect, useMemo, useState } from 'react';
import type * as THREE from 'three';
import type { AvatarLook } from '../components/AstronautAvatar';
import { loadAvatarConfig, loadFaceImage } from '../utils/avatarStorage';
import { canvasFromBlob, faceTextureFrom } from './useAvatarCustomization';

/**
 * The avatar this device saved in the creator: its look right away, and its
 * photo face once the image has been read back from local storage.
 */
export function useSavedAvatar() {
  const config = useMemo(() => loadAvatarConfig(), []);
  const [faceTexture, setFaceTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const id = config.faceId;
    if (!id) return;
    let cancelled = false;
    let texture: THREE.Texture | null = null;
    (async () => {
      const blob = await loadFaceImage(id);
      if (!blob || cancelled) return;
      texture = faceTextureFrom(await canvasFromBlob(blob));
      if (cancelled) texture.dispose();
      else setFaceTexture(texture);
    })();
    return () => {
      cancelled = true;
      texture?.dispose();
    };
  }, [config.faceId]);

  const look = useMemo<AvatarLook>(
    () => ({ suit: config.suit, accent: config.accent, saber: config.saber, accessories: config.accessories }),
    [config],
  );
  return { look, faceTexture, name: config.name };
}
