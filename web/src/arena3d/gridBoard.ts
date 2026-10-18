import type { GridCell } from "../../../server/src/contracts"

/** Coordinate scale retained from the server board wire format. */
export type Board = { cellSize: number; rows: number; stepMs?: number }

/** World x, z; q/r may be fractional after orbital movement. */
export function cellToWorld(cell: GridCell, cellSize: number): [number, number] {
  return [cellSize * cell.q, cellSize * cell.r]
}

/** The rows players stand in: -rows..-1 for slot 1, 1..rows for slot 2. */
export function boardRows(rows: number): number[] {
  return Array.from({ length: rows * 2 }, (_, i) => (i < rows ? i - rows : i - rows + 1))
}
