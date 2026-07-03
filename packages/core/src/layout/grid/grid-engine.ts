// packages/core/src/layout/grid/grid-engine.ts
import type { BpmnBoundaryEvent, BpmnFlowElement, BpmnSequenceFlow } from "../../bpmn/bpmn-model.js"
import type { Bounds, LayoutEdge, LayoutNode, LayoutResult } from "../types.js"
import { ELEMENT_SIZES, GRID_CELL_HEIGHT, GRID_CELL_WIDTH } from "../types.js"
import { placeEdgeLabels } from "./edge-labels.js"
import type { FlowGraph } from "./flow-graph.js"
import { buildFlowGraph } from "./flow-graph.js"
import type { RoutableNode } from "./grid-router.js"
import { collapseCollinear, connectElements, ensureExitBottom } from "./grid-router.js"
import type { Grid } from "./grid.js"
import { createGridLayout } from "./walker.js"

const DEFAULT_SIZE = { width: 100, height: 80 }
const SUB_TYPES = new Set(["subProcess", "adHocSubProcess", "eventSubProcess", "transaction"])
const CHILD_SHIFT_X = 50 // upstream: CELL_W/2 − baseW/4
const CHILD_SHIFT_Y = 40 // upstream: CELL_H − baseH − baseH/4

interface LevelLayout {
	graph: FlowGraph
	grid: Grid<BpmnFlowElement>
	children: Map<string, LevelLayout>
}

interface SubLike {
	flowElements?: BpmnFlowElement[]
	sequenceFlows?: BpmnSequenceFlow[]
}

export function gridLayoutFlowNodes(
	flowNodes: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
): LayoutResult {
	if (flowNodes.length === 0) return { nodes: [], edges: [] }
	const root = buildLevel(flowNodes, sequenceFlows, false)
	const out: LayoutResult = { nodes: [], edges: [] }
	emitLevel(root, { x: 0, y: 0 }, out)
	const nodeMap = new Map(out.nodes.map((n) => [n.id, n]))
	placeEdgeLabels(out.edges, nodeMap)
	return out
}

function buildLevel(
	flowNodes: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
	compact: boolean,
): LevelLayout {
	const graph = buildFlowGraph(flowNodes, sequenceFlows)
	const children = new Map<string, LevelLayout>()
	for (const el of graph.elements) {
		if (!SUB_TYPES.has(el.type)) continue
		const sub = el as unknown as SubLike
		if (!sub.flowElements || sub.flowElements.length === 0) continue
		const childFlows = sub.sequenceFlows ?? []
		const childCompact = el.type === "adHocSubProcess" && childFlows.length === 0
		children.set(el.id, buildLevel(sub.flowElements, childFlows, childCompact))
	}
	const grid = createGridLayout(graph, { compact })
	expandForChildren(grid, children)
	return { graph, grid, children }
}

/** Insert blank cols/rows after every cell holding an expanded subprocess (§A.2.3). */
function expandForChildren(grid: Grid<BpmnFlowElement>, children: Map<string, LevelLayout>): void {
	if (children.size === 0) return
	// columns, right-to-left
	for (let c = grid.colCount() - 1; c >= 0; c--) {
		let maxCols = 0
		for (const { element, col } of grid.elementsByPosition()) {
			if (col !== c) continue
			const child = children.get(element.id)
			if (child) maxCols = Math.max(maxCols, child.grid.colCount())
		}
		if (maxCols > 0) grid.createCol(c, Math.max(maxCols, 2))
	}
	// rows, bottom-to-top
	for (let r = grid.rowCount() - 1; r >= 0; r--) {
		let maxRows = 0
		for (const { element, row } of grid.elementsByPosition()) {
			if (row !== r) continue
			const child = children.get(element.id)
			if (child) maxRows = Math.max(maxRows, child.grid.rowCount())
		}
		for (let i = 0; i < maxRows; i++) grid.createRow(r)
	}
}

function sizeOf(el: BpmnFlowElement): { width: number; height: number } {
	return ELEMENT_SIZES[el.type] ?? DEFAULT_SIZE
}

function emitLevel(level: LevelLayout, shift: { x: number; y: number }, out: LayoutResult): void {
	const routables = new Map<string, RoutableNode>()
	const expandedRowsByRow = new Map<number, number>()
	const boundaryBounds = new Map<string, Bounds>()

	// Pass 1: shapes (+ boundary events + recursion into children)
	for (const { element, row, col } of level.grid.elementsByPosition()) {
		const base = sizeOf(element)
		const child = level.children.get(element.id)
		const bounds: Bounds = {
			x: col * GRID_CELL_WIDTH + (GRID_CELL_WIDTH - base.width) / 2 + shift.x,
			y: row * GRID_CELL_HEIGHT + (GRID_CELL_HEIGHT - base.height) / 2 + shift.y,
			width: child ? child.grid.colCount() * GRID_CELL_WIDTH + base.width : base.width,
			height: child ? child.grid.rowCount() * GRID_CELL_HEIGHT + base.height : base.height,
		}
		const layoutNode: LayoutNode = {
			id: element.id,
			type: element.type,
			bounds,
			layer: col,
			position: row,
			gridRow: row,
		}
		if (element.name) layoutNode.label = element.name
		const lb = computeLabelBounds(element, bounds)
		if (lb) layoutNode.labelBounds = lb
		if (child) layoutNode.isExpanded = true
		out.nodes.push(layoutNode)

		routables.set(element.id, {
			id: element.id,
			bounds,
			row,
			col,
			childGrid: child ? { rows: child.grid.rowCount(), cols: child.grid.colCount() } : undefined,
		})
		if (child) {
			expandedRowsByRow.set(row, Math.max(expandedRowsByRow.get(row) ?? 0, child.grid.rowCount()))
		}

		// boundary events ride on the host's bottom edge
		const attachers = level.graph.attachers.get(element.id) ?? []
		const n = attachers.length
		for (let i = 0; i < n; i++) {
			const be = attachers[i] as BpmnBoundaryEvent
			const beBounds: Bounds = {
				x: bounds.x + ((i + 1) * bounds.width) / (n + 1) - 18,
				y: bounds.y + bounds.height - 18,
				width: 36,
				height: 36,
			}
			const beNode: LayoutNode = {
				id: be.id,
				type: be.type,
				bounds: beBounds,
				layer: col,
				position: row,
				gridRow: row,
			}
			if (be.name) {
				beNode.label = be.name
				const labelWidth = Math.min(Math.max(be.name.length * 7, 40), GRID_CELL_WIDTH)
				beNode.labelBounds = {
					x: beBounds.x + beBounds.width / 2 - labelWidth / 2,
					y: beBounds.y + beBounds.height + 4,
					width: labelWidth,
					height: 14,
				}
			}
			out.nodes.push(beNode)

			boundaryBounds.set(be.id, beBounds)
			routables.set(be.id, {
				id: be.id,
				bounds: beBounds,
				row,
				col,
				hostChildGrid: child
					? { rows: child.grid.rowCount(), cols: child.grid.colCount() }
					: undefined,
			})
		}

		if (child) {
			emitLevel(child, { x: bounds.x + CHILD_SHIFT_X, y: bounds.y + CHILD_SHIFT_Y }, out)
		}
	}

	// Pass 2: edges of THIS level
	for (const flows of level.graph.outgoing.values()) {
		for (const flow of flows) {
			const source = routables.get(flow.sourceRef)
			const target = routables.get(flow.targetRef)
			if (!source || !target) continue
			let waypoints = connectElements(
				source,
				target,
				level.grid as unknown as Grid<{ id: string }>,
				shift,
				expandedRowsByRow,
			)
			const beB = boundaryBounds.get(flow.sourceRef)
			if (beB) waypoints = ensureExitBottom(beB, waypoints)
			const edge: LayoutEdge = {
				id: flow.id,
				sourceRef: flow.sourceRef,
				targetRef: flow.targetRef,
				waypoints: collapseCollinear(waypoints),
			}
			if (flow.name) edge.label = flow.name
			out.edges.push(edge)
		}
	}
}

/** Copied from coordinates.ts:141 — events and gateways get a label below the shape. */
function computeLabelBounds(node: BpmnFlowElement, bounds: Bounds): Bounds | undefined {
	if (!node.name) return undefined

	// Cap label width to one grid cell so labels don't overlap adjacent elements
	const labelWidth = Math.min(Math.max(node.name.length * 7, 40), GRID_CELL_WIDTH)
	const labelHeight = 14

	switch (node.type) {
		case "startEvent":
		case "endEvent":
		case "intermediateThrowEvent":
		case "intermediateCatchEvent":
			// Labels centered below events
			return {
				x: bounds.x + bounds.width / 2 - labelWidth / 2,
				y: bounds.y + bounds.height + 4,
				width: labelWidth,
				height: labelHeight,
			}
		case "exclusiveGateway":
		case "parallelGateway":
		case "inclusiveGateway":
		case "eventBasedGateway":
			// Labels centered below gateway diamond (standard BPMN convention)
			return {
				x: bounds.x + bounds.width / 2 - labelWidth / 2,
				y: bounds.y + bounds.height + 4,
				width: labelWidth,
				height: labelHeight,
			}
		default:
			// Tasks/activities: labels centered inside — no separate label bounds needed
			return undefined
	}
}
