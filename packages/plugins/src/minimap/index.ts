/**
 * @bpmn-sdk/canvas-plugin-minimap — minimap navigation plugin for `@bpmn-sdk/canvas`.
 *
 * Adds a 160×100 overview panel in the bottom-right corner of the canvas.
 * Clicking the minimap pans the main viewport to that position.
 *
 * ## Usage
 * ```typescript
 * import { BpmnCanvas } from "@bpmn-sdk/canvas";
 * import { createMinimapPlugin } from "@bpmn-sdk/canvas-plugin-minimap";
 *
 * const canvas = new BpmnCanvas({
 *   container: document.getElementById("app")!,
 *   xml: myBpmnXml,
 *   plugins: [createMinimapPlugin()],
 * });
 * ```
 *
 * @packageDocumentation
 */

import type { CanvasPlugin } from "@bpmn-sdk/canvas";
import { injectMinimapStyles } from "./css.js";
import { Minimap } from "./minimap.js";

export { Minimap } from "./minimap.js";
export { MINIMAP_CSS, MINIMAP_STYLE_ID, injectMinimapStyles } from "./css.js";

/**
 * Creates a minimap plugin instance.
 *
 * Each call returns a fresh plugin — pass one instance per canvas.
 *
 * @example
 * ```typescript
 * const canvas = new BpmnCanvas({
 *   container,
 *   plugins: [createMinimapPlugin()],
 * });
 * ```
 */
export function createMinimapPlugin(): CanvasPlugin {
	let minimap: Minimap | null = null;
	const unsubs: Array<() => void> = [];

	return {
		name: "minimap",

		install(api) {
			injectMinimapStyles();

			minimap = new Minimap(api.container, (diagX, diagY) => {
				const { scale } = api.getViewport();
				api.setViewport({
					tx: api.svg.clientWidth / 2 - diagX * scale,
					ty: api.svg.clientHeight / 2 - diagY * scale,
				});
			});

			unsubs.push(
				api.on("diagram:load", (defs) => {
					minimap?.update(defs);
				}),
				api.on("viewport:change", (state) => {
					minimap?.syncViewport(state, api.svg.clientWidth, api.svg.clientHeight);
				}),
				api.on("diagram:clear", () => {
					minimap?.clear();
				}),
			);
		},

		uninstall() {
			for (const off of unsubs) off();
			unsubs.length = 0;
			minimap?.destroy();
			minimap = null;
		},
	};
}
