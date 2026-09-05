import { Bpmn, applyAutoLayout, checkDiCompleteness, planeForElement } from "@bpmnkit/core"
import type { BpmnDefinitions, BpmnDiPlane, BpmnFlowElement } from "@bpmnkit/core"
import { CANVAS_CSS, injectStyles } from "./css.js"
import { KeyboardHandler } from "./keyboard.js"
import { OverlayManager } from "./overlays.js"
import { computeDiagramBounds, createDefs, createGrid } from "./renderer.js"
import { Scene } from "./scene.js"
import type {
	CanvasApi,
	CanvasEvents,
	CanvasOptions,
	CanvasPlugin,
	FitMode,
	ImportWarnings,
	PlaneInfo,
	RenderedEdge,
	RenderedShape,
	ScreenBox,
	Theme,
	Viewbox,
	ViewportState,
} from "./types.js"
import { ViewportController } from "./viewport.js"

const NS = "http://www.w3.org/2000/svg"
let _instanceCounter = 0

/**
 * BpmnCanvas — a high-performance, accessible BPMN 2.0 diagram viewer.
 *
 * ## Quick start
 * ```typescript
 * import { BpmnCanvas } from "@bpmnkit/canvas";
 *
 * const canvas = new BpmnCanvas({
 *   container: document.getElementById("app")!,
 *   xml: myBpmnXml,
 *   theme: "auto",
 * });
 * ```
 *
 * ## Framework integration
 * The canvas is framework-agnostic and mounts into any `HTMLElement`.
 *
 * ### React
 * ```tsx
 * const ref = useRef<HTMLDivElement>(null);
 * useEffect(() => {
 *   const canvas = new BpmnCanvas({ container: ref.current!, xml });
 *   return () => canvas.destroy();
 * }, [xml]);
 * return <div ref={ref} style={{ width: "100%", height: "500px" }} />;
 * ```
 *
 * ### Vue
 * ```vue
 * <template><div ref="el" style="width:100%;height:500px" /></template>
 * <script setup>
 * const el = ref(null);
 * onMounted(() => { canvas = new BpmnCanvas({ container: el.value, xml }); });
 * onUnmounted(() => canvas?.destroy());
 * </script>
 * ```
 *
 * ## Plugin system
 * Extend the canvas with custom behaviour by passing plugins to the constructor:
 * ```typescript
 * const canvas = new BpmnCanvas({
 *   container,
 *   plugins: [tooltipPlugin, editModePlugin],
 * });
 * ```
 * See {@link CanvasPlugin} for the plugin contract.
 */
export class BpmnCanvas {
	// ── DOM structure ─────────────────────────────────────────────────
	private readonly _id: string
	private readonly _host: HTMLElement
	private readonly _svg: SVGSVGElement
	private readonly _viewportG: SVGGElement
	private readonly _containersG: SVGGElement
	private readonly _edgesG: SVGGElement
	private readonly _shapesG: SVGGElement
	private readonly _labelsG: SVGGElement
	private _gridPattern: SVGPatternElement | null = null
	private _markerId = ""
	private _breadcrumb: HTMLDivElement

	// ── Sub-systems ───────────────────────────────────────────────────
	private readonly _viewport: ViewportController
	private readonly _keyboard: KeyboardHandler
	private readonly _overlays: OverlayManager
	private readonly _scene: Scene
	private readonly _plugins: CanvasPlugin[] = []

	// ── State ─────────────────────────────────────────────────────────
	private _shapes: RenderedShape[] = []
	private _edges: RenderedEdge[] = []
	private _currentDefs: BpmnDefinitions | null = null
	private _theme: Theme
	private _fit: FitMode
	private _layoutMissingDi: "off" | "all"
	/** Elements from the last load that had no diagram interchange. */
	private _importWarnings: ImportWarnings = { missingShapes: [], missingEdges: [] }
	/** The DI plane currently rendered. */
	private _currentPlane: BpmnDiPlane | null = null
	/** Element ids (this document) that own a plane and can be drilled into. */
	private _planeElementIds = new Set<string>()
	/** Breadcrumb path from the root plane to the current one. */
	private _planeStack: { id: string; name: string }[] = []
	/** CSS classes applied via {@link addMarker}, keyed by element id. */
	private _markers = new Map<string, Set<string>>()
	/** Element id currently under the pointer (for hover enter/leave events). */
	private _hoverId: string | null = null
	/**
	 * Set once the user pans/zooms so a container resize preserves their
	 * viewport instead of force-fitting the diagram.
	 */
	private _userMovedViewport = false

	// ── Event emitter ─────────────────────────────────────────────────
	private _listeners = new Map<keyof CanvasEvents, Set<(...args: unknown[]) => void>>()

	constructor(options: CanvasOptions) {
		injectStyles()

		this._id = String(_instanceCounter++)
		this._theme = options.theme ?? "auto"
		this._fit = options.fit ?? "contain"
		this._layoutMissingDi = options.layoutMissingDi ?? "off"

		// ── Build DOM ────────────────────────────────────────────────
		const container = options.container
		container.innerHTML = ""

		this._host = document.createElement("div")
		this._host.className = "bpmnkit-canvas-host"
		this._host.setAttribute("role", "application")
		this._host.setAttribute("aria-label", "BPMN Diagram")
		this._host.setAttribute("tabindex", "0")
		this._applyTheme(this._theme)
		container.appendChild(this._host)

		// SVG root
		this._svg = document.createElementNS(NS, "svg") as SVGSVGElement
		this._svg.setAttribute("aria-hidden", "true")
		this._host.appendChild(this._svg)

		// Drill-down breadcrumb (hidden until a sub-process is opened)
		this._breadcrumb = document.createElement("div")
		this._breadcrumb.className = "bpmnkit-breadcrumb"
		this._breadcrumb.setAttribute("aria-label", "Diagram plane")
		this._breadcrumb.style.display = "none"
		this._host.appendChild(this._breadcrumb)

		// Arrow marker defs
		this._markerId = createDefs(this._svg, this._id)

		// Dot grid
		if (options.grid !== false) {
			this._gridPattern = createGrid(this._svg, this._id)
		}

		// Viewport group
		this._viewportG = document.createElementNS(NS, "g") as SVGGElement
		this._svg.appendChild(this._viewportG)

		// Layer order: containers (pools/lanes) → edges → shapes → labels
		this._containersG = document.createElementNS(NS, "g") as SVGGElement
		this._edgesG = document.createElementNS(NS, "g") as SVGGElement
		this._shapesG = document.createElementNS(NS, "g") as SVGGElement
		this._labelsG = document.createElementNS(NS, "g") as SVGGElement
		this._viewportG.appendChild(this._containersG)
		this._viewportG.appendChild(this._edgesG)
		this._viewportG.appendChild(this._shapesG)
		this._viewportG.appendChild(this._labelsG)

		// Scene owns the layer content + the id→graphics registry.
		this._scene = new Scene(
			{
				containers: this._containersG,
				edges: this._edgesG,
				shapes: this._shapesG,
				labels: this._labelsG,
			},
			this._id,
		)

		// ── Viewport controller ───────────────────────────────────────
		this._viewport = new ViewportController(
			this._host,
			this._svg,
			this._viewportG,
			this._gridPattern,
			(state) => {
				this._emit("viewport:change", state)
			},
		)

		// ── Overlays ──────────────────────────────────────────────────
		this._overlays = new OverlayManager({
			hostEl: this._host,
			getScale: () => this._viewport.state.scale,
			getBBox: (id) => this.getAbsoluteBBox(id),
			onViewportChange: (cb) => this.on("viewport:change", cb),
		})

		// ── Keyboard ──────────────────────────────────────────────────
		this._keyboard = new KeyboardHandler(
			this._host,
			this._viewport,
			() => this.fitView(),
			(id) => {
				const shape = this._shapes.find((s) => s.id === id)
				if (shape) {
					const e = new PointerEvent("click")
					this._emit("element:click", id, e)
				}
			},
			(id) => this._emit("element:focus", id),
			() => this._emit("element:blur"),
		)

		// ── Click detection ───────────────────────────────────────────
		// Use elementFromPoint rather than e.target because native SVG hit-testing
		// can return the root <svg> element even when a shape is visually under the
		// cursor (reproducible when the canvas is inside a flex/scroll container).
		// elementFromPoint correctly resolves the topmost painted element.
		this._svg.addEventListener("click", (e: MouseEvent) => {
			if (this._viewport.didPan) return
			// elementFromPoint resolves the correct element when native SVG hit-testing
			// returns the root <svg> (reproducible in flex/scroll containers). Fall back
			// to e.target for test environments where elementFromPoint isn't reliable.
			const fromPoint = document.elementFromPoint(e.clientX, e.clientY)
			const domTarget = fromPoint ?? (e.target as Element)

			// Drill-down button takes precedence over element selection.
			const drill = domTarget
				.closest("[data-bpmnkit-drilldown]")
				?.getAttribute("data-bpmnkit-drilldown")
			if (drill) {
				this.showPlane(drill)
				return
			}

			const target = domTarget.closest("[data-bpmnkit-id]")
			const id = target?.getAttribute("data-bpmnkit-id")
			if (id) this._emit("element:click", id, e as unknown as PointerEvent)
			else this._emit("canvas:click", e)
		})

		// ── Hover / out ───────────────────────────────────────────────
		this._svg.addEventListener("pointermove", (e: PointerEvent) => {
			// Suppress hover changes while a button is held (panning/pinching).
			if (e.buttons !== 0) return
			const id = this._elementIdForEvent(e)
			if (id === this._hoverId) return
			if (this._hoverId !== null) this._emit("element:out", this._hoverId)
			this._hoverId = id
			if (id !== null) this._emit("element:hover", id, e)
		})

		// ── Double-click ──────────────────────────────────────────────
		this._svg.addEventListener("dblclick", (e: MouseEvent) => {
			const id = this._elementIdForEvent(e)
			if (id) this._emit("element:dblclick", id, e)
		})

		// ── Context menu ──────────────────────────────────────────────
		this._svg.addEventListener("contextmenu", (e: MouseEvent) => {
			const id = this._elementIdForEvent(e)
			if (id) this._emit("element:contextmenu", id, e)
		})

		// ── Track user viewport interaction ───────────────────────────
		this._svg.addEventListener("wheel", () => {
			this._userMovedViewport = true
		})
		this._svg.addEventListener("pointerup", () => {
			if (this._viewport.didPan) this._userMovedViewport = true
		})

		// ── Install plugins ───────────────────────────────────────────
		if (options.plugins) {
			for (const plugin of options.plugins) {
				this._installPlugin(plugin)
			}
		}

		// ── Initial diagram ───────────────────────────────────────────
		if (options.xml) {
			this.load(options.xml)
		}

		// Re-fit on container resize — but only while the user hasn't taken
		// control of the viewport, so an explicit pan/zoom survives a resize.
		const ro = new ResizeObserver(() => {
			if (this._currentDefs && !this._userMovedViewport) this.fitView()
		})
		ro.observe(this._host)
		this._ro = ro
	}

	private _ro: ResizeObserver

	// ── Public API ────────────────────────────────────────────────────

	/**
	 * Parses and renders a BPMN 2.0 XML string.
	 *
	 * @throws {Error} If the XML cannot be parsed.
	 */
	load(xml: string): void {
		const defs = Bpmn.parse(xml)
		this.loadDefinitions(defs)
	}

	/**
	 * Renders an already-parsed `BpmnDefinitions` model.
	 * Use this when you already have the parsed model from `@bpmnkit/core`.
	 */
	loadDefinitions(defs: BpmnDefinitions): void {
		// Report elements that have no diagram interchange (they would otherwise
		// be invisible). Warnings describe the *source* model, even when we
		// auto-layout below.
		this._importWarnings = checkDiCompleteness(defs)
		const hasMissingDi =
			this._importWarnings.missingShapes.length > 0 || this._importWarnings.missingEdges.length > 0

		if (hasMissingDi) {
			const outcome = this._layoutMissingDi === "all" ? "auto-laying out" : "they will not render"
			const { missingShapes, missingEdges } = this._importWarnings
			console.warn(
				`[bpmnkit] diagram has ${missingShapes.length} element(s) and ${missingEdges.length} connection(s) without diagram interchange — ${outcome}`,
			)
		}

		// Optionally lay out a copy so DI-less elements become visible. The
		// caller's `defs` is never mutated (applyAutoLayout returns a fresh copy).
		const rendered = this._layoutMissingDi === "all" && hasMissingDi ? applyAutoLayout(defs) : defs

		this._currentDefs = rendered
		this._planeElementIds = new Set(rendered.diagrams.map((d) => d.plane.bpmnElement))

		// Start at the primary (first) plane and reset the breadcrumb.
		const root = rendered.diagrams[0]?.plane
		this._planeStack = root
			? [{ id: root.bpmnElement, name: this._planeName(root.bpmnElement) }]
			: []

		// A freshly loaded diagram should auto-fit again until the user interacts.
		this._userMovedViewport = false
		this._renderPlane(root ?? null)

		this._emit("diagram:load", rendered, this._importWarnings)
	}

	/**
	 * Returns the elements from the last {@link load}/{@link loadDefinitions}
	 * that had no diagram interchange (and so were auto-laid-out or skipped).
	 */
	getImportWarnings(): ImportWarnings {
		return {
			missingShapes: [...this._importWarnings.missingShapes],
			missingEdges: [...this._importWarnings.missingEdges],
		}
	}

	/**
	 * Lists every DI plane in the current document (the primary plane plus any
	 * collapsed sub-processes that carry their own layout).
	 */
	getPlanes(): PlaneInfo[] {
		if (!this._currentDefs) return []
		return this._currentDefs.diagrams.map((d) => ({
			id: d.plane.bpmnElement,
			name: this._planeName(d.plane.bpmnElement),
		}))
	}

	/**
	 * Shows the plane identified by a DI plane `bpmnElement` (a process/
	 * collaboration id or a collapsed sub-process id). Drilling into a
	 * sub-process extends the breadcrumb; navigating to an ancestor trims it.
	 * No-op if the id has no plane. Fires `plane:change`.
	 */
	showPlane(planeElementId: string): void {
		if (!this._currentDefs) return
		const isRoot = this._currentDefs.diagrams[0]?.plane.bpmnElement === planeElementId
		const plane = isRoot
			? this._currentDefs.diagrams[0]?.plane
			: planeForElement(this._currentDefs, planeElementId)
		if (!plane) return

		const fromId = this._currentPlane?.bpmnElement ?? ""
		if (fromId === planeElementId) return

		// Navigate up if already in the breadcrumb, otherwise drill down.
		const existing = this._planeStack.findIndex((c) => c.id === planeElementId)
		if (existing >= 0) {
			this._planeStack = this._planeStack.slice(0, existing + 1)
		} else {
			this._planeStack.push({ id: planeElementId, name: this._planeName(planeElementId) })
		}

		this._userMovedViewport = false
		this._renderPlane(plane)
		this._emit("plane:change", fromId, planeElementId)
	}

	/** Renders a specific plane into the (cleared) layers and refits. */
	private _renderPlane(plane: BpmnDiPlane | null): void {
		this._markers.clear()
		this._overlays.clear()
		this._hoverId = null
		this._currentPlane = plane

		if (this._currentDefs && plane) {
			this._scene.render(this._currentDefs, plane, this._planeElementIds)
		} else {
			this._scene.clear()
		}
		this._shapes = this._scene.getShapes()
		this._edges = this._scene.getEdges()

		this._keyboard.setShapes(this._shapes)
		this._updateBreadcrumb()

		if (this._fit !== "none") {
			// Defer fit to next frame so the SVG has been laid out
			requestAnimationFrame(() => this.fitView())
		}
	}

	/** Clears the canvas and fires `diagram:clear`. */
	clear(): void {
		this._scene.clear()
		this._shapes = []
		this._edges = []
		this._markers.clear()
		this._overlays.clear()
		this._hoverId = null
		this._currentDefs = null
		this._currentPlane = null
		this._planeStack = []
		this._planeElementIds.clear()
		this._updateBreadcrumb()
		this._emit("diagram:clear")
	}

	/**
	 * Scales and pans the viewport to make the entire diagram visible.
	 * @param padding — pixels of whitespace around the diagram. Default: 40.
	 */
	fitView(padding = 40): void {
		if (!this._currentDefs) return
		const bounds = computeDiagramBounds(this._currentDefs, this._currentPlane ?? undefined)
		if (!bounds) return

		const svgW = this._svg.clientWidth
		const svgH = this._svg.clientHeight
		if (svgW === 0 || svgH === 0) return

		const dW = bounds.maxX - bounds.minX
		const dH = bounds.maxY - bounds.minY

		if (dW === 0 || dH === 0) return

		const scaleX = (svgW - padding * 2) / dW
		const scaleY = (svgH - padding * 2) / dH
		let scale = Math.min(scaleX, scaleY)

		if (this._fit === "center") scale = 1

		const tx = (svgW - dW * scale) / 2 - bounds.minX * scale
		const ty = (svgH - dH * scale) / 2 - bounds.minY * scale

		this._viewport.set({ tx, ty, scale })
	}

	/** Sets the color theme. Pass `"auto"` to follow the OS preference. */
	setTheme(theme: Theme): void {
		this._theme = theme
		this._applyTheme(theme)
	}

	/**
	 * HTML overlays anchored to diagram elements (badges, tooltips, panels).
	 * @example
	 * ```typescript
	 * canvas.overlays.add("Task_1", {
	 *   position: { top: -8, right: -8 },
	 *   html: `<span class="badge">!</span>`,
	 * });
	 * ```
	 */
	get overlays(): OverlayManager {
		return this._overlays
	}

	/** Returns the rendered shape or edge for a BPMN id, or `undefined` (O(1)). */
	getElement(id: string): RenderedShape | RenderedEdge | undefined {
		return this._scene.getElement(id)
	}

	/** Returns the `<g>` graphics element for a BPMN id, or `undefined` (O(1)). */
	getGraphics(id: string): SVGGElement | undefined {
		return this._scene.getGraphics(id)
	}

	/** Iterates every rendered element (shapes and edges). */
	forEachElement(fn: (el: RenderedShape | RenderedEdge) => void): void {
		this._scene.forEach(fn)
	}

	/**
	 * Re-renders a single element's `<g>` in place from the current model,
	 * preserving markers/selection classes — the incremental-update path used
	 * for cheap edits. No-op for an unknown id.
	 */
	updateElement(id: string): void {
		this._scene.updateElement(id)
		this._shapes = this._scene.getShapes()
		this._edges = this._scene.getEdges()
		const updated = this._scene.getElement(id)
		if (updated && "shape" in updated) this._keyboard.updateShape(updated)
		this._overlays.reposition()
	}

	/** Zooms in by 25% centred on the canvas. */
	zoomIn(): void {
		const { width, height } = this._svg.getBoundingClientRect()
		this._userMovedViewport = true
		this._viewport.zoomAt(width / 2, height / 2, 1.25)
	}

	/** Zooms out by 25% centred on the canvas. */
	zoomOut(): void {
		const { width, height } = this._svg.getBoundingClientRect()
		this._userMovedViewport = true
		this._viewport.zoomAt(width / 2, height / 2, 0.8)
	}

	/** Resets to 100% zoom, centred on the canvas. */
	resetZoom(): void {
		const { width, height } = this._svg.getBoundingClientRect()
		this._userMovedViewport = true
		this._viewport.set({ scale: 1, tx: width / 2, ty: height / 2 })
	}

	/**
	 * Adjusts the zoom. Pass `"fit"` (or no argument) to fit the whole diagram;
	 * pass a number for an absolute scale, optionally keeping `center`
	 * (screen-space pixels relative to the host) fixed.
	 */
	zoom(scaleOrFit: number | "fit" = "fit", center?: { x: number; y: number }): void {
		if (scaleOrFit === "fit") {
			this._userMovedViewport = false
			this.fitView()
			return
		}
		this._userMovedViewport = true
		const { width, height } = this._svg.getBoundingClientRect()
		const cx = center?.x ?? width / 2
		const cy = center?.y ?? height / 2
		const current = this._viewport.state.scale
		if (current > 0) this._viewport.zoomAt(cx, cy, scaleOrFit / current)
	}

	/** Returns the visible region in diagram coordinates plus the zoom scale. */
	viewbox(): Viewbox {
		const { tx, ty, scale } = this._viewport.state
		const { width, height } = this._svg.getBoundingClientRect()
		return { x: -tx / scale, y: -ty / scale, width: width / scale, height: height / scale, scale }
	}

	/** Pans (without changing zoom) so the element with the given id is centred. */
	scrollToElement(id: string): void {
		const box = this._diagramBounds(id)
		if (!box) return
		const { scale } = this._viewport.state
		const { width, height } = this._svg.getBoundingClientRect()
		const centerX = box.x + box.width / 2
		const centerY = box.y + box.height / 2
		this._userMovedViewport = true
		this._viewport.set({ tx: width / 2 - centerX * scale, ty: height / 2 - centerY * scale })
	}

	/**
	 * Returns the element's bounding box in screen pixels relative to the host,
	 * or `null` if the element is not found.
	 */
	getAbsoluteBBox(id: string): ScreenBox | null {
		const box = this._diagramBounds(id)
		if (!box) return null
		const { tx, ty, scale } = this._viewport.state
		return {
			x: box.x * scale + tx,
			y: box.y * scale + ty,
			width: box.width * scale,
			height: box.height * scale,
		}
	}

	/**
	 * Serializes the current diagram to a standalone SVG string with theme
	 * colours inlined, so it renders correctly outside the page.
	 * @param opts.bounds `"diagram"` (default) exports the whole diagram;
	 *   `"viewport"` exports only the currently visible region.
	 */
	exportSvg(opts?: { bounds?: "diagram" | "viewport" }): string {
		const box =
			opts?.bounds === "viewport"
				? (() => {
						const v = this.viewbox()
						return { x: v.x, y: v.y, width: v.width, height: v.height }
					})()
				: (() => {
						const b = this._currentDefs
							? computeDiagramBounds(this._currentDefs, this._currentPlane ?? undefined)
							: null
						const pad = 20
						return b
							? {
									x: b.minX - pad,
									y: b.minY - pad,
									width: b.maxX - b.minX + pad * 2,
									height: b.maxY - b.minY + pad * 2,
								}
							: { x: 0, y: 0, width: 0, height: 0 }
					})()

		const svg = document.createElementNS(NS, "svg")
		svg.setAttribute("xmlns", NS)
		svg.setAttribute("viewBox", `${box.x} ${box.y} ${box.width} ${box.height}`)
		svg.setAttribute("width", String(Math.round(box.width)))
		svg.setAttribute("height", String(Math.round(box.height)))

		const style = document.createElementNS(NS, "style")
		style.textContent = this._exportStyles()
		svg.appendChild(style)

		// Marker/pattern defs so `url(#…)` references resolve inside the export.
		const liveDefs = this._svg.querySelector("defs")
		if (liveDefs) svg.appendChild(liveDefs.cloneNode(true))

		// Diagram content lives in the layer groups in diagram coordinates (the
		// pan/zoom transform is on the viewport group, which is intentionally
		// excluded so the viewBox alone frames the content).
		for (const layer of [this._containersG, this._edgesG, this._shapesG, this._labelsG]) {
			svg.appendChild(layer.cloneNode(true))
		}
		return new XMLSerializer().serializeToString(svg)
	}

	/**
	 * Rasterizes the current diagram to a PNG data URL at `scale`× the diagram
	 * size. Browser-only (requires `Image`/`<canvas>`).
	 */
	exportPng(scale = 2): Promise<string> {
		const svgString = this.exportSvg()
		const match = svgString.match(/width="(\d+)" height="(\d+)"/)
		const w = (match ? Number(match[1]) : 0) * scale
		const h = (match ? Number(match[2]) : 0) * scale
		const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`
		return new Promise((resolve, reject) => {
			const img = new Image()
			img.onload = () => {
				const canvas = document.createElement("canvas")
				canvas.width = w
				canvas.height = h
				const ctx = canvas.getContext("2d")
				if (!ctx) {
					reject(new Error("2D canvas context unavailable"))
					return
				}
				ctx.drawImage(img, 0, 0, w, h)
				resolve(canvas.toDataURL("image/png"))
			}
			img.onerror = () => reject(new Error("Failed to rasterize SVG"))
			img.src = url
		})
	}

	/** Adds a CSS class to the element with the given BPMN id. No-op if not found. */
	addMarker(id: string, cls: string): void {
		const element = this._findElement(id)
		if (!element) return
		element.classList.add(cls)
		let set = this._markers.get(id)
		if (!set) {
			set = new Set()
			this._markers.set(id, set)
		}
		set.add(cls)
	}

	/** Removes a CSS class from the element with the given BPMN id. */
	removeMarker(id: string, cls: string): void {
		this._findElement(id)?.classList.remove(cls)
		this._markers.get(id)?.delete(cls)
	}

	/** Returns whether the element with the given id currently has the CSS class. */
	hasMarker(id: string, cls: string): boolean {
		return this._findElement(id)?.classList.contains(cls) ?? false
	}

	/** Toggles a CSS class on the element with the given id. */
	toggleMarker(id: string, cls: string): void {
		if (this.hasMarker(id, cls)) this.removeMarker(id, cls)
		else this.addMarker(id, cls)
	}

	/**
	 * Subscribes to a canvas event. Returns an unsubscribe function.
	 *
	 * @example
	 * ```typescript
	 * const off = canvas.on("element:click", (id) => console.log(id));
	 * off(); // unsubscribe
	 * ```
	 */
	on<K extends keyof CanvasEvents>(event: K, handler: CanvasEvents[K]): () => void {
		let set = this._listeners.get(event)
		if (!set) {
			set = new Set()
			this._listeners.set(event, set)
		}
		set.add(handler as (...args: unknown[]) => void)
		return () => set.delete(handler as (...args: unknown[]) => void)
	}

	/**
	 * Highlights a set of elements by ID with a coloured outline.
	 *
	 * - `"changed"` — amber outline, for elements modified by AI
	 * - `"new"` — green fill + outline, for elements added by AI
	 *
	 * Call {@link clearHighlights} to remove all highlights.
	 * Highlights are cleared automatically on the next {@link load} / {@link loadDefinitions} call.
	 */
	highlight(ids: string[], variant: "changed" | "new"): void {
		const cls = `bpmnkit-highlight--${variant}`
		for (const id of ids) this.addMarker(id, cls)
	}

	/** Removes all highlight classes added by {@link highlight}. */
	clearHighlights(): void {
		for (const { element } of [...this._shapes, ...this._edges]) {
			element.classList.remove("bpmnkit-highlight--changed", "bpmnkit-highlight--new")
		}
		for (const set of this._markers.values()) {
			set.delete("bpmnkit-highlight--changed")
			set.delete("bpmnkit-highlight--new")
		}
	}

	/** Destroys the canvas, removing all DOM nodes and event listeners. */
	destroy(): void {
		this._ro.disconnect()
		this._viewport.destroy()
		this._keyboard.destroy()
		this._overlays.destroy()
		for (const plugin of this._plugins) plugin.uninstall?.()
		this._plugins.length = 0
		this._listeners.clear()
		this._host.remove()
	}

	// ── Private ───────────────────────────────────────────────────────

	/** Finds the SVG group for a shape or edge by BPMN id. */
	private _findElement(id: string): SVGGElement | undefined {
		return this._scene.getGraphics(id)
	}

	/** Design tokens to resolve from the live host for a self-contained export. */
	private static readonly _EXPORT_TOKENS = [
		"--bpmnkit-bg",
		"--bpmnkit-grid",
		"--bpmnkit-shape-fill",
		"--bpmnkit-shape-stroke",
		"--bpmnkit-flow-stroke",
		"--bpmnkit-text",
		"--bpmnkit-highlight",
		"--bpmnkit-focus",
		"--bpmnkit-warn",
		"--bpmnkit-success",
	]

	/** Stylesheet for the exported SVG: resolved theme tokens + the canvas CSS. */
	private _exportStyles(): string {
		const decls: string[] = []
		if (typeof getComputedStyle !== "undefined") {
			const cs = getComputedStyle(this._host)
			for (const token of BpmnCanvas._EXPORT_TOKENS) {
				const value = cs.getPropertyValue(token).trim()
				if (value) decls.push(`${token}: ${value};`)
			}
		}
		const rootRule = decls.length ? `svg { ${decls.join(" ")} }\n` : ""
		return `${rootRule}${CANVAS_CSS}`
	}

	/** A human-readable label for a plane's `bpmnElement` (name, or a fallback). */
	private _planeName(planeElementId: string): string {
		const el = this._findFlowElementById(planeElementId)
		if (el) return el.name ?? "Sub-process"
		return "Process"
	}

	/** Recursively finds a flow element by id across all processes/sub-processes. */
	private _findFlowElementById(id: string): BpmnFlowElement | undefined {
		if (!this._currentDefs) return undefined
		const walk = (elements: BpmnFlowElement[]): BpmnFlowElement | undefined => {
			for (const el of elements) {
				if (el.id === id) return el
				if ("flowElements" in el) {
					const found = walk(el.flowElements)
					if (found) return found
				}
			}
			return undefined
		}
		for (const proc of this._currentDefs.processes) {
			const found = walk(proc.flowElements)
			if (found) return found
		}
		return undefined
	}

	/** Rebuilds the breadcrumb bar from the current plane stack. */
	private _updateBreadcrumb(): void {
		if (this._planeStack.length <= 1) {
			this._breadcrumb.style.display = "none"
			this._breadcrumb.replaceChildren()
			return
		}
		this._breadcrumb.style.display = ""
		this._breadcrumb.replaceChildren()
		this._planeStack.forEach((crumb, i) => {
			if (i > 0) {
				const sep = document.createElement("span")
				sep.className = "bpmnkit-breadcrumb-sep"
				sep.textContent = "›"
				this._breadcrumb.appendChild(sep)
			}
			const btn = document.createElement("button")
			btn.type = "button"
			btn.className = "bpmnkit-breadcrumb-crumb"
			btn.textContent = crumb.name
			const targetId = crumb.id
			btn.addEventListener("click", () => this.showPlane(targetId))
			this._breadcrumb.appendChild(btn)
		})
	}

	/**
	 * Resolves the BPMN element id under a pointer/mouse event, or `null`.
	 * The event target answers directly for most moves; `elementFromPoint`
	 * (which forces a layout and hit-test flush) is only consulted when native
	 * SVG hit-testing handed us the root `<svg>`, as it does in some flex/scroll
	 * containers.
	 */
	private _elementIdForEvent(e: MouseEvent | PointerEvent): string | null {
		const fromTarget = (e.target as Element | null)?.closest("[data-bpmnkit-id]")
		if (fromTarget) return fromTarget.getAttribute("data-bpmnkit-id")
		const fromPoint = document.elementFromPoint(e.clientX, e.clientY)
		return fromPoint?.closest("[data-bpmnkit-id]")?.getAttribute("data-bpmnkit-id") ?? null
	}

	/** Diagram-coordinate bounds of a shape (from DI) or edge (waypoint bbox). */
	private _diagramBounds(
		id: string,
	): { x: number; y: number; width: number; height: number } | null {
		const el = this._scene.getElement(id)
		if (!el) return null
		if ("shape" in el) {
			const { x, y, width, height } = el.shape.bounds
			return { x, y, width, height }
		}
		const waypoints = el.edge.waypoints
		if (waypoints.length === 0) return null
		let minX = Number.POSITIVE_INFINITY
		let minY = Number.POSITIVE_INFINITY
		let maxX = Number.NEGATIVE_INFINITY
		let maxY = Number.NEGATIVE_INFINITY
		for (const w of waypoints) {
			if (w.x < minX) minX = w.x
			if (w.y < minY) minY = w.y
			if (w.x > maxX) maxX = w.x
			if (w.y > maxY) maxY = w.y
		}
		return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
	}

	private _applyTheme(theme: Theme): void {
		const resolved =
			theme === "auto"
				? window.matchMedia("(prefers-color-scheme: dark)").matches
					? "dark"
					: "light"
				: theme
		if (resolved === "light") {
			this._host.removeAttribute("data-theme")
		} else {
			this._host.setAttribute("data-theme", resolved)
		}
	}

	private _installPlugin(plugin: CanvasPlugin): void {
		this._plugins.push(plugin)
		const api: CanvasApi = {
			container: this._host,
			svg: this._svg,
			viewportEl: this._viewportG,
			getViewport: () => this._viewport.state,
			setViewport: (s) => {
				this._userMovedViewport = true
				this._viewport.set(s)
			},
			getShapes: () => [...this._shapes],
			getEdges: () => [...this._edges],
			getTheme: () => this._theme,
			setTheme: (theme) => this.setTheme(theme),
			overlays: this._overlays,
			addMarker: (id, cls) => this.addMarker(id, cls),
			removeMarker: (id, cls) => this.removeMarker(id, cls),
			hasMarker: (id, cls) => this.hasMarker(id, cls),
			toggleMarker: (id, cls) => this.toggleMarker(id, cls),
			zoom: (scaleOrFit, center) => this.zoom(scaleOrFit, center),
			viewbox: () => this.viewbox(),
			scrollToElement: (id) => this.scrollToElement(id),
			getAbsoluteBBox: (id) => this.getAbsoluteBBox(id),
			on: (event, handler) => this.on(event, handler),
			emit: (event, ...args) => this._emit(event, ...args),
		}
		plugin.install(api)
	}

	private _emit<K extends keyof CanvasEvents>(
		event: K,
		...args: Parameters<CanvasEvents[K]>
	): void {
		const handlers = this._listeners.get(event)
		if (!handlers) return
		for (const h of handlers) {
			;(h as (...a: typeof args) => void)(...args)
		}
	}
}
