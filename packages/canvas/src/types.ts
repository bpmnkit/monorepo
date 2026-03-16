import type {
	BpmnDefinitions,
	BpmnDiEdge,
	BpmnDiShape,
	BpmnFlowElement,
	BpmnTextAnnotation,
} from "@bpmnkit/core"

/** The color theme applied to the canvas. */
export type Theme = "light" | "dark" | "auto" | "neon"

/**
 * Controls how the diagram is initially positioned in the viewport.
 * - `"contain"` — scale and center the diagram to fill the available space (default)
 * - `"center"` — center without scaling
 * - `"none"` — use the diagram's raw coordinates unchanged
 */
export type FitMode = "contain" | "center" | "none"

/** Configuration options for {@link BpmnCanvas}. */
export interface CanvasOptions {
	/** The DOM element to mount the canvas into. */
	container: HTMLElement

	/** BPMN 2.0 XML to render immediately. Can also be provided later via {@link BpmnCanvas.load}. */
	xml?: string

	/**
	 * Color theme. Use `"auto"` to follow the OS preference (prefers-color-scheme).
	 * @default "auto"
	 */
	theme?: Theme

	/**
	 * Show a dot-grid background on the infinite canvas.
	 * @default true
	 */
	grid?: boolean

	/**
	 * How to position the diagram when first rendered.
	 * @default "contain"
	 */
	fit?: FitMode

	/**
	 * Plugins to install. Each plugin receives a {@link CanvasApi} handle and
	 * can extend the canvas with editing, overlays, tooltips, or custom shapes.
	 * @see {@link CanvasPlugin}
	 */
	plugins?: CanvasPlugin[]
}

/** The current pan/zoom state of the canvas viewport. */
export interface ViewportState {
	/** Horizontal translation in screen pixels. */
	tx: number
	/** Vertical translation in screen pixels. */
	ty: number
	/** Zoom scale factor. `1.0` = 100%, `0.5` = 50%, `2.0` = 200%. */
	scale: number
}

/** A rendered BPMN shape with its SVG element and source model data. */
export interface RenderedShape {
	/** The BPMN element ID. */
	readonly id: string
	/** The SVG `<g>` element. */
	readonly element: SVGGElement
	/** DI shape data — contains position and size. */
	readonly shape: BpmnDiShape
	/** The matching BPMN flow element from the process model, if found. */
	readonly flowElement: BpmnFlowElement | undefined
	/** Set if this shape represents a text annotation. */
	readonly annotation?: BpmnTextAnnotation
}

/** A rendered BPMN edge (sequence flow or association) with its SVG element. */
export interface RenderedEdge {
	/** The BPMN element ID. */
	readonly id: string
	/** The SVG `<g>` element. */
	readonly element: SVGGElement
	/** DI edge data — contains waypoints and optional label bounds. */
	readonly edge: BpmnDiEdge
}

/** Events emitted by {@link BpmnCanvas}. */
export interface CanvasEvents {
	/** Fired whenever the viewport is panned or zoomed. */
	"viewport:change": (state: ViewportState) => void
	/** Fired when a BPMN element is clicked. */
	"element:click": (id: string, event: PointerEvent) => void
	/** Fired when keyboard focus moves to a BPMN element. */
	"element:focus": (id: string) => void
	/** Fired when keyboard focus leaves all BPMN elements. */
	"element:blur": () => void
	/** Fired after a BPMN diagram is loaded and rendered. */
	"diagram:load": (defs: BpmnDefinitions) => void
	/** Fired when the canvas is cleared. */
	"diagram:clear": () => void
}

/**
 * The stable API surface exposed to plugins.
 *
 * Plugins receive a `CanvasApi` instance in their `install` method and use it
 * to observe and interact with the canvas without accessing internals.
 *
 * @example
 * ```typescript
 * const hoverPlugin: CanvasPlugin = {
 *   name: "hover-highlight",
 *   install(api) {
 *     api.on("element:click", (id) => {
 *       const shape = api.getShapes().find((s) => s.id === id);
 *       console.log("Clicked:", shape?.flowElement?.name ?? id);
 *     });
 *   },
 * };
 * ```
 */
export interface CanvasApi {
	/** The host element passed to {@link CanvasOptions.container}. */
	readonly container: HTMLElement
	/** The root `<svg>` element. */
	readonly svg: SVGSVGElement
	/** The viewport `<g>` element. All diagram content lives inside this group. */
	readonly viewportEl: SVGGElement

	/** Returns the current viewport state (pan + zoom). */
	getViewport(): ViewportState

	/** Programmatically updates viewport. Missing fields are preserved. */
	setViewport(state: Partial<ViewportState>): void

	/** Returns all currently rendered shapes. */
	getShapes(): RenderedShape[]

	/** Returns all currently rendered edges. */
	getEdges(): RenderedEdge[]

	/** Returns the current color theme. */
	getTheme(): Theme

	/** Sets the color theme. Pass `"auto"` to follow the OS preference. */
	setTheme(theme: Theme): void

	/**
	 * Subscribes to a canvas event. Returns an unsubscribe function.
	 *
	 * @example
	 * ```typescript
	 * const off = api.on("element:click", (id) => console.log(id));
	 * off(); // unsubscribe
	 * ```
	 */
	on<K extends keyof CanvasEvents>(event: K, handler: CanvasEvents[K]): () => void

	/** Emits a canvas event. Intended for use by plugins and internal code. */
	emit<K extends keyof CanvasEvents>(event: K, ...args: Parameters<CanvasEvents[K]>): void
}

/**
 * A plugin that extends `BpmnCanvas` without modifying the core.
 *
 * Plugins follow a simple install/uninstall lifecycle:
 * 1. `install(api)` is called once when the plugin is registered.
 * 2. `uninstall()` is called when the canvas is destroyed.
 *
 * Use `install` to hook into events, add overlays, or register keyboard shortcuts.
 *
 * @example
 * ```typescript
 * // Log all element clicks
 * const logPlugin: CanvasPlugin = {
 *   name: "click-logger",
 *   install(api) {
 *     api.on("element:click", (id, e) => {
 *       console.log(`${id} clicked at (${e.clientX}, ${e.clientY})`);
 *     });
 *   },
 * };
 *
 * const canvas = new BpmnCanvas({
 *   container: document.getElementById("app")!,
 *   plugins: [logPlugin],
 * });
 * ```
 */
export interface CanvasPlugin {
	/** A unique name that identifies this plugin. */
	readonly name: string

	/**
	 * Called once when the plugin is installed. Hook into canvas events here.
	 * @param api — The canvas API handle.
	 */
	install(api: CanvasApi): void

	/**
	 * Called when the canvas is destroyed.
	 * Clean up any resources your plugin allocated (DOM nodes, timers, etc.).
	 */
	uninstall?(): void
}
