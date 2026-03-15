import { BpmnCanvas } from "@bpmnkit/canvas"
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest"
import { MAIN_MENU_STYLE_ID, createMainMenuPlugin } from "../../src/main-menu/index.js"

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeContainer(): HTMLElement {
	const el = document.createElement("div")
	el.style.width = "800px"
	el.style.height = "600px"
	document.body.appendChild(el)
	return el
}

/** Find the dropdown that belongs to a specific canvas container. */
function findDropdown(container: HTMLElement): Element | null {
	// The panel is inside the canvas host; find the plugin's button and match
	// the dropdown appended by the same install() call via data attribute.
	const panel = container.querySelector(".bpmnkit-main-menu-panel")
	if (!panel) return null
	// The dropdown is identified by the same relative position in body children
	// — simplest: find ALL open or not-open dropdowns after a click and match
	// by index. But since we clean up between tests, there is always only one.
	return document.querySelector(".bpmnkit-menu-dropdown")
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("createMainMenuPlugin", () => {
	beforeEach(() => {
		// Clear accumulated DOM (containers + body-appended dropdowns) between tests.
		document.body.innerHTML = ""
	})

	it("has name 'main-menu'", () => {
		expect(createMainMenuPlugin().name).toBe("main-menu")
	})

	it("injects styles into <head>", () => {
		const container = makeContainer()
		new BpmnCanvas({ container, plugins: [createMainMenuPlugin()] })
		expect(document.getElementById(MAIN_MENU_STYLE_ID)).not.toBeNull()
	})

	it("mounts .bpmnkit-main-menu-panel inside the canvas host", () => {
		const container = makeContainer()
		new BpmnCanvas({ container, plugins: [createMainMenuPlugin()] })
		const host = container.querySelector(".bpmnkit-canvas-host")
		expect(host?.querySelector(".bpmnkit-main-menu-panel")).not.toBeNull()
	})

	it("renders a menu button", () => {
		const container = makeContainer()
		new BpmnCanvas({ container, plugins: [createMainMenuPlugin()] })
		expect(container.querySelector(".bpmnkit-menu-btn")).not.toBeNull()
	})

	it("renders a title when provided", () => {
		const container = makeContainer()
		new BpmnCanvas({ container, plugins: [createMainMenuPlugin({ title: "My App" })] })
		const title = container.querySelector(".bpmnkit-main-menu-title")
		expect(title?.textContent).toBe("My App")
	})

	it("renders no title element when title is omitted", () => {
		const container = makeContainer()
		new BpmnCanvas({ container, plugins: [createMainMenuPlugin()] })
		expect(container.querySelector(".bpmnkit-main-menu-title")).toBeNull()
	})

	it("opens the dropdown on button click", () => {
		const container = makeContainer()
		new BpmnCanvas({ container, plugins: [createMainMenuPlugin()] })
		const btn = container.querySelector<HTMLButtonElement>(".bpmnkit-menu-btn")
		if (!btn) throw new Error("menu button not found")
		btn.dispatchEvent(new MouseEvent("click", { bubbles: true }))
		const dropdown = document.querySelector(".bpmnkit-menu-dropdown")
		expect(dropdown?.classList.contains("open")).toBe(true)
	})

	it("closes the dropdown on a second button click", () => {
		const container = makeContainer()
		new BpmnCanvas({ container, plugins: [createMainMenuPlugin()] })
		const btn = container.querySelector<HTMLButtonElement>(".bpmnkit-menu-btn")
		if (!btn) throw new Error("menu button not found")
		btn.dispatchEvent(new MouseEvent("click", { bubbles: true }))
		btn.dispatchEvent(new MouseEvent("click", { bubbles: true }))
		const dropdown = document.querySelector(".bpmnkit-menu-dropdown")
		expect(dropdown?.classList.contains("open")).toBe(false)
	})

	it("renders three theme options after drilling into Theme", () => {
		const container = makeContainer()
		new BpmnCanvas({ container, plugins: [createMainMenuPlugin()] })
		const btn = container.querySelector<HTMLButtonElement>(".bpmnkit-menu-btn")
		if (!btn) throw new Error("menu button not found")
		btn.dispatchEvent(new MouseEvent("click", { bubbles: true }))
		// At root: one drill item labelled "Theme"
		const themeBtn = [...document.querySelectorAll<HTMLButtonElement>(".bpmnkit-menu-item")].find(
			(el) => el.querySelector(".bpmnkit-menu-item-label")?.textContent === "Theme",
		)
		if (!themeBtn) throw new Error("Theme drill button not found")
		themeBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }))
		// After drilling: three theme action items (query the active level — during animation
		// the exiting level may still be in the DOM as a sibling)
		const activeLevel = document.querySelector(
			".bpmnkit-menu-dropdown .bpmnkit-menu-level:last-child",
		)
		if (!activeLevel) throw new Error("active level not found")
		const items = activeLevel.querySelectorAll(".bpmnkit-menu-item")
		expect(items.length).toBe(3)
	})

	it("applies theme and closes dropdown when a theme item is clicked", () => {
		const container = makeContainer()
		const canvas = new BpmnCanvas({
			container,
			theme: "dark",
			plugins: [createMainMenuPlugin()],
		})
		const btn = container.querySelector<HTMLButtonElement>(".bpmnkit-menu-btn")
		if (!btn) throw new Error("menu button not found")
		btn.dispatchEvent(new MouseEvent("click", { bubbles: true }))
		// Drill into Theme
		const themeBtn = [...document.querySelectorAll<HTMLButtonElement>(".bpmnkit-menu-item")].find(
			(el) => el.querySelector(".bpmnkit-menu-item-label")?.textContent === "Theme",
		)
		if (!themeBtn) throw new Error("Theme drill button not found")
		themeBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }))
		// Click "Light" theme item
		const lightBtn = [...document.querySelectorAll<HTMLButtonElement>(".bpmnkit-menu-item")].find(
			(el) => el.querySelector(".bpmnkit-menu-item-label")?.textContent === "Light",
		)
		if (!lightBtn) throw new Error("light theme button not found")
		lightBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }))
		// Theme applied: data-theme attribute removed (light = no dark attr)
		const host = container.querySelector(".bpmnkit-canvas-host")
		expect(host?.getAttribute("data-theme")).toBeNull()
		// Dropdown closed
		const dropdown = document.querySelector(".bpmnkit-menu-dropdown")
		expect(dropdown?.classList.contains("open")).toBe(false)
		canvas.destroy()
	})

	it("removes panel and dropdown on uninstall (destroy)", () => {
		const container = makeContainer()
		const canvas = new BpmnCanvas({ container, plugins: [createMainMenuPlugin()] })
		canvas.destroy()
		expect(container.querySelector(".bpmnkit-main-menu-panel")).toBeNull()
		expect(document.querySelector(".bpmnkit-menu-dropdown")).toBeNull()
	})

	it("each plugin instance is independent", () => {
		const c1 = makeContainer()
		const c2 = makeContainer()
		new BpmnCanvas({ container: c1, plugins: [createMainMenuPlugin({ title: "A" })] })
		new BpmnCanvas({ container: c2, plugins: [createMainMenuPlugin({ title: "B" })] })
		expect(c1.querySelector(".bpmnkit-main-menu-title")?.textContent).toBe("A")
		expect(c2.querySelector(".bpmnkit-main-menu-title")?.textContent).toBe("B")
	})
})
