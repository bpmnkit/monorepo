/**
 * @bpmn-sdk/canvas-plugin-zoom-controls — zoom controls plugin for `@bpmn-sdk/canvas`.
 *
 * Adds +, −, and fit-diagram buttons in the bottom-left corner of the canvas.
 *
 * ## Usage
 * ```typescript
 * import { BpmnCanvas } from "@bpmn-sdk/canvas";
 * import { createZoomControlsPlugin } from "@bpmn-sdk/canvas-plugin-zoom-controls";
 *
 * const canvas = new BpmnCanvas({
 *   container: document.getElementById("app")!,
 *   xml: myBpmnXml,
 *   plugins: [createZoomControlsPlugin()],
 * });
 * ```
 *
 * @packageDocumentation
 */

import type { CanvasPlugin } from "@bpmn-sdk/canvas";
import { injectZoomControlsStyles } from "./css.js";

export { ZOOM_CONTROLS_CSS, ZOOM_CONTROLS_STYLE_ID, injectZoomControlsStyles } from "./css.js";

const MIN_SCALE = 0.05;
const MAX_SCALE = 10;
const FIT_PADDING = 40;

/**
 * Creates a zoom controls plugin instance.
 *
 * Each call returns a fresh plugin — pass one instance per canvas.
 *
 * @example
 * ```typescript
 * const canvas = new BpmnCanvas({
 *   container,
 *   plugins: [createZoomControlsPlugin()],
 * });
 * ```
 */
export function createZoomControlsPlugin(): CanvasPlugin {
	let controlsEl: HTMLDivElement | null = null;

	return {
		name: "zoom-controls",

		install(api) {
			injectZoomControlsStyles();

			function zoomAt(factor: number): void {
				const { tx, ty, scale } = api.getViewport();
				const cx = api.svg.clientWidth / 2;
				const cy = api.svg.clientHeight / 2;
				const newScale = Math.min(Math.max(scale * factor, MIN_SCALE), MAX_SCALE);
				const ratio = newScale / scale;
				api.setViewport({
					tx: cx - (cx - tx) * ratio,
					ty: cy - (cy - ty) * ratio,
					scale: newScale,
				});
			}

			function fitView(): void {
				const shapes = api.getShapes();
				if (shapes.length === 0) return;
				let minX = Number.POSITIVE_INFINITY;
				let minY = Number.POSITIVE_INFINITY;
				let maxX = Number.NEGATIVE_INFINITY;
				let maxY = Number.NEGATIVE_INFINITY;
				for (const s of shapes) {
					const b = s.shape.bounds;
					if (b.x < minX) minX = b.x;
					if (b.y < minY) minY = b.y;
					if (b.x + b.width > maxX) maxX = b.x + b.width;
					if (b.y + b.height > maxY) maxY = b.y + b.height;
				}
				const svgW = api.svg.clientWidth;
				const svgH = api.svg.clientHeight;
				const dw = maxX - minX;
				const dh = maxY - minY;
				const scale = Math.min((svgW - FIT_PADDING * 2) / dw, (svgH - FIT_PADDING * 2) / dh, 2);
				api.setViewport({
					tx: (svgW - dw * scale) / 2 - minX * scale,
					ty: (svgH - dh * scale) / 2 - minY * scale,
					scale,
				});
			}

			const controls = document.createElement("div");
			controls.className = "bpmn-controls";
			controls.setAttribute("aria-label", "Zoom controls");

			const makeBtn = (label: string, title: string, onClick: () => void): HTMLButtonElement => {
				const btn = document.createElement("button");
				btn.className = "bpmn-control-btn";
				btn.type = "button";
				btn.textContent = label;
				btn.setAttribute("aria-label", title);
				btn.title = title;
				btn.addEventListener("click", onClick);
				return btn;
			};

			controls.appendChild(makeBtn("+", "Zoom in", () => zoomAt(1.25)));
			controls.appendChild(makeBtn("−", "Zoom out", () => zoomAt(0.8)));
			controls.appendChild(makeBtn("⊡", "Fit diagram", fitView));

			api.container.appendChild(controls);
			controlsEl = controls;
		},

		uninstall() {
			controlsEl?.remove();
			controlsEl = null;
		},
	};
}
