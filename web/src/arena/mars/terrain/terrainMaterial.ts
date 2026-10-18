import * as THREE from 'three'

/**
 * Mars terrain material: MeshStandardMaterial (real PBR lighting, shadows, fog)
 * with the surface evaluation replaced by world-space material blending.
 *
 * Techniques adapted from nwpointer/three-landscape (MIT): splat-style material
 * blending, height-based transitions, triplanar projection on steep slopes and
 * multi-scale sampling against visible tiling. Textures are CC0 (ambientCG);
 * the Mars color grading is our own, tuned against Perseverance imagery.
 */

export interface PbrSet {
  color: THREE.Texture
  normal: THREE.Texture
  rough: THREE.Texture
  height: THREE.Texture
}

const COMMON = /* glsl */ `
uniform sampler2D tRegC; uniform sampler2D tRegN; uniform sampler2D tRegR; uniform sampler2D tRegH;
uniform sampler2D tSandC; uniform sampler2D tSandN; uniform sampler2D tSandR; uniform sampler2D tSandH;
uniform sampler2D tRockC; uniform sampler2D tRockN; uniform sampler2D tRockR; uniform sampler2D tRockH;
uniform float uDetailFar;
varying vec3 vWPos;
varying vec3 vWNormal;

vec3 gAlbedo; vec3 gNormalW; float gRough;

float tHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(tHash(i), tHash(i + vec2(1, 0)), u.x), mix(tHash(i + vec2(0, 1)), tHash(i + vec2(1, 1)), u.x), u.y);
}
vec3 marsGrade(vec3 c, vec3 tint, float sat) {
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  return mix(vec3(l), c, sat) * tint;
}
vec2 rot2(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }

void marsEval() {
  vec3 N = normalize(vWNormal);
  vec2 xz = vWPos.xz;
  float dist = length(vWPos - cameraPosition);
  float far = smoothstep(18.0, uDetailFar, dist);
  float macro = tNoise(xz * 0.021) * 0.6 + tNoise(xz * 0.083) * 0.4;

  // --- Regolith: two scales + rotation to hide the tile grid.
  vec2 uvA = xz * 0.42;
  vec2 uvB = rot2(xz, 0.83) * 0.17 + 0.37;
  float mixAB = smoothstep(0.35, 0.65, macro);
  vec3 regC = mix(texture2D(tRegC, uvA).rgb, texture2D(tRegC, uvB).rgb, mixAB);
  vec3 regN = mix(texture2D(tRegN, uvA).xyz, texture2D(tRegN, uvB).xyz, mixAB) * 2.0 - 1.0;
  float regR = mix(texture2D(tRegR, uvA).r, texture2D(tRegR, uvB).r, mixAB);
  float regH = mix(texture2D(tRegH, uvA).r, texture2D(tRegH, uvB).r, mixAB);
  regC = marsGrade(regC, vec3(1.22, 0.79, 0.56), 0.42);

  // --- Dark basaltic sand ripples pooling in swales (height-blended).
  vec2 uvS = rot2(xz, 0.3) * 0.33;
  vec3 sandC = marsGrade(texture2D(tSandC, uvS).rgb, vec3(0.86, 0.6, 0.44), 0.35);
  vec3 sandN = texture2D(tSandN, uvS).xyz * 2.0 - 1.0;
  float sandR = texture2D(tSandR, uvS).r;
  float sandH = texture2D(tSandH, uvS).r;
  float sandField = tNoise(xz * 0.045 + 3.1) * 0.7 + tNoise(xz * 0.17) * 0.3;
  float sandW = clamp((sandField - 0.56) * 5.0 + (sandH - regH) * 1.6 + 0.5, 0.0, 1.0);

  vec3 albedo = mix(regC, sandC, sandW);
  vec3 tn = mix(regN, sandN, sandW);
  float rough = mix(regR, sandR, sandW);
  float cavity = mix(regH, sandH, sandW);
  vec3 nW = normalize(N + vec3(tn.x, 0.0, tn.y) * 0.9);

  // --- Layered sedimentary rock on slopes, triplanar (x and z projections).
  float slope = 1.0 - N.y;
  float rockW = smoothstep(0.2, 0.42, slope + (macro - 0.5) * 0.12);
  if (rockW > 0.001) {
    vec3 bw = pow(abs(N), vec3(4.0));
    bw /= (bw.x + bw.z + 1e-4);
    vec2 uvX = vWPos.zy * vec2(0.16, 0.32);
    vec2 uvZ = vWPos.xy * vec2(0.16, 0.32);
    vec3 rc = texture2D(tRockC, uvX).rgb * bw.x + texture2D(tRockC, uvZ).rgb * bw.z;
    vec3 rnX = texture2D(tRockN, uvX).xyz * 2.0 - 1.0;
    vec3 rnZ = texture2D(tRockN, uvZ).xyz * 2.0 - 1.0;
    float rr = texture2D(tRockR, uvX).r * bw.x + texture2D(tRockR, uvZ).r * bw.z;
    vec3 rockNW = normalize(N + vec3(0.0, rnX.y, rnX.x) * bw.x + vec3(rnZ.x, rnZ.y, 0.0) * bw.z);
    rc = marsGrade(rc, vec3(1.12, 0.74, 0.55), 0.55);
    albedo = mix(albedo, rc, rockW);
    nW = normalize(mix(nW, rockNW, rockW));
    rough = mix(rough, rr, rockW);
  }

  // --- Airborne dust settles on up-facing surfaces; cavities stay darker.
  albedo = mix(albedo, vec3(0.6, 0.38, 0.24), clamp(N.y - 0.75, 0.0, 1.0) * 0.6);
  albedo *= mix(0.72, 1.06, cavity);

  // --- Distance: swap texture detail for macro color (no shimmer on phones).
  vec3 farC = vec3(0.47, 0.29, 0.19) * (0.82 + macro * 0.32) * mix(1.0, 0.82, smoothstep(0.15, 0.5, slope));
  albedo = mix(albedo, farC, far);
  nW = normalize(mix(nW, N, far));
  rough = mix(rough, 0.92, far);

  gAlbedo = albedo;
  gNormalW = nW;
  gRough = clamp(rough * 0.6 + 0.42, 0.78, 1.0); // dusty regolith is matte
}
`

export function createTerrainMaterial(sets: { regolith: PbrSet; sand: PbrSet; rock: PbrSet }, detailFar = 70) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 })
  const uniforms = {
    tRegC: { value: sets.regolith.color }, tRegN: { value: sets.regolith.normal }, tRegR: { value: sets.regolith.rough }, tRegH: { value: sets.regolith.height },
    tSandC: { value: sets.sand.color }, tSandN: { value: sets.sand.normal }, tSandR: { value: sets.sand.rough }, tSandH: { value: sets.sand.height },
    tRockC: { value: sets.rock.color }, tRockN: { value: sets.rock.normal }, tRockR: { value: sets.rock.rough }, tRockH: { value: sets.rock.height },
    uDetailFar: { value: detailFar },
  }
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNormal;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNormal = normalize(mat3(modelMatrix) * objectNormal);',
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + COMMON)
      .replace('#include <map_fragment>', 'marsEval();\ndiffuseColor.rgb *= gAlbedo;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = gRough;')
      .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(gNormalW, 0.0)).xyz);')
  }
  mat.customProgramCacheKey = () => 'mars-terrain-v1'
  return mat
}
