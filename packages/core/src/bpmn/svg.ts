import type {
	BpmnDefinitions,
	BpmnFlowElement,
	BpmnLane,
	BpmnParticipant,
	BpmnSequenceFlow,
	BpmnTextAnnotation,
} from "./bpmn-model.js"

// ── Theme ─────────────────────────────────────────────────────────────────────

interface Theme {
	bg: string
	shapeFill: string
	shapeStroke: string
	flowStroke: string
	text: string
	poolHeader: string
	textHalo: string
}

const LIGHT: Theme = {
	bg: "#f8f9fa",
	shapeFill: "#ffffff",
	shapeStroke: "#404040",
	flowStroke: "#404040",
	text: "#333333",
	poolHeader: "rgba(0,0,0,0.04)",
	textHalo: "#f8f9fa",
}

const DARK: Theme = {
	bg: "#1e1e2e",
	shapeFill: "#2a2a3e",
	shapeStroke: "#8888bb",
	flowStroke: "#7777aa",
	text: "#cdd6f4",
	poolHeader: "rgba(255,255,255,0.06)",
	textHalo: "#1e1e2e",
}

// ── Public API ─────────────────────────────────────────────────────────────────

export interface SvgExportOptions {
	/** Visual theme. Default: "light". */
	theme?: "light" | "dark"
	/** Padding around the diagram content in pixels. Default: 20. */
	padding?: number
}

/**
 * Generates a self-contained SVG string from a `BpmnDefinitions` object.
 *
 * The definitions must already contain diagram interchange (DI) position data —
 * i.e. they were produced by `.withAutoLayout().build()` or parsed from BPMN
 * XML that includes `<bpmndi:BPMNDiagram>` elements.
 *
 * Works in every environment (Node.js, browsers, Deno, Bun, edge runtimes) with
 * zero external dependencies. Returns a standalone SVG string that can be written
 * to a file, embedded in HTML, or converted to PNG via a canvas API.
 *
 * @example
 * ```ts
 * import { Bpmn, exportSvg } from "@bpmnkit/core"
 *
 * const defs = Bpmn.createProcess("order")
 *   .startEvent("start")
 *   .serviceTask("process", { name: "Process Order", taskType: "process" })
 *   .endEvent("end")
 *   .withAutoLayout()
 *   .build()
 *
 * const svg = exportSvg(defs)                         // light theme
 * const dark = exportSvg(defs, { theme: "dark" })     // dark theme
 * ```
 */
export function exportSvg(defs: BpmnDefinitions, options?: SvgExportOptions): string {
	const t = options?.theme === "dark" ? DARK : LIGHT
	const padding = options?.padding ?? 20

	const plane = defs.diagrams[0]?.plane
	if (!plane) return emptySvg(t)

	// Build model index for name/type lookups
	const idx = buildIndex(defs)

	// ── Bounding box ──────────────────────────────────────────────────────────
	let minX = Number.POSITIVE_INFINITY
	let minY = Number.POSITIVE_INFINITY
	let maxX = Number.NEGATIVE_INFINITY
	let maxY = Number.NEGATIVE_INFINITY

	for (const shape of plane.shapes) {
		const { x, y, width, height } = shape.bounds
		minX = Math.min(minX, x)
		minY = Math.min(minY, y)
		maxX = Math.max(maxX, x + width)
		maxY = Math.max(maxY, y + height)
	}
	for (const edge of plane.edges) {
		for (const wp of edge.waypoints) {
			minX = Math.min(minX, wp.x)
			minY = Math.min(minY, wp.y)
			maxX = Math.max(maxX, wp.x)
			maxY = Math.max(maxY, wp.y)
		}
	}

	if (!Number.isFinite(minX)) return emptySvg(t)

	const ox = minX - padding
	const oy = minY - padding
	const vw = maxX - minX + padding * 2
	const vh = maxY - minY + padding * 2

	// ── Edges ─────────────────────────────────────────────────────────────────
	const edgeParts: string[] = []
	for (const edge of plane.edges) {
		if (edge.waypoints.length < 2) continue
		const flow = idx.flows.get(edge.bpmnElement)
		const isMsg = idx.messageFlowIds.has(edge.bpmnElement)
		const isAssoc = !flow && !isMsg

		const d = waypointsToPath(edge.waypoints)
		const strokeColor = t.flowStroke
		const sw = 1.5

		if (isAssoc) {
			edgeParts.push(
				`<path d="${d}" fill="none" stroke="${strokeColor}" stroke-width="${sw}" stroke-dasharray="5 3"/>`,
			)
			continue
		}

		const dashArray = isMsg ? ' stroke-dasharray="6 3"' : ""
		edgeParts.push(
			`<path d="${d}" fill="none" stroke="${strokeColor}" stroke-width="${sw}"${dashArray} marker-end="url(#arr)"/>`,
		)

		// Default-flow slash
		if (flow && idx.defaultFlowIds.has(edge.bpmnElement)) {
			const wp0 = edge.waypoints[0]
			const wp1 = edge.waypoints[1]
			if (wp0 && wp1) {
				const dx = wp1.x - wp0.x
				const dy = wp1.y - wp0.y
				const len = Math.sqrt(dx * dx + dy * dy)
				if (len > 0) {
					const nx = dx / len
					const ny = dy / len
					const tDist = Math.min(10, len * 0.25)
					const cx = wp0.x + nx * tDist
					const cy = wp0.y + ny * tDist
					const s = 5
					edgeParts.push(
						`<line x1="${cx - ny * s}" y1="${cy + nx * s}" x2="${cx + ny * s}" y2="${cy - nx * s}" stroke="${strokeColor}" stroke-width="${sw}"/>`,
					)
				}
			}
		}

		// Edge label
		if (flow?.name && edge.label?.bounds) {
			const { x, y, width, height } = edge.label.bounds
			edgeParts.push(labelSvg(flow.name, x + width / 2, y + height / 2, width - 4, t))
		}
	}

	// ── Shapes ────────────────────────────────────────────────────────────────
	const shapeParts: string[] = []
	const labelParts: string[] = []

	for (const shape of plane.shapes) {
		const { x, y, width, height } = shape.bounds
		const el = idx.elements.get(shape.bpmnElement)
		const type = el?.type ?? ""

		let inner: string

		if (isEvent(type)) {
			inner = renderEvent(el, width, height, t)
		} else if (isGateway(type)) {
			inner = renderGateway(el, width, height, t)
		} else if (type === "" && !el) {
			// Pool, lane, or annotation
			const annotation = idx.annotations.get(shape.bpmnElement)
			if (annotation !== undefined) {
				inner = renderAnnotation(annotation.text, width, height, t)
			} else if (idx.participants.has(shape.bpmnElement)) {
				inner = renderPool(idx.participants.get(shape.bpmnElement), width, height, t)
			} else if (idx.lanes.has(shape.bpmnElement)) {
				inner = renderLane(idx.lanes.get(shape.bpmnElement), width, height, t)
			} else {
				inner = ""
			}
		} else {
			inner = renderTask(el, width, height, t)
		}

		if (inner) {
			shapeParts.push(`<g transform="translate(${x} ${y})">${inner}</g>`)
		}

		// External labels for events and gateways
		const isExtLabel = isEvent(type) || isGateway(type)
		if (el?.name && isExtLabel) {
			const lb = shape.label?.bounds ?? {
				x: shape.bounds.x + shape.bounds.width / 2 - 40,
				y: shape.bounds.y + shape.bounds.height + 6,
				width: 80,
				height: 20,
			}
			labelParts.push(
				labelSvg(el.name, lb.x + lb.width / 2, lb.y + lb.height / 2, lb.width - 4, t, true),
			)
		}
	}

	// ── Assemble SVG ──────────────────────────────────────────────────────────
	const bgStyle = `fill="${t.bg}"`
	const arrowFill = t.flowStroke

	return [
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ox} ${oy} ${vw} ${vh}" width="${vw}" height="${vh}">`,
		`<rect x="${ox}" y="${oy}" width="${vw}" height="${vh}" ${bgStyle}/>`,
		"<defs>",
		`  <marker id="arr" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">`,
		`    <path d="M0,0 L8,3 L0,6 Z" fill="${arrowFill}"/>`,
		"  </marker>",
		"</defs>",
		...edgeParts,
		...shapeParts,
		...labelParts,
		"</svg>",
	].join("\n")
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptySvg(t: Theme): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" width="1" height="1"><rect width="1" height="1" fill="${t.bg}"/></svg>`
}

function isEvent(type: string): boolean {
	return (
		type === "startEvent" ||
		type === "endEvent" ||
		type === "intermediateCatchEvent" ||
		type === "intermediateThrowEvent" ||
		type === "boundaryEvent"
	)
}

function isGateway(type: string): boolean {
	return (
		type === "exclusiveGateway" ||
		type === "parallelGateway" ||
		type === "inclusiveGateway" ||
		type === "eventBasedGateway" ||
		type === "complexGateway"
	)
}

// ── Text ──────────────────────────────────────────────────────────────────────

const AVG_CHAR_PX = 6.5

function wrapText(text: string, maxPx: number): string[] {
	if (!text.trim()) return []
	const words = text.split(/\s+/)
	const lines: string[] = []
	let line = ""
	for (const word of words) {
		const candidate = line ? `${line} ${word}` : word
		if (candidate.length * AVG_CHAR_PX <= maxPx) {
			line = candidate
		} else if (line) {
			lines.push(line)
			line = word
		} else {
			line = word
		}
	}
	if (line) lines.push(line)
	return lines.length > 0 ? lines : [text]
}

function esc(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
}

function textStyle(t: Theme): string {
	return `fill:${t.text};font-family:system-ui,-apple-system,sans-serif;font-size:11px;text-anchor:middle;dominant-baseline:central;paint-order:stroke;stroke:${t.textHalo};stroke-width:4px;stroke-linejoin:round`
}

/**
 * Generates SVG text element(s) for a label centred at (cx, cy).
 * topAlign=true makes multi-line text flow downward from cy rather than
 * being centred around it — prevents long labels from overlapping the shape above.
 */
function labelSvg(
	text: string,
	cx: number,
	cy: number,
	maxWidth: number,
	t: Theme,
	topAlign = false,
): string {
	const lines = wrapText(text, maxWidth)
	const lineH = 14
	const style = textStyle(t)
	if (lines.length === 1) {
		return `<text style="${style}" x="${cx}" y="${cy}">${esc(lines[0] ?? text)}</text>`
	}
	const totalH = lines.length * lineH
	const startY = topAlign ? cy + lineH / 2 : cy - totalH / 2 + lineH / 2
	return lines
		.map((l, i) => `<text style="${style}" x="${cx}" y="${startY + i * lineH}">${esc(l)}</text>`)
		.join("")
}

// ── Path ──────────────────────────────────────────────────────────────────────

function waypointsToPath(wps: ReadonlyArray<{ x: number; y: number }>): string {
	if (wps.length < 2) return ""
	const r = 4
	const parts: string[] = []
	for (let i = 0; i < wps.length; i++) {
		const wp = wps[i]
		if (!wp) continue
		if (i === 0) {
			parts.push(`M${wp.x},${wp.y}`)
			continue
		}
		if (i === wps.length - 1) {
			parts.push(`L${wp.x},${wp.y}`)
			continue
		}
		const prev = wps[i - 1]
		const next = wps[i + 1]
		if (!prev || !next) continue
		const dx1 = wp.x - prev.x
		const dy1 = wp.y - prev.y
		const d1 = Math.sqrt(dx1 * dx1 + dy1 * dy1)
		const dx2 = next.x - wp.x
		const dy2 = next.y - wp.y
		const d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2)
		if (d1 < 0.01 || d2 < 0.01) {
			parts.push(`L${wp.x},${wp.y}`)
			continue
		}
		const radius = Math.min(r, d1 / 2, d2 / 2)
		const ax = wp.x - (dx1 / d1) * radius
		const ay = wp.y - (dy1 / d1) * radius
		const bx = wp.x + (dx2 / d2) * radius
		const by = wp.y + (dy2 / d2) * radius
		parts.push(`L${ax},${ay}`)
		parts.push(`Q${wp.x},${wp.y} ${bx},${by}`)
	}
	return parts.join(" ")
}

// ── Task icons (14×14, origin at 0,0) ────────────────────────────────────────

function taskIcon(type: string): string {
	switch (type) {
		case "manualTask":
			return `<path d="M3 8V4.5a1 1 0 012 0V8M5 7V3a1 1 0 012 0v4M7 6a1 1 0 012 0v1.5M9 7.5a1 1 0 012 0V9c0 2.5-1.5 4-4.5 4H5c-2.5 0-4-1.5-4-4V8" class="bi"/>`
		case "serviceTask":
			return `<circle cx="7" cy="7" r="5.5" class="bi"/><circle cx="7" cy="7" r="2" class="bi"/><path d="M7 1v2.5M7 10.5v2.5M1 7h2.5M10.5 7h2.5M2.8 2.8l1.7 1.7M9.5 9.5l1.7 1.7M11.2 2.8l-1.7 1.7M4.5 9.5l-1.7 1.7" class="bi"/>`
		case "userTask":
			return `<circle cx="7" cy="4.5" r="2.5" class="bi"/><path d="M1.5 14Q1.5 9 7 9Q12.5 9 12.5 14" class="bi"/>`
		case "scriptTask":
			return `<rect x="2" y="0.5" width="10" height="13" rx="1" class="bi"/><path d="M4 4h6M4 7h6M4 10h4" class="bi"/>`
		case "sendTask":
			return `<path d="M1.5 3.5h11v8h-11z" class="bis"/><path d="M1.5 3.5l5.5 4.5 5.5-4.5M1.5 11.5l4-3.5M12.5 11.5l-4-3.5" fill="none" stroke="var(--_sf)" stroke-width="1.5"/>`
		case "receiveTask":
			return `<rect x="1.5" y="3.5" width="11" height="8" class="bi"/><path d="M1.5 3.5l5.5 4.5 5.5-4.5" class="bi"/>`
		case "businessRuleTask":
			return `<rect x="1" y="1" width="12" height="12" class="bi"/><path d="M1 4.5h12M4 1v12" class="bi"/>`
		default:
			return ""
	}
}

// ── Event markers (centred at 0,0) ────────────────────────────────────────────

function eventMarker(defType: string, filled: boolean): string {
	const c = filled ? "bis" : "bi"
	switch (defType) {
		case "timer":
			return `<circle cx="0" cy="0" r="5" class="${c}"/><path d="M0 -3.5v3.5l2 2" class="bi"/>`
		case "message":
			return `<rect x="-5" y="-3.5" width="10" height="7" class="${c}"/><path d="M-5 -3.5l5 4 5-4" class="${c}" ${filled ? 'fill="none" stroke="var(--_sf)"' : ""}/>`
		case "signal":
			return `<path d="M0 -5.5l5.5 10h-11z" class="${c}"/>`
		case "error":
			return `<path d="M-2 -5l2.5 4.5-3.5 0.5L2 5l-2.5-4.5 3.5-0.5z" class="${c}"/>`
		case "escalation":
			return `<path d="M0 -5.5l3.5 9.5-3.5-3.5-3.5 3.5z" class="${c}"/>`
		case "compensate":
			return `<path d="M1 -3.5l-5 3.5 5 3.5zM6 -3.5l-5 3.5 5 3.5z" class="${c}"/>`
		case "conditional":
			return `<rect x="-4.5" y="-5.5" width="9" height="11" rx="1" class="${c}"/><path d="M-2.5 -2.5h5M-2.5 0h5M-2.5 2.5h3" class="bi"/>`
		case "link":
			return `<path d="M-2 -3.5v7l5.5-3.5z" class="${c}"/><path d="M-6 0h4" class="bi"/>`
		case "cancel":
			return `<path d="M-4 -4l8 8M4 -4l-8 8" class="${c}"/>`
		case "terminate":
			return `<circle cx="0" cy="0" r="5" class="bis"/>`
		default:
			return ""
	}
}

// ── Gateway markers ────────────────────────────────────────────────────────────

function gatewayMarker(type: string): string {
	switch (type) {
		case "exclusiveGateway":
			return `<path d="M-6 -6l12 12M6 -6l-12 12" class="gms"/>`
		case "parallelGateway":
			return `<path d="M0 -8v16M-8 0h16" class="gms"/>`
		case "inclusiveGateway":
			return `<circle cx="0" cy="0" r="6" class="gms"/>`
		case "eventBasedGateway":
			return `<circle cx="0" cy="0" r="7" class="gms"/><circle cx="0" cy="0" r="5" class="gms"/><path d="M0 -4L3.8 1.8H-3.8Z" class="gm"/>`
		case "complexGateway":
			return `<path d="M0 -8v16M-8 0h16M-5.7 -5.7l11.4 11.4M5.7 -5.7l-11.4 11.4" class="gms"/>`
		default:
			return ""
	}
}

// ── Sub-process marker ────────────────────────────────────────────────────────

function subProcessMarker(type: string): string {
	if (type === "adHocSubProcess") {
		return `<path d="M-7 0Q-4 -4 0 0Q4 4 7 0" class="bi"/>`
	}
	return `<rect x="-7" y="-7" width="14" height="14" rx="1" class="bi"/><path d="M0 -4v8M-4 0h8" class="bi"/>`
}

// ── Shape renderers ────────────────────────────────────────────────────────────

function shapeStyle(t: Theme, sw = 1.5, dash?: string): string {
	return `fill:${t.shapeFill};stroke:${t.shapeStroke};stroke-width:${sw}${dash ? `;stroke-dasharray:${dash}` : ""}`
}

function iconStyle(t: Theme): string {
	return `fill:none;stroke:${t.shapeStroke};stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round`
}

function iconSolidStyle(t: Theme): string {
	return `fill:${t.shapeStroke};stroke:none`
}

function gwMarkerStyle(t: Theme): string {
	return `fill:none;stroke:${t.shapeStroke};stroke-width:2.5;stroke-linecap:round`
}

function gwMarkerFillStyle(t: Theme): string {
	return `fill:${t.shapeStroke};stroke:none`
}

/**
 * Wraps raw icon SVG (which uses class="bi", "bis", "gm", "gms")
 * in a `<g>` that provides those class definitions as inline style overrides.
 * CSS classes cannot be used in standalone SVGs, so we map them to inline styles
 * via a local `<style>` element scoped to the enclosing `<g>`.
 */
function iconGroup(content: string, x: number, y: number, t: Theme): string {
	const bi = iconStyle(t)
	const bis = iconSolidStyle(t)
	const gm = gwMarkerFillStyle(t)
	const gms = gwMarkerStyle(t)
	// Inline style for sendTask envelope fill colour (matches shape fill)
	const sf = t.shapeFill
	return `<g transform="translate(${x} ${y})"><style>.bi{${bi}}.bis{${bis}}.gm{${gm}}.gms{${gms}}</style>${content.replace(/var\(--_sf\)/g, sf)}</g>`
}

function renderEvent(
	el: BpmnFlowElement | undefined,
	width: number,
	height: number,
	t: Theme,
): string {
	const cx = width / 2
	const cy = height / 2
	const r = Math.min(cx, cy) - 1

	const isEnd = el?.type === "endEvent"
	const isIntermediate =
		el?.type === "intermediateCatchEvent" ||
		el?.type === "intermediateThrowEvent" ||
		el?.type === "boundaryEvent"
	const isThrow =
		el?.type === "intermediateThrowEvent" ||
		(el?.type === "boundaryEvent" && (el as { cancelActivity?: boolean }).cancelActivity === false)

	const outerSw = isEnd ? 3 : 1.5
	const outerStyle = `fill:${t.shapeFill};stroke:${t.shapeStroke};stroke-width:${outerSw}`
	let out = `<circle cx="${cx}" cy="${cy}" r="${r}" style="${outerStyle}"/>`

	if (isIntermediate) {
		const isNonInt =
			el?.type === "boundaryEvent" && (el as { cancelActivity?: boolean }).cancelActivity === false
		const innerStyle = `fill:none;stroke:${t.shapeStroke};stroke-width:1.5${isNonInt ? ";stroke-dasharray:4 2" : ""}`
		out += `<circle cx="${cx}" cy="${cy}" r="${r - 3}" style="${innerStyle}"/>`
	}

	const eventDef =
		el && "eventDefinitions" in el && el.eventDefinitions.length > 0
			? el.eventDefinitions[0]
			: undefined
	if (eventDef) {
		const marker = eventMarker(eventDef.type, isThrow && !isEnd)
		if (marker) {
			out += iconGroup(marker, cx, cy, t)
		}
	}

	return out
}

function renderTask(
	el: BpmnFlowElement | undefined,
	width: number,
	height: number,
	t: Theme,
): string {
	const type = el?.type ?? ""
	let sw = 1.5
	let dash: string | undefined
	if (type === "callActivity") sw = 3
	else if (type === "eventSubProcess") dash = "5 3"

	const bodyStyle = shapeStyle(t, sw, dash)
	let out = `<rect x="0" y="0" width="${width}" height="${height}" rx="10" style="${bodyStyle}"/>`

	if (type === "transaction") {
		const innerStyle = iconStyle(t)
		out += `<rect x="3" y="3" width="${width - 6}" height="${height - 6}" rx="8" style="${innerStyle}"/>`
	}

	const icon = taskIcon(type)
	if (icon) {
		out += iconGroup(icon, 4, 4, t)
	}

	if (el?.name) {
		out += labelSvg(el.name, width / 2, height / 2, width - 16, t)
	}

	if (
		type === "subProcess" ||
		type === "adHocSubProcess" ||
		type === "eventSubProcess" ||
		type === "transaction"
	) {
		out += iconGroup(subProcessMarker(type), width / 2, height - 10, t)
	}

	return out
}

function renderGateway(
	el: BpmnFlowElement | undefined,
	width: number,
	height: number,
	t: Theme,
): string {
	const cx = width / 2
	const cy = height / 2
	const bodyStyle = shapeStyle(t)
	const points = `${cx},0 ${width},${cy} ${cx},${height} 0,${cy}`
	let out = `<polygon points="${points}" style="${bodyStyle}"/>`

	const marker = el ? gatewayMarker(el.type) : ""
	if (marker) {
		out += iconGroup(marker, cx, cy, t)
	}

	return out
}

function renderPool(
	participant: BpmnParticipant | undefined,
	width: number,
	height: number,
	t: Theme,
): string {
	const bodyStyle = `fill:${t.shapeFill};stroke:${t.shapeStroke};stroke-width:1.5`
	const headerStyle = `fill:${t.poolHeader};stroke:${t.shapeStroke};stroke-width:1.5`
	let out =
		`<rect x="0" y="0" width="${width}" height="${height}" style="${bodyStyle}"/>` +
		`<rect x="0" y="0" width="30" height="${height}" style="${headerStyle}"/>`

	if (participant?.name) {
		out += `<text style="${textStyle(t)}" transform="translate(15 ${height / 2}) rotate(-90)">${esc(participant.name)}</text>`
	}

	return out
}

function renderLane(lane: BpmnLane | undefined, width: number, height: number, t: Theme): string {
	const bodyStyle = `fill:${t.shapeFill};stroke:${t.shapeStroke};stroke-width:1.5`
	const headerStyle = `fill:${t.poolHeader};stroke:${t.shapeStroke};stroke-width:1.5`
	let out =
		`<rect x="0" y="0" width="${width}" height="${height}" style="${bodyStyle}"/>` +
		`<rect x="0" y="0" width="30" height="${height}" style="${headerStyle}"/>`

	if (lane?.name) {
		out += `<text style="${textStyle(t)}" transform="translate(15 ${height / 2}) rotate(-90)">${esc(lane.name)}</text>`
	}

	return out
}

function renderAnnotation(
	text: string | undefined,
	width: number,
	height: number,
	t: Theme,
): string {
	const pathStyle = `fill:none;stroke:${t.shapeStroke};stroke-width:1.5`
	let out = `<path d="M${width} 0 L0 0 L0 ${height} L${width} ${height}" style="${pathStyle}"/>`
	if (text) {
		out += labelSvg(text, width / 2, height / 2, width - 8, t)
	}
	return out
}

// ── Model index ───────────────────────────────────────────────────────────────

interface ModelIndex {
	elements: Map<string, BpmnFlowElement>
	flows: Map<string, BpmnSequenceFlow>
	annotations: Map<string, BpmnTextAnnotation>
	participants: Map<string, BpmnParticipant>
	lanes: Map<string, BpmnLane>
	messageFlowIds: Set<string>
	defaultFlowIds: Set<string>
}

function buildIndex(defs: BpmnDefinitions): ModelIndex {
	const elements = new Map<string, BpmnFlowElement>()
	const flows = new Map<string, BpmnSequenceFlow>()
	const annotations = new Map<string, BpmnTextAnnotation>()
	const participants = new Map<string, BpmnParticipant>()
	const lanes = new Map<string, BpmnLane>()
	const messageFlowIds = new Set<string>()
	const defaultFlowIds = new Set<string>()

	function indexElements(flowElements: BpmnFlowElement[], seqFlows: BpmnSequenceFlow[]): void {
		for (const el of flowElements) {
			elements.set(el.id, el)
			if (
				el.type === "subProcess" ||
				el.type === "adHocSubProcess" ||
				el.type === "eventSubProcess" ||
				el.type === "transaction"
			) {
				indexElements(el.flowElements, el.sequenceFlows)
			}
			if (
				(el.type === "exclusiveGateway" ||
					el.type === "inclusiveGateway" ||
					el.type === "complexGateway") &&
				el.default
			) {
				defaultFlowIds.add(el.default)
			}
		}
		for (const sf of seqFlows) {
			flows.set(sf.id, sf)
		}
	}

	function indexLaneSet(laneSet: { lanes: BpmnLane[] }): void {
		for (const lane of laneSet.lanes) {
			lanes.set(lane.id, lane)
			if (lane.childLaneSet) indexLaneSet(lane.childLaneSet)
		}
	}

	for (const proc of defs.processes) {
		indexElements(proc.flowElements, proc.sequenceFlows)
		for (const ta of proc.textAnnotations) {
			annotations.set(ta.id, ta)
		}
		if (proc.laneSet) indexLaneSet(proc.laneSet)
	}

	for (const collab of defs.collaborations) {
		for (const p of collab.participants) {
			participants.set(p.id, p)
		}
		for (const ta of collab.textAnnotations) {
			annotations.set(ta.id, ta)
		}
		for (const mf of collab.messageFlows) {
			messageFlowIds.add(mf.id)
		}
	}

	return { elements, flows, annotations, participants, lanes, messageFlowIds, defaultFlowIds }
}
