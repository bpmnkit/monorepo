import type { BpmnFlowElement, BpmnSequenceFlow } from "../bpmn/bpmn-model.js"
import { buildGraph, detectBackEdges, reverseBackEdges } from "./graph.js"
import { assignLayers } from "./layers.js"
import { ELEMENT_SIZES } from "./types.js"
import type { LayoutResult } from "./types.js"

// ============================================================================
// Module 1: Core Data Structures
// ============================================================================

/** Mutable node record used by the SA optimizer. */
export interface OptNode {
	id: string
	x: number
	y: number
	width: number
	height: number
}

/** Mutable edge record used by the SA optimizer. */
export interface OptEdge {
	id: string
	sourceId: string
	targetId: string
	waypoints: Array<{ x: number; y: number }>
}

/**
 * Mutable graph with deep-clone support.
 * Manages nodes/edges via Map<string, Node> and Map<string, Edge>.
 */
export class OptGraph {
	nodes: Map<string, OptNode>
	edges: Map<string, OptEdge>

	constructor(nodes: Map<string, OptNode>, edges: Map<string, OptEdge>) {
		this.nodes = nodes
		this.edges = edges
	}

	/** Create a completely independent deep copy of the entire graph state. */
	clone(): OptGraph {
		const nodes = new Map<string, OptNode>()
		for (const [id, n] of this.nodes) {
			nodes.set(id, { id: n.id, x: n.x, y: n.y, width: n.width, height: n.height })
		}
		const edges = new Map<string, OptEdge>()
		for (const [id, e] of this.edges) {
			edges.set(id, {
				id: e.id,
				sourceId: e.sourceId,
				targetId: e.targetId,
				waypoints: e.waypoints.map((wp) => ({ x: wp.x, y: wp.y })),
			})
		}
		return new OptGraph(nodes, edges)
	}
}

// ============================================================================
// Geometry helpers
// ============================================================================

/** Signed area of triangle (p1, p2, p3) — positive = CCW, negative = CW, 0 = collinear. */
function triArea(
	p1x: number,
	p1y: number,
	p2x: number,
	p2y: number,
	p3x: number,
	p3y: number,
): number {
	return (p2x - p1x) * (p3y - p1y) - (p2y - p1y) * (p3x - p1x)
}

function inRange(lo: number, hi: number, v: number): boolean {
	return Math.min(lo, hi) <= v && v <= Math.max(lo, hi)
}

/** True if point P lies on segment AB (caller should have verified collinearity). */
function onSeg(ax: number, ay: number, bx: number, by: number, px: number, py: number): boolean {
	return inRange(ax, bx, px) && inRange(ay, by, py)
}

/** True if segment AB intersects segment CD (including touching endpoints). */
function segmentsIntersect(
	ax: number,
	ay: number,
	bx: number,
	by: number,
	cx: number,
	cy: number,
	dx: number,
	dy: number,
): boolean {
	const d1 = triArea(cx, cy, dx, dy, ax, ay)
	const d2 = triArea(cx, cy, dx, dy, bx, by)
	const d3 = triArea(ax, ay, bx, by, cx, cy)
	const d4 = triArea(ax, ay, bx, by, dx, dy)
	if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0)))
		return true
	if (d1 === 0 && onSeg(cx, cy, dx, dy, ax, ay)) return true
	if (d2 === 0 && onSeg(cx, cy, dx, dy, bx, by)) return true
	if (d3 === 0 && onSeg(ax, ay, bx, by, cx, cy)) return true
	if (d4 === 0 && onSeg(ax, ay, bx, by, dx, dy)) return true
	return false
}

/** True if segment AB intersects any edge of axis-aligned rectangle. */
function segmentIntersectsRect(
	ax: number,
	ay: number,
	bx: number,
	by: number,
	rx: number,
	ry: number,
	rw: number,
	rh: number,
): boolean {
	return (
		segmentsIntersect(ax, ay, bx, by, rx, ry, rx + rw, ry) ||
		segmentsIntersect(ax, ay, bx, by, rx + rw, ry, rx + rw, ry + rh) ||
		segmentsIntersect(ax, ay, bx, by, rx + rw, ry + rh, rx, ry + rh) ||
		segmentsIntersect(ax, ay, bx, by, rx, ry + rh, rx, ry)
	)
}

function countEdgePairCrossings(ea: OptEdge, eb: OptEdge): number {
	let n = 0
	for (let i = 0; i < ea.waypoints.length - 1; i++) {
		const a1 = ea.waypoints[i]
		const a2 = ea.waypoints[i + 1]
		if (!a1 || !a2) continue
		for (let j = 0; j < eb.waypoints.length - 1; j++) {
			const b1 = eb.waypoints[j]
			const b2 = eb.waypoints[j + 1]
			if (!b1 || !b2) continue
			if (segmentsIntersect(a1.x, a1.y, a2.x, a2.y, b1.x, b1.y, b2.x, b2.y)) n++
		}
	}
	return n
}

function edgeIntersectsNode(edge: OptEdge, node: OptNode): boolean {
	for (let i = 0; i < edge.waypoints.length - 1; i++) {
		const p1 = edge.waypoints[i]
		const p2 = edge.waypoints[i + 1]
		if (!p1 || !p2) continue
		if (segmentIntersectsRect(p1.x, p1.y, p2.x, p2.y, node.x, node.y, node.width, node.height))
			return true
	}
	return false
}

function countBends(edge: OptEdge): number {
	let bends = 0
	for (let i = 1; i < edge.waypoints.length - 1; i++) {
		const prev = edge.waypoints[i - 1]
		const curr = edge.waypoints[i]
		const next = edge.waypoints[i + 1]
		if (!prev || !curr || !next) continue
		const dx1 = Math.sign(curr.x - prev.x)
		const dy1 = Math.sign(curr.y - prev.y)
		const dx2 = Math.sign(next.x - curr.x)
		const dy2 = Math.sign(next.y - curr.y)
		if (dx1 !== dx2 || dy1 !== dy2) bends++
	}
	return bends
}

function countNonOrthogonal(edge: OptEdge): number {
	let count = 0
	for (let i = 0; i < edge.waypoints.length - 1; i++) {
		const p1 = edge.waypoints[i]
		const p2 = edge.waypoints[i + 1]
		if (!p1 || !p2) continue
		if (Math.abs(p1.x - p2.x) > 0.5 && Math.abs(p1.y - p2.y) > 0.5) count++
	}
	return count
}

function edgeTotalLength(edge: OptEdge): number {
	let len = 0
	for (let i = 0; i < edge.waypoints.length - 1; i++) {
		const p1 = edge.waypoints[i]
		const p2 = edge.waypoints[i + 1]
		if (!p1 || !p2) continue
		len += Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2)
	}
	return len
}

// ============================================================================
// Module 2: The Cost Function
// ============================================================================

/**
 * Evaluate the current layout quality. Returns a penalty score — lower is better.
 *
 * Penalties:
 *   1. Node overlaps              — 10,000 per overlapping pair
 *   2. Edge crossings             —  1,000 per crossing
 *   3. Edge-to-node intersections —  5,000 per instance
 *   4. Edge bends / corners       —     50 per bend
 *   5. Non-orthogonal segments    —    500 per diagonal segment
 *   6. Edge length                —      1 per pixel
 *   7. Un-aligned connected nodes —     10 per pixel of Y/X misalignment
 */
export function calculateLayoutCost(graph: OptGraph): number {
	let cost = 0
	const nodeList = [...graph.nodes.values()]
	const edgeList = [...graph.edges.values()]

	// 1. Node overlaps
	for (let i = 0; i < nodeList.length; i++) {
		for (let j = i + 1; j < nodeList.length; j++) {
			const a = nodeList[i]
			const b = nodeList[j]
			if (!a || !b) continue
			if (
				a.x < b.x + b.width &&
				a.x + a.width > b.x &&
				a.y < b.y + b.height &&
				a.y + a.height > b.y
			) {
				cost += 10000
			}
		}
	}

	// 2. Edge crossings
	for (let i = 0; i < edgeList.length; i++) {
		for (let j = i + 1; j < edgeList.length; j++) {
			const ea = edgeList[i]
			const eb = edgeList[j]
			if (!ea || !eb) continue
			// Skip edge pairs that share a node (connected edges naturally meet)
			if (
				ea.sourceId === eb.sourceId ||
				ea.sourceId === eb.targetId ||
				ea.targetId === eb.sourceId ||
				ea.targetId === eb.targetId
			)
				continue
			cost += countEdgePairCrossings(ea, eb) * 1000
		}
	}

	// 3. Edge-to-node intersections
	for (const edge of edgeList) {
		for (const node of nodeList) {
			if (node.id === edge.sourceId || node.id === edge.targetId) continue
			if (edgeIntersectsNode(edge, node)) cost += 5000
		}
	}

	// 4. Edge bends
	for (const edge of edgeList) {
		cost += countBends(edge) * 50
	}

	// 5. Non-orthogonal segments
	for (const edge of edgeList) {
		cost += countNonOrthogonal(edge) * 500
	}

	// 6. Edge length
	for (const edge of edgeList) {
		cost += edgeTotalLength(edge)
	}

	// 7. Un-aligned connected nodes
	for (const edge of edgeList) {
		const src = graph.nodes.get(edge.sourceId)
		const tgt = graph.nodes.get(edge.targetId)
		if (!src || !tgt) continue
		const srcCx = src.x + src.width / 2
		const srcCy = src.y + src.height / 2
		const tgtCx = tgt.x + tgt.width / 2
		const tgtCy = tgt.y + tgt.height / 2
		// Penalise the smaller misalignment axis (reward partial alignment)
		const misalign = Math.min(Math.abs(srcCy - tgtCy), Math.abs(srcCx - tgtCx))
		cost += misalign * 10
	}

	return cost
}

// ============================================================================
// Module 3: Graph Initializer (Rough Draft)
// ============================================================================

/**
 * Create an OptGraph from raw BPMN elements with rough topological-order coordinates.
 * Nodes are placed in a grid by (layer, stack-position); edges are straight lines.
 *
 * Use this when running SA from scratch.
 * For better results, start from an existing LayoutResult via `layoutResultToOptGraph`.
 */
export function initializeOptGraph(
	flowNodes: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
): OptGraph {
	const nodeIndex = new Map(flowNodes.map((n) => [n.id, n]))
	const graph = buildGraph(flowNodes, sequenceFlows)
	const backEdges = detectBackEdges(graph, sequenceFlows)
	const dag = backEdges.length > 0 ? reverseBackEdges(graph, backEdges) : graph
	const layers = assignLayers(dag)

	// Group nodes by topological layer
	const byLayer = new Map<number, string[]>()
	for (const [id, layer] of layers) {
		const arr = byLayer.get(layer) ?? []
		arr.push(id)
		byLayer.set(layer, arr)
	}

	const GRID_X = 200
	const GRID_Y = 150
	const MARGIN = 50

	const nodes = new Map<string, OptNode>()
	for (const [layerIdx, ids] of byLayer) {
		for (let rowIdx = 0; rowIdx < ids.length; rowIdx++) {
			const id = ids[rowIdx]
			if (!id) continue
			const bpmnNode = nodeIndex.get(id)
			const size = bpmnNode
				? (ELEMENT_SIZES[bpmnNode.type] ?? { width: 100, height: 80 })
				: { width: 100, height: 80 }
			nodes.set(id, {
				id,
				x: MARGIN + layerIdx * GRID_X,
				y: MARGIN + rowIdx * GRID_Y,
				width: size.width,
				height: size.height,
			})
		}
	}

	const edges = new Map<string, OptEdge>()
	for (const flow of sequenceFlows) {
		const src = nodes.get(flow.sourceRef)
		const tgt = nodes.get(flow.targetRef)
		if (!src || !tgt) continue
		edges.set(flow.id, {
			id: flow.id,
			sourceId: flow.sourceRef,
			targetId: flow.targetRef,
			waypoints: [
				{ x: src.x + src.width, y: src.y + src.height / 2 },
				{ x: tgt.x, y: tgt.y + tgt.height / 2 },
			],
		})
	}

	return new OptGraph(nodes, edges)
}

// ============================================================================
// Module 4: Mutation Engine
// ============================================================================

/**
 * Apply one random, small change to the graph in-place.
 *
 * Possible mutations (one chosen per call):
 *   1. Nudge node      — move X or Y by ±20 px; connected edge endpoints follow.
 *   2. Add dogleg      — insert a midpoint waypoint on a random edge segment.
 *   3. Remove waypoint — delete a random intermediate waypoint.
 *   4. Shift waypoint  — snap an intermediate waypoint toward orthogonal alignment.
 */
export function mutateGraphRandomly(graph: OptGraph): void {
	const nodeList = [...graph.nodes.values()]
	const edgeList = [...graph.edges.values()]
	if (nodeList.length === 0 && edgeList.length === 0) return

	const roll = Math.random()

	if (roll < 0.35 && nodeList.length > 0) {
		// Mutation 1: Nudge a random node ±20 px on one axis
		const node = nodeList[Math.floor(Math.random() * nodeList.length)]
		if (!node) return
		const moveX = Math.random() < 0.5
		const delta = (Math.random() - 0.5) * 40

		if (moveX) {
			node.x += delta
		} else {
			node.y += delta
		}

		// Translate connected edge endpoints so edges stay attached
		for (const edge of edgeList) {
			if (edge.sourceId === node.id) {
				const wp = edge.waypoints[0]
				if (wp) {
					if (moveX) wp.x += delta
					else wp.y += delta
				}
			}
			if (edge.targetId === node.id) {
				const wp = edge.waypoints[edge.waypoints.length - 1]
				if (wp) {
					if (moveX) wp.x += delta
					else wp.y += delta
				}
			}
		}
	} else if (roll < 0.55 && edgeList.length > 0) {
		// Mutation 2: Insert a dogleg waypoint on a random segment
		const edge = edgeList[Math.floor(Math.random() * edgeList.length)]
		if (!edge || edge.waypoints.length < 2) return
		const segIdx = Math.floor(Math.random() * (edge.waypoints.length - 1))
		const p1 = edge.waypoints[segIdx]
		const p2 = edge.waypoints[segIdx + 1]
		if (!p1 || !p2) return
		// Offset perpendicular to the dominant segment direction
		const isHoriz = Math.abs(p2.x - p1.x) >= Math.abs(p2.y - p1.y)
		const offset = (Math.random() - 0.5) * 40
		const mx = isHoriz ? (p1.x + p2.x) / 2 : (p1.x + p2.x) / 2 + offset
		const my = isHoriz ? (p1.y + p2.y) / 2 + offset : (p1.y + p2.y) / 2
		edge.waypoints.splice(segIdx + 1, 0, { x: mx, y: my })
	} else if (roll < 0.75) {
		// Mutation 3: Remove a random intermediate waypoint
		const candidates = edgeList.filter((e) => e.waypoints.length > 2)
		if (candidates.length === 0) return
		const edge = candidates[Math.floor(Math.random() * candidates.length)]
		if (!edge) return
		const idx = 1 + Math.floor(Math.random() * (edge.waypoints.length - 2))
		edge.waypoints.splice(idx, 1)
	} else {
		// Mutation 4: Shift waypoint toward orthogonal alignment with a neighbour
		const candidates = edgeList.filter((e) => e.waypoints.length > 2)
		if (candidates.length === 0) return
		const edge = candidates[Math.floor(Math.random() * candidates.length)]
		if (!edge) return
		const idx = 1 + Math.floor(Math.random() * (edge.waypoints.length - 2))
		const wp = edge.waypoints[idx]
		const prev = edge.waypoints[idx - 1]
		const next = edge.waypoints[idx + 1]
		if (!wp || !prev || !next) return

		// Snap to a neighbour's coordinate so segments become axis-aligned
		if (Math.random() < 0.5) {
			wp.x = Math.random() < 0.5 ? prev.x : next.x
		} else {
			wp.y = Math.random() < 0.5 ? prev.y : next.y
		}
		// Tiny jitter prevents degenerate collinear points from accumulating
		if (Math.random() < 0.5) {
			wp.x += (Math.random() - 0.5) * 4
		} else {
			wp.y += (Math.random() - 0.5) * 4
		}
	}
}

// ============================================================================
// Module 5: Optimization Loop (Simulated Annealing)
// ============================================================================

/**
 * Refine a graph layout using simulated annealing (in-place).
 *
 * Each iteration:
 *   1. Clone the graph state.
 *   2. Apply one random mutation.
 *   3. Score with calculateLayoutCost.
 *   4. Keep if better; probabilistically keep if worse (SA acceptance).
 *   5. Reject and restore on failure.
 *
 * Temperature decreases linearly 1 → 0, so early iterations explore freely
 * and later iterations only accept improvements.
 *
 * @param graph      - Mutated in-place.
 * @param iterations - Higher = better quality, slower. Default: 10,000.
 */
export function optimizeLayout(graph: OptGraph, iterations = 10000): void {
	let currentCost = calculateLayoutCost(graph)

	for (let i = 0; i < iterations; i++) {
		const temperature = Math.max(0.001, 1.0 - i / iterations)
		const backup = graph.clone()

		mutateGraphRandomly(graph)
		const newCost = calculateLayoutCost(graph)

		if (newCost < currentCost) {
			currentCost = newCost
		} else {
			const delta = newCost - currentCost
			// Higher temperature → greater willingness to accept worse solutions
			const acceptProbability = Math.exp(-delta / (temperature * 500 + 1))
			if (Math.random() < acceptProbability) {
				currentCost = newCost
			} else {
				graph.nodes = backup.nodes
				graph.edges = backup.edges
			}
		}
	}
}

// ============================================================================
// Conversion utilities
// ============================================================================

/**
 * Convert a LayoutResult into an OptGraph.
 * Dummy nodes are excluded. Label bounds are not carried over.
 */
export function layoutResultToOptGraph(result: LayoutResult): OptGraph {
	const nodes = new Map<string, OptNode>()
	for (const n of result.nodes) {
		if (n.isDummy) continue
		nodes.set(n.id, {
			id: n.id,
			x: n.bounds.x,
			y: n.bounds.y,
			width: n.bounds.width,
			height: n.bounds.height,
		})
	}
	const edges = new Map<string, OptEdge>()
	for (const e of result.edges) {
		edges.set(e.id, {
			id: e.id,
			sourceId: e.sourceRef,
			targetId: e.targetRef,
			waypoints: e.waypoints.map((wp) => ({ x: wp.x, y: wp.y })),
		})
	}
	return new OptGraph(nodes, edges)
}

/** Write optimized positions and waypoints back into a new LayoutResult. */
function applyOptGraphToResult(graph: OptGraph, result: LayoutResult): LayoutResult {
	const updatedNodes = result.nodes.map((n) => {
		const opt = graph.nodes.get(n.id)
		if (!opt) return n
		const dx = opt.x - n.bounds.x
		const dy = opt.y - n.bounds.y
		return {
			...n,
			bounds: { x: opt.x, y: opt.y, width: n.bounds.width, height: n.bounds.height },
			labelBounds: n.labelBounds
				? {
						x: n.labelBounds.x + dx,
						y: n.labelBounds.y + dy,
						width: n.labelBounds.width,
						height: n.labelBounds.height,
					}
				: undefined,
		}
	})
	const updatedEdges = result.edges.map((e) => {
		const opt = graph.edges.get(e.id)
		if (!opt) return e
		return { ...e, waypoints: opt.waypoints }
	})
	return { nodes: updatedNodes, edges: updatedEdges }
}

/**
 * Convenience wrapper: optimise a LayoutResult via SA and return the improved version.
 * The original result is not modified.
 *
 * @param result     - Starting layout (e.g. the output of bandLayout).
 * @param iterations - SA iterations. Default: 10,000.
 */
export function optimizeLayoutResult(result: LayoutResult, iterations = 10000): LayoutResult {
	if (result.nodes.length === 0) return result
	const graph = layoutResultToOptGraph(result)
	optimizeLayout(graph, iterations)
	return applyOptGraphToResult(graph, result)
}
