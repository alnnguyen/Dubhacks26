// The duel board: a lane of square cells, centered on the world origin. q is
// the column along x and has no end, so players can sidestep forever; r is the
// row along z. Each player owns the rows on their side of the center line:
// slot 1 rows -ROWS..-1, slot 2 rows 1..ROWS.

import type { PlayerSlot } from "../contracts.js";

export interface Cell {
  q: number;
  r: number;
}

// Center-to-center distance between neighboring cells (m). Front rows sit
// two cells apart: today's 1.3 m dueling distance.
export const CELL_SIZE = 0.65;
// Rows on each side: forward and back move between them.
export const ROWS_PER_SIDE = 3;

export function cellToWorld(c: Cell): [number, number] {
  return [CELL_SIZE * c.q, CELL_SIZE * c.r];
}

// A row the player may stand in: their own side, ROWS_PER_SIDE deep.
export function ownRow(slot: PlayerSlot, r: number): boolean {
  return slot === 1 ? r <= -1 && r >= -ROWS_PER_SIDE : r >= 1 && r <= ROWS_PER_SIDE;
}

// Both at the front line, at most one column apart: the only time swings count.
export function inReach(a: Cell, b: Cell): boolean {
  return Math.abs(a.r - b.r) === 2 && Math.abs(a.q - b.q) <= 1;
}

export const sameCell = (a: Cell, b: Cell) => a.q === b.q && a.r === b.r;
