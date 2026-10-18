import { expect, it } from "vitest"
import { boardCells, hexCorners, hexToWorld } from "./hexBoard"

const SIZE = 1.3 / Math.sqrt(3)

it("matches the server: 19 cells, neighbors 1.3 m apart, starts across the center", () => {
  expect(boardCells(2)).toHaveLength(19)
  const [x, z] = hexToWorld({ q: 1, r: 0 }, SIZE)
  expect(Math.hypot(x, z)).toBeCloseTo(1.3)
  expect(hexToWorld({ q: 0, r: -1 }, SIZE)[1]).toBeCloseTo(-1.3)
  expect(hexCorners(SIZE).every(([cx, cz]) => Math.abs(Math.hypot(cx, cz) - SIZE) < 1e-9)).toBe(true)
})
