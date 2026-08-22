import { BpmnCanvas } from "@bpmnkit/canvas"
import type { BpmnDefinitions, LayoutEngine } from "@bpmnkit/core"
import { SAMPLES, layoutWith } from "../data/layout-samples.js"
import { createSpecThemePlugin } from "./canvas-theme.js"

const xmlById = new Map(SAMPLES.map((sample) => [sample.id, sample.xml]))

interface Mounted {
	canvas: BpmnCanvas
	/** Both layouts, computed once on first render and reused on every toggle. */
	laid: Map<LayoutEngine, BpmnDefinitions>
	xml: string
}

const mounted = new Map<string, Mounted>()

function show(id: string, engine: LayoutEngine): void {
	const entry = mounted.get(id)
	if (!entry) return
	let defs = entry.laid.get(engine)
	if (!defs) {
		defs = layoutWith(entry.xml, engine)
		entry.laid.set(engine, defs)
	}
	entry.canvas.loadDefinitions(defs)
	entry.canvas.fitView()
}

function currentEngine(section: HTMLElement): LayoutEngine {
	const pressed = section.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')
	return pressed?.dataset.engine === "grid" ? "grid" : "semantic"
}

function mount(section: HTMLElement): void {
	const id = section.dataset.sample
	const container = section.querySelector<HTMLElement>("[data-canvas]")
	const xml = id ? xmlById.get(id) : undefined
	if (!id || !container || !xml || mounted.has(id)) return

	mounted.set(id, {
		canvas: new BpmnCanvas({
			container,
			theme: "light",
			grid: false,
			fit: "contain",
			plugins: [createSpecThemePlugin({ maxZoom: 1.5 })],
		}),
		laid: new Map(),
		xml,
	})
	show(id, currentEngine(section))
}

const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-sample]"))

// Five diagrams is enough work to be worth deferring until each is on screen.
const observer = new IntersectionObserver(
	(entries) => {
		for (const entry of entries) {
			if (!entry.isIntersecting) continue
			observer.unobserve(entry.target)
			mount(entry.target as HTMLElement)
		}
	},
	{ rootMargin: "200px" },
)

for (const section of sections) {
	observer.observe(section)

	for (const button of section.querySelectorAll<HTMLButtonElement>("button[data-engine]")) {
		button.addEventListener("click", () => {
			const engine: LayoutEngine = button.dataset.engine === "grid" ? "grid" : "semantic"
			for (const sibling of section.querySelectorAll<HTMLButtonElement>("button[data-engine]"))
				sibling.setAttribute("aria-pressed", String(sibling === button))
			// Clicking before the section scrolled into view is possible via keyboard.
			mount(section)
			if (section.dataset.sample) show(section.dataset.sample, engine)
		})
	}
}
