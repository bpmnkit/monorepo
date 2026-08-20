import type {
	BpmnFlowElement,
	BpmnLaneSet,
	BpmnProcess,
	BpmnSequenceFlow,
} from "../../bpmn/bpmn-model.js"
import { placeEdgeLabels } from "../grid/edge-labels.js"
import type { Bounds, LayoutEdge, LayoutNode, LayoutResult } from "../types.js"
import { LABEL_CHAR_WIDTH, LABEL_HEIGHT, LABEL_MIN_WIDTH, SUBPROCESS_PADDING } from "../types.js"
import { assignBands } from "./bands.js"
import { buildSemanticGraph } from "./graph.js"
import { place, sizeOf } from "./place.js"
import { routeFlows } from "./route.js"

/** Padding between an expanded sub-process border and its children. */
const SUB_PADDING = SUBPROCESS_PADDING
/** Extra top padding inside a named expanded sub-process, for its title. */
const TITLE_BAND = 28
/** Gap between an event or gateway and its external label. */
const LABEL_OFFSET = 4

const CONTAINER_TYPES = new Set(["subProcess", "adHocSubProcess", "eventSubProcess", "transaction"])
const EXTERNAL_LABEL_TYPES = new Set([
	"startEvent",
	"endEvent",
	"intermediateThrowEvent",
	"intermediateCatchEvent",
	"boundaryEvent",
	"exclusiveGateway",
	"parallelGateway",
	"inclusiveGateway",
	"eventBasedGateway",
	"complexGateway",
])

interface Container {
	flowElements?: BpmnFlowElement[]
	sequenceFlows?: BpmnSequenceFlow[]
	laneSet?: BpmnLaneSet
}

/**
 * Lay out a process the way the BPMN reads: ranks carry the flow left to right,
 * semantic bands carry branch meaning up and down, and lane membership wins over
 * both.
 */
export function semanticLayoutProcess(process: BpmnProcess): LayoutResult {
	return semanticLayout(process.flowElements, process.sequenceFlows, process.laneSet)
}

export function semanticLayout(
	flowElements: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
	laneSet?: BpmnLaneSet,
): LayoutResult {
	if (flowElements.length === 0) return { nodes: [], edges: [] }

	const graph = buildSemanticGraph(flowElements, sequenceFlows)
	const bandLayout = assignBands(graph)

	// Children first: an expanded sub-process is sized by what it contains.
	const childResults = new Map<string, LayoutResult>()
	const sizes = new Map<string, { width: number; height: number }>()
	for (const el of graph.nodes) {
		const child = childLayoutOf(el)
		if (child) {
			childResults.set(el.id, child.result)
			sizes.set(el.id, child.size)
		} else {
			sizes.set(el.id, sizeOf(el))
		}
	}

	const { bounds, lanes, gutterX } = place(graph, bandLayout, sizes, laneSet)

	const nodes: LayoutNode[] = []
	for (const el of flowElements) {
		const b = bounds.get(el.id)
		if (!b) continue
		const node: LayoutNode = {
			id: el.id,
			type: el.type,
			bounds: b,
			layer: graph.ranks.get(el.id) ?? 0,
			position: bandLayout.bands.get(el.id) ?? 0,
			gridRow: bandLayout.bands.get(el.id) ?? 0,
		}
		if (el.name) {
			node.label = el.name
			const labelBounds = externalLabel(el.type, el.name, b)
			if (labelBounds) node.labelBounds = labelBounds
		}
		if (childResults.has(el.id)) node.isExpanded = true
		nodes.push(node)
	}

	const edges = routeFlows(graph, sequenceFlows, bounds, bandLayout, gutterX)

	// Drop the children in, translated into their parent's interior.
	for (const [parentId, child] of childResults) {
		const parent = bounds.get(parentId)
		if (!parent) continue
		const extent = extentOf(child)
		if (!extent) continue
		const named = graph.byId.get(parentId)?.name !== undefined
		const dx = parent.x + SUB_PADDING - extent.x
		const dy = parent.y + SUB_PADDING + (named ? TITLE_BAND : 0) - extent.y
		for (const node of child.nodes) {
			node.bounds = shift(node.bounds, dx, dy)
			if (node.labelBounds) node.labelBounds = shift(node.labelBounds, dx, dy)
			nodes.push(node)
		}
		for (const edge of child.edges) {
			edge.waypoints = edge.waypoints.map((wp) => ({ x: wp.x + dx, y: wp.y + dy }))
			if (edge.labelBounds) edge.labelBounds = shift(edge.labelBounds, dx, dy)
			edges.push(edge)
		}
	}

	const result: LayoutResult = { nodes, edges }
	if (lanes.length > 0) result.lanes = lanes
	placeEdgeLabels(edges, new Map(nodes.map((n) => [n.id, n])))
	return result
}

/** Lay out a container's children and report the size its border needs. */
function childLayoutOf(
	el: BpmnFlowElement,
): { result: LayoutResult; size: { width: number; height: number } } | null {
	if (!CONTAINER_TYPES.has(el.type)) return null
	const container = el as unknown as Container
	if (!container.flowElements || container.flowElements.length === 0) return null

	const result = semanticLayout(
		container.flowElements,
		container.sequenceFlows ?? [],
		container.laneSet,
	)
	const extent = extentOf(result)
	if (!extent) return null

	const titleBand = el.name !== undefined ? TITLE_BAND : 0
	return {
		result,
		size: {
			width: extent.width + 2 * SUB_PADDING,
			height: extent.height + 2 * SUB_PADDING + titleBand,
		},
	}
}

function extentOf(result: LayoutResult): Bounds | null {
	let minX = Number.POSITIVE_INFINITY
	let minY = Number.POSITIVE_INFINITY
	let maxX = Number.NEGATIVE_INFINITY
	let maxY = Number.NEGATIVE_INFINITY
	const consider = (b: Bounds): void => {
		minX = Math.min(minX, b.x)
		minY = Math.min(minY, b.y)
		maxX = Math.max(maxX, b.x + b.width)
		maxY = Math.max(maxY, b.y + b.height)
	}
	for (const node of result.nodes) {
		consider(node.bounds)
		if (node.labelBounds) consider(node.labelBounds)
	}
	for (const edge of result.edges) {
		for (const wp of edge.waypoints) consider({ x: wp.x, y: wp.y, width: 0, height: 0 })
	}
	if (!Number.isFinite(minX)) return null
	return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

function shift(b: Bounds, dx: number, dy: number): Bounds {
	return { x: b.x + dx, y: b.y + dy, width: b.width, height: b.height }
}

/** Events and gateways carry their name outside the shape; activities do not. */
function externalLabel(type: string, name: string, bounds: Bounds): Bounds | undefined {
	if (!EXTERNAL_LABEL_TYPES.has(type)) return undefined
	const width = Math.max(name.length * LABEL_CHAR_WIDTH, LABEL_MIN_WIDTH)
	return {
		x: bounds.x + bounds.width / 2 - width / 2,
		y: bounds.y + bounds.height + LABEL_OFFSET,
		width,
		height: LABEL_HEIGHT,
	}
}

export type { Placement } from "./place.js"
