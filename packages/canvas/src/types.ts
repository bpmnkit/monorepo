import type {
	BpmnDefinitions,
	BpmnDiEdge,
	BpmnDiShape,
	BpmnFlowElement,
	BpmnTextAnnotation,
	DiCompleteness,
} from "@bpmnkit/core"
import type { OverlayManager } from "./overlays.js"

/** Elements in the model that have no diagram interchange (BPMNShape/BPMNEdge). */
export type ImportWarnings = DiCompleteness

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

	/**
	 * What to do when the model has elements without diagram interchange
	 * (no `BPMNShape`/`BPMNEdge`), which would otherwise be invisible.
	 * - `"off"` (default) — render only elements that have DI.
	 * - `"all"` — if any DI is missing, auto-layout a copy of the model and
	 *   render that. The caller's model is never mutated.
	 * @default "off"
	 */
	layoutMissingDi?: "off" | "all"
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

/** A rectangle in screen pixels, relative to the canvas host. */
export interface ScreenBox {
	x: number
	y: number
	width: number
	height: number
}

/**
 * The visible region of the diagram, in diagram coordinates, plus the current
 * zoom scale. The inverse of the pan/zoom transform applied to the viewport.
 */
export interface Viewbox {
	/** Diagram x-coordinate at the left edge of the viewport. */
	x: number
	/** Diagram y-coordinate at the top edge of the viewport. */
	y: number
	/** Width of the visible region in diagram units. */
	width: number
	/** Height of the visible region in diagram units. */
	height: number
	/** Current zoom scale factor. */
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
	/** Fired when the pointer moves onto a BPMN element (once per enter). */
	"element:hover": (id: string, event: PointerEvent) => void
	/** Fired when the pointer leaves the previously-hovered element. */
	"element:out": (id: string) => void
	/** Fired when a BPMN element is double-clicked. */
	"element:dblclick": (id: string, event: MouseEvent) => void
	/**
	 * Fired when a BPMN element is right-clicked. Call `event.preventDefault()`
	 * in the handler to suppress the browser's native context menu.
	 */
	"element:contextmenu": (id: string, event: MouseEvent) => void
	/** Fired when the empty canvas background (no element) is clicked. */
	"canvas:click": (event: MouseEvent) => void
	/** Fired when keyboard focus moves to a BPMN element. */
	"element:focus": (id: string) => void
	/** Fired when keyboard focus leaves all BPMN elements. */
	"element:blur": () => void
	/**
	 * Fired after a BPMN diagram is loaded and rendered. `warnings` lists any
	 * model elements that had no diagram interchange (see {@link ImportWarnings}).
	 */
	"diagram:load": (defs: BpmnDefinitions, warnings: ImportWarnings) => void
	/** Fired when the canvas is cleared. */
	"diagram:clear": () => void
	/**
	 * Fired when the visible plane changes (drilling into a collapsed
	 * sub-process or navigating back). Both ids are DI plane `bpmnElement`s.
	 */
	"plane:change": (fromPlaneId: string, toPlaneId: string) => void
}

/** A DI plane the canvas can display (a process/collaboration or sub-process). */
export interface PlaneInfo {
	/** The plane's `bpmnElement` id (process, collaboration, or sub-process id). */
	id: string
	/** A human-readable label (element name, or a fallback). */
	name: string
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

	/** HTML overlays anchored to diagram elements. */
	readonly overlays: OverlayManager

	/** Adds a CSS class to the element with the given BPMN id. No-op if not found. */
	addMarker(id: string, cls: string): void

	/** Removes a CSS class from the element with the given BPMN id. */
	removeMarker(id: string, cls: string): void

	/** Returns whether the element with the given id currently has the CSS class. */
	hasMarker(id: string, cls: string): boolean

	/** Toggles a CSS class on the element with the given id. */
	toggleMarker(id: string, cls: string): void

	/**
	 * Adjusts the zoom. Pass `"fit"` (or no argument) to fit the whole diagram;
	 * pass a number for an absolute scale, optionally keeping `center`
	 * (screen-space pixels relative to the host) fixed.
	 */
	zoom(scaleOrFit?: number | "fit", center?: { x: number; y: number }): void

	/** Returns the visible region in diagram coordinates plus the zoom scale. */
	viewbox(): Viewbox

	/** Pans (without changing zoom) so the element with the given id is centred. */
	scrollToElement(id: string): void

	/**
	 * Returns the element's bounding box in screen pixels relative to the host,
	 * or `null` if the element is not found.
	 */
	getAbsoluteBBox(id: string): ScreenBox | null

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
