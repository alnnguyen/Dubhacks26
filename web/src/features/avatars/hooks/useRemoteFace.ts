import { useEffect, useState } from 'react';
import * as THREE from 'three';

export function useRemoteFace(data: string | null | undefined) {
  const [loaded, setLoaded] = useState<{ data: string; texture: THREE.Texture } | null>(null);
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    const texture = new THREE.TextureLoader().load(data, () => {
      if (cancelled) return;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      setLoaded({ data, texture });
    }, undefined, () => { if (!cancelled) setLoaded(null); });
    return () => { cancelled = true; texture.dispose(); };
  }, [data]);
  return loaded && loaded.data === data ? loaded.texture : null;
}
