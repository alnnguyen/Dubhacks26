import type { HexCell } from "../../../server/src/contracts"

/** The server's hex board, for drawing (same formulas as server/src/game/hex.ts). */
export type Board = { hexSize: number; radius: number; stepMs?: number }

/** World x, z of a cell's center: flat-top hexes, r along z. */
export function hexToWorld(cell: HexCell, hexSize: number): [number, number] {
  return [hexSize * 1.5 * cell.q, hexSize * Math.sqrt(3) * (cell.r + cell.q / 2)]
}

export function boardCells(radius: number): HexCell[] {
  const cells: HexCell[] = []
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      if (Math.abs(q) + Math.abs(r) + Math.abs(q + r) <= radius * 2) cells.push({ q, r })
    }
  }
  return cells
}

/** The six corners of a flat-top hex around (0, 0), world x, z. */
export function hexCorners(hexSize: number): [number, number][] {
  return Array.from({ length: 6 }, (_, i) => [hexSize * Math.cos((i * Math.PI) / 3), hexSize * Math.sin((i * Math.PI) / 3)])
}
