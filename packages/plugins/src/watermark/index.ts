/**
 * @bpmn-sdk/canvas-plugin-watermark — bottom-right attribution bar for `@bpmn-sdk/canvas`.
 *
 * Renders configurable links and an optional logo in the bottom-right corner.
 * Links are left of the logo; the logo is always the rightmost element.
 *
 * ## Usage
 * ```typescript
 * import { BpmnCanvas } from "@bpmn-sdk/canvas";
 * import { createWatermarkPlugin } from "@bpmn-sdk/canvas-plugin-watermark";
 *
 * const canvas = new BpmnCanvas({
 *   container,
 *   plugins: [
 *     createWatermarkPlugin({
 *       links: [{ label: "GitHub", url: "https://github.com/example/repo" }],
 *       logo: myLogoSvgString,
 *     }),
 *   ],
 * });
 * ```
 *
 * @packageDocumentation
 */

import type { CanvasPlugin } from "@bpmn-sdk/canvas";
import { injectWatermarkStyles } from "./css.js";

export { WATERMARK_CSS, WATERMARK_STYLE_ID, injectWatermarkStyles } from "./css.js";

/** A single navigable link rendered in the watermark bar. */
export interface WatermarkLink {
	label: string;
	url: string;
}

/** Options for {@link createWatermarkPlugin}. */
export interface WatermarkOptions {
	/** Links to display, in order from left to right. */
	links?: WatermarkLink[];
	/**
	 * Square SVG markup string for the logo, rendered rightmost.
	 * Must be a self-contained `<svg>` element.
	 */
	logo?: string;
}

/**
 * Creates a watermark plugin instance.
 *
 * Each call returns a fresh plugin — pass one instance per canvas.
 */
export function createWatermarkPlugin(options: WatermarkOptions = {}): CanvasPlugin {
	let host: HTMLDivElement | null = null;

	return {
		name: "watermark",

		install(api) {
			injectWatermarkStyles();

			host = document.createElement("div");
			host.className = "bpmn-watermark";
			host.setAttribute("aria-label", "Attribution");

			for (const link of options.links ?? []) {
				const a = document.createElement("a");
				a.className = "bpmn-watermark-link";
				a.href = link.url;
				a.target = "_blank";
				a.rel = "noopener noreferrer";
				a.textContent = link.label;
				host.appendChild(a);
			}

			if (options.logo) {
				const logoDiv = document.createElement("div");
				logoDiv.className = "bpmn-watermark-logo";
				logoDiv.innerHTML = options.logo;
				host.appendChild(logoDiv);
			}

			api.container.appendChild(host);
		},

		uninstall() {
			host?.remove();
			host = null;
		},
	};
}
