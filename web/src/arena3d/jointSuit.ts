import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
/** Same endpoint mapping as main's stick figure. Thickness never changes the joints. */
export function placeSuitSegment(object: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
  const direction = new THREE.Vector3().subVectors(b, a);
  const length = direction.length();
  object.visible = length > 1e-6;
  if (!object.visible) return;
  object.position.copy(a).addScaledVector(direction, 0.5);
  object.quaternion.setFromUnitVectors(UP, direction.divideScalar(length));
  object.scale.set(1, length, 1);
}

/** +z is the face, +x runs toward the player's left; z flips from the server's forward direction. */
export function bodyBasis(left: THREE.Vector3, right: THREE.Vector3, hips: THREE.Vector3, shoulders: THREE.Vector3) {
  const x = left.clone().sub(right).normalize();
  const y = shoulders.clone().sub(hips).normalize();
  const z = new THREE.Vector3().crossVectors(x, y).normalize();
  if (z.lengthSq() < 1e-6) return null;
  y.crossVectors(z, x).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
