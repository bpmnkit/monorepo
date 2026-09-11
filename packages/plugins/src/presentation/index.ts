import type { CanvasApi, CanvasPlugin, ViewportState } from "@bpmnkit/canvas"
import type { BpmnDefinitions } from "@bpmnkit/core"
import { injectChromeStyles } from "@bpmnkit/editor"

// ── SVG helpers ───────────────────────────────────────────────────────────────

const NS = "http://www.w3.org/2000/svg"

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
	return document.createElementNS(NS, tag) as SVGElementTagNameMap[K]
}

function attrs(el: Element, map: Record<string, string | number>): void {
	for (const [k, v] of Object.entries(map)) el.setAttribute(k, String(v))
}

// ── Local structural types (avoid tight coupling to @bpmnkit/core internals) ──

interface FlowEl {
	id: string
	type: string
	name?: string
	flowElements?: FlowEl[]
	sequenceFlows?: SeqFlow[]
}

interface SeqFlow {
	id: string
	sourceRef: string
	targetRef: string
	name?: string
	conditionExpression?: string
}

// ── Public types ──────────────────────────────────────────────────────────────

interface Choice {
	flowId: string
	targetId: string
	label: string | undefined
}

type FlowGraph = Map<string, Choice[]>

export interface PresentationApi {
	enter(): void
	exit(): void
}

export interface PresentationPlugin extends CanvasPlugin {
	api: PresentationApi
}

interface PaletteInput {
	addCommands(
		cmds: Array<{ id: string; title: string; description?: string; action(): void }>,
	): () => void
}

export interface PresentationOptions {
	palette?: PaletteInput | null
	onEnter?: () => void
	onExit?: () => void
}

// ── CSS ───────────────────────────────────────────────────────────────────────

const CSS_ID = "bpmnkit-presentation-v1"

const CSS = `
.bpmnkit-pres-fullscreen {
  position: fixed !important;
  inset: 0 !important;
  z-index: 9000 !important;
}
.bpmnkit-pres-fullscreen #hud-top-center,
.bpmnkit-pres-fullscreen #hud-bottom-center {
  display: none !important;
}
.bpmnkit-pres-overlay {
  position: absolute; inset: 0; pointer-events: none; z-index: 500;
  user-select: none;
  font-family: var(--bpmnkit-chrome-font);
}
.bpmnkit-pres-progress {
  position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: var(--bpmnkit-chrome-line);
}
.bpmnkit-pres-progress-fill {
  height: 100%; background: var(--bpmnkit-chrome-accent);
  transition: width 0.35s ease;
}
.bpmnkit-pres-stat {
  position: absolute; top: 8px; left: 50%; transform: translateX(-50%);
  font-size: 11px; color: var(--bpmnkit-chrome-ink-4);
  background: var(--bpmnkit-chrome-ground);
  border: 1px solid var(--bpmnkit-chrome-line); padding: 2px 10px;
  white-space: nowrap;
}
.bpmnkit-pres-minimap {
  position: absolute; bottom: 12px; right: 12px;
  width: 160px; height: 100px;
  pointer-events: auto;
  background: var(--bpmnkit-chrome-ground);
  border: 1px solid var(--bpmnkit-chrome-line); overflow: hidden;
  cursor: crosshair;
}
.bpmnkit-pres-minimap > svg {
  display: block; width: 100%; height: 100%; pointer-events: none;
}
.bpmnkit-pres-hints {
  position: absolute; bottom: 12px; left: 12px;
  display: flex; flex-direction: column; gap: 4px;
}
.bpmnkit-pres-hint {
  display: inline-flex; align-items: center; gap: 5px;
  background: var(--bpmnkit-chrome-ground);
  border: 1px solid var(--bpmnkit-chrome-line); padding: 3px 8px;
  font-size: 11px; color: var(--bpmnkit-chrome-ink-4);
}
.bpmnkit-pres-hint kbd {
  font-family: var(--bpmnkit-chrome-mono);
  font-size: 10px; color: var(--bpmnkit-chrome-ink);
  background: var(--bpmnkit-chrome-ground-2);
  border: 1px solid var(--bpmnkit-chrome-line); padding: 1px 5px;
}
`

function injectPresStyles(): void {
	injectChromeStyles()
	if (typeof document === "undefined") return
	if (document.getElementById(CSS_ID)) return
	const style = document.createElement("style")
	style.id = CSS_ID
	style.textContent = CSS
	document.head.appendChild(style)
}

// ── Flow graph builder ─────────────────────────────────────────────────────────

function buildGraph(rawDefs: BpmnDefinitions): {
	graph: FlowGraph
	startIds: string[]
	reachableCount: number
} {
	const graph: FlowGraph = new Map()
	const startIds: string[] = []

	const defs = rawDefs as unknown as {
		processes: Array<{ flowElements: FlowEl[]; sequenceFlows: SeqFlow[] }>
	}

	function walk(elements: FlowEl[], flows: SeqFlow[]): void {
		for (const el of elements) {
			if (!graph.has(el.id)) graph.set(el.id, [])
			if (el.type === "startEvent") startIds.push(el.id)
			if (el.flowElements) walk(el.flowElements, el.sequenceFlows ?? [])
		}
		for (const f of flows) {
			const list = graph.get(f.sourceRef)
			if (list)
				list.push({
					flowId: f.id,
					targetId: f.targetRef,
					label: f.name ?? f.conditionExpression,
				})
		}
	}

	for (const proc of defs.processes) walk(proc.flowElements, proc.sequenceFlows)

	// BFS to count reachable nodes (for progress indicator)
	const seen = new Set<string>()
	const q = [...startIds]
	while (q.length > 0) {
		const id = q.shift()
		if (!id || seen.has(id)) continue
		seen.add(id)
		for (const c of graph.get(id) ?? []) {
			if (!seen.has(c.targetId)) q.push(c.targetId)
		}
	}

	return { graph, startIds, reachableCount: seen.size }
}

// ── PresentationMinimap ────────────────────────────────────────────────────────

/**
 * A 160×100 minimap for the presentation overlay. Uses `CanvasApi.getShapes()`
 * and `CanvasApi.getEdges()` so it stays decoupled from BpmnDefinitions internals.
 */
class PresentationMinimap {
	private readonly host: HTMLDivElement
	private readonly svg: SVGSVGElement
	private readonly edgesG: SVGGElement
	private readonly shapesG: SVGGElement
	private readonly vpRect: SVGRectElement

	private mmScale = 1
	private mmOffX = 0
	private mmOffY = 0
	private readonly mmW = 160
	private readonly mmH = 100

	/** id → minimap shape element for fast colour updates */
	private readonly shapeMap = new Map<string, SVGElement>()

	constructor(container: HTMLElement, onNavigate: (diagX: number, diagY: number) => void) {
		this.host = document.createElement("div")
		this.host.className = "bpmnkit-pres-minimap"
		this.host.setAttribute("aria-hidden", "true")

		this.svg = svgEl("svg")
		attrs(this.svg, {
			viewBox: `0 0 ${this.mmW} ${this.mmH}`,
			preserveAspectRatio: "none",
		})
		this.host.appendChild(this.svg)

		this.edgesG = svgEl("g")
		this.shapesG = svgEl("g")
		this.vpRect = svgEl("rect")
		attrs(this.vpRect, {
			fill: "none",
			stroke: "var(--bpmnkit-chrome-accent)",
			"stroke-width": "1.5",
			rx: "1",
			opacity: "0.7",
		})

		this.svg.appendChild(this.edgesG)
		this.svg.appendChild(this.shapesG)
		this.svg.appendChild(this.vpRect)

		container.appendChild(this.host)

		this.host.addEventListener("click", (e) => {
			const r = this.host.getBoundingClientRect()
			onNavigate(
				(e.clientX - r.left - this.mmOffX) / this.mmScale,
				(e.clientY - r.top - this.mmOffY) / this.mmScale,
			)
		})
	}

	update(api: CanvasApi): void {
		this.edgesG.innerHTML = ""
		this.shapesG.innerHTML = ""
		this.shapeMap.clear()

		const shapes = api.getShapes()
		const edges = api.getEdges()

		if (shapes.length === 0) return

		// Compute diagram bounding box from shapes
		let minX = Number.POSITIVE_INFINITY
		let minY = Number.POSITIVE_INFINITY
		let maxX = Number.NEGATIVE_INFINITY
		let maxY = Number.NEGATIVE_INFINITY
		for (const s of shapes) {
			const b = s.shape.bounds
			if (b.x < minX) minX = b.x
			if (b.y < minY) minY = b.y
			if (b.x + b.width > maxX) maxX = b.x + b.width
			if (b.y + b.height > maxY) maxY = b.y + b.height
		}

		// Expand with edge waypoints
		for (const e of edges) {
			const wps =
				(e.edge as unknown as { waypoints?: Array<{ x: number; y: number }> }).waypoints ?? []
			for (const wp of wps) {
				if (wp.x < minX) minX = wp.x
				if (wp.y < minY) minY = wp.y
				if (wp.x > maxX) maxX = wp.x
				if (wp.y > maxY) maxY = wp.y
			}
		}

		const pad = 8
		const dW = maxX - minX
		const dH = maxY - minY
		this.mmScale = Math.min((this.mmW - pad * 2) / dW, (this.mmH - pad * 2) / dH)
		this.mmOffX = pad + (this.mmW - pad * 2 - dW * this.mmScale) / 2 - minX * this.mmScale
		this.mmOffY = pad + (this.mmH - pad * 2 - dH * this.mmScale) / 2 - minY * this.mmScale

		// Render edges
		for (const e of edges) {
			const wps =
				(e.edge as unknown as { waypoints?: Array<{ x: number; y: number }> }).waypoints ?? []
			if (wps.length < 2) continue
			const pts = wps
				.map((wp) => `${wp.x * this.mmScale + this.mmOffX},${wp.y * this.mmScale + this.mmOffY}`)
				.join(" ")
			const poly = svgEl("polyline")
			attrs(poly, {
				points: pts,
				stroke: "var(--bpmnkit-shape-stroke,#404040)",
				"stroke-width": "0.5",
				fill: "none",
				opacity: "0.35",
			})
			this.edgesG.appendChild(poly)
		}

		// Render shapes
		for (const s of shapes) {
			const b = s.shape.bounds
			const x = b.x * this.mmScale + this.mmOffX
			const y = b.y * this.mmScale + this.mmOffY
			const w = b.width * this.mmScale
			const h = b.height * this.mmScale

			let el: SVGElement
			if (w < 10) {
				el = svgEl("circle")
				attrs(el, {
					cx: x + w / 2,
					cy: y + h / 2,
					r: Math.max(w / 2, 2),
					fill: "var(--bpmnkit-shape-stroke,#404040)",
					opacity: "0.45",
				})
			} else {
				el = svgEl("rect")
				attrs(el, {
					x,
					y,
					width: Math.max(w, 1),
					height: Math.max(h, 1),
					rx: 1,
					fill: "var(--bpmnkit-shape-stroke,#404040)",
					opacity: "0.45",
				})
			}
			this.shapeMap.set(s.id, el)
			this.shapesG.appendChild(el)
		}
	}

	highlight(currentId: string | null, visited: ReadonlySet<string>): void {
		for (const [id, el] of this.shapeMap) {
			if (id === currentId) {
				el.setAttribute("fill", "var(--bpmnkit-chrome-accent)")
				el.setAttribute("opacity", "0.9")
			} else if (visited.has(id)) {
				el.setAttribute("fill", "var(--bpmnkit-success,#16a34a)")
				el.setAttribute("opacity", "0.6")
			} else {
				el.setAttribute("fill", "var(--bpmnkit-shape-stroke,#404040)")
				el.setAttribute("opacity", "0.45")
			}
		}
	}

	syncViewport(state: ViewportState, svgW: number, svgH: number): void {
		const left = -state.tx / state.scale
		const top = -state.ty / state.scale
		const w = svgW / state.scale
		const h = svgH / state.scale
		attrs(this.vpRect, {
			x: left * this.mmScale + this.mmOffX,
			y: top * this.mmScale + this.mmOffY,
			width: Math.max(w * this.mmScale, 2),
			height: Math.max(h * this.mmScale, 2),
		})
	}

	destroy(): void {
		this.host.remove()
	}
}

// ── PresentationMode ──────────────────────────────────────────────────────────

class PresentationMode {
	private readonly canvasApi: CanvasApi
	private readonly onEnter?: () => void
	private readonly onExit?: () => void

	private isActive = false
	private graph: FlowGraph = new Map()
	private startIds: string[] = []
	private reachableCount = 0
	private currentId: string | null = null
	private readonly visited = new Set<string>()

	// Overlay DOM
	private overlay: HTMLDivElement | null = null
	private progressFill: HTMLDivElement | null = null
	private statEl: HTMLDivElement | null = null
	private hintsEl: HTMLDivElement | null = null
	private minimap: PresentationMinimap | null = null

	// SVG layers (inside viewportEl, use diagram coordinates)
	private badgeG: SVGGElement | null = null

	// Navigation history for back navigation
	private history: string[] = []

	// Cleanup handles
	private offViewport: (() => void) | null = null
	private keyHandler: ((e: KeyboardEvent) => void) | null = null

	constructor(api: CanvasApi, opts?: { onEnter?: () => void; onExit?: () => void }) {
		this.canvasApi = api
		this.onEnter = opts?.onEnter
		this.onExit = opts?.onExit
	}

	setDefs(defs: BpmnDefinitions): void {
		const result = buildGraph(defs)
		this.graph = result.graph
		this.startIds = result.startIds
		this.reachableCount = result.reachableCount
	}

	enter(): void {
		if (this.isActive) return
		if (this.canvasApi.getShapes().length === 0) return
		this.isActive = true
		this.onEnter?.()
		this.visited.clear()
		this.history = []
		this.currentId = null
		injectPresStyles()
		this.canvasApi.container.classList.add("bpmnkit-pres-fullscreen")
		document.body.style.overflow = "hidden"
		this.buildOverlay()
		this.buildBadgeLayer()
		this.setupKeyboard()
		// Navigate to the first start event (or first shape as fallback)
		const first = this.startIds[0] ?? this.canvasApi.getShapes()[0]?.id
		if (first) this.navigateTo(first)
	}

	exit(): void {
		if (!this.isActive) return
		this.isActive = false

		if (this.keyHandler) {
			window.removeEventListener("keydown", this.keyHandler, true)
			this.keyHandler = null
		}
		this.offViewport?.()
		this.offViewport = null

		this.badgeG?.remove()
		this.badgeG = null

		this.overlay?.remove()
		this.overlay = null
		this.progressFill = null
		this.statEl = null
		this.hintsEl = null
		this.minimap?.destroy()
		this.minimap = null

		// Remove smooth-transition style we injected
		this.canvasApi.viewportEl.style.transition = ""

		this.canvasApi.container.classList.remove("bpmnkit-pres-fullscreen")
		document.body.style.overflow = ""
		this.onExit?.()

		this.visited.clear()
		this.history = []
		this.currentId = null
	}

	// ── Build overlay ───────────────────────────────────────────────────────────

	private buildOverlay(): void {
		const ov = document.createElement("div")
		ov.className = "bpmnkit-pres-overlay"

		// Progress bar
		const pb = document.createElement("div")
		pb.className = "bpmnkit-pres-progress"
		const fill = document.createElement("div")
		fill.className = "bpmnkit-pres-progress-fill"
		fill.style.width = "0%"
		pb.appendChild(fill)
		this.progressFill = fill

		// Progress label (centre-top)
		const stat = document.createElement("div")
		stat.className = "bpmnkit-pres-stat"
		stat.textContent = "0 / 0"
		this.statEl = stat

		// Minimap
		const mm = new PresentationMinimap(ov, (diagX, diagY) => {
			const { scale } = this.canvasApi.getViewport()
			this.canvasApi.setViewport({
				tx: this.canvasApi.svg.clientWidth / 2 - diagX * scale,
				ty: this.canvasApi.svg.clientHeight / 2 - diagY * scale,
			})
		})
		mm.update(this.canvasApi)
		mm.syncViewport(
			this.canvasApi.getViewport(),
			this.canvasApi.svg.clientWidth,
			this.canvasApi.svg.clientHeight,
		)
		this.minimap = mm

		// Keyboard hints
		const hints = document.createElement("div")
		hints.className = "bpmnkit-pres-hints"
		this.hintsEl = hints

		ov.appendChild(pb)
		ov.appendChild(stat)
		ov.appendChild(hints)
		this.canvasApi.container.appendChild(ov)
		this.overlay = ov

		// Keep minimap viewport indicator in sync
		this.offViewport = this.canvasApi.on("viewport:change", (state) => {
			this.minimap?.syncViewport(
				state,
				this.canvasApi.svg.clientWidth,
				this.canvasApi.svg.clientHeight,
			)
		})
	}

	// ── Build SVG badge layer (diagram coordinate space) ────────────────────────

	private buildBadgeLayer(): void {
		const bg = svgEl("g")
		bg.style.pointerEvents = "none"
		this.canvasApi.viewportEl.appendChild(bg)
		this.badgeG = bg
	}

	// ── Navigation ──────────────────────────────────────────────────────────────

	private navigateTo(id: string, addToHistory = true): void {
		if (!this.isActive) return
		const shape = this.canvasApi.getShapes().find((s) => s.id === id)
		if (!shape) return

		if (addToHistory && this.currentId) {
			this.history.push(this.currentId)
		}
		this.visited.add(id)
		this.currentId = id

		this.centerOn(shape.shape.bounds)
		this.updateBadges(id)
		this.updateProgress()
		this.minimap?.highlight(id, this.visited)
		this.updateHints(id)
	}

	private navigateBack(): void {
		const prev = this.history.pop()
		if (prev) this.navigateTo(prev, false)
	}

	private centerOn(bounds: { x: number; y: number; width: number; height: number }): void {
		const sw = this.canvasApi.svg.clientWidth
		const sh = this.canvasApi.svg.clientHeight
		const scale = Math.min(
			(sw * 0.45) / Math.max(bounds.width, 1),
			(sh * 0.45) / Math.max(bounds.height, 1),
			2.5,
		)
		const cx = bounds.x + bounds.width / 2
		const cy = bounds.y + bounds.height / 2

		this.canvasApi.viewportEl.style.transition = "transform 0.35s cubic-bezier(0.4,0,0.2,1)"
		this.canvasApi.setViewport({
			tx: sw / 2 - cx * scale,
			ty: sh / 2 - cy * scale,
			scale,
		})
		setTimeout(() => {
			if (this.isActive && this.canvasApi.viewportEl) {
				this.canvasApi.viewportEl.style.transition = ""
			}
		}, 380)
	}

	// ── Choice badges ───────────────────────────────────────────────────────────

	private updateBadges(nodeId: string): void {
		const bg = this.badgeG
		if (!bg) return
		bg.innerHTML = ""

		const choices = this.graph.get(nodeId) ?? []
		if (choices.length <= 1) return

		for (let i = 0; i < choices.length; i++) {
			const choice = choices[i]
			if (!choice) continue
			const target = this.canvasApi.getShapes().find((s) => s.id === choice.targetId)
			if (!target) continue

			const b = target.shape.bounds
			const cx = b.x + b.width / 2
			const cy = b.y - 20

			const g = svgEl("g")
			attrs(g, { transform: `translate(${cx},${cy})` })

			const circle = svgEl("circle")
			attrs(circle, { r: 14, fill: "var(--bpmnkit-chrome-accent)" })

			const num = svgEl("text")
			attrs(num, {
				"text-anchor": "middle",
				"dominant-baseline": "central",
				fill: "white",
				"font-size": "13",
				"font-weight": "bold",
				"font-family": "var(--bpmnkit-chrome-font)",
			})
			num.textContent = String(i + 1)

			g.appendChild(circle)
			g.appendChild(num)

			const label = choice.label
			if (label) {
				const truncated = label.length > 20 ? `${label.slice(0, 20)}…` : label
				const lbg = svgEl("rect")
				attrs(lbg, {
					x: -40,
					y: 18,
					width: 80,
					height: 15,
					rx: 3,
					fill: "var(--bpmnkit-chrome-ground)",
					stroke: "var(--bpmnkit-chrome-line)",
				})
				const lt = svgEl("text")
				attrs(lt, {
					"text-anchor": "middle",
					y: 26,
					"font-size": "9",
					fill: "var(--bpmnkit-chrome-ink-4)",
					"font-family": "var(--bpmnkit-chrome-font)",
				})
				lt.textContent = truncated
				g.appendChild(lbg)
				g.appendChild(lt)
			}

			bg.appendChild(g)
		}
	}

	// ── Progress ────────────────────────────────────────────────────────────────

	private updateProgress(): void {
		if (!this.progressFill || !this.statEl) return
		const total = Math.max(this.reachableCount, 1)
		const done = this.visited.size
		this.progressFill.style.width = `${(done / total) * 100}%`
		this.statEl.textContent = `${done} / ${total}`
	}

	// ── Hints ───────────────────────────────────────────────────────────────────

	private updateHints(nodeId: string): void {
		if (!this.hintsEl) return
		const choices = this.graph.get(nodeId) ?? []
		this.hintsEl.innerHTML = ""

		const hint = (html: string) => {
			const d = document.createElement("div")
			d.className = "bpmnkit-pres-hint"
			d.innerHTML = html
			return d
		}

		if (choices.length > 1) {
			this.hintsEl.appendChild(
				hint(`<kbd>→</kbd> Next &nbsp;<kbd>1</kbd>–<kbd>${choices.length}</kbd> Choose path`),
			)
		} else if (choices.length === 1) {
			this.hintsEl.appendChild(hint("<kbd>→</kbd> Next"))
		} else {
			this.hintsEl.appendChild(hint("End of process"))
		}
		if (this.history.length > 0) {
			this.hintsEl.appendChild(hint("<kbd>←</kbd> Back"))
		}
		this.hintsEl.appendChild(hint("<kbd>↑</kbd><kbd>↓</kbd> Zoom"))
		this.hintsEl.appendChild(hint("<kbd>Esc</kbd> Exit"))
	}

	// ── Keyboard ────────────────────────────────────────────────────────────────

	private setupKeyboard(): void {
		const handler = (e: KeyboardEvent) => {
			if (!this.isActive) return
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

			switch (e.key) {
				case "Escape":
					e.preventDefault()
					e.stopPropagation()
					this.exit()
					break
				case "ArrowLeft":
					e.preventDefault()
					e.stopPropagation()
					this.navigateBack()
					break
				case "ArrowRight":
				case "Enter": {
					e.preventDefault()
					e.stopPropagation()
					const choices = this.graph.get(this.currentId ?? "") ?? []
					const next = choices[0]
					if (next) this.navigateTo(next.targetId)
					break
				}
				case "ArrowUp":
					e.preventDefault()
					e.stopPropagation()
					this.zoomAround(1.2)
					break
				case "ArrowDown":
					e.preventDefault()
					e.stopPropagation()
					this.zoomAround(1 / 1.2)
					break
				default:
					if (e.key >= "1" && e.key <= "9") {
						e.preventDefault()
						e.stopPropagation()
						const idx = Number(e.key) - 1
						const choices = this.graph.get(this.currentId ?? "") ?? []
						const pick = choices[idx]
						if (pick) this.navigateTo(pick.targetId)
					}
			}
		}

		window.addEventListener("keydown", handler, true)
		this.keyHandler = handler
	}

	private zoomAround(factor: number): void {
		const vp = this.canvasApi.getViewport()
		const hw = this.canvasApi.svg.clientWidth / 2
		const hh = this.canvasApi.svg.clientHeight / 2
		this.canvasApi.setViewport({
			scale: vp.scale * factor,
			tx: hw - (hw - vp.tx) * factor,
			ty: hh - (hh - vp.ty) * factor,
		})
	}
}

// ── Plugin factory ─────────────────────────────────────────────────────────────

export function createPresentationPlugin(options: PresentationOptions = {}): PresentationPlugin {
	let mode: PresentationMode | null = null
	const unsubs: Array<() => void> = []

	const api: PresentationApi = {
		enter() {
			mode?.enter()
		},
		exit() {
			mode?.exit()
		},
	}

	return {
		name: "presentation",
		api,

		install(canvasApi) {
			mode = new PresentationMode(canvasApi, { onEnter: options.onEnter, onExit: options.onExit })

			unsubs.push(
				canvasApi.on("diagram:load", (defs) => mode?.setDefs(defs)),
				canvasApi.on("diagram:clear", () => mode?.exit()),
			)

			if (options.palette) {
				unsubs.push(
					options.palette.addCommands([
						{
							id: "presentation:start",
							title: "Start Presentation Mode",
							description: "Walk through the process step by step from start event to end",
							action() {
								mode?.enter()
							},
						},
					]),
				)
			}
		},

		uninstall() {
			mode?.exit()
			for (const off of unsubs) off()
			unsubs.length = 0
			mode = null
		},
	}
}
