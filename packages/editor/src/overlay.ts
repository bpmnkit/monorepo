import type { RenderedShape } from "@bpmn-sdk/canvas"
import type { BpmnBounds, BpmnWaypoint } from "@bpmn-sdk/core"
import { handlePositions } from "./geometry.js"
import type { CreateShapeType, DiagPoint, HandleDir } from "./types.js"

const NS = "http://www.w3.org/2000/svg"

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
	return document.createElementNS(NS, tag)
}

function attr(el: Element, attrs: Record<string, string | number>): void {
	for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v))
}

const HANDLE_SIZE = 7

const ALL_HANDLES: HandleDir[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"]

/**
 * Renders editor overlays (selection handles, connection ports, rubber-band,
 * resize preview, ghost shapes) inside a dedicated SVG group that lives in
 * the viewport's coordinate space.
 */
export class OverlayRenderer {
	private readonly _g: SVGGElement
	private readonly _markerId: string

	// Sub-groups for each overlay layer
	private readonly _selectionG: SVGGElement
	private readonly _portsG: SVGGElement
	private readonly _rubberG: SVGGElement
	private readonly _resizePreviewG: SVGGElement
	private readonly _ghostConnG: SVGGElement
	private readonly _boundaryHostG: SVGGElement
	private readonly _ghostCreateG: SVGGElement
	private readonly _alignG: SVGGElement
	private readonly _distG: SVGGElement
	private readonly _edgeEndpointsG: SVGGElement
	private readonly _endpointGhostG: SVGGElement
	private readonly _spaceG: SVGGElement
	private readonly _edgeHoverDotG: SVGGElement
	private readonly _edgeWaypointsG: SVGGElement

	constructor(overlayGroup: SVGGElement, markerId: string) {
		this._g = overlayGroup
		this._markerId = markerId

		this._selectionG = svgEl("g")
		this._portsG = svgEl("g")
		this._rubberG = svgEl("g")
		this._resizePreviewG = svgEl("g")
		this._ghostConnG = svgEl("g")
		this._boundaryHostG = svgEl("g")
		this._ghostCreateG = svgEl("g")
		this._alignG = svgEl("g")
		this._distG = svgEl("g")
		this._endpointGhostG = svgEl("g")
		this._edgeEndpointsG = svgEl("g")
		this._spaceG = svgEl("g")
		this._edgeHoverDotG = svgEl("g")
		this._edgeWaypointsG = svgEl("g")

		this._g.appendChild(this._spaceG)
		this._g.appendChild(this._boundaryHostG)
		this._g.appendChild(this._ghostCreateG)
		this._g.appendChild(this._ghostConnG)
		this._g.appendChild(this._endpointGhostG)
		this._g.appendChild(this._rubberG)
		this._g.appendChild(this._resizePreviewG)
		this._g.appendChild(this._alignG)
		this._g.appendChild(this._distG)
		this._g.appendChild(this._selectionG)
		this._g.appendChild(this._portsG)
		this._g.appendChild(this._edgeWaypointsG)
		this._g.appendChild(this._edgeEndpointsG)
		this._g.appendChild(this._edgeHoverDotG)
	}

	// ── Selection + handles ───────────────────────────────────────────

	setSelection(ids: string[], shapes: RenderedShape[], resizableIds?: ReadonlySet<string>): void {
		this._selectionG.innerHTML = ""

		const selected = shapes.filter((s) => ids.includes(s.id))
		if (selected.length === 0) return

		const isSingle = selected.length === 1

		for (const shape of selected) {
			const { x, y, width, height } = shape.shape.bounds

			// Selection outline
			const outline = svgEl("rect")
			attr(outline, {
				class: "bpmn-sel-indicator",
				x: x - 2,
				y: y - 2,
				width: width + 4,
				height: height + 4,
				rx: 2,
				"data-bpmn-id": shape.id,
			})
			this._selectionG.appendChild(outline)

			// Resize handles only for single selection of resizable elements
			if (isSingle && resizableIds?.has(shape.id)) {
				const positions = handlePositions(shape.shape.bounds)
				for (const dir of ALL_HANDLES) {
					const pos = positions[dir]
					const handle = svgEl("rect")
					attr(handle, {
						class: "bpmn-resize-handle",
						"data-bpmn-handle": dir,
						"data-bpmn-id": shape.id,
						x: pos.x - HANDLE_SIZE / 2,
						y: pos.y - HANDLE_SIZE / 2,
						width: HANDLE_SIZE,
						height: HANDLE_SIZE,
					})
					this._selectionG.appendChild(handle)
				}
			}
		}
	}

	// ── Hover ports ───────────────────────────────────────────────────

	setHovered(_id: string | null, _shapes: RenderedShape[]): void {
		// Port balls removed — connections are initiated via the contextual toolbar
		this._portsG.innerHTML = ""
	}

	// ── Alignment guides ──────────────────────────────────────────────

	setAlignmentGuides(guides: Array<{ x1: number; y1: number; x2: number; y2: number }>): void {
		this._alignG.innerHTML = ""
		for (const guide of guides) {
			const line = svgEl("line")
			attr(line, {
				class: "bpmn-align-guide",
				x1: guide.x1,
				y1: guide.y1,
				x2: guide.x2,
				y2: guide.y2,
			})
			this._alignG.appendChild(line)
		}
	}

	// ── Distance guides ───────────────────────────────────────────────

	setDistanceGuides(guides: Array<{ x1: number; y1: number; x2: number; y2: number }>): void {
		this._distG.innerHTML = ""
		const TICK = 4
		for (const g of guides) {
			const isH = Math.abs(g.y2 - g.y1) < 0.5
			const main = svgEl("line")
			attr(main, { class: "bpmn-dist-guide", x1: g.x1, y1: g.y1, x2: g.x2, y2: g.y2 })
			this._distG.appendChild(main)
			const t1 = svgEl("line")
			const t2 = svgEl("line")
			if (isH) {
				attr(t1, {
					class: "bpmn-dist-guide",
					x1: g.x1,
					y1: g.y1 - TICK,
					x2: g.x1,
					y2: g.y1 + TICK,
				})
				attr(t2, {
					class: "bpmn-dist-guide",
					x1: g.x2,
					y1: g.y2 - TICK,
					x2: g.x2,
					y2: g.y2 + TICK,
				})
			} else {
				attr(t1, {
					class: "bpmn-dist-guide",
					x1: g.x1 - TICK,
					y1: g.y1,
					x2: g.x1 + TICK,
					y2: g.y1,
				})
				attr(t2, {
					class: "bpmn-dist-guide",
					x1: g.x2 - TICK,
					y1: g.y2,
					x2: g.x2 + TICK,
					y2: g.y2,
				})
			}
			this._distG.appendChild(t1)
			this._distG.appendChild(t2)
		}
	}

	// ── Rubber-band ────────────────────────────────────────────────────

	setRubberBand(origin: DiagPoint | null, current?: DiagPoint): void {
		this._rubberG.innerHTML = ""
		if (!origin || !current) return

		const x = Math.min(origin.x, current.x)
		const y = Math.min(origin.y, current.y)
		const width = Math.abs(current.x - origin.x)
		const height = Math.abs(current.y - origin.y)

		const rect = svgEl("rect")
		attr(rect, { class: "bpmn-rubber-band", x, y, width, height })
		this._rubberG.appendChild(rect)
	}

	// ── Resize preview ─────────────────────────────────────────────────

	setResizePreview(bounds: BpmnBounds | null): void {
		this._resizePreviewG.innerHTML = ""
		if (!bounds) return

		const rect = svgEl("rect")
		attr(rect, {
			class: "bpmn-resize-preview",
			x: bounds.x,
			y: bounds.y,
			width: bounds.width,
			height: bounds.height,
		})
		this._resizePreviewG.appendChild(rect)
	}

	// ── Ghost connection ───────────────────────────────────────────────

	setGhostConnection(waypoints: BpmnWaypoint[] | null): void {
		this._ghostConnG.innerHTML = ""
		if (!waypoints || waypoints.length < 2) return
		const points = waypoints.map((wp) => `${wp.x},${wp.y}`).join(" ")
		const poly = svgEl("polyline")
		attr(poly, {
			class: "bpmn-ghost-conn",
			points,
			"marker-end": `url(#${this._markerId})`,
		})
		this._ghostConnG.appendChild(poly)
	}

	// ── Edge endpoint balls ────────────────────────────────────────────

	setEdgeEndpoints(waypoints: BpmnWaypoint[] | null, edgeId: string): void {
		this._edgeEndpointsG.innerHTML = ""
		if (!waypoints || waypoints.length < 2) return
		const first = waypoints[0]
		const last = waypoints[waypoints.length - 1]
		if (!first || !last) return
		for (const [pt, isStart] of [
			[first, true],
			[last, false],
		] as const) {
			const circle = svgEl("circle")
			attr(circle, {
				class: "bpmn-edge-endpoint",
				"data-bpmn-endpoint": isStart ? "start" : "end",
				"data-bpmn-id": edgeId,
				cx: pt.x,
				cy: pt.y,
				r: 5,
			})
			this._edgeEndpointsG.appendChild(circle)
		}
	}

	// ── Endpoint drag ghost ────────────────────────────────────────────

	setEndpointDragGhost(waypoints: BpmnWaypoint[] | null): void {
		this._endpointGhostG.innerHTML = ""
		if (!waypoints || waypoints.length < 2) return
		const points = waypoints.map((wp) => `${wp.x},${wp.y}`).join(" ")
		const poly = svgEl("polyline")
		attr(poly, { class: "bpmn-endpoint-ghost", points })
		this._endpointGhostG.appendChild(poly)
	}

	// ── Space tool split line ──────────────────────────────────────────

	setSpacePreview(axis: "h" | "v" | null, splitValue?: number): void {
		this._spaceG.innerHTML = ""
		if (!axis || splitValue === undefined) return

		const EXTENT = 10000
		const line = svgEl("line")
		if (axis === "h") {
			attr(line, {
				class: "bpmn-space-line",
				x1: splitValue,
				y1: -EXTENT,
				x2: splitValue,
				y2: EXTENT,
			})
		} else {
			attr(line, {
				class: "bpmn-space-line",
				x1: -EXTENT,
				y1: splitValue,
				x2: EXTENT,
				y2: splitValue,
			})
		}
		this._spaceG.appendChild(line)
	}

	// ── Ghost create shape ─────────────────────────────────────────────

	setGhostCreate(type: CreateShapeType | null, diag?: DiagPoint): void {
		this._ghostCreateG.innerHTML = ""
		if (!type || !diag) return

		const bounds = defaultBoundsForType(type, diag.x, diag.y)
		const { x, y, width, height } = bounds

		const g = svgEl("g")
		attr(g, { class: "bpmn-ghost", transform: `translate(${x} ${y})` })

		const isStartEvent =
			type === "startEvent" ||
			type === "messageStartEvent" ||
			type === "timerStartEvent" ||
			type === "conditionalStartEvent" ||
			type === "signalStartEvent"
		const isEndEvent =
			type === "endEvent" ||
			type === "messageEndEvent" ||
			type === "escalationEndEvent" ||
			type === "errorEndEvent" ||
			type === "compensationEndEvent" ||
			type === "signalEndEvent" ||
			type === "terminateEndEvent"
		const isIntermediateEvent =
			type === "intermediateThrowEvent" ||
			type === "intermediateCatchEvent" ||
			type === "messageCatchEvent" ||
			type === "messageThrowEvent" ||
			type === "timerCatchEvent" ||
			type === "escalationThrowEvent" ||
			type === "conditionalCatchEvent" ||
			type === "linkCatchEvent" ||
			type === "linkThrowEvent" ||
			type === "compensationThrowEvent" ||
			type === "signalCatchEvent" ||
			type === "signalThrowEvent"
		const isGateway =
			type === "exclusiveGateway" ||
			type === "parallelGateway" ||
			type === "inclusiveGateway" ||
			type === "eventBasedGateway" ||
			type === "complexGateway"
		const isAnnotation = type === "textAnnotation"

		if (isStartEvent || isEndEvent || isIntermediateEvent) {
			const cx = width / 2
			const cy = height / 2
			const r = Math.min(cx, cy) - 1
			const circle = svgEl("circle")
			attr(circle, {
				cx,
				cy,
				r,
				class: isEndEvent ? "bpmn-end-body" : "bpmn-event-body",
			})
			g.appendChild(circle)
			if (isIntermediateEvent) {
				const inner = svgEl("circle")
				attr(inner, { cx, cy, r: r - 3, class: "bpmn-event-inner" })
				g.appendChild(inner)
			}
		} else if (isGateway) {
			const cx = width / 2
			const cy = height / 2
			const diamond = svgEl("polygon")
			attr(diamond, {
				points: `${cx},0 ${width},${cy} ${cx},${height} 0,${cy}`,
				class: "bpmn-gw-body",
			})
			g.appendChild(diamond)
		} else if (isAnnotation) {
			const path = svgEl("path")
			attr(path, {
				d: `M ${width * 0.4} 0 L 0 0 L 0 ${height} L ${width * 0.4} ${height}`,
				class: "bpmn-shape-body",
				fill: "none",
			})
			g.appendChild(path)
		} else {
			const rect = svgEl("rect")
			attr(rect, { x: 0, y: 0, width, height, rx: 10, class: "bpmn-shape-body" })
			g.appendChild(rect)
		}

		this._ghostCreateG.appendChild(g)
	}

	// ── Edge hover dot ─────────────────────────────────────────────────

	setEdgeHoverDot(pt: DiagPoint | null): void {
		this._edgeHoverDotG.innerHTML = ""
		if (!pt) return
		const circle = svgEl("circle")
		attr(circle, { class: "bpmn-edge-hover-dot", cx: pt.x, cy: pt.y, r: 4 })
		this._edgeHoverDotG.appendChild(circle)
	}

	// ── Edge waypoint balls ────────────────────────────────────────────

	setEdgeWaypointBalls(waypoints: BpmnWaypoint[] | null, edgeId: string | null): void {
		this._edgeWaypointsG.innerHTML = ""
		if (!waypoints || !edgeId || waypoints.length < 3) return
		for (let i = 1; i < waypoints.length - 1; i++) {
			const wp = waypoints[i]
			if (!wp) continue
			const circle = svgEl("circle")
			attr(circle, {
				class: "bpmn-edge-waypoint-ball",
				"data-bpmn-waypoint": "",
				"data-bpmn-waypoint-idx": i,
				"data-bpmn-id": edgeId,
				cx: wp.x,
				cy: wp.y,
				r: 5,
			})
			this._edgeWaypointsG.appendChild(circle)
		}
	}

	// ── Boundary host highlight ────────────────────────────────────────

	setBoundaryHostHighlight(
		shapeBounds: { x: number; y: number; width: number; height: number } | null,
	): void {
		this._boundaryHostG.innerHTML = ""
		if (!shapeBounds) return
		const rect = svgEl("rect")
		attr(rect, {
			class: "bpmn-boundary-host",
			x: shapeBounds.x - 3,
			y: shapeBounds.y - 3,
			width: shapeBounds.width + 6,
			height: shapeBounds.height + 6,
			rx: 12,
		})
		this._boundaryHostG.appendChild(rect)
	}
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function defaultBoundsForType(
	type: CreateShapeType,
	cx: number,
	cy: number,
): { x: number; y: number; width: number; height: number } {
	const isEvent =
		type === "startEvent" ||
		type === "messageStartEvent" ||
		type === "timerStartEvent" ||
		type === "conditionalStartEvent" ||
		type === "signalStartEvent" ||
		type === "endEvent" ||
		type === "messageEndEvent" ||
		type === "escalationEndEvent" ||
		type === "errorEndEvent" ||
		type === "compensationEndEvent" ||
		type === "signalEndEvent" ||
		type === "terminateEndEvent" ||
		type === "intermediateThrowEvent" ||
		type === "intermediateCatchEvent" ||
		type === "messageCatchEvent" ||
		type === "messageThrowEvent" ||
		type === "timerCatchEvent" ||
		type === "escalationThrowEvent" ||
		type === "conditionalCatchEvent" ||
		type === "linkCatchEvent" ||
		type === "linkThrowEvent" ||
		type === "compensationThrowEvent" ||
		type === "signalCatchEvent" ||
		type === "signalThrowEvent"
	if (isEvent) return { x: cx - 18, y: cy - 18, width: 36, height: 36 }

	const isGateway =
		type === "exclusiveGateway" ||
		type === "parallelGateway" ||
		type === "inclusiveGateway" ||
		type === "eventBasedGateway" ||
		type === "complexGateway"
	if (isGateway) return { x: cx - 25, y: cy - 25, width: 50, height: 50 }

	if (type === "subProcess" || type === "transaction")
		return { x: cx - 100, y: cy - 60, width: 200, height: 120 }
	if (type === "textAnnotation") return { x: cx - 50, y: cy - 25, width: 100, height: 50 }
	return { x: cx - 50, y: cy - 40, width: 100, height: 80 }
}
