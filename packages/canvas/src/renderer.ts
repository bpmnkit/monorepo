import type {
	BpmnDefinitions,
	BpmnDiEdge,
	BpmnDiShape,
	BpmnFlowElement,
	BpmnLane,
	BpmnParticipant,
	BpmnSequenceFlow,
	BpmnTextAnnotation,
} from "@bpmnkit/core"
import { readDiColor } from "@bpmnkit/core"
import type { RenderedEdge, RenderedShape } from "./types.js"

// ── SVG helpers ───────────────────────────────────────────────────────────────

const NS = "http://www.w3.org/2000/svg"

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
	return document.createElementNS(NS, tag)
}

function attr(el: Element, attrs: Record<string, string | number>): void {
	for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v))
}

// ── Text helpers ──────────────────────────────────────────────────────────────

const AVG_CHAR_PX = 6.5 // approximate width at 11px system-ui

/**
 * Splits `text` into lines that fit within `maxPx` pixels.
 * Uses an average character-width estimate rather than actual text measurement
 * to keep this dependency-free and synchronous.
 */
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
			// Single word wider than maxPx — use as-is
			line = word
		}
	}
	if (line) lines.push(line)
	return lines.length > 0 ? lines : [text]
}

/**
 * Creates a `<text>` element (or multi-line group) centred at (`cx`, `cy`).
 * When `topAlign` is true, multi-line text flows downward from `cy` rather
 * than being centred around it — used for external labels below shapes so
 * that long wrapped labels never extend upward into the shape.
 */
function makeLabel(
	text: string,
	cx: number,
	cy: number,
	maxWidth: number,
	cls = "bpmnkit-label",
	topAlign = false,
): SVGElement {
	const lines = wrapText(text, maxWidth)
	const lineH = 14
	if (lines.length === 1) {
		const t = svgEl("text")
		attr(t, { class: cls, x: cx, y: cy })
		t.textContent = lines[0] ?? text
		return t
	}
	const g = svgEl("g")
	const totalH = lines.length * lineH
	const startY = topAlign ? lineH / 2 : cy - totalH / 2 + lineH / 2
	for (let i = 0; i < lines.length; i++) {
		const t = svgEl("text")
		attr(t, { class: cls, x: cx, y: startY + i * lineH })
		t.textContent = lines[i] ?? ""
		g.appendChild(t)
	}
	return g
}

/**
 * Converts a list of waypoints into an SVG path `d` attribute string
 * with rounded corners at intermediate waypoints (quadratic bezier arcs).
 */
function waypointsToRoundedPath(waypoints: ReadonlyArray<{ x: number; y: number }>): string {
	if (waypoints.length < 2) return ""
	const r = 4 // corner radius in diagram units
	const parts: string[] = []

	for (let i = 0; i < waypoints.length; i++) {
		const wp = waypoints[i]
		if (!wp) continue

		if (i === 0) {
			parts.push(`M${wp.x},${wp.y}`)
			continue
		}

		if (i === waypoints.length - 1) {
			parts.push(`L${wp.x},${wp.y}`)
			continue
		}

		// Intermediate waypoint — round the corner with a quadratic bezier
		const prev = waypoints[i - 1]
		const next = waypoints[i + 1]
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
		// Approach point: step back from the corner along the incoming segment
		const ax = wp.x - (dx1 / d1) * radius
		const ay = wp.y - (dy1 / d1) * radius
		// Departure point: step forward from the corner along the outgoing segment
		const bx = wp.x + (dx2 / d2) * radius
		const by = wp.y + (dy2 / d2) * radius

		parts.push(`L${ax},${ay}`)
		parts.push(`Q${wp.x},${wp.y} ${bx},${by}`)
	}

	return parts.join(" ")
}

// ── Task type icons (14×14, origin at 0,0) ───────────────────────────────────

/**
 * Returns inner SVG markup for task-type icons positioned at the top-left
 * corner of a task rectangle.  Each icon fits in a 14×14 bounding box.
 */
function taskIcon(type: string): string {
	switch (type) {
		case "manualTask":
			// Hand icon
			return `<path d="M3 8V4.5a1 1 0 012 0V8M5 7V3a1 1 0 012 0v4M7 6a1 1 0 012 0v1.5M9 7.5a1 1 0 012 0V9c0 2.5-1.5 4-4.5 4H5c-2.5 0-4-1.5-4-4V8" class="bpmnkit-icon"/>`
		case "serviceTask":
			// Gear: two concentric circles + 8 spokes
			return `<circle cx="7" cy="7" r="5.5" class="bpmnkit-icon"/>
<circle cx="7" cy="7" r="2" class="bpmnkit-icon"/>
<path d="M7 1v2.5M7 10.5v2.5M1 7h2.5M10.5 7h2.5M2.8 2.8l1.7 1.7M9.5 9.5l1.7 1.7M11.2 2.8l-1.7 1.7M4.5 9.5l-1.7 1.7" class="bpmnkit-icon"/>`
		case "userTask":
			// Person: head circle + shoulders arc
			return `<circle cx="7" cy="4.5" r="2.5" class="bpmnkit-icon"/>
<path d="M1.5 14Q1.5 9 7 9Q12.5 9 12.5 14" class="bpmnkit-icon"/>`
		case "scriptTask":
			// Document with three text lines
			return `<rect x="2" y="0.5" width="10" height="13" rx="1" class="bpmnkit-icon"/>
<path d="M4 4h6M4 7h6M4 10h4" class="bpmnkit-icon"/>`
		case "sendTask":
			// Filled envelope
			return `<path d="M1.5 3.5h11v8h-11z" class="bpmnkit-icon-solid"/>
<path d="M1.5 3.5l5.5 4.5 5.5-4.5M1.5 11.5l4-3.5M12.5 11.5l-4-3.5" style="fill:none;stroke:var(--bpmnkit-shape-fill,#fff);stroke-width:1.5"/>`
		case "receiveTask":
			// Outlined envelope
			return `<rect x="1.5" y="3.5" width="11" height="8" class="bpmnkit-icon"/>
<path d="M1.5 3.5l5.5 4.5 5.5-4.5" class="bpmnkit-icon"/>`
		case "businessRuleTask":
			// Table grid
			return `<rect x="1" y="1" width="12" height="12" class="bpmnkit-icon"/>
<path d="M1 4.5h12M4 1v12" class="bpmnkit-icon"/>`
		default:
			return ""
	}
}

// ── Event definition markers (centred at 0,0, ~10×10) ────────────────────────

function eventMarker(defType: string, filled: boolean): string {
	const cls = filled ? "bpmnkit-icon-solid" : "bpmnkit-icon"
	switch (defType) {
		case "timer":
			return `<circle cx="0" cy="0" r="5" class="${cls}"/>
<path d="M0 -3.5v3.5l2 2" class="bpmnkit-icon"/>`
		case "message":
			return `<rect x="-5" y="-3.5" width="10" height="7" class="${cls}"/>
<path d="M-5 -3.5l5 4 5-4" class="${filled ? "bpmnkit-icon" : "bpmnkit-icon"}" style="${filled ? "stroke:var(--bpmnkit-shape-fill,#fff)" : ""}"/>`
		case "signal":
			return `<path d="M0 -5.5l5.5 10h-11z" class="${cls}"/>`
		case "error":
			return `<path d="M-2 -5l2.5 4.5-3.5 0.5L2 5l-2.5-4.5 3.5-0.5z" class="${cls}"/>`
		case "escalation":
			return `<path d="M0 -5.5l3.5 9.5-3.5-3.5-3.5 3.5z" class="${cls}"/>`
		case "compensate":
			return `<path d="M1 -3.5l-5 3.5 5 3.5zM6 -3.5l-5 3.5 5 3.5z" class="${cls}"/>`
		case "conditional":
			return `<rect x="-4.5" y="-5.5" width="9" height="11" rx="1" class="${cls}"/>
<path d="M-2.5 -2.5h5M-2.5 0h5M-2.5 2.5h3" class="bpmnkit-icon"/>`
		case "link":
			return `<path d="M-2 -3.5v7l5.5-3.5z" class="${cls}"/><path d="M-6 0h4" class="bpmnkit-icon"/>`
		case "cancel":
			return `<path d="M-4 -4l8 8M4 -4l-8 8" class="${cls}"/>`
		case "terminate":
			return `<circle cx="0" cy="0" r="5" class="bpmnkit-icon-solid"/>`
		default:
			return ""
	}
}

// ── Gateway markers (centred at 0,0, ~16×16) ─────────────────────────────────

function gatewayMarker(type: string): string {
	switch (type) {
		case "exclusiveGateway":
			return `<path d="M-6 -6l12 12M6 -6l-12 12" class="bpmnkit-gw-marker-stroke"/>`
		case "parallelGateway":
			return `<path d="M0 -8v16M-8 0h16" class="bpmnkit-gw-marker-stroke"/>`
		case "inclusiveGateway":
			return `<circle cx="0" cy="0" r="6" class="bpmnkit-gw-marker-stroke"/>`
		case "eventBasedGateway":
			return `<circle cx="0" cy="0" r="7" class="bpmnkit-gw-marker-stroke"/>
<circle cx="0" cy="0" r="5" class="bpmnkit-gw-marker-stroke"/>
<path d="M0 -4L3.8 1.8H-3.8Z" class="bpmnkit-gw-marker"/>`
		case "complexGateway":
			return `<path d="M0 -8v16M-8 0h16M-5.7 -5.7l11.4 11.4M5.7 -5.7l-11.4 11.4" class="bpmnkit-gw-marker-stroke"/>`
		default:
			return ""
	}
}

// ── Sub-process bottom markers ────────────────────────────────────────────────

function subProcessMarker(type: string): string {
	if (type === "adHocSubProcess") {
		// Tilde (~) for ad-hoc
		return `<path d="M-7 0Q-4 -4 0 0Q4 4 7 0" class="bpmnkit-icon"/>`
	}
	// Standard expand marker: + in a small box
	return `<rect x="-7" y="-7" width="14" height="14" rx="1" class="bpmnkit-icon"/>
<path d="M0 -4v8M-4 0h8" class="bpmnkit-icon"/>`
}

// ── Model index helpers ───────────────────────────────────────────────────────

interface ModelIndex {
	/** id → BpmnFlowElement (all levels flattened) */
	elements: Map<string, BpmnFlowElement>
	/** id → BpmnSequenceFlow */
	flows: Map<string, BpmnSequenceFlow>
	/** id → BpmnTextAnnotation */
	annotations: Map<string, BpmnTextAnnotation>
	/** id → BpmnParticipant */
	participants: Map<string, BpmnParticipant>
	/** id → BpmnLane */
	lanes: Map<string, BpmnLane>
	/** id → messageFlow (stored by id for edge rendering) */
	messageFlowIds: Set<string>
	/** IDs of sequence flows that are the default flow of their source gateway */
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

	function indexProcess(flowElements: BpmnFlowElement[], sequenceFlows: BpmnSequenceFlow[]): void {
		for (const el of flowElements) {
			elements.set(el.id, el)
			if (
				el.type === "subProcess" ||
				el.type === "adHocSubProcess" ||
				el.type === "eventSubProcess" ||
				el.type === "transaction"
			) {
				indexProcess(el.flowElements, el.sequenceFlows)
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
		for (const sf of sequenceFlows) {
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
		indexProcess(proc.flowElements, proc.sequenceFlows)
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

// ── Color helper ─────────────────────────────────────────────────────────────

/** Applies bioc/color namespace attributes as inline style on a shape body element. */
function applyColor(el: SVGElement, shape: BpmnDiShape): void {
	const { fill, stroke } = readDiColor(shape.unknownAttributes)
	if (!fill && !stroke) return
	const parts: string[] = []
	if (fill) parts.push(`fill: ${fill}`)
	if (stroke) parts.push(`stroke: ${stroke}`)
	el.setAttribute("style", parts.join("; "))
}

// ── Shape renderers ───────────────────────────────────────────────────────────

function renderEvent(
	shape: BpmnDiShape,
	el: BpmnFlowElement | undefined,
	instanceId: string,
): SVGGElement {
	const { width, height } = shape.bounds
	const cx = width / 2
	const cy = height / 2
	const r = Math.min(cx, cy) - 1

	const g = svgEl("g")

	const isEnd = el?.type === "endEvent"
	const isIntermediate =
		el?.type === "intermediateCatchEvent" ||
		el?.type === "intermediateThrowEvent" ||
		el?.type === "boundaryEvent"
	const isThrow =
		el?.type === "intermediateThrowEvent" ||
		(el?.type === "boundaryEvent" && (el as { cancelActivity?: boolean }).cancelActivity === false)

	// Outer circle
	const outer = svgEl("circle")
	attr(outer, {
		cx,
		cy,
		r,
		class: isEnd ? "bpmnkit-end-body" : "bpmnkit-event-body",
	})
	applyColor(outer, shape)
	g.appendChild(outer)

	// Intermediate: inner circle (dashed for non-interrupting boundary events)
	if (isIntermediate) {
		const inner = svgEl("circle")
		const isNonInterrupting = el?.type === "boundaryEvent" && el.cancelActivity === false
		attr(inner, {
			cx,
			cy,
			r: r - 3,
			class: isNonInterrupting ? "bpmnkit-event-inner-dashed" : "bpmnkit-event-inner",
		})
		g.appendChild(inner)
	}

	// Event definition marker
	const eventDef =
		el && "eventDefinitions" in el && el.eventDefinitions.length > 0
			? el.eventDefinitions[0]
			: undefined
	if (eventDef) {
		const markerG = svgEl("g")
		attr(markerG, { transform: `translate(${cx} ${cy})` })
		markerG.innerHTML = eventMarker(eventDef.type, isThrow && !isEnd)
		g.appendChild(markerG)
	}

	// Accessibility
	const label = el?.name ?? el?.type ?? "event"
	attr(g, {
		class: "bpmnkit-shape",
		tabindex: "-1",
		role: "button",
		"aria-label": label,
		"data-bpmnkit-id": shape.bpmnElement,
		"data-bpmnkit-instance": instanceId,
	})

	return g
}

function renderTask(
	shape: BpmnDiShape,
	el: BpmnFlowElement | undefined,
	instanceId: string,
): SVGGElement {
	const { width, height } = shape.bounds

	const g = svgEl("g")

	// Body
	const body = svgEl("rect")
	const bodyClass =
		el?.type === "callActivity"
			? "bpmnkit-callactivity-body"
			: el?.type === "eventSubProcess"
				? "bpmnkit-eventsubprocess-body"
				: el?.type === "subProcess" || el?.type === "adHocSubProcess"
					? "bpmnkit-shape-body"
					: "bpmnkit-shape-body"
	attr(body, { x: 0, y: 0, width, height, rx: 10, class: bodyClass })
	applyColor(body, shape)
	g.appendChild(body)

	// Transaction: double inner border
	if (el?.type === "transaction") {
		const inner = svgEl("rect")
		attr(inner, { x: 3, y: 3, width: width - 6, height: height - 6, rx: 8, class: "bpmnkit-icon" })
		g.appendChild(inner)
	}

	// Task type icon (14×14 at position 4,4)
	const templateIconUri = el?.unknownAttributes?.["zeebe:modelerTemplateIcon"]
	if (templateIconUri) {
		const img = svgEl("image")
		attr(img, {
			x: 4,
			y: 4,
			width: 14,
			height: 14,
			href: templateIconUri,
			preserveAspectRatio: "xMidYMid meet",
		})
		g.appendChild(img)
	} else {
		const iconSvg = taskIcon(el?.type ?? "")
		if (iconSvg) {
			const iconG = svgEl("g")
			attr(iconG, { transform: "translate(4 4)" })
			iconG.innerHTML = iconSvg
			g.appendChild(iconG)
		}
	}

	// Label — centred in shape
	if (el?.name) {
		const labelMaxW = width - 16
		const labelEl = makeLabel(el.name, width / 2, height / 2, labelMaxW)
		g.appendChild(labelEl)
	}

	// Sub-process expand/adHoc marker at bottom centre
	if (
		el?.type === "subProcess" ||
		el?.type === "adHocSubProcess" ||
		el?.type === "eventSubProcess" ||
		el?.type === "transaction"
	) {
		const markerG = svgEl("g")
		attr(markerG, { transform: `translate(${width / 2} ${height - 10})` })
		markerG.innerHTML = subProcessMarker(el.type)
		g.appendChild(markerG)
	}

	const label = el?.name ?? el?.type ?? "task"
	attr(g, {
		class: "bpmnkit-shape",
		tabindex: "-1",
		role: "button",
		"aria-label": label,
		"data-bpmnkit-id": shape.bpmnElement,
		"data-bpmnkit-instance": instanceId,
	})

	return g
}

function renderGateway(
	shape: BpmnDiShape,
	el: BpmnFlowElement | undefined,
	instanceId: string,
): SVGGElement {
	const { width, height } = shape.bounds
	const cx = width / 2
	const cy = height / 2

	const g = svgEl("g")

	// Diamond
	const diamond = svgEl("polygon")
	attr(diamond, {
		points: `${cx},0 ${width},${cy} ${cx},${height} 0,${cy}`,
		class: "bpmnkit-gw-body",
	})
	applyColor(diamond, shape)
	g.appendChild(diamond)

	// Gateway marker centred in diamond
	const markerSvg = el ? gatewayMarker(el.type) : ""
	if (markerSvg) {
		const markerG = svgEl("g")
		attr(markerG, { transform: `translate(${cx} ${cy})` })
		markerG.innerHTML = markerSvg
		g.appendChild(markerG)
	}

	const label = el?.name ?? el?.type ?? "gateway"
	attr(g, {
		class: "bpmnkit-shape",
		tabindex: "-1",
		role: "button",
		"aria-label": label,
		"data-bpmnkit-id": shape.bpmnElement,
		"data-bpmnkit-instance": instanceId,
	})

	return g
}

function renderPool(
	shape: BpmnDiShape,
	participant: BpmnParticipant | undefined,
	instanceId: string,
): SVGGElement {
	const { width, height } = shape.bounds
	const g = svgEl("g")

	// Pool body
	const bg = svgEl("rect")
	attr(bg, { x: 0, y: 0, width, height, class: "bpmnkit-pool-body" })
	g.appendChild(bg)

	// Title bar (left column, 30px wide)
	const titleBar = svgEl("rect")
	attr(titleBar, { x: 0, y: 0, width: 30, height, class: "bpmnkit-pool-header" })
	g.appendChild(titleBar)

	// Pool name (rotated in title bar)
	if (participant?.name) {
		const text = svgEl("text")
		attr(text, {
			class: "bpmnkit-label",
			transform: `translate(15 ${height / 2}) rotate(-90)`,
		})
		text.textContent = participant.name
		g.appendChild(text)
	}

	attr(g, {
		class: "bpmnkit-shape bpmnkit-pool",
		tabindex: "-1",
		role: "region",
		"aria-label": participant?.name ?? "Pool",
		"data-bpmnkit-id": shape.bpmnElement,
		"data-bpmnkit-instance": instanceId,
	})
	return g
}

function renderLane(
	shape: BpmnDiShape,
	lane: BpmnLane | undefined,
	instanceId: string,
): SVGGElement {
	const { width, height } = shape.bounds
	const g = svgEl("g")

	// Lane body
	const bg = svgEl("rect")
	attr(bg, { x: 0, y: 0, width, height, class: "bpmnkit-lane-body" })
	g.appendChild(bg)

	// Title bar (left column, 30px wide)
	const titleBar = svgEl("rect")
	attr(titleBar, { x: 0, y: 0, width: 30, height, class: "bpmnkit-lane-header" })
	g.appendChild(titleBar)

	// Lane name (rotated in title bar)
	if (lane?.name) {
		const text = svgEl("text")
		attr(text, {
			class: "bpmnkit-label",
			transform: `translate(15 ${height / 2}) rotate(-90)`,
		})
		text.textContent = lane.name
		g.appendChild(text)
	}

	attr(g, {
		class: "bpmnkit-shape bpmnkit-lane",
		tabindex: "-1",
		role: "region",
		"aria-label": lane?.name ?? "Lane",
		"data-bpmnkit-id": shape.bpmnElement,
		"data-bpmnkit-instance": instanceId,
	})
	return g
}

function renderAnnotation(
	shape: BpmnDiShape,
	text: string | undefined,
	instanceId: string,
): SVGGElement {
	const { width, height } = shape.bounds
	const g = svgEl("g")

	// Transparent hit rect so the full bounding area is clickable/draggable
	const hit = svgEl("rect")
	attr(hit, { x: "0", y: "0", width: String(width), height: String(height), fill: "transparent" })
	g.appendChild(hit)

	// Bracket (open on the right — left + top + bottom strokes only)
	const path = svgEl("path")
	attr(path, {
		d: `M${width} 0 L0 0 L0 ${height} L${width} ${height}`,
		class: "bpmnkit-icon",
	})
	g.appendChild(path)

	// Annotation text centred in the full shape area
	if (text) {
		const labelEl = makeLabel(text, width / 2, height / 2, width - 8)
		g.appendChild(labelEl)
	}

	attr(g, {
		class: "bpmnkit-shape",
		tabindex: "-1",
		role: "note",
		"data-bpmnkit-id": shape.bpmnElement,
		"data-bpmnkit-instance": instanceId,
	})
	return g
}

// ── External label ────────────────────────────────────────────────────────────

/**
 * Renders an external label at absolute diagram coordinates.
 * Used for events, gateways, and edge midpoints.
 * Pass `topAlign = true` for labels below shapes — multi-line text then flows
 * downward from the top of the bounds, preventing upward overlap with the shape.
 */
function renderExternalLabel(
	absX: number,
	absY: number,
	labelW: number,
	labelH: number,
	text: string,
	topAlign = false,
): SVGGElement {
	const g = svgEl("g")
	attr(g, { transform: `translate(${absX} ${absY})` })
	const labelEl = makeLabel(text, labelW / 2, labelH / 2, labelW - 4, "bpmnkit-label", topAlign)
	g.appendChild(labelEl)
	return g
}

// ── Edge renderer ─────────────────────────────────────────────────────────────

function renderEdge(
	edge: BpmnDiEdge,
	flow: BpmnSequenceFlow | undefined,
	markerId: string,
	isDefault: boolean,
): SVGGElement {
	const g = svgEl("g")
	attr(g, {
		class: "bpmnkit-edge",
		"data-bpmnkit-id": edge.bpmnElement,
	})

	if (edge.waypoints.length < 2) return g

	const path = svgEl("path")
	attr(path, {
		d: waypointsToRoundedPath(edge.waypoints),
		class: "bpmnkit-edge-path",
		"marker-end": `url(#${markerId})`,
	})
	g.appendChild(path)

	// Wide transparent stroke so the edge is easy to click
	const hitPath = svgEl("path")
	attr(hitPath, {
		d: waypointsToRoundedPath(edge.waypoints),
		fill: "none",
		stroke: "transparent",
		"stroke-width": "12",
		"pointer-events": "stroke",
	})
	g.appendChild(hitPath)

	// Default-flow slash mark near the source end
	if (isDefault) {
		const wp0 = edge.waypoints[0]
		const wp1 = edge.waypoints[1]
		if (wp0 && wp1) {
			const dx = wp1.x - wp0.x
			const dy = wp1.y - wp0.y
			const len = Math.sqrt(dx * dx + dy * dy)
			if (len > 0) {
				const nx = dx / len
				const ny = dy / len
				const t = Math.min(10, len * 0.25)
				const cx = wp0.x + nx * t
				const cy = wp0.y + ny * t
				const s = 5
				const slash = svgEl("line")
				attr(slash, {
					x1: cx - ny * s,
					y1: cy + nx * s,
					x2: cx + ny * s,
					y2: cy - nx * s,
					class: "bpmnkit-edge-default-slash",
				})
				g.appendChild(slash)
			}
		}
	}

	// Edge label
	if (flow?.name && edge.label?.bounds) {
		const { x, y, width, height } = edge.label.bounds
		const labelEl = renderExternalLabel(x, y, width, height, flow.name)
		g.appendChild(labelEl)
	}

	return g
}

function renderAssociation(edge: BpmnDiEdge): SVGGElement {
	const g = svgEl("g")
	attr(g, { class: "bpmnkit-edge", "data-bpmnkit-id": edge.bpmnElement })

	const path = svgEl("path")
	attr(path, { d: waypointsToRoundedPath(edge.waypoints), class: "bpmnkit-edge-assoc" })
	g.appendChild(path)
	return g
}

// ── SVG defs (arrow markers) ──────────────────────────────────────────────────

/**
 * Creates the SVG `<defs>` section for this canvas instance.
 * Uses `instanceId` to make marker IDs unique per canvas, avoiding
 * conflicts when multiple canvases are mounted on the same page.
 */
export function createDefs(svg: SVGSVGElement, instanceId: string): string {
	const markerId = `bpmnkit-arrow-${instanceId}`
	const defs = svgEl("defs")
	defs.innerHTML = `
    <marker id="${markerId}" markerWidth="8" markerHeight="6"
            refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L8,3 L0,6 Z" class="bpmnkit-arrow-fill"/>
    </marker>
  `
	svg.appendChild(defs)
	return markerId
}

// ── Dot-grid background ───────────────────────────────────────────────────────

/**
 * Creates and inserts an SVG dot-grid background pattern.
 * The `<rect>` filling the entire viewport and the `<pattern>` definition
 * are both inserted into the SVG. Returns the `<pattern>` element so the
 * viewport controller can keep `patternTransform` in sync.
 */
export function createGrid(svg: SVGSVGElement, instanceId: string): SVGPatternElement {
	const patternId = `bpmnkit-grid-${instanceId}`

	const defs = svg.querySelector("defs") ?? svgEl("defs")
	const pattern = svgEl("pattern")
	attr(pattern, {
		id: patternId,
		width: 20,
		height: 20,
		patternUnits: "userSpaceOnUse",
	})
	const dot = svgEl("circle")
	attr(dot, { cx: 1, cy: 1, r: 1, fill: "var(--bpmnkit-grid, rgba(0,0,0,0.14))" })
	pattern.appendChild(dot)
	defs.appendChild(pattern)
	if (!svg.contains(defs)) svg.insertBefore(defs, svg.firstChild)

	const bg = svgEl("rect")
	attr(bg, {
		x: "-5000%",
		y: "-5000%",
		width: "10100%",
		height: "10100%",
		fill: `url(#${patternId})`,
		"pointer-events": "none",
	})
	svg.appendChild(bg)

	return pattern
}

// ── Main render function ──────────────────────────────────────────────────────

export interface RenderResult {
	shapes: RenderedShape[]
	edges: RenderedEdge[]
}

/**
 * Renders a `BpmnDefinitions` model into SVG element groups, appending them
 * to `edgesLayer` and `shapesLayer` respectively.
 *
 * Edges are placed below shapes (rendered first) so connection lines don't
 * cover shape bodies.  Shapes are rendered in DI order so container shapes
 * (sub-processes) appear before their children.
 */
export function render(
	defs: BpmnDefinitions,
	containersLayer: SVGGElement,
	edgesLayer: SVGGElement,
	shapesLayer: SVGGElement,
	labelsLayer: SVGGElement,
	markerId: string,
	instanceId: string,
): RenderResult {
	const index = buildIndex(defs)
	const shapes: RenderedShape[] = []
	const edges: RenderedEdge[] = []

	const plane = defs.diagrams[0]?.plane
	if (!plane) return { shapes, edges }

	// ── Edges ─────────────────────────────────────────────────────────
	for (const edge of plane.edges) {
		const flow = index.flows.get(edge.bpmnElement)
		let g: SVGGElement

		if (flow) {
			g = renderEdge(edge, flow, markerId, index.defaultFlowIds.has(edge.bpmnElement))
		} else if (index.messageFlowIds.has(edge.bpmnElement)) {
			// Message flow — dashed arrow between pools
			g = svgEl("g")
			attr(g, { class: "bpmnkit-edge", "data-bpmnkit-id": edge.bpmnElement })
			if (edge.waypoints.length >= 2) {
				const path = svgEl("path")
				attr(path, {
					d: waypointsToRoundedPath(edge.waypoints),
					class: "bpmnkit-msgflow-path",
					"marker-end": `url(#${markerId})`,
				})
				g.appendChild(path)
			}
		} else {
			// Association or unknown edge type
			g = renderAssociation(edge)
		}

		edgesLayer.appendChild(g)
		edges.push({ id: edge.bpmnElement, element: g, edge })
	}

	// ── Shapes ────────────────────────────────────────────────────────
	for (const shape of plane.shapes) {
		const el = index.elements.get(shape.bpmnElement)
		const { x, y } = shape.bounds

		let g: SVGGElement

		const type = el?.type ?? ""
		if (
			type === "startEvent" ||
			type === "endEvent" ||
			type === "intermediateCatchEvent" ||
			type === "intermediateThrowEvent" ||
			type === "boundaryEvent"
		) {
			g = renderEvent(shape, el, instanceId)
		} else if (
			type === "exclusiveGateway" ||
			type === "parallelGateway" ||
			type === "inclusiveGateway" ||
			type === "eventBasedGateway" ||
			type === "complexGateway"
		) {
			g = renderGateway(shape, el, instanceId)
		} else if (type === "" && !el) {
			// Could be: text annotation, pool (participant), or lane
			const annotation = index.annotations.get(shape.bpmnElement)
			if (annotation !== undefined) {
				g = renderAnnotation(shape, annotation.text, instanceId)
				attr(g, { transform: `translate(${x} ${y})` })
				shapesLayer.appendChild(g)
				shapes.push({ id: shape.bpmnElement, element: g, shape, flowElement: el, annotation })
				continue
			}
			if (index.participants.has(shape.bpmnElement)) {
				g = renderPool(shape, index.participants.get(shape.bpmnElement), instanceId)
				attr(g, { transform: `translate(${x} ${y})` })
				containersLayer.appendChild(g)
				shapes.push({ id: shape.bpmnElement, element: g, shape, flowElement: el })
				continue
			}
			if (index.lanes.has(shape.bpmnElement)) {
				g = renderLane(shape, index.lanes.get(shape.bpmnElement), instanceId)
				attr(g, { transform: `translate(${x} ${y})` })
				containersLayer.appendChild(g)
				shapes.push({ id: shape.bpmnElement, element: g, shape, flowElement: el })
				continue
			}
			// Unknown shape — invisible placeholder
			g = svgEl("g")
			attr(g, { "data-bpmnkit-id": shape.bpmnElement, "data-bpmnkit-instance": instanceId })
			attr(g, { transform: `translate(${x} ${y})` })
			shapesLayer.appendChild(g)
			shapes.push({ id: shape.bpmnElement, element: g, shape, flowElement: el })
			continue
		} else {
			g = renderTask(shape, el, instanceId)
		}

		attr(g, { transform: `translate(${x} ${y})` })
		shapesLayer.appendChild(g)
		shapes.push({ id: shape.bpmnElement, element: g, shape, flowElement: el })

		// External labels for events and gateways — use stored bounds or default to bottom-centred
		const isExternalLabelType =
			type === "startEvent" ||
			type === "endEvent" ||
			type === "intermediateCatchEvent" ||
			type === "intermediateThrowEvent" ||
			type === "boundaryEvent" ||
			type === "exclusiveGateway" ||
			type === "parallelGateway" ||
			type === "inclusiveGateway" ||
			type === "eventBasedGateway" ||
			type === "complexGateway"
		if (el?.name && isExternalLabelType) {
			const lb = shape.label?.bounds ?? {
				x: shape.bounds.x + shape.bounds.width / 2 - 40,
				y: shape.bounds.y + shape.bounds.height + 6,
				width: 80,
				height: 20,
			}
			// topAlign=true: multi-line text flows downward from the top of the
			// label bounds, so long labels never extend upward into the shape.
			const labelG = renderExternalLabel(lb.x, lb.y, lb.width, lb.height, el.name, true)
			labelsLayer.appendChild(labelG)
		}
	}

	// Edge labels at their absolute label bounds
	for (const edge of plane.edges) {
		const flow = index.flows.get(edge.bpmnElement)
		if (flow?.name && edge.label?.bounds) {
			// Already rendered inside the edge group — skip duplicate
			// (renderEdge adds the label when label.bounds is present)
		}
	}

	return { shapes, edges }
}

// ── Bounding-box helper ───────────────────────────────────────────────────────

export interface DiagramBounds {
	minX: number
	minY: number
	maxX: number
	maxY: number
}

/**
 * Computes the bounding box of all shapes in the first DI diagram plane.
 * Returns `null` if the diagram has no shapes.
 */
export function computeDiagramBounds(defs: BpmnDefinitions): DiagramBounds | null {
	const plane = defs.diagrams[0]?.plane
	if (!plane || plane.shapes.length === 0) return null

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
	// Also include waypoints from edges
	for (const edge of plane.edges) {
		for (const wp of edge.waypoints) {
			minX = Math.min(minX, wp.x)
			minY = Math.min(minY, wp.y)
			maxX = Math.max(maxX, wp.x)
			maxY = Math.max(maxY, wp.y)
		}
	}

	return { minX, minY, maxX, maxY }
}
