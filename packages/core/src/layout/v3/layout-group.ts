/**
 * v3 layout — Step 4: compute per-group node positions.
 *
 * Returns absolute pixel coordinates for every node and edge within a group,
 * relative to the group's own origin (0, 0).  Callers can translate the whole
 * group to any position in a parent composition.
 */
import type { BpmnFlowElement, BpmnSequenceFlow } from "../../bpmn/bpmn-model.js"
import { ELEMENT_SIZES } from "../types.js"
import type { AtomicSegment, SegmentGroup } from "./types.js"

const GW_GAP = 80 // horizontal gap between gateway and first/last interior node
const NODE_GAP = 40 // horizontal gap between consecutive interior nodes
const LANE_GAP = 40 // vertical gap between parallel branches
const LANE_PAD = 16 // vertical padding within each lane (above and below nodes)

export interface NodeLayout {
	id: string
	x: number
	y: number
	width: number
	height: number
}

export interface EdgeLayout {
	id: string
	sourceId: string
	targetId: string
}

export interface GroupLayout {
	groupId: string
	width: number
	height: number
	nodes: NodeLayout[]
	edges: EdgeLayout[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function nodeSize(
	node: BpmnFlowElement,
	overrides?: Map<string, { width: number; height: number }>,
): { width: number; height: number } {
	return overrides?.get(node.id) ?? ELEMENT_SIZES[node.type] ?? { width: 100, height: 80 }
}

function findEdge(
	sequenceFlows: BpmnSequenceFlow[],
	sourceId: string,
	targetId: string,
): BpmnSequenceFlow | undefined {
	return sequenceFlows.find((f) => f.sourceRef === sourceId && f.targetRef === targetId)
}

// ── Gateway-pair layout ────────────────────────────────────────────────────────

function layoutGatewayPair(
	group: SegmentGroup,
	segMap: Map<string, AtomicSegment>,
	nodeMap: Map<string, BpmnFlowElement>,
	sequenceFlows: BpmnSequenceFlow[],
	overrides?: Map<string, { width: number; height: number }>,
): GroupLayout {
	const nodes: NodeLayout[] = []
	const edges: EdgeLayout[] = []

	const branchSegs = group.segmentIds
		.map((id) => segMap.get(id))
		.filter((s): s is AtomicSegment => s !== undefined)

	const splitNode = group.splitId ? nodeMap.get(group.splitId) : undefined
	const joinNode = group.joinId ? nodeMap.get(group.joinId) : undefined
	const splitSz = splitNode ? nodeSize(splitNode, overrides) : { width: 50, height: 50 }
	const joinSz = joinNode ? nodeSize(joinNode, overrides) : { width: 50, height: 50 }

	// Lane heights: tallest node in branch + padding
	const lanes = branchSegs.map((seg) => {
		const maxH = seg.nodeIds.reduce((acc, id) => {
			const n = nodeMap.get(id)
			return Math.max(acc, n ? nodeSize(n, overrides).height : 80)
		}, 0)
		return { seg, laneH: Math.max(maxH, splitSz.height, joinSz.height) + LANE_PAD * 2 }
	})

	const totalH =
		lanes.reduce((acc, l) => acc + l.laneH, 0) + LANE_GAP * Math.max(0, lanes.length - 1)

	const maxSegW = branchSegs.reduce((acc, s) => Math.max(acc, s.estimatedWidth), 0)
	const contentX = splitSz.width + GW_GAP
	const joinX = contentX + maxSegW + GW_GAP

	// Split gateway — vertically centered
	if (group.splitId && splitNode) {
		nodes.push({
			id: group.splitId,
			x: 0,
			y: Math.max(0, totalH / 2 - splitSz.height / 2),
			width: splitSz.width,
			height: splitSz.height,
		})
	}

	// Join gateway — vertically centered
	if (group.joinId && joinNode) {
		nodes.push({
			id: group.joinId,
			x: joinX,
			y: Math.max(0, totalH / 2 - joinSz.height / 2),
			width: joinSz.width,
			height: joinSz.height,
		})
	}

	// Branch nodes — one horizontal lane per segment
	let laneY = 0
	for (const { seg, laneH } of lanes) {
		const laneCenter = laneY + laneH / 2
		let nodeX = contentX
		let prevId: string | null = group.splitId ?? null

		for (const nid of seg.nodeIds) {
			const n = nodeMap.get(nid)
			const s = n ? nodeSize(n, overrides) : { width: 100, height: 80 }
			nodes.push({
				id: nid,
				x: nodeX,
				y: laneCenter - s.height / 2,
				width: s.width,
				height: s.height,
			})
			if (prevId) {
				const e = findEdge(sequenceFlows, prevId, nid)
				if (e) edges.push({ id: e.id, sourceId: prevId, targetId: nid })
			}
			prevId = nid
			nodeX += s.width + NODE_GAP
		}

		// Last node → join
		if (prevId && group.joinId) {
			const e = findEdge(sequenceFlows, prevId, group.joinId)
			if (e) edges.push({ id: e.id, sourceId: prevId, targetId: group.joinId })
		}

		laneY += laneH + LANE_GAP
	}

	return {
		groupId: group.id,
		width: joinX + joinSz.width,
		height: Math.max(totalH, splitSz.height, joinSz.height),
		nodes,
		edges,
	}
}

// ── Event-attachment layout ────────────────────────────────────────────────────

function layoutEventAttachment(
	group: SegmentGroup,
	segMap: Map<string, AtomicSegment>,
	nodeMap: Map<string, BpmnFlowElement>,
	sequenceFlows: BpmnSequenceFlow[],
	overrides?: Map<string, { width: number; height: number }>,
): GroupLayout {
	const nodes: NodeLayout[] = []
	const edges: EdgeLayout[] = []

	const branchSegs = group.segmentIds
		.map((id) => segMap.get(id))
		.filter((s): s is AtomicSegment => s !== undefined)

	const hostNode = group.hostNodeId ? nodeMap.get(group.hostNodeId) : undefined
	const eventNode = group.eventNodeId ? nodeMap.get(group.eventNodeId) : undefined
	const hostSz = hostNode ? nodeSize(hostNode, overrides) : { width: 100, height: 80 }
	const eventSz = eventNode ? nodeSize(eventNode, overrides) : { width: 36, height: 36 }

	// Host task at origin
	if (hostNode && group.hostNodeId) {
		nodes.push({ id: group.hostNodeId, x: 0, y: 0, width: hostSz.width, height: hostSz.height })
	}

	// Boundary/intermediate event: centered on the bottom edge of the host
	const eventX = group.hostNodeId ? hostSz.width / 2 - eventSz.width / 2 : 0
	const eventY = group.hostNodeId ? hostSz.height - eventSz.height / 2 : 0
	const eventCenterY = eventY + eventSz.height / 2

	if (eventNode && group.eventNodeId) {
		nodes.push({
			id: group.eventNodeId,
			x: eventX,
			y: eventY,
			width: eventSz.width,
			height: eventSz.height,
		})
	}

	// Segment flows horizontally right from the event
	const segStartX =
		(group.hostNodeId ? Math.max(hostSz.width, eventX + eventSz.width) : eventX + eventSz.width) +
		GW_GAP

	for (const seg of branchSegs) {
		let nodeX = segStartX
		let prevId: string | null = group.eventNodeId ?? null

		for (const nid of seg.nodeIds) {
			const n = nodeMap.get(nid)
			const s = n ? nodeSize(n, overrides) : { width: 100, height: 80 }
			nodes.push({
				id: nid,
				x: nodeX,
				y: eventCenterY - s.height / 2,
				width: s.width,
				height: s.height,
			})
			if (prevId) {
				const e = findEdge(sequenceFlows, prevId, nid)
				if (e) edges.push({ id: e.id, sourceId: prevId, targetId: nid })
			}
			prevId = nid
			nodeX += s.width + NODE_GAP
		}

		// Place the terminal node (toId) at the end of the path
		if (seg.toId) {
			const toNode = nodeMap.get(seg.toId)
			const toSz = toNode ? nodeSize(toNode, overrides) : { width: 36, height: 36 }
			nodes.push({
				id: seg.toId,
				x: nodeX,
				y: eventCenterY - toSz.height / 2,
				width: toSz.width,
				height: toSz.height,
			})
			if (prevId) {
				const e = findEdge(sequenceFlows, prevId, seg.toId)
				if (e) edges.push({ id: e.id, sourceId: prevId, targetId: seg.toId })
			}
		}
	}

	const maxX = nodes.reduce((acc, n) => Math.max(acc, n.x + n.width), 0)
	const maxY = nodes.reduce((acc, n) => Math.max(acc, n.y + n.height), 0)
	return { groupId: group.id, width: maxX, height: maxY, nodes, edges }
}

// ── Main export ────────────────────────────────────────────────────────────────

export function layoutGroup(
	group: SegmentGroup,
	segments: AtomicSegment[],
	flowNodes: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
	sizeOverrides?: Map<string, { width: number; height: number }>,
): GroupLayout {
	const segMap = new Map(segments.map((s) => [s.id, s]))
	const nodeMap = new Map(flowNodes.map((n) => [n.id, n]))
	return group.kind === "gateway-pair"
		? layoutGatewayPair(group, segMap, nodeMap, sequenceFlows, sizeOverrides)
		: layoutEventAttachment(group, segMap, nodeMap, sequenceFlows, sizeOverrides)
}
