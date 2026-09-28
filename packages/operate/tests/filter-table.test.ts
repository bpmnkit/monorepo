// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest"
import { createFilterTable } from "../src/components/filter-table.js"

interface Row {
	id: number
	name: string
}

const rows = (n: number): Row[] =>
	Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `row-${i + 1}` }))

function make(onRowClick?: (row: Row) => void) {
	return createFilterTable<Row>({
		columns: [
			{ label: "ID", render: (r) => String(r.id), sortValue: (r) => r.id },
			{ label: "Name", render: (r) => r.name },
		],
		searchFn: (r) => r.name,
		onRowClick,
		emptyText: "Nothing here",
	})
}

const bodyTexts = (el: HTMLElement): string[] =>
	Array.from(el.querySelectorAll(".bpmnkit-table-row")).map(
		(r) => r.querySelector(".bpmnkit-table-td")?.textContent ?? "",
	)
const info = (el: HTMLElement): string => el.querySelector(".op-pagination-info")?.textContent ?? ""
const next = (el: HTMLElement): HTMLButtonElement => {
	const btns = el.querySelectorAll<HTMLButtonElement>(".op-pagination-btn")
	const btn = btns[1]
	if (!btn) throw new Error("no next button")
	return btn
}

describe("createFilterTable", () => {
	it("shows the empty text when there are no rows", () => {
		const t = make()
		t.setRows([])
		expect(t.el.querySelector(".bpmnkit-table-empty")?.textContent).toBe("Nothing here")
		expect(info(t.el)).toBe("0 results")
	})

	it("pages 10 rows at a time and moves between pages", () => {
		const t = make()
		t.setRows(rows(25))
		expect(bodyTexts(t.el)).toHaveLength(10)
		expect(info(t.el)).toBe("1–10 of 25")
		next(t.el).click()
		next(t.el).click()
		expect(info(t.el)).toBe("21–25 of 25")
		expect(next(t.el).disabled).toBe(true)
	})

	it("changes the page size", () => {
		const t = make()
		t.setRows(rows(30))
		const select = t.el.querySelector<HTMLSelectElement>(".op-page-size")
		if (!select) throw new Error("no page size select")
		select.value = "25"
		select.dispatchEvent(new Event("change"))
		expect(bodyTexts(t.el)).toHaveLength(25)
	})

	it("filters with the search box and shows a filtered count", () => {
		const t = make()
		t.setRows(rows(12))
		const input = t.el.querySelector<HTMLInputElement>(".op-search")
		if (!input) throw new Error("no search input")
		input.value = "row-1"
		input.dispatchEvent(new Event("input"))
		// row-1, row-10, row-11, row-12
		expect(bodyTexts(t.el)).toEqual(["1", "10", "11", "12"])
		expect(t.el.querySelector(".op-search-count")?.textContent).toBe("4 / 12")

		input.value = "zzz"
		input.dispatchEvent(new Event("input"))
		expect(t.el.querySelector(".bpmnkit-table-empty")?.textContent).toBe("No results")
	})

	it("cycles a sortable column asc → desc → unsorted", () => {
		const t = make()
		t.setRows([
			{ id: 2, name: "b" },
			{ id: 1, name: "a" },
			{ id: 3, name: "c" },
		])
		const th = t.el.querySelector<HTMLElement>(".op-th-sort")
		if (!th) throw new Error("no sortable header")
		th.click()
		expect(bodyTexts(t.el)).toEqual(["1", "2", "3"])
		th.click()
		expect(bodyTexts(t.el)).toEqual(["3", "2", "1"])
		th.click()
		expect(bodyTexts(t.el)).toEqual(["2", "1", "3"])
		// Only columns with sortValue get a sort control
		expect(t.el.querySelectorAll(".op-th-sort")).toHaveLength(1)
	})

	it("calls onRowClick with the row", () => {
		const onClick = vi.fn()
		const t = make(onClick)
		t.setRows(rows(3))
		t.el.querySelectorAll<HTMLElement>(".bpmnkit-table-row")[1]?.click()
		expect(onClick).toHaveBeenCalledWith({ id: 2, name: "row-2" })
	})

	it("resets to the first page when rows are replaced", () => {
		const t = make()
		t.setRows(rows(25))
		next(t.el).click()
		t.setRows(rows(25))
		expect(info(t.el)).toBe("1–10 of 25")
	})

	// Regression: every poll called setRows, which threw the user back to page 1.
	it("keeps the current page on a refresh with keepPage", () => {
		const t = make()
		t.setRows(rows(25))
		next(t.el).click()
		t.setRows(rows(26), true)
		expect(info(t.el)).toBe("11–20 of 26")
	})

	it("clamps a kept page when the data shrinks", () => {
		const t = make()
		t.setRows(rows(25))
		next(t.el).click()
		next(t.el).click()
		t.setRows(rows(8), true)
		expect(info(t.el)).toBe("1–8 of 8")
	})
})
