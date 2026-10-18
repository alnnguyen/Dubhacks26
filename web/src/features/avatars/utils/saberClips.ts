import * as THREE from 'three';
import type { AstronautRig } from './astronautModel';

/**
 * The source rig ships pistol animations but no sword moves. These helpers author
 * real keyframe clips for the right arm by solving poses on the rig's own skeleton:
 * each key says where the upper arm, forearm and blade should point (character
 * space: +Z forward, +Y up, +X the character's left), and the solver converts
 * that into bone-local quaternions. The rest of the body comes from a source clip,
 * so the authored clips crossfade with the original animations like any other.
 */

export interface ArmKey {
  t: number;
  upper: [number, number, number];
  fore: [number, number, number];
  blade: [number, number, number];
  /** Torso yaw in degrees (+ turns the right shoulder forward). */
  twist?: number;
  /** Torso lean back in degrees. */
  lean?: number;
  /** Wrist bend in degrees, tipping the blade toward the fingertips. */
  wrist?: number;
}

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const qa = new THREE.Quaternion();
const qb = new THREE.Quaternion();

function worldDir(from: THREE.Object3D, to: THREE.Object3D) {
  return to.getWorldPosition(v2).sub(from.getWorldPosition(v1)).normalize().clone();
}

/** Rotates `bone` (in world space) by the shortest arc taking `current` to `target`, then returns its new local quaternion. */
function rotateBoneWorld(bone: THREE.Object3D, delta: THREE.Quaternion) {
  const parent = bone.parent!;
  const worldQ = bone.getWorldQuaternion(qa);
  const parentQ = parent.getWorldQuaternion(qb);
  const next = delta.clone().multiply(worldQ);
  bone.quaternion.copy(parentQ.invert().multiply(next));
  bone.updateMatrixWorld(true);
}

function aimBone(bone: THREE.Object3D, child: THREE.Object3D, target: THREE.Vector3) {
  const current = worldDir(bone, child);
  rotateBoneWorld(bone, new THREE.Quaternion().setFromUnitVectors(current, target));
}

/** Twists `bone` about its own direction so `probe`'s +Y axis comes as close as possible to `target`. */
function twistToward(bone: THREE.Object3D, child: THREE.Object3D, probe: THREE.Object3D, target: THREE.Vector3) {
  const axis = worldDir(bone, child);
  const current = new THREE.Vector3(0, 1, 0).applyQuaternion(probe.getWorldQuaternion(qa));
  const a = current.clone().projectOnPlane(axis);
  const b = target.clone().projectOnPlane(axis);
  if (a.lengthSq() < 1e-6 || b.lengthSq() < 1e-6) return;
  a.normalize();
  b.normalize();
  let angle = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));
  if (new THREE.Vector3().crossVectors(a, b).dot(axis) < 0) angle = -angle;
  rotateBoneWorld(bone, new THREE.Quaternion().setFromAxisAngle(axis, angle));
}

interface PoseResult {
  torso: THREE.Quaternion;
  upper: THREE.Quaternion;
  fore: THREE.Quaternion;
}

/** Solves one key on the rig, starting from its rest pose (restored afterwards). */
function solvePose(rig: AstronautRig, key: ArmKey, rest: Map<THREE.Object3D, THREE.Quaternion>): PoseResult {
  const { torso, upperArmR, lowerArmR, middle1R } = rig.bones;
  for (const [bone, q] of rest) bone.quaternion.copy(q);
  rig.root.updateMatrixWorld(true);

  // Torso: yaw about world up, lean about the character's left/right axis.
  const twist = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(key.twist ?? 0));
  const lean = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(-(key.lean ?? 0)));
  rotateBoneWorld(torso, twist.multiply(lean));

  aimBone(upperArmR, lowerArmR, new THREE.Vector3(...key.upper).normalize());
  // The forearm's direction runs from the elbow toward the knuckles.
  aimBone(lowerArmR, middle1R, new THREE.Vector3(...key.fore).normalize());
  twistToward(lowerArmR, middle1R, rig.gripAnchor, new THREE.Vector3(...key.blade).normalize());

  const result = { torso: torso.quaternion.clone(), upper: upperArmR.quaternion.clone(), fore: lowerArmR.quaternion.clone() };
  for (const [bone, q] of rest) bone.quaternion.copy(q);
  rig.root.updateMatrixWorld(true);
  return result;
}

function track(bone: THREE.Object3D, times: number[], quats: THREE.Quaternion[]) {
  // Keep neighboring keys on the same hemisphere so interpolation takes the short way.
  for (let i = 1; i < quats.length; i++) if (quats[i].dot(quats[i - 1]) < 0) quats[i].set(-quats[i].x, -quats[i].y, -quats[i].z, -quats[i].w);
  return new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, quats.flatMap((q) => q.toArray()));
}

/**
 * Builds a clip: `base` drives every bone except the torso and right arm, which
 * follow the solved keys. The rig must be in its rest pose (no mixer applied yet).
 */
export function authorSaberClip(rig: AstronautRig, name: string, base: THREE.AnimationClip, keys: ArmKey[], duration = base.duration): THREE.AnimationClip {
  const { torso, upperArmR, lowerArmR } = rig.bones;
  const rest = new Map<THREE.Object3D, THREE.Quaternion>([torso, upperArmR, lowerArmR].map((b) => [b, b.quaternion.clone()]));
  const poses = keys.map((key) => solvePose(rig, key, rest));
  const times = keys.map((k) => k.t);
  const overridden = new Set([torso.name, upperArmR.name, lowerArmR.name].map((n) => `${n}.quaternion`));
  const baseTracks = base.tracks.filter((t) => !overridden.has(t.name)).map((t) => t.clone());
  const clip = new THREE.AnimationClip(name, duration, [
    ...baseTracks,
    track(torso, times, poses.map((p) => p.torso)),
    track(upperArmR, times, poses.map((p) => p.upper)),
    track(lowerArmR, times, poses.map((p) => p.fore)),
    track(
      rig.saberWrist,
      times,
      keys.map((k) => new THREE.Quaternion().setFromAxisAngle(rig.wristAxis, THREE.MathUtils.degToRad(k.wrist ?? 0))),
    ),
  ]);
  return clip;
}

/**
 * Character-space key poses. Right arm is on −X. Blade directions describe where
 * the saber points, so a reader can picture each frame.
 */
export const SABER_KEYS = {
  /** Ready stance: hilt at the right hip, blade angled up and forward. */
  ready: [
    { t: 0, upper: [-0.45, -0.85, 0.2], fore: [0.05, -0.1, 1], blade: [-0.6, 0.7, 0.2], twist: 10 },
  ],
  /** Overhead diagonal chop: saber raised over the right shoulder, cut down and across, recover. */
  attack: [
    { t: 0, upper: [-0.45, -0.85, 0.2], fore: [0.05, -0.1, 1], blade: [-0.6, 0.7, 0.2], twist: 10 },
    { t: 0.16, upper: [-0.45, 0.85, -0.2], fore: [0.1, 0.95, -0.3], blade: [-0.3, 0.2, -0.93], twist: -25, lean: 8, wrist: 45 },
    { t: 0.3, upper: [-0.05, 0.2, 0.98], fore: [0.45, -0.25, 0.86], blade: [0.3, -0.9, -0.2], twist: 30, lean: -10, wrist: 55 },
    { t: 0.42, upper: [0.25, -0.55, 0.8], fore: [0.75, -0.6, 0.25], blade: [0.35, 0.3, -0.9], twist: 38, lean: -12, wrist: 30 },
    { t: 0.8, upper: [-0.45, -0.85, 0.2], fore: [0.05, -0.1, 1], blade: [-0.6, 0.7, 0.2], twist: 10 },
  ],
  /** Guard: saber held level across the chest, under the helmet, body crouched behind it. */
  block: [
    { t: 0, upper: [-0.4, -0.6, 0.7], fore: [0.0, 0.55, 0.85], blade: [1, 0, -0.05], twist: 18, lean: -4 },
  ],
  /** Celebration: arm raised beside the helmet, wrist bent so the blade points to the sky, pumping. */
  victory: [
    { t: 0, upper: [-0.6, 0.78, 0.1], fore: [0.45, 0.88, 0.15], blade: [-0.45, 0.5, 0.75], lean: 6, wrist: 30 },
    { t: 0.2, upper: [-0.7, 0.62, 0.25], fore: [0.3, 0.8, 0.5], blade: [-0.5, 0.4, 0.75], lean: 3, wrist: 25 },
    { t: 0.4, upper: [-0.6, 0.78, 0.1], fore: [0.45, 0.88, 0.15], blade: [-0.45, 0.5, 0.75], lean: 6, wrist: 30 },
    { t: 0.6, upper: [-0.7, 0.62, 0.25], fore: [0.3, 0.8, 0.5], blade: [-0.5, 0.4, 0.75], lean: 3, wrist: 25 },
    { t: 0.8, upper: [-0.6, 0.78, 0.1], fore: [0.45, 0.88, 0.15], blade: [-0.45, 0.5, 0.75], lean: 6, wrist: 30 },
  ],
} satisfies Record<string, ArmKey[]>;
