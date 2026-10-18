export interface Cell {
  q: number;
  r: number;
}

// World units per coordinate unit; radial steps are 0.65 m.
export const CELL_SIZE = 0.65;
// Legacy board metadata retained for wire compatibility; there are no owned rows.
export const ROWS_PER_SIDE = 3;

export function cellToWorld(c: Cell): [number, number] {
  return [CELL_SIZE * c.q, CELL_SIZE * c.r];
}

// Engagement follows actual separation, independent of direction around the rival.
export function inReach(a: Cell, b: Cell): boolean {
  return Math.hypot(a.q - b.q, a.r - b.r) <= Math.sqrt(5) + 1e-9;
}

/** Opponent-relative steps. Coordinates retain the wire format, but are fractional. */
export function orbitStep(a: Cell, b: Cell, direction: "forward" | "back" | "left" | "right"): Cell | null {
  const dx = a.q - b.q, dz = a.r - b.r;
  const radius = Math.hypot(dx, dz);
  if (radius < 1e-9) return null;
  if (direction === "forward" || direction === "back") {
    // Same closest/farthest separation as the old front/back rows. Knockback leaves fractional
    // gaps, so a step stops short at the limit rather than being refused (which could strand
    // both players just outside reach); it's refused only when already at the limit.
    const next = Math.max(2, Math.min(6, radius + (direction === "forward" ? -1 : 1)));
    if (direction === "forward" ? next >= radius - 1e-9 : next <= radius + 1e-9) return null;
    return { q: b.q + dx * next / radius, r: b.r + dz * next / radius };
  }
  // Constant travel distance, capped at 15 degrees per swipe near the rival.
  const angle = Math.min(1 / radius, Math.PI / 12) * (direction === "right" ? 1 : -1);
  const c = Math.cos(angle), s = Math.sin(angle);
  return { q: b.q + dx * c - dz * s, r: b.r + dx * s + dz * c };
}

export const sameCell = (a: Cell, b: Cell) => a.q === b.q && a.r === b.r;

/** Shared by authoritative motion and local display; optional center gives a true arc. */
export function interpolateStep(from: [number, number], to: [number, number], t: number, center?: [number, number]): [number, number] {
  if (!center) return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
  const a = Math.atan2(from[1] - center[1], from[0] - center[0]);
  const b = Math.atan2(to[1] - center[1], to[0] - center[0]);
  const delta = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  const r0 = Math.hypot(from[0] - center[0], from[1] - center[1]);
  const r1 = Math.hypot(to[0] - center[0], to[1] - center[1]);
  const r = r0 + (r1 - r0) * t;
  return [center[0] + r * Math.cos(a + delta * t), center[1] + r * Math.sin(a + delta * t)];
}
