import { Bpmn } from "@bpmn-sdk/core"
import type { BpmnDefinitions } from "@bpmn-sdk/core"
import { injectStyles } from "./css.js"
import { KeyboardHandler } from "./keyboard.js"
import { computeDiagramBounds, createDefs, createGrid, render } from "./renderer.js"
import type {
	CanvasApi,
	CanvasEvents,
	CanvasOptions,
	CanvasPlugin,
	FitMode,
	RenderedEdge,
	RenderedShape,
	Theme,
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
 * import { BpmnCanvas } from "@bpmn-sdk/canvas";
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
	private readonly _edgesG: SVGGElement
	private readonly _shapesG: SVGGElement
	private readonly _labelsG: SVGGElement
	private _gridPattern: SVGPatternElement | null = null
	private _markerId = ""

	// ── Sub-systems ───────────────────────────────────────────────────
	private readonly _viewport: ViewportController
	private readonly _keyboard: KeyboardHandler
	private readonly _plugins: CanvasPlugin[] = []

	// ── State ─────────────────────────────────────────────────────────
	private _shapes: RenderedShape[] = []
	private _edges: RenderedEdge[] = []
	private _currentDefs: BpmnDefinitions | null = null
	private _theme: Theme
	private _fit: FitMode

	// ── Event emitter ─────────────────────────────────────────────────
	private _listeners = new Map<keyof CanvasEvents, Set<(...args: unknown[]) => void>>()

	constructor(options: CanvasOptions) {
		injectStyles()

		this._id = String(_instanceCounter++)
		this._theme = options.theme ?? "auto"
		this._fit = options.fit ?? "contain"

		// ── Build DOM ────────────────────────────────────────────────
		const container = options.container
		container.innerHTML = ""

		this._host = document.createElement("div")
		this._host.className = "bpmn-canvas-host"
		this._host.setAttribute("role", "application")
		this._host.setAttribute("aria-label", "BPMN Diagram")
		this._host.setAttribute("tabindex", "0")
		this._applyTheme(this._theme)
		container.appendChild(this._host)

		// SVG root
		this._svg = document.createElementNS(NS, "svg") as SVGSVGElement
		this._svg.setAttribute("aria-hidden", "true")
		this._host.appendChild(this._svg)

		// Arrow marker defs
		this._markerId = createDefs(this._svg, this._id)

		// Dot grid
		if (options.grid !== false) {
			this._gridPattern = createGrid(this._svg, this._id)
		}

		// Viewport group
		this._viewportG = document.createElementNS(NS, "g") as SVGGElement
		this._svg.appendChild(this._viewportG)

		// Layer order: edges under shapes, labels on top
		this._edgesG = document.createElementNS(NS, "g") as SVGGElement
		this._shapesG = document.createElementNS(NS, "g") as SVGGElement
		this._labelsG = document.createElementNS(NS, "g") as SVGGElement
		this._viewportG.appendChild(this._edgesG)
		this._viewportG.appendChild(this._shapesG)
		this._viewportG.appendChild(this._labelsG)

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
		this._svg.addEventListener("click", (e: MouseEvent) => {
			if (this._viewport.didPan) return
			const target = (e.target as Element).closest("[data-bpmn-id]")
			const id = target?.getAttribute("data-bpmn-id")
			if (id) this._emit("element:click", id, e as unknown as PointerEvent)
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

		// Re-fit on container resize
		const ro = new ResizeObserver(() => {
			if (this._currentDefs) this.fitView()
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
	 * Use this when you already have the parsed model from `@bpmn-sdk/core`.
	 */
	loadDefinitions(defs: BpmnDefinitions): void {
		// Clear previous content
		this._edgesG.innerHTML = ""
		this._shapesG.innerHTML = ""
		this._labelsG.innerHTML = ""
		this._shapes = []
		this._edges = []

		this._currentDefs = defs

		const result = render(
			defs,
			this._edgesG,
			this._shapesG,
			this._labelsG,
			this._markerId,
			this._id,
		)
		this._shapes = result.shapes
		this._edges = result.edges

		this._keyboard.setShapes(this._shapes)

		if (this._fit !== "none") {
			// Defer fit to next frame so the SVG has been laid out
			requestAnimationFrame(() => this.fitView())
		}

		this._emit("diagram:load", defs)
	}

	/** Clears the canvas and fires `diagram:clear`. */
	clear(): void {
		this._edgesG.innerHTML = ""
		this._shapesG.innerHTML = ""
		this._labelsG.innerHTML = ""
		this._shapes = []
		this._edges = []
		this._currentDefs = null
		this._emit("diagram:clear")
	}

	/**
	 * Scales and pans the viewport to make the entire diagram visible.
	 * @param padding — pixels of whitespace around the diagram. Default: 40.
	 */
	fitView(padding = 40): void {
		if (!this._currentDefs) return
		const bounds = computeDiagramBounds(this._currentDefs)
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

	/** Zooms in by 25% centred on the canvas. */
	zoomIn(): void {
		const { width, height } = this._svg.getBoundingClientRect()
		this._viewport.zoomAt(width / 2, height / 2, 1.25)
	}

	/** Zooms out by 25% centred on the canvas. */
	zoomOut(): void {
		const { width, height } = this._svg.getBoundingClientRect()
		this._viewport.zoomAt(width / 2, height / 2, 0.8)
	}

	/** Resets to 100% zoom, centred on the canvas. */
	resetZoom(): void {
		const { width, height } = this._svg.getBoundingClientRect()
		this._viewport.set({ scale: 1, tx: width / 2, ty: height / 2 })
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

	/** Destroys the canvas, removing all DOM nodes and event listeners. */
	destroy(): void {
		this._ro.disconnect()
		this._viewport.destroy()
		this._keyboard.destroy()
		for (const plugin of this._plugins) plugin.uninstall?.()
		this._plugins.length = 0
		this._listeners.clear()
		this._host.remove()
	}

	// ── Private ───────────────────────────────────────────────────────

	private _applyTheme(theme: Theme): void {
		const resolved =
			theme === "auto"
				? window.matchMedia("(prefers-color-scheme: dark)").matches
					? "dark"
					: "light"
				: theme
		if (resolved === "dark") {
			this._host.setAttribute("data-theme", "dark")
		} else {
			this._host.removeAttribute("data-theme")
		}
	}

	private _installPlugin(plugin: CanvasPlugin): void {
		this._plugins.push(plugin)
		const api: CanvasApi = {
			container: this._host,
			svg: this._svg,
			viewportEl: this._viewportG,
			getViewport: () => this._viewport.state,
			setViewport: (s) => this._viewport.set(s),
			getShapes: () => [...this._shapes],
			getEdges: () => [...this._edges],
			getTheme: () => this._theme,
			setTheme: (theme) => this.setTheme(theme),
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
