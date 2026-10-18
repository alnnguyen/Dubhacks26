import * as THREE from 'three';
import { createAstronautRig, type AstronautSource } from '../features/avatars/utils/astronautModel';

export const BATTLE_ASTRONAUT_URL = '/models/avatars/battle-astronaut.glb';
export const PIECES = ['upperL', 'lowerL', 'upperR', 'lowerR', 'thighL', 'shinL', 'thighR', 'shinR', 'torso', 'bootL', 'bootR'] as const;
export type SuitPiece = typeof PIECES[number];

/** Stable roll toward the character's front, while endpoints stay on the tracked joints. */
export function segmentQuaternion(a: THREE.Vector3, b: THREE.Vector3, front: THREE.Vector3) {
  const y = b.clone().sub(a).normalize();
  const z = front.clone().projectOnPlane(y);
  if (z.lengthSq() < 1e-6) z.set(1, 0, 0).projectOnPlane(y);
  z.normalize();
  const x = new THREE.Vector3().crossVectors(y, z).normalize();
  z.crossVectors(x, y).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

function category(name: string): SuitPiece | null {
  const side = name.endsWith('L') ? 'L' : 'R';
  if (name.startsWith('UpperArm') || name.startsWith('Shoulder')) return `upper${side}`;
  if (/^(LowerArm|Pinky|Middle|Index|Thumb)/.test(name)) return `lower${side}`;
  if (name.startsWith('UpperLeg')) return `thigh${side}`;
  if (name.startsWith('LowerLeg')) return `shin${side}`;
  if (name.startsWith('Foot')) return `boot${side}`;
  if (['Root', 'Body', 'Hips', 'Abdomen', 'Torso', 'Neck'].includes(name)) return 'torso';
  return null;
}

type Prepared = { geometry: THREE.BufferGeometry; inverses: THREE.Matrix4[] };
const cache = new WeakMap<AstronautSource, Prepared>();

/**
 * Preserve the source suit's connected triangles and UVs. Remap its skin weights
 * to the stickman's 11 segments; shared seam vertices blend across adjacent pieces.
 * No source animation or source bone hierarchy participates in battle movement.
 */
function prepare(source: AstronautSource): Prepared {
  const previous = cache.get(source);
  if (previous) return previous;
  const rig = createAstronautRig(source);
  rig.root.updateMatrixWorld(true);
  const p = (name: string) => {
    const bone = rig.root.getObjectByName(name);
    if (!bone) throw new Error(`Battle suit missing ${name}`);
    return bone.getWorldPosition(new THREE.Vector3());
  };
  const shoulders = p('UpperArmL').add(p('UpperArmR')).multiplyScalar(0.5);
  const hips = p('UpperLegL').add(p('UpperLegR')).multiplyScalar(0.5);
  const neckY = p('Neck').y;
  const front = new THREE.Vector3(0, 0, 1);
  const endpoints: Record<SuitPiece, [THREE.Vector3, THREE.Vector3]> = {
    upperL: [p('UpperArmL'), p('LowerArmL')], lowerL: [p('LowerArmL'), p('Middle1L')],
    upperR: [p('UpperArmR'), p('LowerArmR')], lowerR: [p('LowerArmR'), p('Middle1R')],
    thighL: [p('UpperLegL'), p('LowerLegL')], shinL: [p('LowerLegL'), p('FootL')],
    thighR: [p('UpperLegR'), p('LowerLegR')], shinR: [p('LowerLegR'), p('FootR')],
    torso: [hips, shoulders], bootL: [p('FootL'), p('FootL').add(new THREE.Vector3(0, 1, 0))],
    bootR: [p('FootR'), p('FootR').add(new THREE.Vector3(0, 1, 0))],
  };
  const centers = PIECES.map((key) => key.startsWith('boot') ? endpoints[key][0] : endpoints[key][0].clone().lerp(endpoints[key][1], 0.5));
  const rotations = PIECES.map((key) => key === 'torso' || key.startsWith('boot') ? new THREE.Quaternion() : segmentQuaternion(...endpoints[key], front));
  const boxes = PIECES.map(() => new THREE.Box3());
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], skinIndices: number[] = [], skinWeights: number[] = [];
  const point = new THREE.Vector3();
  for (const mesh of rig.skinnedMeshes) {
    mesh.skeleton.update();
    const g = mesh.geometry, index = g.index!;
    const skin = g.getAttribute('skinIndex'), weights = g.getAttribute('skinWeight'), uv = g.getAttribute('uv');
    const sourceNormals = g.getAttribute('normal');
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    for (let t = 0; t < index.count; t += 3) {
      const vertices = [index.getX(t), index.getX(t + 1), index.getX(t + 2)];
      const samples = vertices.map((v) => {
        mesh.getVertexPosition(v, point); mesh.localToWorld(point);
        const grouped = new Map<number, number>();
        for (let k = 0; k < 4; k++) {
          const weight = weights.getComponent(v, k);
          const key = category(mesh.skeleton.bones[skin.getComponent(v, k)].name);
          if (weight > 0 && key) { const i = PIECES.indexOf(key); grouped.set(i, (grouped.get(i) ?? 0) + weight); }
        }
        return { v, position: point.clone(), grouped };
      });
      // The source has a bee head and antennae; the existing customizable helmet replaces all of it.
      if (samples.some((s) => s.position.y > neckY + 0.015 || s.grouped.size === 0)) continue;
      for (const sample of samples) {
        const entries = [...sample.grouped];
        const sum = entries.reduce((n, [, w]) => n + w, 0);
        positions.push(...sample.position.toArray());
        normals.push(...new THREE.Vector3().fromBufferAttribute(sourceNormals, sample.v).applyNormalMatrix(normalMatrix).toArray());
        uvs.push(uv.getX(sample.v), uv.getY(sample.v));
        for (let k = 0; k < 4; k++) { skinIndices.push(entries[k]?.[0] ?? 0); skinWeights.push((entries[k]?.[1] ?? 0) / sum); }
        for (const [i, w] of entries) if (w / sum > 0.4) {
          const local = sample.position.clone().sub(centers[i]).applyQuaternion(rotations[i].clone().invert());
          boxes[i].expandByPoint(local);
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  const inverses = PIECES.map((key, i) => {
    const size = boxes[i].getSize(new THREE.Vector3());
    const radius = Math.max(Math.abs(boxes[i].min.x), Math.abs(boxes[i].max.x), Math.abs(boxes[i].min.z), Math.abs(boxes[i].max.z), 0.001);
    const scale = key === 'torso' ? new THREE.Vector3(size.x, endpoints[key][0].distanceTo(endpoints[key][1]), size.z)
      : key.startsWith('boot') ? size : new THREE.Vector3(radius, endpoints[key][0].distanceTo(endpoints[key][1]), radius);
    return new THREE.Matrix4().compose(centers[i], rotations[i], scale).invert();
  });
  rig.dispose();
  const result = { geometry, inverses };
  cache.set(source, result);
  return result;
}

export function createJointSuit(source: AstronautSource, material: THREE.Material) {
  const prepared = prepare(source);
  const bones = PIECES.map(() => { const b = new THREE.Bone(); b.matrixAutoUpdate = false; return b; });
  const skeleton = new THREE.Skeleton(bones, PIECES.map(() => new THREE.Matrix4()));
  const mesh = new THREE.SkinnedMesh(prepared.geometry, material);
  mesh.bind(skeleton, new THREE.Matrix4());
  mesh.bindMode = 'detached';
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return {
    mesh,
    setPiece(key: SuitPiece, matrix: THREE.Matrix4) { bones[PIECES.indexOf(key)].matrixWorld.copy(matrix).multiply(prepared.inverses[PIECES.indexOf(key)]); },
    dispose() { skeleton.dispose(); },
  };
}
