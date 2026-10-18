import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { bodyBasis, placeSuitSegment } from './jointSuit';

describe('joint-following suit', () => {
  it('preserves both tracked endpoints at arbitrary orientations and lengths', () => {
    for (const [a, b] of [
      [new THREE.Vector3(-0.2, 1.5, 0), new THREE.Vector3(-0.4, 1.1, 0.3)],
      [new THREE.Vector3(1, 0.4, -2), new THREE.Vector3(1.6, 0.2, -1)],
    ]) {
      const piece = new THREE.Group();
      placeSuitSegment(piece, a, b);
      piece.updateMatrixWorld(true);
      expect(new THREE.Vector3(0, -0.5, 0).applyMatrix4(piece.matrixWorld).distanceTo(a)).toBeLessThan(1e-6);
      expect(new THREE.Vector3(0, 0.5, 0).applyMatrix4(piece.matrixWorld).distanceTo(b)).toBeLessThan(1e-6);
    }
  });
  it('hides a collapsed segment and recovers with valid tracking', () => {
    const piece = new THREE.Group();
    placeSuitSegment(piece, new THREE.Vector3(), new THREE.Vector3());
    expect(piece.visible).toBe(false);
    placeSuitSegment(piece, new THREE.Vector3(), new THREE.Vector3(0, 1, 0));
    expect(piece.visible).toBe(true);
  });
  it('faces each slot toward the other player after the arena z flip', () => {
    for (const sign of [1, -1]) {
      const q = bodyBasis(new THREE.Vector3(-0.2 * sign, 1.5, 0), new THREE.Vector3(0.2 * sign, 1.5, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1.5, 0))!;
      expect(new THREE.Vector3(0, 0, 1).applyQuaternion(q).z).toBeCloseTo(-sign);
    }
  });
});
