import { useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useCubeTexture } from '@react-three/drei';

/**
 * Milky Way cubemap (three.js examples — astronomy imagery).
 * Sets the WebGL scene background so most of the frame is real starfield.
 */
export function StarSkybox() {
  const scene = useThree((s) => s.scene);
  const texture = useCubeTexture(
    ['dark-s_px.jpg', 'dark-s_nx.jpg', 'dark-s_py.jpg', 'dark-s_ny.jpg', 'dark-s_pz.jpg', 'dark-s_nz.jpg'],
    { path: '/textures/sky/' },
  );

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    const prev = scene.background;
    scene.background = texture;
    return () => {
      scene.background = prev;
    };
  }, [scene, texture]);

  return null;
}
