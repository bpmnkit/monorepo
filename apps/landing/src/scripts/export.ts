import type { CanvasApi } from "@bpmnkit/canvas"

// ── Theme resolution ─────────────────────────────────────────────────────────

interface Colors {
	bg: string
	shapeFill: string
	shapeStroke: string
	flowStroke: string
	text: string
}

const LIGHT: Colors = {
	bg: "#f8f9fa",
	shapeFill: "#ffffff",
	shapeStroke: "#404040",
	flowStroke: "#404040",
	text: "#333333",
}

const DARK: Colors = {
	bg: "#1e1e2e",
	shapeFill: "#2a2a3e",
	shapeStroke: "#8888bb",
	flowStroke: "#7777aa",
	text: "#cdd6f4",
}

function resolveColors(api: CanvasApi): Colors {
	const t = api.getTheme()
	if (t === "dark") return DARK
	if (t === "light") return LIGHT
	return window.matchMedia("(prefers-color-scheme: dark)").matches ? DARK : LIGHT
}

// ── Inline CSS (no CSS variables — works in any SVG viewer) ─────────────────

function buildInlineCss(c: Colors): string {
	return `
.bpmnkit-shape-body,.bpmnkit-event-body,.bpmnkit-gw-body{fill:${c.shapeFill};stroke:${c.shapeStroke};stroke-width:1.5}
.bpmnkit-end-body{fill:${c.shapeFill};stroke:${c.shapeStroke};stroke-width:3}
.bpmnkit-event-inner{fill:none;stroke:${c.shapeStroke};stroke-width:1.5}
.bpmnkit-event-inner-dashed{fill:none;stroke:${c.shapeStroke};stroke-width:1.5;stroke-dasharray:4 2}
.bpmnkit-eventsubprocess-body{fill:${c.shapeFill};stroke:${c.shapeStroke};stroke-width:1.5;stroke-dasharray:5 3}
.bpmnkit-callactivity-body{fill:${c.shapeFill};stroke:${c.shapeStroke};stroke-width:3}
.bpmnkit-icon{fill:none;stroke:${c.shapeStroke};stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
.bpmnkit-icon-solid{fill:${c.shapeStroke};stroke:none}
.bpmnkit-gw-marker{fill:${c.shapeStroke};stroke:none}
.bpmnkit-gw-marker-stroke{fill:none;stroke:${c.shapeStroke};stroke-width:2.5;stroke-linecap:round}
.bpmnkit-pool-body,.bpmnkit-lane-body{fill:${c.shapeFill};stroke:${c.shapeStroke};stroke-width:1.5}
.bpmnkit-pool-header,.bpmnkit-lane-header{fill:rgba(0,0,0,0.04);stroke:${c.shapeStroke};stroke-width:1.5}
.bpmnkit-edge-path{fill:none;stroke:${c.flowStroke};stroke-width:1.5}
.bpmnkit-edge-assoc{fill:none;stroke:${c.flowStroke};stroke-width:1.5;stroke-dasharray:5 3}
.bpmnkit-edge-default-slash{stroke:${c.flowStroke};stroke-width:1.5}
.bpmnkit-msgflow-path{fill:none;stroke:${c.flowStroke};stroke-width:1.5;stroke-dasharray:6 3}
.bpmnkit-arrow-fill{fill:${c.flowStroke}}
.bpmnkit-label{fill:${c.text};font-family:system-ui,-apple-system,sans-serif;font-size:11px;text-anchor:middle;dominant-baseline:central;paint-order:stroke;stroke:${c.bg};stroke-width:4px;stroke-linejoin:round}
`
}

// ── SVG clone builder ────────────────────────────────────────────────────────

const SVG_NS = "http://www.w3.org/2000/svg"

interface ExportSvg {
	clone: SVGSVGElement
	width: number
	height: number
}

function buildExportSvg(api: CanvasApi, title: string): ExportSvg {
	const bbox = api.viewportEl.getBBox()
	if (bbox.width === 0 && bbox.height === 0) {
		throw new Error("Nothing to export — diagram is empty.")
	}

	const pad = 20
	const vx = bbox.x - pad
	const vy = bbox.y - pad
	const vw = bbox.width + 2 * pad
	const vh = bbox.height + 2 * pad
	const w = Math.ceil(vw)
	const h = Math.ceil(vh)

	const colors = resolveColors(api)

	// Deep-clone the live SVG
	const clone = api.svg.cloneNode(true) as SVGSVGElement

	// Remove the dot-grid background rect (fill="url(#bpmnkit-grid-…)")
	for (const rect of clone.querySelectorAll<SVGRectElement>("rect")) {
		if (rect.getAttribute("fill")?.startsWith("url(#bpmnkit-grid")) {
			rect.remove()
			break
		}
	}

	// Remove the grid <pattern> from <defs> (no longer needed)
	for (const pat of clone.querySelectorAll<SVGPatternElement>("pattern")) {
		if (pat.id.startsWith("bpmnkit-grid-")) {
			pat.remove()
			break
		}
	}

	// Find the viewport <g> (only direct <g> child of the SVG root)
	const viewportG = Array.from(clone.children).find((el) => el.tagName === "g")

	// Reset the viewport pan/zoom transform — content lives in diagram coordinates
	viewportG?.setAttribute("transform", "")

	// Remove editor-only elements that exist solely for interactivity
	for (const el of clone.querySelectorAll(".bpmnkit-edge-hitarea")) {
		el.remove()
	}

	// Remove interactive state classes that shouldn't appear in static exports
	for (const el of clone.querySelectorAll(
		".bpmnkit-selected,.bpmnkit-token-active,.bpmnkit-token-visited,.bpmnkit-token-edge-active,.bpmnkit-token-edge-visited",
	)) {
		for (const cls of [
			"bpmnkit-selected",
			"bpmnkit-token-active",
			"bpmnkit-token-visited",
			"bpmnkit-token-edge-active",
			"bpmnkit-token-edge-visited",
		]) {
			el.classList.remove(cls)
		}
	}

	// ── Inline critical presentation attributes ──────────────────────────────
	// SVG path elements default to fill="black". For straight edges this is
	// invisible (no enclosed area), but L/Z-shaped paths enclose a region that
	// renders as a solid black triangle when fill isn't explicitly none.
	// CSS inside <style> may not apply reliably when SVG is rendered via
	// <img> for canvas-based PNG conversion, so we set the attributes directly.
	for (const el of clone.querySelectorAll<SVGElement>(
		".bpmnkit-edge-path,.bpmnkit-edge-assoc,.bpmnkit-msgflow-path,.bpmnkit-edge-default-slash,.bpmnkit-icon,.bpmnkit-event-inner,.bpmnkit-event-inner-dashed,.bpmnkit-gw-marker-stroke",
	)) {
		el.setAttribute("fill", "none")
	}
	for (const el of clone.querySelectorAll<SVGElement>(".bpmnkit-arrow-fill")) {
		el.setAttribute("fill", colors.flowStroke)
	}
	for (const el of clone.querySelectorAll<SVGElement>(".bpmnkit-gw-marker,.bpmnkit-icon-solid")) {
		el.setAttribute("fill", colors.shapeStroke)
	}

	// Insert <title> as first child (improves accessibility in SVG viewers)
	const titleEl = document.createElementNS(SVG_NS, "title")
	titleEl.textContent = title
	clone.insertBefore(titleEl, clone.firstChild)

	// Insert inline <style> after <title>
	const styleEl = document.createElementNS(SVG_NS, "style")
	styleEl.textContent = buildInlineCss(colors)
	titleEl.insertAdjacentElement("afterend", styleEl)

	// Insert background <rect> just before the viewport group
	const bgRect = document.createElementNS(SVG_NS, "rect")
	bgRect.setAttribute("x", String(vx))
	bgRect.setAttribute("y", String(vy))
	bgRect.setAttribute("width", String(vw))
	bgRect.setAttribute("height", String(vh))
	bgRect.setAttribute("fill", colors.bg)
	if (viewportG) {
		clone.insertBefore(bgRect, viewportG)
	} else {
		clone.appendChild(bgRect)
	}

	// Set root SVG attributes for standalone use
	clone.setAttribute("xmlns", SVG_NS)
	clone.setAttribute("viewBox", `${vx} ${vy} ${vw} ${vh}`)
	clone.setAttribute("width", String(w))
	clone.setAttribute("height", String(h))
	clone.removeAttribute("aria-hidden")

	return { clone, width: w, height: h }
}

// ── Download helper ──────────────────────────────────────────────────────────

function triggerDownload(url: string, filename: string): void {
	const a = document.createElement("a")
	a.href = url
	a.download = filename
	a.style.display = "none"
	document.body.appendChild(a)
	a.click()
	document.body.removeChild(a)
}

// ── Public API ───────────────────────────────────────────────────────────────

export function saveSvg(api: CanvasApi, name: string): void {
	const { clone } = buildExportSvg(api, name)
	const xml = new XMLSerializer().serializeToString(clone)
	const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" })
	const url = URL.createObjectURL(blob)
	triggerDownload(url, `${name}.svg`)
	setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * Export the diagram as a PNG at 2× resolution (retina-friendly).
 *
 * Strategy: render the export SVG into an off-screen <canvas> via an
 * HTMLImageElement, then export the canvas pixels as a PNG blob.
 * No external libraries required — all standard browser APIs.
 */
export function savePng(api: CanvasApi, name: string): void {
	const { clone, width, height } = buildExportSvg(api, name)
	const xml = new XMLSerializer().serializeToString(clone)
	const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" })
	const svgUrl = URL.createObjectURL(blob)

	const img = new Image()
	img.onload = () => {
		const scale = 2 // 2× for crisp retina output
		const canvas = document.createElement("canvas")
		canvas.width = width * scale
		canvas.height = height * scale

		const ctx = canvas.getContext("2d")
		if (!ctx) {
			URL.revokeObjectURL(svgUrl)
			return
		}

		ctx.scale(scale, scale)
		ctx.drawImage(img, 0, 0, width, height)
		URL.revokeObjectURL(svgUrl)

		canvas.toBlob((pngBlob) => {
			if (!pngBlob) return
			const pngUrl = URL.createObjectURL(pngBlob)
			triggerDownload(pngUrl, `${name}.png`)
			setTimeout(() => URL.revokeObjectURL(pngUrl), 60_000)
		}, "image/png")
	}
	img.onerror = () => URL.revokeObjectURL(svgUrl)
	img.src = svgUrl
}
