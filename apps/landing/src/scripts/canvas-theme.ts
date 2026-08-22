import type { CanvasPlugin } from "@bpmnkit/canvas"

// Skeleton BPMN flow: Start → Task → Gateway → Task → End, shown while the
// canvas lays out. Inline animation-delay staggers the pulse across shapes.
const LOADER_SVG = `<svg class="canvas-skeleton-svg" viewBox="-10 -12 350 104" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
  <line x1="34" y1="40" x2="58" y2="40" class="canvas-skeleton-edge"/>
  <line x1="122" y1="40" x2="146" y2="40" class="canvas-skeleton-edge" style="animation-delay:-0.3s"/>
  <line x1="178" y1="40" x2="202" y2="40" class="canvas-skeleton-edge" style="animation-delay:-0.6s"/>
  <line x1="266" y1="40" x2="290" y2="40" class="canvas-skeleton-edge" style="animation-delay:-0.9s"/>
  <polygon points="56,36 63,40 56,44" class="canvas-skeleton-arrow"/>
  <polygon points="144,36 151,40 144,44" class="canvas-skeleton-arrow"/>
  <polygon points="200,36 207,40 200,44" class="canvas-skeleton-arrow"/>
  <polygon points="288,36 295,40 288,44" class="canvas-skeleton-arrow"/>
  <circle cx="18" cy="40" r="16" class="canvas-skeleton-start"/>
  <rect x="58" y="26" width="64" height="28" rx="5" class="canvas-skeleton-shape" style="animation-delay:-0.4s"/>
  <polygon points="162,26 178,40 162,54 146,40" class="canvas-skeleton-gw" style="animation-delay:-0.8s"/>
  <rect x="202" y="26" width="64" height="28" rx="5" class="canvas-skeleton-shape" style="animation-delay:-1.2s"/>
  <circle cx="308" cy="40" r="16" class="canvas-skeleton-end" style="animation-delay:-1.4s"/>
</svg>`

export function createSpecThemePlugin(options?: { maxZoom?: number }): CanvasPlugin {
	let _loader: HTMLElement | null = null
	const _unsubs: Array<() => void> = []

	return {
		name: "spec-theme",

		install(api) {
			const host =
				api.svg.closest<HTMLElement>(".bpmnkit-canvas-host") ??
				(api.svg.parentElement as HTMLElement | null)
			if (!host) return

			// Landing-page palette — inline styles win over [data-theme] rules.
			// Hairline ink on paper, one accent for the focused element.
			host.style.setProperty("--bpmnkit-bg", "transparent")
			host.style.setProperty("--bpmnkit-grid", "rgba(20, 22, 26, 0.05)")
			host.style.setProperty("--bpmnkit-shape-fill", "#ffffff")
			host.style.setProperty("--bpmnkit-shape-stroke", "var(--ink, #14161a)")
			host.style.setProperty("--bpmnkit-flow-stroke", "var(--ink, #14161a)")
			host.style.setProperty("--bpmnkit-text", "var(--ink, #14161a)")
			host.style.setProperty("--bpmnkit-highlight", "var(--accent, #a8503a)")
			host.style.setProperty("--bpmnkit-focus", "var(--accent, #a8503a)")

			// Keep canvas invisible until fitView has positioned it
			host.style.opacity = "0"
			host.style.transition = "opacity 0.45s ease"

			// Skeleton loader overlay
			const loader = document.createElement("div")
			loader.className = "bpmnkit-canvas-skeleton"
			loader.innerHTML = LOADER_SVG
			api.container.appendChild(loader)
			_loader = loader

			// The canvas schedules fitView via RAF *before* emitting diagram:load.
			// Our RAF therefore queues after it in the same frame, running after fitView.
			_unsubs.push(
				api.on("diagram:load", () => {
					requestAnimationFrame(() => {
						// Clamp zoom: if the diagram is very small (e.g. a single start event),
						// fitView may produce an excessively large scale. Cap it and re-center.
						if (options?.maxZoom !== undefined) {
							const vp = api.getViewport()
							if (vp.scale > options.maxZoom) {
								const svgW = api.svg.clientWidth
								const svgH = api.svg.clientHeight
								const ratio = options.maxZoom / vp.scale
								api.setViewport({
									scale: options.maxZoom,
									tx: svgW / 2 + (vp.tx - svgW / 2) * ratio,
									ty: svgH / 2 + (vp.ty - svgH / 2) * ratio,
								})
							}
						}
						loader.style.opacity = "0"
						host.style.opacity = "1"
						_loader = null
						setTimeout(() => loader.remove(), 450)
					})
				}),
			)
		},

		uninstall() {
			for (const unsub of _unsubs) unsub()
			_unsubs.length = 0
			_loader?.remove()
			_loader = null
		},
	}
}
