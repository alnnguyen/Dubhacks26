import { useEffect } from 'react';
import { gameAudio, type AudioScene } from './gameAudio';
export function useAudioScene(scene: AudioScene | null) {
  useEffect(() => scene ? gameAudio.enterScene(scene) : undefined, [scene]);
}
