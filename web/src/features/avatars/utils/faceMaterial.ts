import * as THREE from 'three';

/**
 * Head material for the comm-cap head inside the helmet. The player's photo face is
 * projected from the front onto the curved head in object space, so it wraps like a
 * real face instead of reading as a flat card, and its feathered alpha blends into
 * the cap fabric. The head stays opaque: no transparent layers behind the visor glass.
 */
export interface FaceUniforms {
  faceMap: THREE.IUniform<THREE.Texture | null>;
  hasFace: THREE.IUniform<number>;
  /** Face half-width / half-height on the unit head sphere, and vertical center. */
  faceRect: THREE.IUniform<THREE.Vector3>;
  /** Extra self-illumination so the face reads inside the helmet. */
  faceGlow: THREE.IUniform<number>;
}

export const FACE_HALF_WIDTH = 0.8;

export function createFaceMaterial(capColor: string) {
  const uniforms: FaceUniforms = {
    faceMap: { value: null },
    hasFace: { value: 0 },
    faceRect: { value: new THREE.Vector3(FACE_HALF_WIDTH, FACE_HALF_WIDTH * 1.25, 0.02) },
    faceGlow: { value: 0.32 },
  };
  const material = new THREE.MeshStandardMaterial({ color: capColor, roughness: 0.82, metalness: 0 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFacePos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFacePos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vFacePos;
uniform sampler2D faceMap;
uniform float hasFace;
uniform vec3 faceRect;
uniform float faceGlow;
vec4 faceSample = vec4(0.0);`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
if (hasFace > 0.5 && vFacePos.z > 0.0) {
  vec2 fuv = vec2(vFacePos.x / faceRect.x, (vFacePos.y - faceRect.z) / faceRect.y) * 0.5 + 0.5;
  if (fuv.x > 0.0 && fuv.x < 1.0 && fuv.y > 0.0 && fuv.y < 1.0) {
    faceSample = texture2D(faceMap, fuv);
    // Fade out where the sphere turns away, so the photo never smears around the sides.
    faceSample.a *= smoothstep(0.08, 0.3, vFacePos.z);
    diffuseColor.rgb = mix(diffuseColor.rgb, faceSample.rgb, faceSample.a);
  }
}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
totalEmissiveRadiance += faceSample.rgb * faceSample.a * faceGlow;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.55, faceSample.a);`,
      );
  };
  material.customProgramCacheKey = () => 'astronaut-photo-face';
  return { material, uniforms };
}

/** Generic friendly face shown until the player adds a photo. */
export function createPlaceholderFace(): THREE.CanvasTexture {
  const w = 256;
  const h = 320;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d')!;
  const skin = g.createRadialGradient(w * 0.5, h * 0.45, 10, w * 0.5, h * 0.5, w * 0.55);
  skin.addColorStop(0, '#f6cfae');
  skin.addColorStop(1, '#e2a986');
  g.fillStyle = skin;
  g.beginPath();
  g.ellipse(w / 2, h / 2, w * 0.46, h * 0.47, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#2b211d';
  for (const x of [0.36, 0.64]) {
    g.beginPath();
    g.ellipse(w * x, h * 0.47, 11, 15, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#fff';
  for (const x of [0.37, 0.65]) {
    g.beginPath();
    g.arc(w * x, h * 0.455, 4, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = 'rgba(240, 120, 120, 0.35)';
  for (const x of [0.27, 0.73]) {
    g.beginPath();
    g.ellipse(w * x, h * 0.6, 20, 11, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = '#7a3b30';
  g.lineWidth = 6;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(w / 2, h * 0.6, 26, 0.18 * Math.PI, 0.82 * Math.PI);
  g.stroke();
  // Feather the oval edge into transparency, like processed photos.
  g.globalCompositeOperation = 'destination-in';
  // Drawn in a y-stretched space so the circular gradient becomes the face oval.
  const mask = g.createRadialGradient(w / 2, w / 2, w * 0.36, w / 2, w / 2, w * 0.5);
  mask.addColorStop(0, 'rgba(0,0,0,1)');
  mask.addColorStop(1, 'rgba(0,0,0,0)');
  g.setTransform(1, 0, 0, h / w, 0, 0);
  g.fillStyle = mask;
  g.fillRect(0, 0, w, w);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
