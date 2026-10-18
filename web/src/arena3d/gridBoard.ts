import type { GridCell } from "../../../server/src/contracts"

/** The server's lane board, for drawing (same formulas as server/src/game/grid.ts). */
export type Board = { cellSize: number; rows: number; stepMs?: number }

/** World x, z of a cell's center: q along x, r along z. */
export function cellToWorld(cell: GridCell, cellSize: number): [number, number] {
  return [cellSize * cell.q, cellSize * cell.r]
}

/** The rows players stand in: -rows..-1 for slot 1, 1..rows for slot 2. */
export function boardRows(rows: number): number[] {
  return Array.from({ length: rows * 2 }, (_, i) => (i < rows ? i - rows : i - rows + 1))
}
