/**
 * SVG-based interactive DRD (Decision Requirements Diagram) canvas.
 *
 * Visual style matches the BPMN editor: dot-grid background, floating
 * bottom-center toolbar for adding nodes, contextual toolbar below each
 * selected node.
 *
 * Features:
 *   - Dot-grid background that scrolls with the viewport
 *   - Pan (drag on empty canvas) + zoom (mouse wheel)
 *   - 5 node shapes: Decision, InputData, KnowledgeSource, BKM, TextAnnotation
 *   - 4 edge types: InformationRequirement, KnowledgeRequirement, AuthorityRequirement, Association
 *   - Node selection and movement
 *   - Keyboard delete / Escape
 *   - Contextual toolbar below selected node: Edit Table (Decision), Connect, Delete
 *   - Bottom-center floating toolbar for adding new nodes
 *   - Double-click Decision → open decision table
 *   - Inline label editing on double-click (non-decision nodes)
 */
import type { DmnDefinitions, DmnWaypoint } from "@bpmn-sdk/core"

// ── Constants ─────────────────────────────────────────────────────────────────

const SVG_NS = "http://www.w3.org/2000/svg"
const GRID_SIZE = 20
let _instanceCounter = 0

const NODE_SIZE = {
	decision: { width: 180, height: 80 },
	inputData: { width: 125, height: 45 },
	knowledgeSource: { width: 100, height: 63 },
	businessKnowledgeModel: { width: 135, height: 46 },
	textAnnotation: { width: 100, height: 80 },
} as const

// ── Icons ─────────────────────────────────────────────────────────────────────

const IC = {
	decision: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="1" width="26" height="16" rx="1.5"/></svg>`,
	inputData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="1" y="1" width="26" height="14" rx="7"/></svg>`,
	knowledgeSource: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1,1 L23,1 L23,15 C18,21 6,11 1,17 Z"/></svg>`,
	businessKnowledgeModel: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6,1 L25,1 L25,17 L1,17 L1,6 Z"/></svg>`,
	textAnnotation: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8,1 L1,1 L1,17 L8,17"/></svg>`,
	connect: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2,7 L16,7 M12,3 L16,7 L12,11"/></svg>`,
	editTable: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="1" width="18" height="14" rx="1"/><line x1="1" y1="6" x2="19" y2="6"/><line x1="8" y1="6" x2="8" y2="15"/></svg>`,
	trash: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1,4 15,4"/><path d="M3,4 L3,15 L13,15 L13,4"/><path d="M6,1 L10,1"/></svg>`,
}

// ── Types ─────────────────────────────────────────────────────────────────────

type NodeType = keyof typeof NODE_SIZE
type EdgeType =
	| "informationRequirement"
	| "knowledgeRequirement"
	| "authorityRequirement"
	| "association"

interface NodeInfo {
	id: string
	type: NodeType
	label: string
	x: number
	y: number
	width: number
	height: number
}

interface EdgeInfo {
	id: string
	type: EdgeType
	sourceId: string
	targetId: string
	waypoints: DmnWaypoint[]
}

export interface DrdCanvasOptions {
	container: HTMLElement
	defs: DmnDefinitions
	onChange?: () => void
	onDecisionOpen?: (decisionId: string) => void
}

// ── Connection rules for quick-add ────────────────────────────────────────────

const QUICK_ADD_TARGETS: Partial<Record<NodeType, NodeType[]>> = {
	decision: ["decision", "textAnnotation"],
	inputData: ["decision", "textAnnotation"],
	knowledgeSource: ["decision", "knowledgeSource", "businessKnowledgeModel", "textAnnotation"],
	businessKnowledgeModel: ["decision", "businessKnowledgeModel", "textAnnotation"],
}

const QUICK_ADD_LABELS: Partial<Record<NodeType, string>> = {
	decision: "Decision",
	inputData: "Input Data",
	knowledgeSource: "Knowledge Source",
	businessKnowledgeModel: "BKM",
	textAnnotation: "Annotation",
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

function rectEdgePoint(
	cx: number,
	cy: number,
	w: number,
	h: number,
	tx: number,
	ty: number,
): { x: number; y: number } {
	const dx = tx - cx
	const dy = ty - cy
	if (dx === 0 && dy === 0) return { x: cx, y: cy }
	const hw = w / 2
	const hh = h / 2
	const sx = hw / Math.abs(dx)
	const sy = hh / Math.abs(dy)
	const scale = Math.min(sx, sy)
	return { x: cx + dx * scale, y: cy + dy * scale }
}

function computeEdgePath(src: NodeInfo, tgt: NodeInfo, waypoints: DmnWaypoint[]): string {
	if (waypoints.length >= 2) {
		const first = waypoints[0]
		if (!first) return ""
		let d = `M ${first.x},${first.y}`
		for (let i = 1; i < waypoints.length; i++) {
			const wp = waypoints[i]
			if (wp) d += ` L ${wp.x},${wp.y}`
		}
		return d
	}
	const sx = src.x + src.width / 2
	const sy = src.y + src.height / 2
	const tx = tgt.x + tgt.width / 2
	const ty = tgt.y + tgt.height / 2
	const start = rectEdgePoint(sx, sy, src.width, src.height, tx, ty)
	const end = rectEdgePoint(tx, ty, tgt.width, tgt.height, sx, sy)
	return `M ${start.x},${start.y} L ${end.x},${end.y}`
}

// ── SVG helpers ───────────────────────────────────────────────────────────────

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
	return document.createElementNS(SVG_NS, tag) as SVGElementTagNameMap[K]
}

function setAttrs(el: SVGElement, attrs: Record<string, string | number>): void {
	for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v))
}

function cls(el: SVGElement, names: string): void {
	el.setAttribute("class", names)
}

function uid(): string {
	return Math.random().toString(36).slice(2, 10)
}

// ── DRD Canvas ────────────────────────────────────────────────────────────────

export class DrdCanvas {
	private _defs: DmnDefinitions
	private readonly _root: HTMLDivElement
	private readonly _svg: SVGSVGElement
	private readonly _vpGroup: SVGGElement
	private readonly _edgesLayer: SVGGElement
	private readonly _nodesLayer: SVGGElement
	private readonly _svgDefsEl: SVGDefsElement
	private _gridPattern: SVGPatternElement | null = null
	private readonly _guidesLayer: SVGGElement

	private readonly _bottomBar: HTMLDivElement
	private readonly _ctxBar: HTMLDivElement
	private _ctxBarNodeId: string | null = null

	private _vpX = 40
	private _vpY = 40
	private _scale = 1

	private _selectedIds = new Set<string>()
	private _panStart: { mx: number; my: number; vpX: number; vpY: number } | null = null
	private _dragNode: {
		id: string
		startMx: number
		startMy: number
		startX: number
		startY: number
	} | null = null
	private _connectMode = false
	private _connectSourceId: string | null = null

	private readonly _onChange: () => void
	private readonly _onDecisionOpen: (id: string) => void
	private readonly _cleanups: Array<() => void> = []

	constructor(options: DrdCanvasOptions) {
		_instanceCounter++
		this._defs = options.defs
		this._onChange = options.onChange ?? (() => undefined)
		this._onDecisionOpen = options.onDecisionOpen ?? (() => undefined)

		// Root — position: relative so absolute children are positioned inside
		this._root = document.createElement("div")
		this._root.className = "drd-root"

		// SVG — fills root absolutely
		this._svg = svgEl("svg")
		cls(this._svg, "drd-svg")
		this._root.appendChild(this._svg)

		// Defs (markers + grid pattern)
		this._svgDefsEl = svgEl("defs")
		this._svg.appendChild(this._svgDefsEl)
		this._buildMarkers()
		this._buildGrid()

		// Viewport group (contains edges + nodes)
		this._vpGroup = svgEl("g")
		this._svg.appendChild(this._vpGroup)

		this._edgesLayer = svgEl("g")
		cls(this._edgesLayer, "drd-edges")
		this._vpGroup.appendChild(this._edgesLayer)

		this._nodesLayer = svgEl("g")
		cls(this._nodesLayer, "drd-nodes")
		this._vpGroup.appendChild(this._nodesLayer)

		this._guidesLayer = svgEl("g")
		cls(this._guidesLayer, "drd-guides")
		this._vpGroup.appendChild(this._guidesLayer)

		// Floating toolbars
		this._bottomBar = this._buildBottomBar()
		this._root.appendChild(this._bottomBar)

		this._ctxBar = document.createElement("div")
		this._ctxBar.className = "drd-bar drd-ctx-bar"
		this._ctxBar.style.display = "none"
		this._root.appendChild(this._ctxBar)

		options.container.appendChild(this._root)
		this._bindEvents()
		this._ensureLayout()
		this._render()
	}

	setDefs(defs: DmnDefinitions): void {
		this._defs = defs
		this._ensureLayout()
		this._render()
	}

	destroy(): void {
		for (const fn of this._cleanups) fn()
		this._cleanups.length = 0
		this._root.remove()
	}

	// ── Dot-grid background ────────────────────────────────────────────────────

	private _buildGrid(): void {
		const patternId = `drd-grid-${_instanceCounter}`

		const pattern = svgEl("pattern")
		setAttrs(pattern, {
			id: patternId,
			width: GRID_SIZE,
			height: GRID_SIZE,
			patternUnits: "userSpaceOnUse",
		})
		const dot = svgEl("circle")
		setAttrs(dot, { cx: 1, cy: 1, r: 1, fill: "var(--drd-grid, rgba(0,0,0,0.12))" })
		pattern.appendChild(dot)
		this._svgDefsEl.appendChild(pattern)
		this._gridPattern = pattern

		// Background rect filled with the pattern (before vpGroup so it's behind nodes)
		const bg = svgEl("rect")
		setAttrs(bg, { width: "100%", height: "100%", fill: `url(#${patternId})` })
		bg.setAttribute("pointer-events", "none")
		this._svg.insertBefore(bg, this._vpGroup)
	}

	// ── Auto-layout for nodes without diagram positions ────────────────────────

	private _ensureLayout(): void {
		const defs = this._defs
		if (!defs.diagram) defs.diagram = { shapes: [], edges: [] }
		const diagram = defs.diagram
		const existingIds = new Set(diagram.shapes.map((s) => s.dmnElementRef))

		const allNodes = this._buildNodes()
		const unplaced = allNodes.filter((n) => !existingIds.has(n.id))
		if (unplaced.length === 0) return

		const maxX = diagram.shapes.reduce((m, s) => Math.max(m, s.bounds.x + s.bounds.width), 0)
		const startX = diagram.shapes.length > 0 ? maxX + 80 : 80

		unplaced.forEach((n, i) => {
			const col = i % 3
			const row = Math.floor(i / 3)
			diagram.shapes.push({
				dmnElementRef: n.id,
				bounds: {
					x: startX + col * 220,
					y: 80 + row * 120,
					width: NODE_SIZE[n.type].width,
					height: NODE_SIZE[n.type].height,
				},
			})
		})
	}

	// ── Data extraction ────────────────────────────────────────────────────────

	private _buildNodes(): NodeInfo[] {
		const defs = this._defs
		const shapesMap = new Map((defs.diagram?.shapes ?? []).map((s) => [s.dmnElementRef, s]))
		const nodes: NodeInfo[] = []

		const push = (id: string, type: NodeType, label: string): void => {
			const shape = shapesMap.get(id)
			const size = NODE_SIZE[type]
			nodes.push({
				id,
				type,
				label,
				x: shape?.bounds.x ?? 80,
				y: shape?.bounds.y ?? 80,
				width: shape?.bounds.width ?? size.width,
				height: shape?.bounds.height ?? size.height,
			})
		}

		for (const d of defs.decisions) push(d.id, "decision", d.name ?? d.id)
		for (const id of defs.inputData) push(id.id, "inputData", id.name ?? id.id)
		for (const ks of defs.knowledgeSources) push(ks.id, "knowledgeSource", ks.name ?? ks.id)
		for (const bkm of defs.businessKnowledgeModels)
			push(bkm.id, "businessKnowledgeModel", bkm.name ?? bkm.id)
		for (const ann of defs.textAnnotations) push(ann.id, "textAnnotation", ann.text ?? ann.id)

		return nodes
	}

	private _buildEdges(): EdgeInfo[] {
		const defs = this._defs
		const waypointsMap = new Map(
			(defs.diagram?.edges ?? []).map((e) => [e.dmnElementRef, e.waypoints]),
		)
		const edges: EdgeInfo[] = []

		const push = (id: string, type: EdgeType, sourceId: string, targetId: string): void => {
			if (!sourceId || !targetId) return
			edges.push({ id, type, sourceId, targetId, waypoints: waypointsMap.get(id) ?? [] })
		}

		for (const d of defs.decisions) {
			for (const req of d.informationRequirements)
				push(
					req.id,
					"informationRequirement",
					req.requiredDecision ?? req.requiredInput ?? "",
					d.id,
				)
			for (const req of d.knowledgeRequirements)
				push(req.id, "knowledgeRequirement", req.requiredKnowledge, d.id)
			for (const req of d.authorityRequirements)
				push(
					req.id,
					"authorityRequirement",
					req.requiredAuthority ?? req.requiredDecision ?? req.requiredInput ?? "",
					d.id,
				)
		}
		for (const ks of defs.knowledgeSources) {
			for (const req of ks.authorityRequirements)
				push(
					req.id,
					"authorityRequirement",
					req.requiredAuthority ?? req.requiredDecision ?? req.requiredInput ?? "",
					ks.id,
				)
		}
		for (const bkm of defs.businessKnowledgeModels) {
			for (const req of bkm.knowledgeRequirements)
				push(req.id, "knowledgeRequirement", req.requiredKnowledge, bkm.id)
			for (const req of bkm.authorityRequirements)
				push(
					req.id,
					"authorityRequirement",
					req.requiredAuthority ?? req.requiredDecision ?? req.requiredInput ?? "",
					bkm.id,
				)
		}
		for (const assoc of defs.associations)
			push(assoc.id, "association", assoc.sourceRef, assoc.targetRef)

		return edges
	}

	// ── Rendering ─────────────────────────────────────────────────────────────

	private _buildMarkers(): void {
		const mk = (id: string, w: number, h: number, rx: number, ry: number): SVGMarkerElement => {
			const m = svgEl("marker")
			setAttrs(m, { id, markerWidth: w, markerHeight: h, refX: rx, refY: ry, orient: "auto" })
			return m
		}

		// Filled arrow — InformationRequirement
		const infoM = mk("drd-info-arrow", 10, 8, 9, 4)
		const infoP = svgEl("path")
		setAttrs(infoP, { d: "M 0,0 L 9,4 L 0,8 Z" })
		cls(infoP, "drd-marker-fill")
		infoM.appendChild(infoP)

		// Open V arrow — KnowledgeRequirement
		const knowM = mk("drd-know-arrow", 12, 8, 10, 4)
		const knowPL = svgEl("polyline")
		setAttrs(knowPL, { points: "0,0 8,4 0,8", fill: "none", "stroke-width": 1.5 })
		cls(knowPL, "drd-marker-stroke")
		knowM.appendChild(knowPL)

		// Circle — AuthorityRequirement source
		const authM = mk("drd-auth-circle", 10, 10, 5, 5)
		const authC = svgEl("circle")
		setAttrs(authC, { cx: 5, cy: 5, r: 4, fill: "none", "stroke-width": 1.5 })
		cls(authC, "drd-marker-stroke")
		authM.appendChild(authC)

		// Open arrow — Association
		const assocM = mk("drd-assoc-arrow", 10, 8, 9, 4)
		const assocPL = svgEl("polyline")
		setAttrs(assocPL, { points: "0,0 8,4 0,8", fill: "none", "stroke-width": 1.5 })
		cls(assocPL, "drd-marker-assoc")
		assocM.appendChild(assocPL)

		for (const m of [infoM, knowM, authM, assocM]) this._svgDefsEl.appendChild(m)
	}

	private _render(): void {
		this._edgesLayer.innerHTML = ""
		this._nodesLayer.innerHTML = ""
		this._updateTransform()

		// Toggle crosshair cursor when in connect mode
		this._root.classList.toggle("drd-connect-mode", this._connectMode)

		const nodes = this._buildNodes()
		const nodeMap = new Map<string, NodeInfo>(nodes.map((n) => [n.id, n]))
		const edges = this._buildEdges()

		for (const edge of edges) {
			const src = nodeMap.get(edge.sourceId)
			const tgt = nodeMap.get(edge.targetId)
			if (src && tgt) this._edgesLayer.appendChild(this._renderEdge(edge, src, tgt))
		}
		for (const node of nodes) this._nodesLayer.appendChild(this._renderNode(node))

		// Update contextual toolbar
		if (this._selectedIds.size === 1) {
			const id = [...this._selectedIds][0]
			const n = id ? nodeMap.get(id) : undefined
			if (n) {
				this._showCtxBar(n)
			} else {
				this._hideCtxBar()
			}
		} else {
			this._hideCtxBar()
		}
	}

	private _renderNode(n: NodeInfo): SVGGElement {
		const g = svgEl("g")
		const selected = this._selectedIds.has(n.id)
		const connectSrc = this._connectMode && this._connectSourceId === n.id
		const classes = ["drd-node", `drd-node--${n.type}`]
		if (selected) classes.push("drd-node--selected")
		if (connectSrc) classes.push("drd-node--connect-src")
		cls(g, classes.join(" "))
		g.dataset.id = n.id
		setAttrs(g, { transform: `translate(${n.x},${n.y})` })

		g.appendChild(this._makeNodeShape(n))

		const fo = svgEl("foreignObject")
		setAttrs(fo, { x: 0, y: 0, width: n.width, height: n.height })
		const div = document.createElement("div")
		div.className = "drd-label"
		div.style.cssText = `width:${n.width}px;height:${n.height}px;`
		div.textContent = n.label
		fo.appendChild(div)
		g.appendChild(fo)

		if (this._connectMode) {
			const hi = svgEl("rect")
			setAttrs(hi, { x: -3, y: -3, width: n.width + 6, height: n.height + 6, rx: 4, ry: 4 })
			cls(hi, "drd-connect-hi")
			g.appendChild(hi)
		}

		g.addEventListener("mousedown", (e) => this._onNodeMouseDown(e, n))
		g.addEventListener("dblclick", (e) => this._onNodeDblClick(e, n))

		return g
	}

	private _makeNodeShape(n: NodeInfo): SVGElement {
		const { width: w, height: h } = n
		let el: SVGElement

		if (n.type === "decision") {
			const r = svgEl("rect")
			setAttrs(r, { x: 0, y: 0, width: w, height: h, rx: 2, ry: 2 })
			el = r
		} else if (n.type === "inputData") {
			const r = svgEl("rect")
			setAttrs(r, { x: 0, y: 0, width: w, height: h, rx: h / 2, ry: h / 2 })
			el = r
		} else if (n.type === "knowledgeSource") {
			const wave = h * 0.18
			const p = svgEl("path")
			setAttrs(p, {
				d: `M 0,0 L ${w},0 L ${w},${h - wave} C ${w * 0.75},${h + wave * 0.5} ${w * 0.25},${h - wave * 2.5} 0,${h - wave} Z`,
			})
			el = p
		} else if (n.type === "businessKnowledgeModel") {
			const clip = 14
			const p = svgEl("path")
			setAttrs(p, { d: `M ${clip},0 L ${w},0 L ${w},${h} L 0,${h} L 0,${clip} Z` })
			el = p
		} else {
			// textAnnotation — open bracket
			const p = svgEl("path")
			const inset = 16
			setAttrs(p, {
				d: `M ${inset},0 L 0,0 L 0,${h} L ${inset},${h}`,
				fill: "none",
			})
			el = p
		}

		cls(el, "drd-shape")
		return el
	}

	private _renderEdge(edge: EdgeInfo, src: NodeInfo, tgt: NodeInfo): SVGGElement {
		const g = svgEl("g")
		const selected = this._selectedIds.has(edge.id)
		const classes = ["drd-edge", `drd-edge--${edge.type}`]
		if (selected) classes.push("drd-edge--selected")
		cls(g, classes.join(" "))
		g.dataset.id = edge.id

		const d = computeEdgePath(src, tgt, edge.waypoints)

		const hit = svgEl("path")
		setAttrs(hit, { d, stroke: "transparent", "stroke-width": 12, fill: "none" })
		g.appendChild(hit)

		const line = svgEl("path")
		setAttrs(line, { d, fill: "none", "stroke-width": 1.5, "stroke-linecap": "round" })
		cls(line, "drd-edge-line")

		if (edge.type === "informationRequirement") {
			line.setAttribute("marker-end", "url(#drd-info-arrow)")
		} else if (edge.type === "knowledgeRequirement") {
			line.setAttribute("stroke-dasharray", "6,3")
			line.setAttribute("marker-end", "url(#drd-know-arrow)")
		} else if (edge.type === "authorityRequirement") {
			line.setAttribute("stroke-dasharray", "6,3")
			line.setAttribute("marker-start", "url(#drd-auth-circle)")
		} else {
			line.setAttribute("stroke-dasharray", "3,4")
			line.setAttribute("marker-end", "url(#drd-assoc-arrow)")
		}

		g.appendChild(line)

		g.addEventListener("mousedown", (e) => {
			e.stopPropagation()
			if (this._connectMode) return
			this._selectedIds.clear()
			this._selectedIds.add(edge.id)
			this._render()
		})

		return g
	}

	private _updateTransform(): void {
		const t = `translate(${this._vpX},${this._vpY}) scale(${this._scale})`
		this._vpGroup.setAttribute("transform", t)
		if (this._gridPattern) {
			this._gridPattern.setAttribute("patternTransform", t)
		}
		this._updateCtxBarPosition()
	}

	// ── Snap alignment ─────────────────────────────────────────────────────────

	private _computeSnap(
		cx: number,
		cy: number,
		w: number,
		h: number,
		dragId: string,
	): { adjX: number; adjY: number; guides: Array<{ type: "h" | "v"; pos: number }> } {
		const thr = 8 / this._scale
		const shapes = (this._defs.diagram?.shapes ?? []).filter((s) => s.dmnElementRef !== dragId)

		const dxs = [cx, cx + w / 2, cx + w]
		const dys = [cy, cy + h / 2, cy + h]

		let bestX: { delta: number; guidePos: number } | null = null
		let bestY: { delta: number; guidePos: number } | null = null

		for (const s of shapes) {
			const { x, y, width, height } = s.bounds
			const sxs = [x, x + width / 2, x + width]
			const sys = [y, y + height / 2, y + height]

			for (const da of dxs) {
				for (const sa of sxs) {
					const d = sa - da
					if (Math.abs(d) < thr && (bestX === null || Math.abs(d) < Math.abs(bestX.delta))) {
						bestX = { delta: d, guidePos: sa }
					}
				}
			}
			for (const da of dys) {
				for (const sa of sys) {
					const d = sa - da
					if (Math.abs(d) < thr && (bestY === null || Math.abs(d) < Math.abs(bestY.delta))) {
						bestY = { delta: d, guidePos: sa }
					}
				}
			}
		}

		const guides: Array<{ type: "h" | "v"; pos: number }> = []
		if (bestX) guides.push({ type: "v", pos: bestX.guidePos })
		if (bestY) guides.push({ type: "h", pos: bestY.guidePos })
		return { adjX: bestX?.delta ?? 0, adjY: bestY?.delta ?? 0, guides }
	}

	private _renderGuides(guides: Array<{ type: "h" | "v"; pos: number }>): void {
		this._guidesLayer.innerHTML = ""
		for (const g of guides) {
			const line = svgEl("line")
			cls(line, "drd-align-guide")
			if (g.type === "v") {
				setAttrs(line, { x1: g.pos, y1: -2000, x2: g.pos, y2: 2000 })
			} else {
				setAttrs(line, { x1: -2000, y1: g.pos, x2: 2000, y2: g.pos })
			}
			this._guidesLayer.appendChild(line)
		}
	}

	private _clearGuides(): void {
		this._guidesLayer.innerHTML = ""
	}

	// ── Bottom toolbar ─────────────────────────────────────────────────────────

	private _buildBottomBar(): HTMLDivElement {
		const bar = document.createElement("div")
		bar.className = "drd-bar drd-bottom-bar"

		const btn = (icon: string, title: string, onClick: () => void): HTMLButtonElement => {
			const b = document.createElement("button")
			b.type = "button"
			b.className = "drd-bar-btn"
			b.innerHTML = icon
			b.title = title
			b.addEventListener("click", onClick)
			return b
		}

		const sep = (): HTMLDivElement => {
			const d = document.createElement("div")
			d.className = "drd-bar-sep"
			return d
		}

		bar.append(
			btn(IC.decision, "Add Decision", () => this._addNode("decision")),
			btn(IC.inputData, "Add Input Data", () => this._addNode("inputData")),
			btn(IC.knowledgeSource, "Add Knowledge Source", () => this._addNode("knowledgeSource")),
			btn(IC.businessKnowledgeModel, "Add Business Knowledge Model", () =>
				this._addNode("businessKnowledgeModel"),
			),
			sep(),
			btn(IC.textAnnotation, "Add Text Annotation", () => this._addNode("textAnnotation")),
		)

		return bar
	}

	// ── Contextual toolbar ─────────────────────────────────────────────────────

	private _showCtxBar(n: NodeInfo): void {
		this._ctxBarNodeId = n.id
		this._ctxBar.innerHTML = ""

		const barBtn = (
			icon: string,
			title: string,
			onClick: () => void,
			active = false,
		): HTMLButtonElement => {
			const b = document.createElement("button")
			b.type = "button"
			b.className = active ? "drd-bar-btn active" : "drd-bar-btn"
			b.innerHTML = icon
			b.title = title
			b.addEventListener("click", (e) => {
				e.stopPropagation()
				onClick()
			})
			return b
		}

		const sep = (): HTMLDivElement => {
			const d = document.createElement("div")
			d.className = "drd-bar-sep"
			return d
		}

		// "Edit Table" — Decision nodes only
		if (n.type === "decision") {
			this._ctxBar.append(
				barBtn(IC.editTable, "Edit decision table (double-click)", () =>
					this._onDecisionOpen(n.id),
				),
				sep(),
			)
		}

		// "Connect" — start connect mode from this node
		const isConnectSrc = this._connectMode && this._connectSourceId === n.id
		this._ctxBar.appendChild(
			barBtn(
				IC.connect,
				isConnectSrc ? "Cancel connect (Escape)" : "Connect to another element",
				() => {
					if (this._connectMode && this._connectSourceId === n.id) {
						this._connectMode = false
						this._connectSourceId = null
					} else {
						this._connectMode = true
						this._connectSourceId = n.id
					}
					this._render()
				},
				isConnectSrc,
			),
		)

		// Quick-add connected nodes
		const quickTargets = QUICK_ADD_TARGETS[n.type]
		if (quickTargets && quickTargets.length > 0) {
			this._ctxBar.appendChild(sep())
			for (const targetType of quickTargets) {
				const label = QUICK_ADD_LABELS[targetType] ?? targetType
				this._ctxBar.appendChild(
					barBtn(IC[targetType], `Add connected ${label}`, () =>
						this._addConnectedNode(n.id, targetType),
					),
				)
			}
		}

		// "Delete"
		this._ctxBar.append(
			sep(),
			barBtn(IC.trash, "Delete element (Delete key)", () => {
				this._deleteElement(n.id)
				this._selectedIds.clear()
				this._render()
				this._onChange()
			}),
		)

		this._updateCtxBarPosition()
		this._ctxBar.style.display = "flex"
	}

	private _hideCtxBar(): void {
		this._ctxBarNodeId = null
		this._ctxBar.style.display = "none"
	}

	private _updateCtxBarPosition(): void {
		if (!this._ctxBarNodeId) return
		const shape = this._defs.diagram?.shapes.find((s) => s.dmnElementRef === this._ctxBarNodeId)
		if (!shape) return
		const { x, y, width, height } = shape.bounds
		const cx = (x + width / 2) * this._scale + this._vpX
		const top = (y + height) * this._scale + this._vpY + 8
		this._ctxBar.style.left = `${cx}px`
		this._ctxBar.style.top = `${top}px`
	}

	// ── Node creation ──────────────────────────────────────────────────────────

	private _addNode(type: NodeType): void {
		const id = `${type}_${uid()}`
		const size = NODE_SIZE[type]
		const defs = this._defs

		const cx = (this._svg.clientWidth / 2 - this._vpX) / this._scale
		const cy = (this._svg.clientHeight / 2 - this._vpY) / this._scale

		if (!defs.diagram) defs.diagram = { shapes: [], edges: [] }
		defs.diagram.shapes.push({
			dmnElementRef: id,
			bounds: {
				x: cx - size.width / 2,
				y: cy - size.height / 2,
				width: size.width,
				height: size.height,
			},
		})

		switch (type) {
			case "decision":
				defs.decisions.push({
					id,
					name: "Decision",
					informationRequirements: [],
					knowledgeRequirements: [],
					authorityRequirements: [],
				})
				break
			case "inputData":
				defs.inputData.push({ id, name: "Input Data" })
				break
			case "knowledgeSource":
				defs.knowledgeSources.push({ id, name: "Knowledge Source", authorityRequirements: [] })
				break
			case "businessKnowledgeModel":
				defs.businessKnowledgeModels.push({
					id,
					name: "BKM",
					knowledgeRequirements: [],
					authorityRequirements: [],
				})
				break
			case "textAnnotation":
				defs.textAnnotations.push({ id, text: "Note" })
				break
		}

		this._selectedIds.clear()
		this._selectedIds.add(id)
		this._render()
		this._onChange()
	}

	// ── Smart placement + quick-add ───────────────────────────────────────────

	private _smartPlace(sourceId: string, targetType: NodeType): { x: number; y: number } {
		const GAP = 60
		const tSize = NODE_SIZE[targetType]
		const srcShape = this._defs.diagram?.shapes.find((s) => s.dmnElementRef === sourceId)
		if (!srcShape) return { x: 80, y: 80 }

		const { x: sx, y: sy, width: sw, height: sh } = srcShape.bounds
		const allBounds = (this._defs.diagram?.shapes ?? []).map((s) => s.bounds)

		const overlaps = (px: number, py: number): boolean => {
			const m = 10
			for (const b of allBounds) {
				if (
					px + tSize.width + m > b.x &&
					px - m < b.x + b.width &&
					py + tSize.height + m > b.y &&
					py - m < b.y + b.height
				) {
					return true
				}
			}
			return false
		}

		for (let mult = 1; mult <= 6; mult++) {
			const gap = GAP * mult
			const candidates = [
				{ x: sx + sw + gap, y: sy + sh / 2 - tSize.height / 2 },
				{ x: sx + sw / 2 - tSize.width / 2, y: sy + sh + gap },
				{ x: sx + sw / 2 - tSize.width / 2, y: sy - tSize.height - gap },
			]
			for (const c of candidates) {
				if (!overlaps(c.x, c.y)) return c
			}
		}

		return { x: sx + sw + GAP * 7, y: sy }
	}

	private _addConnectedNode(sourceId: string, targetType: NodeType): void {
		const id = `${targetType}_${uid()}`
		const size = NODE_SIZE[targetType]
		const pos = this._smartPlace(sourceId, targetType)
		const defs = this._defs
		if (!defs.diagram) defs.diagram = { shapes: [], edges: [] }

		defs.diagram.shapes.push({
			dmnElementRef: id,
			bounds: { x: pos.x, y: pos.y, width: size.width, height: size.height },
		})

		switch (targetType) {
			case "decision":
				defs.decisions.push({
					id,
					name: "Decision",
					informationRequirements: [],
					knowledgeRequirements: [],
					authorityRequirements: [],
				})
				break
			case "inputData":
				defs.inputData.push({ id, name: "Input Data" })
				break
			case "knowledgeSource":
				defs.knowledgeSources.push({ id, name: "Knowledge Source", authorityRequirements: [] })
				break
			case "businessKnowledgeModel":
				defs.businessKnowledgeModels.push({
					id,
					name: "BKM",
					knowledgeRequirements: [],
					authorityRequirements: [],
				})
				break
			case "textAnnotation":
				defs.textAnnotations.push({ id, text: "Note" })
				break
		}

		this._selectedIds.clear()
		this._selectedIds.add(id)
		this._connectNodes(sourceId, id)
	}

	// ── Edge creation ──────────────────────────────────────────────────────────

	private _connectNodes(sourceId: string, targetId: string): void {
		const defs = this._defs
		if (!defs.diagram) defs.diagram = { shapes: [], edges: [] }
		const id = `req_${uid()}`

		const targetDecision = defs.decisions.find((d) => d.id === targetId)
		const targetKs = defs.knowledgeSources.find((k) => k.id === targetId)
		const targetBkm = defs.businessKnowledgeModels.find((b) => b.id === targetId)
		const targetAnn = defs.textAnnotations.find((a) => a.id === targetId)

		const sourceIsDecision = defs.decisions.some((d) => d.id === sourceId)
		const sourceIsInput = defs.inputData.some((i) => i.id === sourceId)
		const sourceIsBkm = defs.businessKnowledgeModels.some((b) => b.id === sourceId)
		const sourceIsKs = defs.knowledgeSources.some((k) => k.id === sourceId)

		if (targetAnn) {
			const assocId = `assoc_${uid()}`
			defs.associations.push({ id: assocId, sourceRef: sourceId, targetRef: targetId })
			defs.diagram.edges.push({ dmnElementRef: assocId, waypoints: [] })
		} else if (targetDecision) {
			if (sourceIsDecision) {
				targetDecision.informationRequirements.push({ id, requiredDecision: sourceId })
				defs.diagram.edges.push({ dmnElementRef: id, waypoints: [] })
			} else if (sourceIsInput) {
				targetDecision.informationRequirements.push({ id, requiredInput: sourceId })
				defs.diagram.edges.push({ dmnElementRef: id, waypoints: [] })
			} else if (sourceIsBkm) {
				targetDecision.knowledgeRequirements.push({ id, requiredKnowledge: sourceId })
				defs.diagram.edges.push({ dmnElementRef: id, waypoints: [] })
			} else if (sourceIsKs) {
				targetDecision.authorityRequirements.push({ id, requiredAuthority: sourceId })
				defs.diagram.edges.push({ dmnElementRef: id, waypoints: [] })
			} else {
				return
			}
		} else if (targetKs && sourceIsKs) {
			targetKs.authorityRequirements.push({ id, requiredAuthority: sourceId })
			defs.diagram.edges.push({ dmnElementRef: id, waypoints: [] })
		} else if (targetBkm) {
			if (sourceIsBkm) {
				targetBkm.knowledgeRequirements.push({ id, requiredKnowledge: sourceId })
				defs.diagram.edges.push({ dmnElementRef: id, waypoints: [] })
			} else if (sourceIsKs) {
				targetBkm.authorityRequirements.push({ id, requiredAuthority: sourceId })
				defs.diagram.edges.push({ dmnElementRef: id, waypoints: [] })
			} else {
				return
			}
		} else {
			const assocId = `assoc_${uid()}`
			defs.associations.push({ id: assocId, sourceRef: sourceId, targetRef: targetId })
			defs.diagram.edges.push({ dmnElementRef: assocId, waypoints: [] })
		}

		this._render()
		this._onChange()
	}

	// ── Deletion ───────────────────────────────────────────────────────────────

	private _deleteSelected(): void {
		for (const id of this._selectedIds) this._deleteElement(id)
		this._selectedIds.clear()
		this._render()
		this._onChange()
	}

	private _deleteElement(id: string): void {
		const defs = this._defs
		if (defs.diagram) {
			defs.diagram.shapes = defs.diagram.shapes.filter((s) => s.dmnElementRef !== id)
			defs.diagram.edges = defs.diagram.edges.filter((e) => e.dmnElementRef !== id)
		}

		const removeFrom = <T extends { id: string }>(arr: T[]): boolean => {
			const idx = arr.findIndex((x) => x.id === id)
			if (idx === -1) return false
			arr.splice(idx, 1)
			return true
		}

		if (removeFrom(defs.decisions)) {
			this._removeEdgesReferencing(id)
			return
		}
		if (removeFrom(defs.inputData)) {
			this._removeEdgesReferencing(id)
			return
		}
		if (removeFrom(defs.knowledgeSources)) {
			this._removeEdgesReferencing(id)
			return
		}
		if (removeFrom(defs.businessKnowledgeModels)) {
			this._removeEdgesReferencing(id)
			return
		}
		if (removeFrom(defs.textAnnotations)) {
			this._removeEdgesReferencing(id)
			return
		}

		this._deleteRequirement(id)
	}

	private _removeEdgesReferencing(nodeId: string): void {
		const defs = this._defs
		for (const d of defs.decisions) {
			d.informationRequirements = d.informationRequirements.filter(
				(r) => r.requiredDecision !== nodeId && r.requiredInput !== nodeId,
			)
			d.knowledgeRequirements = d.knowledgeRequirements.filter(
				(r) => r.requiredKnowledge !== nodeId,
			)
			d.authorityRequirements = d.authorityRequirements.filter(
				(r) =>
					r.requiredAuthority !== nodeId &&
					r.requiredDecision !== nodeId &&
					r.requiredInput !== nodeId,
			)
		}
		for (const ks of defs.knowledgeSources) {
			ks.authorityRequirements = ks.authorityRequirements.filter(
				(r) =>
					r.requiredAuthority !== nodeId &&
					r.requiredDecision !== nodeId &&
					r.requiredInput !== nodeId,
			)
		}
		for (const bkm of defs.businessKnowledgeModels) {
			bkm.knowledgeRequirements = bkm.knowledgeRequirements.filter(
				(r) => r.requiredKnowledge !== nodeId,
			)
			bkm.authorityRequirements = bkm.authorityRequirements.filter(
				(r) =>
					r.requiredAuthority !== nodeId &&
					r.requiredDecision !== nodeId &&
					r.requiredInput !== nodeId,
			)
		}
		defs.associations = defs.associations.filter(
			(a) => a.sourceRef !== nodeId && a.targetRef !== nodeId,
		)
	}

	private _deleteRequirement(reqId: string): void {
		const defs = this._defs
		for (const d of defs.decisions) {
			d.informationRequirements = d.informationRequirements.filter((r) => r.id !== reqId)
			d.knowledgeRequirements = d.knowledgeRequirements.filter((r) => r.id !== reqId)
			d.authorityRequirements = d.authorityRequirements.filter((r) => r.id !== reqId)
		}
		for (const ks of defs.knowledgeSources) {
			ks.authorityRequirements = ks.authorityRequirements.filter((r) => r.id !== reqId)
		}
		for (const bkm of defs.businessKnowledgeModels) {
			bkm.knowledgeRequirements = bkm.knowledgeRequirements.filter((r) => r.id !== reqId)
			bkm.authorityRequirements = bkm.authorityRequirements.filter((r) => r.id !== reqId)
		}
		defs.associations = defs.associations.filter((a) => a.id !== reqId)
		if (defs.diagram) {
			defs.diagram.edges = defs.diagram.edges.filter((e) => e.dmnElementRef !== reqId)
		}
	}

	// ── Events ─────────────────────────────────────────────────────────────────

	private _bindEvents(): void {
		const svg = this._svg

		const onWheel = (e: WheelEvent): void => {
			e.preventDefault()
			const rect = svg.getBoundingClientRect()
			const mx = e.clientX - rect.left
			const my = e.clientY - rect.top
			const factor = e.deltaY > 0 ? 0.9 : 1.1
			const newScale = Math.min(4, Math.max(0.2, this._scale * factor))
			this._vpX = mx - (mx - this._vpX) * (newScale / this._scale)
			this._vpY = my - (my - this._vpY) * (newScale / this._scale)
			this._scale = newScale
			this._updateTransform()
		}
		svg.addEventListener("wheel", onWheel, { passive: false })
		this._cleanups.push(() => svg.removeEventListener("wheel", onWheel))

		const onSvgMouseDown = (e: MouseEvent): void => {
			const t = e.target as Node
			if (t !== svg && t !== this._vpGroup && t !== this._edgesLayer && t !== this._nodesLayer)
				return

			if (this._connectMode) {
				// Clicking empty space cancels connect mode but keeps selection
				this._connectMode = false
				this._connectSourceId = null
				this._render()
				return
			}

			this._selectedIds.clear()
			this._render()
			this._panStart = { mx: e.clientX, my: e.clientY, vpX: this._vpX, vpY: this._vpY }
		}
		svg.addEventListener("mousedown", onSvgMouseDown)
		this._cleanups.push(() => svg.removeEventListener("mousedown", onSvgMouseDown))

		const onMouseMove = (e: MouseEvent): void => {
			if (this._panStart) {
				this._vpX = this._panStart.vpX + (e.clientX - this._panStart.mx)
				this._vpY = this._panStart.vpY + (e.clientY - this._panStart.my)
				this._updateTransform()
			} else if (this._dragNode) {
				const rawDx = (e.clientX - this._dragNode.startMx) / this._scale
				const rawDy = (e.clientY - this._dragNode.startMy) / this._scale
				const shape = this._defs.diagram?.shapes.find((s) => s.dmnElementRef === this._dragNode?.id)
				if (shape) {
					const candidateX = this._dragNode.startX + rawDx
					const candidateY = this._dragNode.startY + rawDy
					const { adjX, adjY, guides } = this._computeSnap(
						candidateX,
						candidateY,
						shape.bounds.width,
						shape.bounds.height,
						this._dragNode.id,
					)
					shape.bounds.x = candidateX + adjX
					shape.bounds.y = candidateY + adjY
					this._renderGuides(guides)
					const nodeEl = this._nodesLayer.querySelector(
						`[data-id="${this._dragNode.id}"]`,
					) as SVGGElement | null
					nodeEl?.setAttribute("transform", `translate(${shape.bounds.x},${shape.bounds.y})`)
					this._edgesLayer.innerHTML = ""
					const nodes = this._buildNodes()
					const nodeMap = new Map<string, NodeInfo>(nodes.map((n) => [n.id, n]))
					for (const edge of this._buildEdges()) {
						const src = nodeMap.get(edge.sourceId)
						const tgt = nodeMap.get(edge.targetId)
						if (src && tgt) this._edgesLayer.appendChild(this._renderEdge(edge, src, tgt))
					}
					this._updateCtxBarPosition()
				}
			}
		}
		document.addEventListener("mousemove", onMouseMove)
		this._cleanups.push(() => document.removeEventListener("mousemove", onMouseMove))

		const onMouseUp = (): void => {
			if (this._dragNode) {
				this._clearGuides()
				this._onChange()
			}
			this._panStart = null
			this._dragNode = null
		}
		document.addEventListener("mouseup", onMouseUp)
		this._cleanups.push(() => document.removeEventListener("mouseup", onMouseUp))

		const onKeyDown = (e: KeyboardEvent): void => {
			if (e.key === "Escape") {
				if (this._connectMode) {
					this._connectMode = false
					this._connectSourceId = null
					this._render()
				}
				return
			}
			if (e.key !== "Delete" && e.key !== "Backspace") return
			const active = document.activeElement
			if (
				active instanceof HTMLInputElement ||
				active instanceof HTMLTextAreaElement ||
				active instanceof HTMLSelectElement
			)
				return
			if (this._selectedIds.size > 0) this._deleteSelected()
		}
		document.addEventListener("keydown", onKeyDown)
		this._cleanups.push(() => document.removeEventListener("keydown", onKeyDown))
	}

	private _onNodeMouseDown(e: MouseEvent, n: NodeInfo): void {
		e.stopPropagation()

		if (this._connectMode) {
			if (!this._connectSourceId) {
				this._connectSourceId = n.id
				this._render()
			} else if (this._connectSourceId !== n.id) {
				const src = this._connectSourceId
				this._connectSourceId = null
				this._connectMode = false
				this._connectNodes(src, n.id)
			}
			return
		}

		this._selectedIds.clear()
		this._selectedIds.add(n.id)

		const shape = this._defs.diagram?.shapes.find((s) => s.dmnElementRef === n.id)
		if (shape) {
			this._dragNode = {
				id: n.id,
				startMx: e.clientX,
				startMy: e.clientY,
				startX: shape.bounds.x,
				startY: shape.bounds.y,
			}
		}

		this._render()
	}

	private _onNodeDblClick(e: MouseEvent, n: NodeInfo): void {
		e.stopPropagation()
		if (n.type === "decision") {
			this._onDecisionOpen(n.id)
			return
		}
		this._startInlineEdit(n)
	}

	private _startInlineEdit(n: NodeInfo): void {
		const shape = this._defs.diagram?.shapes.find((s) => s.dmnElementRef === n.id)
		if (!shape) return

		this._vpGroup.querySelector(".drd-inline-edit-fo")?.remove()

		const fo = svgEl("foreignObject")
		cls(fo, "drd-inline-edit-fo")
		setAttrs(fo, {
			x: shape.bounds.x,
			y: shape.bounds.y,
			width: shape.bounds.width,
			height: shape.bounds.height,
		})

		const inp = document.createElement("input")
		inp.type = "text"
		inp.className = "drd-inline-edit"
		inp.value = n.label
		inp.style.cssText = `width:${shape.bounds.width}px;height:${shape.bounds.height}px;`
		fo.appendChild(inp)
		this._vpGroup.appendChild(fo)

		inp.focus()
		inp.select()

		const commit = (): void => {
			const val = inp.value.trim() || n.label
			this._setNodeLabel(n.id, val)
			fo.remove()
			this._render()
			this._onChange()
		}

		inp.addEventListener("blur", commit)
		inp.addEventListener("keydown", (ev) => {
			if (ev.key === "Enter") {
				ev.preventDefault()
				inp.blur()
			} else if (ev.key === "Escape") {
				fo.remove()
				this._render()
			}
		})
	}

	private _setNodeLabel(id: string, label: string): void {
		const defs = this._defs
		const d = defs.decisions.find((x) => x.id === id)
		if (d) {
			d.name = label
			return
		}
		const inp = defs.inputData.find((x) => x.id === id)
		if (inp) {
			inp.name = label
			return
		}
		const ks = defs.knowledgeSources.find((x) => x.id === id)
		if (ks) {
			ks.name = label
			return
		}
		const bkm = defs.businessKnowledgeModels.find((x) => x.id === id)
		if (bkm) {
			bkm.name = label
			return
		}
		const ann = defs.textAnnotations.find((x) => x.id === id)
		if (ann) ann.text = label
	}
}
