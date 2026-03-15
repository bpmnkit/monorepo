/**
 * @bpmnkit/canvas — a high-performance, accessible BPMN 2.0 diagram viewer.
 *
 * ## Features
 * - **Zero external dependencies** (only `@bpmnkit/core` for XML parsing)
 * - **Infinite canvas** with pan and zoom (mouse, touch, keyboard)
 * - **Dot-grid background** for visual orientation
 * - **Light / dark / auto theming** via CSS custom properties
 * - **First-class accessibility** — ARIA roles, keyboard navigation, focus management
 * - **Framework-agnostic** — plain DOM, works in React, Vue, Svelte, Angular, or vanilla JS
 * - **Plugin system** — extend with editing, tooltips, minimap, custom shapes, and more
 *
 * ## Quick start
 * ```typescript
 * import { BpmnCanvas } from "@bpmnkit/canvas";
 *
 * const canvas = new BpmnCanvas({
 *   container: document.getElementById("app")!,
 *   xml: myBpmnXml,       // BPMN 2.0 XML string
 *   theme: "auto",        // follows OS preference
 *   grid: true,           // dot-grid background
 *   fit: "contain",       // scale to fit on load
 * });
 *
 * // Listen to events
 * canvas.on("element:click", (id) => console.log("clicked", id));
 *
 * // Programmatic control
 * canvas.fitView();
 * canvas.zoomIn();
 * canvas.setTheme("dark");
 *
 * // Always clean up
 * canvas.destroy();
 * ```
 *
 * ## Embedding in React
 * ```tsx
 * function BpmnViewer({ xml }: { xml: string }) {
 *   const ref = useRef<HTMLDivElement>(null);
 *   useEffect(() => {
 *     if (!ref.current) return;
 *     const canvas = new BpmnCanvas({ container: ref.current, xml });
 *     return () => canvas.destroy();
 *   }, [xml]);
 *   return <div ref={ref} style={{ width: "100%", height: "500px" }} />;
 * }
 * ```
 *
 * ## Plugin example
 * ```typescript
 * const tooltipPlugin: CanvasPlugin = {
 *   name: "tooltips",
 *   install(api) {
 *     api.on("element:click", (id) => {
 *       const shape = api.getShapes().find((s) => s.id === id);
 *       alert(shape?.flowElement?.name ?? id);
 *     });
 *   },
 * };
 * const canvas = new BpmnCanvas({ container, plugins: [tooltipPlugin] });
 * ```
 *
 * @packageDocumentation
 */

export { BpmnCanvas } from "./canvas.js"
export type {
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

// Internal exports for use by @bpmnkit/editor
export { ViewportController } from "./viewport.js"
export { render, computeDiagramBounds, createDefs, createGrid } from "./renderer.js"
export { KeyboardHandler } from "./keyboard.js"
export { injectStyles, CANVAS_CSS, STYLE_ID } from "./css.js"
