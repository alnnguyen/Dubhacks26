// The duel board: a round arena of flat-top hexagons in axial coordinates
// (q, r), centered on the world origin. Every neighboring cell is the same
// distance away, which a ring-and-slice polar grid can't offer.

export interface Hex {
  q: number;
  r: number;
}

// Center-to-center distance between neighbors: today's dueling distance.
export const HEX_SPACING = 1.3;
export const HEX_SIZE = HEX_SPACING / Math.sqrt(3);
// Cells within this many steps of the center: 19 hexes.
export const BOARD_RADIUS = 2;

const DIRECTIONS: Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

// World x, z of a cell's center (meters). r runs along z, so cells (0, -1) and
// (0, 1) sit straight across the center from each other.
export function hexToWorld(h: Hex): [number, number] {
  return [HEX_SIZE * 1.5 * h.q, HEX_SIZE * Math.sqrt(3) * (h.r + h.q / 2)];
}

export function neighbors(h: Hex): Hex[] {
  return DIRECTIONS.map((d) => ({ q: h.q + d.q, r: h.r + d.r }));
}

export function hexDistance(a: Hex, b: Hex): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export function onBoard(h: Hex): boolean {
  return hexDistance(h, { q: 0, r: 0 }) <= BOARD_RADIUS;
}

export const sameHex = (a: Hex, b: Hex) => a.q === b.q && a.r === b.r;

// The neighbor closest to a world direction (x, z): how a step relative to the
// player's facing becomes a cell.
export function neighborToward(h: Hex, direction: [number, number]): Hex {
  const [cx, cz] = hexToWorld(h);
  let best = neighbors(h)[0];
  let bestDot = -Infinity;
  for (const n of neighbors(h)) {
    const [x, z] = hexToWorld(n);
    const dot = ((x - cx) * direction[0] + (z - cz) * direction[1]) / HEX_SPACING;
    if (dot > bestDot) {
      bestDot = dot;
      best = n;
    }
  }
  return best;
}
