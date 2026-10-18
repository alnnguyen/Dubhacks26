import { useEffect } from 'react';
import type { GameClient } from '../../../networking';
import { AVATAR_SAVED_EVENT, loadAvatarConfig, loadFaceImage } from '../utils/avatarStorage';
import { canvasFromBlob } from './useAvatarCustomization';

/** Publish once on entry/save/reconnect, not in the realtime pose stream. */
export function useAvatarSync(client: GameClient) {
  useEffect(() => {
    let generation = 0;
    let cancelled = false;
    const publish = async () => {
      const current = ++generation;
      if (client.status() !== 'online') return;
      const config = loadAvatarConfig();
      let face: string | null = null;
      try {
        const blob = config.faceId ? await loadFaceImage(config.faceId) : null;
        if (blob) {
          const source = await canvasFromBlob(blob);
          const canvas = document.createElement('canvas');
          canvas.width = 128;
          canvas.height = 160;
          canvas.getContext('2d')!.drawImage(source, 0, 0, 128, 160);
          face = canvas.toDataURL('image/png');
        }
      } catch { /* A missing or unreadable saved face uses the default helmet face. */ }
      if (!cancelled && generation === current) {
        await client.setAvatar({ suit: config.suit, accent: config.accent, saber: config.saber, accessories: config.accessories, face });
      }
    };
    const changed = () => { void publish(); };
    const off = client.onStatus(changed);
    window.addEventListener(AVATAR_SAVED_EVENT, changed);
    window.addEventListener('storage', changed);
    void publish();
    return () => {
      cancelled = true;
      off();
      window.removeEventListener(AVATAR_SAVED_EVENT, changed);
      window.removeEventListener('storage', changed);
    };
  }, [client]);
}
