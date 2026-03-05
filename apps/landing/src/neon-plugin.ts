import type { CanvasPlugin } from "@bpmn-sdk/canvas";

// Skeleton BPMN flow: Start → Task → Gateway → Task → End
// Uses inline animation-delay to stagger the pulse wave across shapes.
const LOADER_SVG = `<svg class="neon-loader-svg" viewBox="-10 -12 350 104" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
  <line x1="34" y1="40" x2="58" y2="40" class="neon-loader-edge"/>
  <line x1="122" y1="40" x2="146" y2="40" class="neon-loader-edge" style="animation-delay:-0.3s"/>
  <line x1="178" y1="40" x2="202" y2="40" class="neon-loader-edge" style="animation-delay:-0.6s"/>
  <line x1="266" y1="40" x2="290" y2="40" class="neon-loader-edge" style="animation-delay:-0.9s"/>
  <polygon points="56,36 63,40 56,44" class="neon-loader-arrow"/>
  <polygon points="144,36 151,40 144,44" class="neon-loader-arrow"/>
  <polygon points="200,36 207,40 200,44" class="neon-loader-arrow"/>
  <polygon points="288,36 295,40 288,44" class="neon-loader-arrow"/>
  <circle cx="18" cy="40" r="16" class="neon-loader-start"/>
  <rect x="58" y="26" width="64" height="28" rx="5" class="neon-loader-shape" style="animation-delay:-0.4s"/>
  <polygon points="162,26 178,40 162,54 146,40" class="neon-loader-gw" style="animation-delay:-0.8s"/>
  <rect x="202" y="26" width="64" height="28" rx="5" class="neon-loader-shape" style="animation-delay:-1.2s"/>
  <circle cx="308" cy="40" r="16" class="neon-loader-end" style="animation-delay:-1.4s"/>
</svg>`;

export function createNeonThemePlugin(options?: { maxZoom?: number }): CanvasPlugin {
	let _loader: HTMLElement | null = null;
	const _unsubs: Array<() => void> = [];

	return {
		name: "neon-theme",

		install(api) {
			const host =
				api.svg.closest<HTMLElement>(".bpmn-canvas-host") ??
				(api.svg.parentElement as HTMLElement | null);
			if (!host) return;

			// Neon color overrides — inline styles win over [data-theme] rules
			host.style.setProperty("--bpmn-bg", "transparent");
			host.style.setProperty("--bpmn-grid", "oklch(55% 0.04 270 / 0.12)");
			host.style.setProperty("--bpmn-shape-fill", "oklch(6% 0.03 270 / 0.8)");
			host.style.setProperty("--bpmn-shape-stroke", "oklch(65% 0.28 280)");
			host.style.setProperty("--bpmn-flow-stroke", "oklch(72% 0.18 185)");
			host.style.setProperty("--bpmn-text", "oklch(88% 0.02 270)");
			host.style.setProperty("--bpmn-highlight", "oklch(72% 0.18 185)");
			host.style.setProperty("--bpmn-focus", "oklch(72% 0.18 185)");

			// Keep canvas invisible until fitView has positioned it
			host.style.opacity = "0";
			host.style.transition = "opacity 0.45s ease";

			// Skeleton loader overlay
			const loader = document.createElement("div");
			loader.className = "bpmn-neon-loader";
			loader.innerHTML = LOADER_SVG;
			api.container.appendChild(loader);
			_loader = loader;

			// The canvas schedules fitView via RAF *before* emitting diagram:load.
			// Our RAF therefore queues after it in the same frame, running after fitView.
			_unsubs.push(
				api.on("diagram:load", () => {
					requestAnimationFrame(() => {
						// Clamp zoom: if the diagram is very small (e.g. a single start event),
						// fitView may produce an excessively large scale. Cap it and re-center.
						if (options?.maxZoom !== undefined) {
							const vp = api.getViewport();
							if (vp.scale > options.maxZoom) {
								const svgW = api.svg.clientWidth;
								const svgH = api.svg.clientHeight;
								const ratio = options.maxZoom / vp.scale;
								api.setViewport({
									scale: options.maxZoom,
									tx: svgW / 2 + (vp.tx - svgW / 2) * ratio,
									ty: svgH / 2 + (vp.ty - svgH / 2) * ratio,
								});
							}
						}
						loader.style.opacity = "0";
						host.style.opacity = "1";
						_loader = null;
						setTimeout(() => loader.remove(), 450);
					});
				}),
			);
		},

		uninstall() {
			for (const unsub of _unsubs) unsub();
			_unsubs.length = 0;
			_loader?.remove();
			_loader = null;
		},
	};
}
