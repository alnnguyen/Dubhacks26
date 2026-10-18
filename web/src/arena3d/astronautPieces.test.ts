import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createJointSuit, PIECES, segmentQuaternion } from './astronautPieces';

async function suppliedSuit() {
  // Exercise the actual supplied mesh in Node, leaving texture decoding to browser QA.
  const raw = readFileSync(new URL('../../public/models/avatars/battle-astronaut.glb', import.meta.url));
  const jsonLength = raw.readUInt32LE(12);
  const json = JSON.parse(raw.subarray(20, 20 + jsonLength).toString());
  for (const m of json.materials) delete m.pbrMetallicRoughness.baseColorTexture;
  const text = Buffer.from(JSON.stringify(json));
  const padded = Buffer.alloc(Math.ceil(text.length / 4) * 4, 32); text.copy(padded);
  const binaryChunk = raw.subarray(20 + jsonLength);
  const header = Buffer.alloc(20); header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + padded.length + binaryChunk.length, 8); header.writeUInt32LE(padded.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const packed = Buffer.concat([header, padded, binaryChunk]);
  const gltf = await new GLTFLoader().parseAsync(packed.buffer.slice(packed.byteOffset, packed.byteOffset + packed.length), '');
  gltf.scene.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
      const material = (o as THREE.SkinnedMesh).material as THREE.MeshStandardMaterial;
      material.map = new THREE.Texture(); material.map.image = { width: 512, height: 512 };
    }
  });
  return gltf;
}

describe('supplied astronaut suit', () => {
  it('keeps both segment endpoints aligned while facing either player', () => {
    const a = new THREE.Vector3(-0.2, 1.5, 0), b = new THREE.Vector3(-0.35, 1.15, 0.2);
    for (const sign of [-1, 1]) {
      const q = segmentQuaternion(a, b, new THREE.Vector3(0, 0, sign));
      const m = new THREE.Matrix4().compose(a.clone().lerp(b, 0.5), q, new THREE.Vector3(0.07, a.distanceTo(b), 0.07));
      expect(new THREE.Vector3(0, -0.5, 0).applyMatrix4(m).distanceTo(a)).toBeLessThan(1e-6);
      expect(new THREE.Vector3(0, 0.5, 0).applyMatrix4(m).distanceTo(b)).toBeLessThan(1e-6);
    }
  });
  it('loads the real asset, remaps all weighted vertices and keeps posed geometry finite', async () => {
    const suit = createJointSuit(await suppliedSuit(), new THREE.MeshStandardMaterial());
    expect(suit.mesh.geometry.getAttribute('position').count).toBeGreaterThan(1000);
    expect(suit.mesh.geometry.getAttribute('uv').count).toBe(suit.mesh.geometry.getAttribute('position').count);
    for (const key of PIECES) suit.setPiece(key, new THREE.Matrix4().compose(new THREE.Vector3(0, 1, 0), new THREE.Quaternion(), new THREE.Vector3(0.1, 0.4, 0.1)));
    suit.mesh.skeleton.update();
    const indices = suit.mesh.geometry.getAttribute('skinIndex');
    const weights = suit.mesh.geometry.getAttribute('skinWeight');
    const active = new Set<number>();
    const vertex = new THREE.Vector3();
    for (let i = 0; i < indices.count; i++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) { const w = weights.getComponent(i, k); sum += w; if (w > 0) active.add(indices.getComponent(i, k)); }
      expect(sum).toBeCloseTo(1);
      suit.mesh.getVertexPosition(i, vertex);
      expect(vertex.toArray().every(Number.isFinite)).toBe(true);
    }
    expect(active.size).toBe(PIECES.length);
    suit.dispose();
  });
});
