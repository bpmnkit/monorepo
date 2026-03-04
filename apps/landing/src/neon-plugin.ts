import type { CanvasPlugin } from "@bpmn-sdk/canvas";

/**
 * Applies a neon dark color scheme to the canvas for the hero preview.
 * Overrides the CSS variables on the host element so the neon palette
 * takes effect regardless of the active `data-theme`.
 */
export function createNeonThemePlugin(): CanvasPlugin {
	return {
		name: "neon-theme",
		install(api) {
			// CSS variables are declared on .bpmn-canvas-host; inline styles
			// on that element win over any theme CSS rule.
			const host =
				api.svg.closest<HTMLElement>(".bpmn-canvas-host") ??
				(api.svg.parentElement as HTMLElement | null);
			if (!host) return;

			host.style.setProperty("--bpmn-bg", "transparent");
			host.style.setProperty("--bpmn-grid", "oklch(55% 0.04 270 / 0.12)");
			host.style.setProperty("--bpmn-shape-fill", "oklch(6% 0.03 270 / 0.8)");
			host.style.setProperty("--bpmn-shape-stroke", "oklch(65% 0.28 280)");
			host.style.setProperty("--bpmn-flow-stroke", "oklch(72% 0.18 185)");
			host.style.setProperty("--bpmn-text", "oklch(88% 0.02 270)");
			host.style.setProperty("--bpmn-highlight", "oklch(72% 0.18 185)");
			host.style.setProperty("--bpmn-focus", "oklch(72% 0.18 185)");
		},
	};
}
