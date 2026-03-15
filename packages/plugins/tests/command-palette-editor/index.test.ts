import type { CanvasApi } from "@bpmnkit/canvas"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createCommandPaletteEditorPlugin } from "../../src/command-palette-editor/index.js"
import { createCommandPalettePlugin } from "../../src/command-palette/index.js"

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeApi(): CanvasApi {
	const container = document.createElement("div")
	document.body.appendChild(container)
	return {
		container,
		svg: document.createElementNS("http://www.w3.org/2000/svg", "svg") as SVGSVGElement,
		viewportEl: document.createElementNS("http://www.w3.org/2000/svg", "g") as SVGGElement,
		getViewport: () => ({ tx: 0, ty: 0, scale: 1 }),
		setViewport: vi.fn(),
		getShapes: () => [],
		getEdges: () => [],
		getTheme: () => "dark" as const,
		setTheme: vi.fn(),
		on: (_event: unknown, _handler: unknown) => () => {},
		emit: vi.fn(),
	}
}

function ctrlK(): void {
	document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }))
}

beforeEach(() => {
	document.body.innerHTML = ""
	document.head.innerHTML = ""
})

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("createCommandPaletteEditorPlugin", () => {
	it("registers element commands when installed", () => {
		const palette = createCommandPalettePlugin()
		const setTool = vi.fn()
		const editorPlugin = createCommandPaletteEditorPlugin(palette, setTool)

		const api = makeApi()
		palette.install(api)
		editorPlugin.install(api)

		// Open palette and check that element commands appear
		ctrlK()
		const input = document.querySelector<HTMLInputElement>(".bpmnkit-palette-input")
		if (!input) throw new Error("input not found")
		input.value = "Add"
		input.dispatchEvent(new Event("input", { bubbles: true }))
		const items = document.querySelectorAll(".bpmnkit-palette-item")
		expect(items.length).toBe(40) // 40 element types
	})

	it("deregisters commands on uninstall", () => {
		const palette = createCommandPalettePlugin()
		const setTool = vi.fn()
		const editorPlugin = createCommandPaletteEditorPlugin(palette, setTool)

		const api = makeApi()
		palette.install(api)
		editorPlugin.install(api)
		editorPlugin.uninstall?.()

		ctrlK()
		const input = document.querySelector<HTMLInputElement>(".bpmnkit-palette-input")
		if (!input) throw new Error("input not found")
		input.value = "Add"
		input.dispatchEvent(new Event("input", { bubbles: true }))
		// Commands deregistered — only "No commands found" empty state
		expect(document.querySelector(".bpmnkit-palette-empty")).not.toBeNull()
	})

	it("calls setTool with correct create: prefix when command is executed", () => {
		const palette = createCommandPalettePlugin()
		const setTool = vi.fn()
		const editorPlugin = createCommandPaletteEditorPlugin(palette, setTool)

		const api = makeApi()
		palette.install(api)
		editorPlugin.install(api)

		ctrlK()
		const input = document.querySelector<HTMLInputElement>(".bpmnkit-palette-input")
		if (!input) throw new Error("input not found")
		input.value = "service task"
		input.dispatchEvent(new Event("input", { bubbles: true }))
		const item = document.querySelector<HTMLDivElement>(".bpmnkit-palette-item")
		if (!item) throw new Error("item not found")
		item.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))
		expect(setTool).toHaveBeenCalledWith("create:serviceTask")
	})

	it("each element type has a unique command id", () => {
		const palette = createCommandPalettePlugin()
		const setTool = vi.fn()
		const editorPlugin = createCommandPaletteEditorPlugin(palette, setTool)
		const api = makeApi()
		palette.install(api)
		editorPlugin.install(api)

		ctrlK()
		const input = document.querySelector<HTMLInputElement>(".bpmnkit-palette-input")
		if (!input) throw new Error("input not found")
		input.value = "Add"
		input.dispatchEvent(new Event("input", { bubbles: true }))

		const items = document.querySelectorAll(".bpmnkit-palette-item-title")
		const titles = Array.from(items).map((el) => el.textContent ?? "")
		const unique = new Set(titles)
		expect(unique.size).toBe(titles.length)
	})
})
