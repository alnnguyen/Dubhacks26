import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

/**
 * Quaternius "Astronaut" suit (CC0, Ultimate Space Kit, via poly.pizza).
 * The source character has an animal head; we drop the head triangles at load
 * time (the file on disk is untouched) and put our own helmet + photo face on
 * the Head bone.
 */
export const ASTRONAUT_MODEL_URL = '/models/avatars/astronaut-suit.glb';

/** Body height (boot sole to collar) in meters after normalization. */
const BODY_HEIGHT = 1.0;

/** Swatch cells in the shared 512² palette atlas (16 px cells, glTF uv origin top-left). */
const CELL = 16;
export const ATLAS_CELLS = {
  suitMain: [0, 4],
  suitShade: [2, 4],
  accent: [0, 8],
} as const;

/** Names after GLTFLoader sanitizes them ("UpperArm.R" → "UpperArmR"). */
export const BONES = {
  root: 'Root',
  hips: 'Hips',
  torso: 'Torso',
  neck: 'Neck',
  head: 'Head',
  upperArmR: 'UpperArmR',
  lowerArmR: 'LowerArmR',
  upperArmL: 'UpperArmL',
  lowerArmL: 'LowerArmL',
  index3R: 'Index3R',
  middle1R: 'Middle1R',
  middle3R: 'Middle3R',
  pinky3R: 'Pinky3R',
} as const;

interface PreparedSource {
  /** Head-stripped template; cloned per avatar. */
  template: THREE.Object3D;
  atlas: CanvasImageSource & { width: number; height: number };
  /** In template space at rest pose. */
  headCenter: THREE.Vector3;
  headSize: THREE.Vector3;
  scale: number;
}

/** The parts of a loaded glTF this module needs (drei's and three's GLTF types differ slightly). */
export interface AstronautSource {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
}

const prepared = new WeakMap<AstronautSource, PreparedSource>();

function headWeight(geometry: THREE.BufferGeometry, headIndex: number, v: number) {
  const joints = geometry.getAttribute('skinIndex');
  const weights = geometry.getAttribute('skinWeight');
  let sum = 0;
  for (let c = 0; c < 4; c++) if (joints.getComponent(v, c) === headIndex) sum += weights.getComponent(v, c);
  return sum;
}

/** One-time processing of the loaded file, shared by every avatar instance. */
function prepareSource(gltf: AstronautSource): PreparedSource {
  const cached = prepared.get(gltf);
  if (cached) return cached;

  const template = gltf.scene;
  template.updateMatrixWorld(true);
  const headPoints = new THREE.Box3();
  const bodyBox = new THREE.Box3();
  const point = new THREE.Vector3();
  let atlas: PreparedSource['atlas'] | null = null;
  const remove: THREE.Object3D[] = [];

  template.traverse((object) => {
    // The source character holds a pistol (a plain mesh on the hand bone); our saber replaces it.
    if (object.name === 'Pistol') {
      remove.push(object);
      return;
    }
    const mesh = object as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    const material = mesh.material as THREE.MeshStandardMaterial;
    if (material.map?.image) atlas = material.map.image as PreparedSource['atlas'];

    mesh.skeleton.update(); // bone matrices are only filled on first render otherwise
    const geometry = mesh.geometry;
    const headIndex = mesh.skeleton.bones.findIndex((b) => b.name === BONES.head);
    const index = geometry.index!;
    const keep: number[] = [];
    for (let t = 0; t < index.count; t += 3) {
      const a = index.getX(t);
      const b = index.getX(t + 1);
      const c = index.getX(t + 2);
      const isHead = Math.max(headWeight(geometry, headIndex, a), headWeight(geometry, headIndex, b), headWeight(geometry, headIndex, c)) > 0.5;
      for (const v of [a, b, c]) {
        mesh.getVertexPosition(v, point);
        mesh.localToWorld(point);
        (isHead ? headPoints : bodyBox).expandByPoint(point);
      }
      if (!isHead) keep.push(a, b, c);
    }
    geometry.setIndex(keep);
  });
  remove.forEach((object) => object.removeFromParent());
  if (!atlas) throw new Error('Astronaut model is missing its palette atlas.');

  // Normalize so the body (without helmet) is BODY_HEIGHT tall with boots at y = 0.
  const scale = BODY_HEIGHT / (bodyBox.max.y - bodyBox.min.y);
  template.scale.multiplyScalar(scale);
  template.position.y -= bodyBox.min.y * scale;
  template.updateMatrixWorld(true);

  const result: PreparedSource = {
    template,
    atlas,
    headCenter: headPoints.getCenter(new THREE.Vector3()).multiplyScalar(scale).add(new THREE.Vector3(0, -bodyBox.min.y * scale, 0)),
    headSize: headPoints.getSize(new THREE.Vector3()).multiplyScalar(scale),
    scale,
  };
  prepared.set(gltf, result);
  return result;
}

export interface SuitColors {
  main: string;
  shade: string;
  accent: string;
}

const atlasCache = new Map<string, THREE.CanvasTexture>();

/** Palette atlas with the suit / accent swatches repainted. Cached per color combination. */
export function recoloredAtlas(source: PreparedSource['atlas'], colors: SuitColors): THREE.CanvasTexture {
  const key = `${colors.main}|${colors.shade}|${colors.accent}`;
  const hit = atlasCache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext('2d')!;
  context.drawImage(source, 0, 0);
  const k = source.width / 512;
  const paint = ([x, y]: readonly [number, number], color: string) => {
    context.fillStyle = color;
    context.fillRect(x * CELL * k, y * CELL * k, CELL * k, CELL * k);
  };
  paint(ATLAS_CELLS.suitMain, colors.main);
  paint(ATLAS_CELLS.suitShade, colors.shade);
  paint(ATLAS_CELLS.accent, colors.accent);
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false; // glTF uv convention
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter; // flat swatches: keep edges crisp
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = 4;
  atlasCache.set(key, texture);
  return texture;
}

export interface AstronautRig {
  root: THREE.Group;
  skinnedMeshes: THREE.SkinnedMesh[];
  suitMaterial: THREE.MeshStandardMaterial;
  bones: Record<keyof typeof BONES, THREE.Bone>;
  /** Child of the Head bone, at the helmet center, axes aligned with the character at rest (+Z forward). Unit scale. */
  helmetAnchor: THREE.Group;
  /** Child of LowerArm.R at the grip point. +Y = blade direction (neutral wrist), unit scale. */
  gripAnchor: THREE.Group;
  /** Child of gripAnchor that clips rotate to bend the "wrist" (the rig has no wrist bone). Hold props here. */
  saberWrist: THREE.Group;
  /** Wrist bend axis in gripAnchor space: positive angles tip the blade toward the fingertips. */
  wristAxis: THREE.Vector3;
  /** Child of Torso, centered on the upper back surface. +Z points backward, unit scale. */
  backAnchor: THREE.Group;
  /** Child of UpperArm.L on the outer shoulder. +X points outward, unit scale. */
  shoulderAnchorL: THREE.Group;
  /** Helmet radius in meters (sized from the removed head). */
  helmetRadius: number;
  dispose: () => void;
}

/** Anchor that keeps a world-space pose (position + character axes, unit scale) relative to `bone`. */
function anchorOn(bone: THREE.Object3D, worldPosition: THREE.Vector3, worldQuaternion = new THREE.Quaternion()) {
  const anchor = new THREE.Group();
  anchor.position.copy(worldPosition);
  anchor.quaternion.copy(worldQuaternion);
  anchor.updateMatrixWorld(true);
  bone.attach(anchor); // keeps the world transform, so scale compensation is automatic
  return anchor;
}

/** Builds one independent avatar instance from the loaded file. */
export function createAstronautRig(gltf: AstronautSource): AstronautRig {
  const source = prepareSource(gltf);
  const root = new THREE.Group();
  root.name = 'AstronautRig';
  const body = cloneSkinned(source.template);
  root.add(body);
  root.updateMatrixWorld(true);

  const suitMaterial = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.02 });
  const skinnedMeshes: THREE.SkinnedMesh[] = [];
  body.traverse((object) => {
    const mesh = object as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    mesh.material = suitMaterial;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // Skinned bounds don't follow the animation; avoid popping out at screen edges.
    mesh.frustumCulled = false;
    skinnedMeshes.push(mesh);
  });

  const bones = {} as AstronautRig['bones'];
  for (const [key, name] of Object.entries(BONES) as [keyof typeof BONES, string][]) {
    const bone = body.getObjectByName(name) as THREE.Bone | undefined;
    if (!bone) throw new Error(`Astronaut rig is missing bone ${name}.`);
    bones[key] = bone;
  }

  // Helmet: centered on the removed head, slightly raised so the collar meets the suit.
  const helmetRadius = Math.max(source.headSize.x, source.headSize.z) * 0.5 * 1.18;
  const helmetCenter = source.headCenter.clone();
  helmetCenter.y = source.headCenter.y - source.headSize.y * 0.5 + helmetRadius * 0.86;
  const helmetAnchor = anchorOn(bones.head, helmetCenter);

  // Grip: the fist's tunnel. Finger chains all start at the wrist, so use their tips:
  // the hilt runs across the hand (pinky → index side), perpendicular to the forearm,
  // sitting a little toward the palm where the fingers close around it.
  const p = (bone: THREE.Object3D) => bone.getWorldPosition(new THREE.Vector3());
  const elbow = p(bones.lowerArmR);
  const wrist = p(bones.middle1R);
  const forearm = wrist.clone().sub(elbow).normalize();
  const across = p(bones.index3R).sub(p(bones.pinky3R)).projectOnPlane(forearm).normalize();
  const palm = new THREE.Vector3().crossVectors(forearm, across).negate();
  const handLength = p(bones.middle3R).distanceTo(wrist);
  const gripPos = wrist.clone().addScaledVector(forearm, handLength * 0.42).addScaledVector(palm, handLength * 0.16);
  const gripQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), across);
  const gripAnchor = anchorOn(bones.lowerArmR, gripPos, gripQuat);
  const saberWrist = new THREE.Group();
  saberWrist.name = 'SaberWrist';
  gripAnchor.add(saberWrist);
  // Rotating about the palm normal swings the blade (+Y) toward the forearm direction (fingertips).
  const wristAxis = palm.clone().applyQuaternion(gripQuat.clone().invert());
  if (new THREE.Vector3(0, 1, 0).applyAxisAngle(wristAxis, 0.3).applyQuaternion(gripQuat).dot(forearm) < 0) wristAxis.negate();

  // Back: behind the torso at shoulder-blade height.
  const torsoPos = p(bones.torso);
  const neckPos = p(bones.neck);
  const backAnchor = anchorOn(bones.torso, new THREE.Vector3(torsoPos.x, THREE.MathUtils.lerp(torsoPos.y, neckPos.y, 0.45), torsoPos.z - 0.2));

  const shoulderL = p(bones.upperArmL).lerp(p(bones.lowerArmL), 0.32);
  const shoulderAnchorL = anchorOn(bones.upperArmL, shoulderL);

  return {
    root,
    skinnedMeshes,
    suitMaterial,
    bones,
    helmetAnchor,
    gripAnchor,
    saberWrist,
    wristAxis,
    backAnchor,
    shoulderAnchorL,
    helmetRadius,
    dispose: () => suitMaterial.dispose(),
  };
}

export function atlasOf(gltf: AstronautSource) {
  return prepareSource(gltf).atlas;
}
