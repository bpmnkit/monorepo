import { describe, expect, it } from "vitest"
import { Grid } from "../src/layout/grid/grid.js"

describe("Grid", () => {
	it("add without position starts a new row", () => {
		const g = new Grid<string>()
		g.add("a")
		g.add("b")
		expect(g.find("a")).toEqual([0, 0])
		expect(g.find("b")).toEqual([1, 0])
		expect(g.getGridDimensions()).toEqual([2, 1])
	})

	it("add at explicit position throws when occupied", () => {
		const g = new Grid<string>()
		g.add("a", [0, 0])
		expect(() => g.add("b", [0, 0])).toThrow()
		g.add("b", [2, 3])
		expect(g.find("b")).toEqual([2, 3])
	})

	it("addAfter inserts right and shifts the row", () => {
		const g = new Grid<string>()
		g.add("a")
		g.addAfter("a", "c")
		g.addAfter("a", "b") // squeezes between a and c
		expect(g.find("a")).toEqual([0, 0])
		expect(g.find("b")).toEqual([0, 1])
		expect(g.find("c")).toEqual([0, 2])
	})

	it("addBelow places in same column, splicing a row when occupied", () => {
		const g = new Grid<string>()
		g.add("a")
		g.add("x") // row 1 col 0
		g.addBelow("a", "b") // [1,0] occupied by x → new row spliced at 1
		expect(g.find("b")).toEqual([1, 0])
		expect(g.find("x")).toEqual([2, 0])
	})

	it("adjustGridPosition right-aligns an element to the grid's last column when free", () => {
		const g = new Grid<string>()
		g.add("a") // [0,0] — short row
		g.addAfter("a", "b") // [0,1]
		g.add("x") // row 1
		g.addAfter("x", "y")
		g.addAfter("y", "z") // grid max col = 2; [0,2] is free
		g.adjustGridPosition("a")
		expect(g.find("a")).toEqual([0, 2])
		expect(g.get(0, 0)).toBeUndefined()
		expect(g.find("b")).toEqual([0, 1])
	})

	it("adjustGridPosition never overwrites an occupied cell", () => {
		const g = new Grid<string>()
		g.add("a")
		g.addAfter("a", "b")
		g.addAfter("b", "c") // [0,2] occupied — a must stay put
		g.adjustGridPosition("a")
		expect(g.find("a")).toEqual([0, 0])
		expect(g.getElementsTotal()).toBe(3)
	})

	it("adjustRowForMultipleIncoming moves a join up to its topmost feeder", () => {
		const g = new Grid<string>()
		g.add("s1") // [0,0]
		g.add("s2") // [1,0]
		g.add("join", [1, 1])
		g.adjustRowForMultipleIncoming(["s1", "s2"], "join")
		expect(g.find("join")).toEqual([0, 1])
	})

	it("adjustColumnForMultipleIncoming pushes a join right of its furthest feeder", () => {
		const g = new Grid<string>()
		g.add("s1") // [0,0]
		g.addAfter("s1", "s2") // [0,1]
		g.add("join", [1, 0])
		g.adjustColumnForMultipleIncoming(["s1", "s2"], "join")
		expect(g.find("join")).toEqual([1, 2])
	})

	it("createCol inserts blank columns into every row", () => {
		const g = new Grid<string>()
		g.add("a")
		g.addAfter("a", "b")
		g.add("c") // row 1
		g.createCol(0, 2)
		expect(g.find("a")).toEqual([0, 0])
		expect(g.find("b")).toEqual([0, 3])
		expect(g.find("c")).toEqual([1, 0])
	})

	it("getElementsInRange collects non-empty cells in a rectangle (any corner order)", () => {
		const g = new Grid<string>()
		g.add("a", [0, 0])
		g.add("b", [0, 2])
		g.add("c", [1, 1])
		expect(g.getElementsInRange({ row: 0, col: 0 }, { row: 1, col: 2 }).sort()).toEqual([
			"a",
			"b",
			"c",
		])
		expect(g.getElementsInRange({ row: 1, col: 2 }, { row: 0, col: 0 }).sort()).toEqual([
			"a",
			"b",
			"c",
		])
	})

	it("elementsByPosition returns row-major order", () => {
		const g = new Grid<string>()
		g.add("a", [0, 1])
		g.add("b", [1, 0])
		expect(g.elementsByPosition()).toEqual([
			{ element: "a", row: 0, col: 1 },
			{ element: "b", row: 1, col: 0 },
		])
	})
})
