import type { ArenaBlade, Vec3 } from "../contracts.js";

// Pure 3D geometry for the saber duel, in the shared arena's world frame
// (meters): x to slot 1's right, y up, z from slot 1 toward slot 2. Bodies and
// blades come from each player's own inputs; this is a game space, not a
// reconstruction of the players' real rooms.

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const length = (a: Vec3): number => Math.sqrt(dot(a, a));
export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => add(a, scale(sub(b, a), t));
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

// MediaPipe pose joint indices.
export const NOSE = 0;
export const LEFT_SHOULDER = 11;
export const RIGHT_SHOULDER = 12;
export const LEFT_WRIST = 15;
export const RIGHT_WRIST = 16;
export const LEFT_HIP = 23;
export const RIGHT_HIP = 24;
export const JOINT_COUNT = 33;

// A horizontal unit vector (world x, z): which way a player faces.
export type Facing = [number, number];

// A player's body frame (x right, y up, z forward) into the world, turned to
// face `facing`. Facing +z, right is +x; facing -z, right is -x.
export function directionToWorld(d: Vec3, facing: Facing): Vec3 {
  const [fx, fz] = facing;
  return [d[0] * fz + d[2] * fx, d[1], -d[0] * fx + d[2] * fz];
}

// The reverse turn: a world direction into the player's body frame.
export function worldToDirection(w: Vec3, facing: Facing): Vec3 {
  const [fx, fz] = facing;
  return [w[0] * fz - w[2] * fx, w[1], w[0] * fx + w[2] * fz];
}

export function bodyToWorld(p: Vec3, facing: Facing, root: Vec3): Vec3 {
  return add(root, directionToWorld(p, facing));
}

// Closest distance between segments p1-q1 and p2-q2 (Ericson, Real-Time Collision Detection 5.1.9).
export function segmentDistance(p1: Vec3, q1: Vec3, p2: Vec3, q2: Vec3): number {
  const d1 = sub(q1, p1);
  const d2 = sub(q2, p2);
  const r = sub(p1, p2);
  const a = dot(d1, d1);
  const e = dot(d2, d2);
  const f = dot(d2, r);
  let s: number;
  let t: number;
  if (a <= 1e-12 && e <= 1e-12) return length(r);
  if (a <= 1e-12) {
    s = 0;
    t = clamp01(f / e);
  } else {
    const c = dot(d1, r);
    if (e <= 1e-12) {
      t = 0;
      s = clamp01(-c / a);
    } else {
      const b = dot(d1, d2);
      const denom = a * e - b * b;
      s = denom > 1e-12 ? clamp01((b * f - c * e) / denom) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp01(-c / a);
      } else if (t > 1) {
        t = 1;
        s = clamp01((b - c) / a);
      }
    }
  }
  return length(sub(add(p1, scale(d1, s)), add(p2, scale(d2, t))));
}

export function pointSegmentDistance(p: Vec3, a: Vec3, b: Vec3): number {
  return segmentDistance(p, p, a, b);
}

export interface BodyShape {
  // Torso capsule from shoulder midpoint to hip midpoint.
  torso: [Vec3, Vec3];
  head: Vec3;
}

export function bodyShape(joints: Vec3[]): BodyShape {
  const mid = (i: number, j: number) => scale(add(joints[i], joints[j]), 0.5);
  return { torso: [mid(LEFT_SHOULDER, RIGHT_SHOULDER), mid(LEFT_HIP, RIGHT_HIP)], head: joints[NOSE] };
}

export interface SweepRules {
  bladeRadius: number;
  torsoRadius: number;
  headRadius: number;
  substeps: number;
}

export type SweepOutcome = "blocked" | "hit" | null;

// Moves the attacker's blade (and the defender's, if any) from their previous
// to current positions in small steps. The first step with contact decides:
// touching the defender's blade blocks, touching their body hits. A blade at
// the same step wins over the body behind it.
export function resolveSweep(
  attacker: { from: ArenaBlade; to: ArenaBlade },
  defenderBlade: { from: ArenaBlade; to: ArenaBlade } | null,
  defenderBody: BodyShape | null,
  rules: SweepRules,
): SweepOutcome {
  for (let i = 1; i <= rules.substeps; i++) {
    const t = i / rules.substeps;
    const hilt = lerp(attacker.from.hilt, attacker.to.hilt, t);
    const tip = lerp(attacker.from.tip, attacker.to.tip, t);
    if (defenderBlade) {
      const dh = lerp(defenderBlade.from.hilt, defenderBlade.to.hilt, t);
      const dt = lerp(defenderBlade.from.tip, defenderBlade.to.tip, t);
      if (segmentDistance(hilt, tip, dh, dt) <= rules.bladeRadius * 2) return "blocked";
    }
    if (defenderBody) {
      const [top, bottom] = defenderBody.torso;
      if (segmentDistance(hilt, tip, top, bottom) <= rules.torsoRadius + rules.bladeRadius) return "hit";
      if (pointSegmentDistance(defenderBody.head, hilt, tip) <= rules.headRadius + rules.bladeRadius) return "hit";
    }
  }
  return null;
}
