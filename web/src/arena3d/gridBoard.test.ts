import { expect, it } from "vitest"
import { boardRows, cellToWorld } from "./gridBoard"

const SIZE = 0.65

it("matches the server: front rows 1.3 m apart, three rows a side, columns along x", () => {
  expect(boardRows(3)).toEqual([-3, -2, -1, 1, 2, 3])
  expect(cellToWorld({ q: 0, r: 1 }, SIZE)[1] - cellToWorld({ q: 0, r: -1 }, SIZE)[1]).toBeCloseTo(1.3)
  expect(cellToWorld({ q: -40, r: -2 }, SIZE)).toEqual([-26, -1.3])
})
