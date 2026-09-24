import { afterEach, describe, expect, it, vi } from "vitest"
import {
	IC_UI,
	badge,
	cell,
	createStatsCard,
	createTable,
	createThemeSwitcher,
} from "../src/index.js"

afterEach(() => {
	document.body.innerHTML = ""
	localStorage.clear()
})

describe("badge / cell", () => {
	it("renders a badge whose modifier is the lower-cased state", () => {
		const el = badge("ACTIVE")
		expect(el.tagName).toBe("SPAN")
		expect(el.className).toBe("bpmnkit-badge bpmnkit-badge--active")
		expect(el.textContent).toBe("ACTIVE")
	})

	it("renders a cell, with a dash for a missing value", () => {
		expect(cell("x").textContent).toBe("x")
		expect(cell(null).textContent).toBe("—")
		expect(cell(undefined).textContent).toBe("—")
		expect(cell("").textContent).toBe("")
	})

	it("sets text, never markup", () => {
		expect(badge("<b>x</b>").querySelector("b")).toBeNull()
		expect(cell("<b>x</b>").querySelector("b")).toBeNull()
	})
})

describe("createStatsCard", () => {
	it("renders the value and the label", () => {
		const el = createStatsCard("Instances", 42)
		expect(el.className).toBe("bpmnkit-card")
		expect(el.querySelector(".bpmnkit-card-value")?.textContent).toBe("42")
		expect(el.querySelector(".bpmnkit-card-label")?.textContent).toBe("Instances")
	})

	it("adds the modifier class", () => {
		expect(createStatsCard("Incidents", "3", "warn").className).toBe(
			"bpmnkit-card bpmnkit-card--warn",
		)
	})
})

describe("createTable", () => {
	interface Row {
		id: number
		state: string
	}
	const columns = [
		{ label: "ID", width: "80px", render: (r: Row) => String(r.id) },
		{ label: "State", render: (r: Row) => badge(r.state) },
	]
	const rows = (el: HTMLElement) => Array.from(el.querySelectorAll(".bpmnkit-table-row"))

	it("renders a header cell per column, with its width", () => {
		const { el } = createTable<Row>({ columns })
		const ths = Array.from(el.querySelectorAll<HTMLElement>(".bpmnkit-table-th"))
		expect(ths.map((th) => th.textContent)).toEqual(["ID", "State"])
		expect(ths[0]?.style.width).toBe("80px")
	})

	it("renders strings as text and elements as children", () => {
		const t = createTable<Row>({ columns })
		t.setRows([
			{ id: 1, state: "ACTIVE" },
			{ id: 2, state: "COMPLETED" },
		])
		const [first] = rows(t.el)
		const tds = first?.querySelectorAll<HTMLElement>(".bpmnkit-table-td")
		expect(tds?.[0]?.textContent).toBe("1")
		expect(tds?.[0]?.style.width).toBe("80px")
		expect(tds?.[1]?.querySelector(".bpmnkit-badge--active")).not.toBeNull()
		expect(rows(t.el)).toHaveLength(2)
	})

	it("replaces the rows on each setRows", () => {
		const t = createTable<Row>({ columns })
		t.setRows([{ id: 1, state: "A" }])
		t.setRows([
			{ id: 2, state: "B" },
			{ id: 3, state: "C" },
		])
		expect(rows(t.el).map((r) => r.firstElementChild?.textContent)).toEqual(["2", "3"])
	})

	it("shows the empty text, defaulting to 'No data'", () => {
		const t = createTable<Row>({ columns })
		t.setRows([])
		expect(t.el.querySelector(".bpmnkit-table-empty")?.textContent).toBe("No data")
		const custom = createTable<Row>({ columns, emptyText: "Nothing yet" })
		custom.setRows([])
		expect(custom.el.querySelector(".bpmnkit-table-empty")?.textContent).toBe("Nothing yet")
	})

	it("makes rows clickable only with onRowClick, passing the row", () => {
		const plain = createTable<Row>({ columns })
		plain.setRows([{ id: 1, state: "A" }])
		expect(rows(plain.el)[0]?.classList.contains("bpmnkit-table-row--clickable")).toBe(false)

		const onRowClick = vi.fn()
		const t = createTable<Row>({ columns, onRowClick })
		const row = { id: 7, state: "A" }
		t.setRows([row])
		const tr = rows(t.el)[0] as HTMLElement
		expect(tr.classList.contains("bpmnkit-table-row--clickable")).toBe(true)
		tr.click()
		expect(onRowClick).toHaveBeenCalledWith(row)
	})
})

describe("createThemeSwitcher", () => {
	const dropdown = () => document.querySelector<HTMLElement>(".bpmnkit-theme-dropdown")
	const items = () => Array.from(document.querySelectorAll<HTMLElement>(".bpmnkit-theme-item"))
	const tick = () => new Promise((r) => setTimeout(r, 0))
	/** An icon string as the DOM serialises it back. */
	const icon = (svg: string) => {
		const el = document.createElement("span")
		el.innerHTML = svg
		return el.innerHTML
	}

	/** A real mouse click: pointerdown reaches the document before the click does. */
	function mouseClick(el: HTMLElement): void {
		el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))
		el.click()
	}

	function mount(opts: Partial<Parameters<typeof createThemeSwitcher>[0]> = {}) {
		const onChange = vi.fn()
		const sw = createThemeSwitcher({ onChange, ...opts })
		document.body.appendChild(sw.el)
		return { sw, onChange }
	}

	it("shows the icon of the initial theme, defaulting to neon", () => {
		expect(mount().sw.el.innerHTML).toBe(icon(IC_UI.neon))
		expect(mount({ initial: "light" }).sw.el.innerHTML).toBe(icon(IC_UI.sun))
	})

	it("opens a dropdown with the four themes, checking the current one", () => {
		const { sw } = mount({ initial: "dark" })
		sw.el.click()
		expect(dropdown()?.getAttribute("data-theme")).toBe("dark")
		expect(items().map((i) => i.textContent)).toEqual(["Dark", "Light", "System", "Neon"])
		const checked = items().filter((i) => i.querySelector(".bpmnkit-theme-item-check svg"))
		expect(checked.map((i) => i.textContent)).toEqual(["Dark"])
	})

	it("selecting a theme closes the dropdown, reports it and updates the icon", async () => {
		const { sw, onChange } = mount({ initial: "dark" })
		sw.el.click()
		await tick()
		const light = items()[1] as HTMLElement
		mouseClick(light)
		expect(onChange).toHaveBeenCalledWith("light", "light")
		expect(dropdown()).toBeNull()
		expect(sw.el.innerHTML).toBe(icon(IC_UI.sun))
		expect(localStorage.getItem("bpmnkit-theme")).toBeNull()
	})

	it("persists the selection when asked to", async () => {
		const { sw } = mount({ persist: true })
		sw.el.click()
		await tick()
		mouseClick(items()[0] as HTMLElement)
		expect(localStorage.getItem("bpmnkit-theme")).toBe("dark")
	})

	it("closes on a click outside", async () => {
		const { sw, onChange } = mount()
		sw.el.click()
		await tick()
		mouseClick(document.body)
		expect(dropdown()).toBeNull()
		expect(onChange).not.toHaveBeenCalled()
	})

	it("setTheme updates the icon without reporting a change", () => {
		const { sw, onChange } = mount({ initial: "dark" })
		sw.setTheme("auto")
		expect(sw.el.innerHTML).toBe(icon(IC_UI.auto))
		expect(onChange).not.toHaveBeenCalled()
	})

	// Regression: the outside-click handler treated the button as "outside", so
	// its pointerdown closed the dropdown and the click that followed reopened it.
	it("closes when its own button is clicked again", async () => {
		const { sw } = mount()
		mouseClick(sw.el)
		await tick()
		expect(dropdown()).not.toBeNull()
		mouseClick(sw.el)
		expect(dropdown()).toBeNull()
		expect(document.querySelectorAll(".bpmnkit-theme-dropdown")).toHaveLength(0)
	})

	// Regression: a dropdown closed by a selection left its outside-click handler
	// on the document, where it closed the next dropdown on its first pointerdown.
	it("a second dropdown still takes a selection after the first was closed", async () => {
		const { sw, onChange } = mount({ initial: "dark" })
		sw.el.click() // keyboard activation: no pointerdown
		await tick()
		;(items()[1] as HTMLElement).click()
		sw.el.click()
		await tick()
		const neon = items()[3] as HTMLElement
		neon.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))
		// A browser drops the click if its target left the DOM on pointerdown.
		expect(dropdown()).not.toBeNull()
		neon.click()
		expect(onChange).toHaveBeenLastCalledWith("neon", "neon")
	})
})

describe("IC_UI", () => {
	it("holds an SVG string per icon", () => {
		for (const [name, svg] of Object.entries(IC_UI)) {
			expect(svg, name).toMatch(/^<svg [^>]*viewBox="[^"]+"[^>]*>.*<\/svg>$/)
		}
	})
})
