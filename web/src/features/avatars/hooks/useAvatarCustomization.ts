import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { NAME_MAX_LENGTH, type AvatarConfig } from '../types/avatar';
import { normalizeAvatarConfig } from '../utils/avatarConfig';
import { deleteFaceImage, loadAvatarConfig, loadFaceImage, newFaceId, saveAvatarConfig, saveFaceImage } from '../utils/avatarStorage';

function faceTextureFrom(canvas: HTMLCanvasElement) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

async function canvasFromBlob(blob: Blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Creator state: the editable config, the face texture shown on the avatar, and
 * local persistence. A face being edited previews live via `previewFace` and is
 * only written to storage by `commitFace`.
 */
export function useAvatarCustomization() {
  const [config, setConfigState] = useState<AvatarConfig>(() => loadAvatarConfig());
  const [faceTexture, setFaceTexture] = useState<THREE.Texture | null>(null);
  const [faceUrl, setFaceUrl] = useState<string | null>(null);
  const [faceMissing, setFaceMissing] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [dirty, setDirty] = useState(false);
  const savedFace = useRef<{ texture: THREE.Texture | null; url: string | null }>({ texture: null, url: null });

  // Restore the saved face on load; recover quietly if the image is gone.
  useEffect(() => {
    let cancelled = false;
    const id = config.faceId;
    if (!id) return;
    (async () => {
      const blob = await loadFaceImage(id);
      if (cancelled) return;
      if (!blob) {
        setFaceMissing(true);
        setConfigState((c) => ({ ...c, faceId: null }));
        saveAvatarConfig({ ...loadAvatarConfig(), faceId: null });
        return;
      }
      const canvas = await canvasFromBlob(blob);
      if (cancelled) return;
      const texture = faceTextureFrom(canvas);
      const url = URL.createObjectURL(blob);
      savedFace.current = { texture, url };
      setFaceTexture(texture);
      setFaceUrl(url);
    })();
    return () => {
      cancelled = true;
    };
    // Only on mount: later face changes go through commitFace/removeFace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      savedFace.current.texture?.dispose();
      if (savedFace.current.url) URL.revokeObjectURL(savedFace.current.url);
    },
    [],
  );

  const update = useCallback((patch: Partial<AvatarConfig>) => {
    // Keep the name as typed (spaces, empty) while editing; it is cleaned on blur/save.
    setConfigState((c) => ({ ...normalizeAvatarConfig({ ...c, ...patch }), name: (patch.name ?? c.name).slice(0, NAME_MAX_LENGTH) }));
    setDirty(true);
    setSaveState('idle');
  }, []);

  /** Live preview while cropping. Pass null to go back to the saved face. */
  const previewFace = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (canvas) {
        // Reuse one preview texture: the editor redraws the same canvas while dragging.
        setFaceTexture((previous) => {
          if (previous && previous !== savedFace.current.texture && (previous as THREE.CanvasTexture).image === canvas) {
            previous.needsUpdate = true;
            return previous;
          }
          if (previous && previous !== savedFace.current.texture) previous.dispose();
          return faceTextureFrom(canvas);
        });
      } else {
        setFaceTexture((previous) => {
          if (previous && previous !== savedFace.current.texture) previous.dispose();
          return savedFace.current.texture;
        });
      }
    },
    [],
  );

  const replaceSavedFace = (texture: THREE.Texture | null, url: string | null) => {
    const old = savedFace.current;
    savedFace.current = { texture, url };
    setFaceTexture((previous) => {
      if (previous && previous !== texture) previous.dispose();
      return texture;
    });
    if (old.texture && old.texture !== texture) old.texture.dispose();
    if (old.url) URL.revokeObjectURL(old.url);
    setFaceUrl(url);
  };

  /** Stores the processed face and points the config at it (saved immediately). */
  const commitFace = useCallback(
    async (canvas: HTMLCanvasElement, png: Blob) => {
      const id = newFaceId();
      await saveFaceImage(id, png);
      const previousId = config.faceId;
      const snapshot = document.createElement('canvas');
      snapshot.width = canvas.width;
      snapshot.height = canvas.height;
      snapshot.getContext('2d')!.drawImage(canvas, 0, 0);
      replaceSavedFace(faceTextureFrom(snapshot), URL.createObjectURL(png));
      setFaceMissing(false);
      setConfigState((c) => ({ ...c, faceId: id }));
      // Persist only the face pointer; other unsaved edits wait for Save.
      saveAvatarConfig({ ...loadAvatarConfig(), faceId: id });
      if (previousId) await deleteFaceImage(previousId);
    },
    [config.faceId],
  );

  const removeFace = useCallback(async () => {
    const id = config.faceId;
    replaceSavedFace(null, null);
    setConfigState((c) => ({ ...c, faceId: null }));
    saveAvatarConfig({ ...loadAvatarConfig(), faceId: null });
    if (id) await deleteFaceImage(id);
  }, [config.faceId]);

  const save = useCallback(() => {
    setSaveState('saving');
    const clean = normalizeAvatarConfig(config);
    setConfigState(clean);
    const ok = saveAvatarConfig(clean);
    setSaveState(ok ? 'saved' : 'error');
    if (ok) setDirty(false);
  }, [config]);

  return { config, update, faceTexture, faceUrl, faceMissing, previewFace, commitFace, removeFace, save, saveState, dirty };
}
