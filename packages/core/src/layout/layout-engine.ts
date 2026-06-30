import type { BpmnFlowElement, BpmnProcess, BpmnSequenceFlow } from "../bpmn/bpmn-model.js"
import { buildBlockTree } from "./block-builder.js"
import { applyBlockLayout } from "./block-layout.js"
import {
	alignBaselinePath,
	alignBranchBaselines,
	alignSplitJoinPairs,
	assignCoordinates,
	assignGridRows,
	compactBranches,
	distributeSplitBranches,
	ensureEarlyReturnOffBaseline,
	resolveLayerOverlaps,
	snapToYRows,
} from "./coordinates.js"
import { minimizeCrossings } from "./crossing.js"
import { buildGraph, detectBackEdges, reverseBackEdges } from "./graph.js"
import { assignLayers, groupByLayer } from "./layers.js"
import { assertNoOverlap } from "./overlap.js"
import { routeEdges } from "./routing.js"
import { layoutSubProcesses } from "./subprocess.js"
import type { LayoutNode, LayoutResult, SubProcessChildResult } from "./types.js"

const CHAIN_GAP = 30
const CHAIN_V_GAP = 20

/**
 * Reposition boundary events to the bottom edge of their host task, then walk
 * each boundary event's exclusive downstream chain and place those nodes
 * horizontally to the right of the host task. Re-routes all affected edges.
 */
function repositionBoundaryEvents(flowElements: BpmnFlowElement[], result: LayoutResult): void {
	const boundaryMap = new Map<string, string[]>()
	for (const el of flowElements) {
		if (el.type !== "boundaryEvent") continue
		const list = boundaryMap.get(el.attachedToRef) ?? []
		list.push(el.id)
		boundaryMap.set(el.attachedToRef, list)
	}
	if (boundaryMap.size === 0) return

	const nodeById = new Map(result.nodes.map((n) => [n.id, n]))

	const succIds = new Map<string, string[]>()
	const predIds = new Map<string, Set<string>>()
	for (const edge of result.edges) {
		const se = succIds.get(edge.sourceRef) ?? []
		se.push(edge.targetRef)
		succIds.set(edge.sourceRef, se)
		const ps = predIds.get(edge.targetRef) ?? new Set<string>()
		ps.add(edge.sourceRef)
		predIds.set(edge.targetRef, ps)
	}

	const allChainNodes = new Set<string>()

	for (const [hostId, beIds] of boundaryMap) {
		const hostNode = nodeById.get(hostId)
		if (!hostNode) continue

		// Pre-compute distribution parameters (all boundary events share the same fixed size).
		// Distribute events evenly along the bottom edge, centered on the task.
		// effectiveSpacing guarantees events don't overlap (min bW + 4px gap).
		const firstBeNode = nodeById.get(beIds[0] ?? "")
		const bW = firstBeNode?.bounds.width ?? 36
		const bH = firstBeNode?.bounds.height ?? 36
		const n = beIds.length
		const effectiveSpacing = Math.max(Math.round(hostNode.bounds.width / (n + 1)), bW + 4)
		const groupWidth = Math.max(0, n - 1) * effectiveSpacing
		const groupStartCenterX = Math.round(
			hostNode.bounds.x + hostNode.bounds.width / 2 - groupWidth / 2,
		)

		for (let i = 0; i < beIds.length; i++) {
			const beId = beIds[i]
			if (!beId) continue
			const beNode = nodeById.get(beId)
			if (!beNode) continue

			// bW / bH come from the pre-loop computation (all BEs are fixed 36×36)

			// Center-bottom distribution: single event → task center; multiple → even spread
			beNode.bounds.x = Math.round(groupStartCenterX + i * effectiveSpacing - bW / 2)
			beNode.bounds.y = Math.round(hostNode.bounds.y + hostNode.bounds.height - bH / 2)
			if (beNode.labelBounds) {
				beNode.labelBounds.x = beNode.bounds.x + Math.round(bW / 2 - beNode.labelBounds.width / 2)
				beNode.labelBounds.y = beNode.bounds.y + bH + 4
			}

			// Collect nodes exclusively reachable from this boundary event (BFS)
			const chainSet = new Set<string>([beId])
			const chainOrder: string[] = []
			const queue = [...(succIds.get(beId) ?? [])]
			while (queue.length > 0) {
				const id = queue.shift()
				if (!id || chainSet.has(id)) continue
				const preds = predIds.get(id) ?? new Set<string>()
				if ([...preds].every((p) => chainSet.has(p))) {
					chainSet.add(id)
					chainOrder.push(id)
					queue.push(...(succIds.get(id) ?? []))
				}
			}

			// Record all chain members so the forward pass can identify them.
			for (const cid of chainSet) allChainNodes.add(cid)

			// Each boundary event's chain gets its own vertical lane
			let maxChainH = 0
			for (const id of chainOrder) {
				const n = nodeById.get(id)
				if (n) maxChainH = Math.max(maxChainH, n.bounds.height)
			}
			const laneOffset = i * (maxChainH + CHAIN_V_GAP + 10)
			const chainCenterY = Math.round(
				beNode.bounds.y + bH + CHAIN_V_GAP + maxChainH / 2 + laneOffset,
			)
			const chainStartX = Math.max(
				Math.round(beNode.bounds.x + bW / 2) + CHAIN_GAP,
				hostNode.bounds.x + hostNode.bounds.width + CHAIN_GAP,
			)
			let curX = chainStartX

			for (const id of chainOrder) {
				const n = nodeById.get(id)
				if (!n) continue
				n.bounds.x = curX
				n.bounds.y = chainCenterY - Math.round(n.bounds.height / 2)
				if (n.labelBounds) {
					// Center label on node, but clamp so it never extends left of the node —
					// wide event labels would otherwise overlap the preceding chain element.
					const labelX = n.bounds.x + Math.round(n.bounds.width / 2 - n.labelBounds.width / 2)
					n.labelBounds.x = Math.max(labelX, n.bounds.x)
					n.labelBounds.y = n.bounds.y + n.bounds.height + 4
				}
				// Advance past the node AND its label so the next element doesn't overlap.
				const nodeRight = n.bounds.x + n.bounds.width
				const labelRight = n.labelBounds ? n.labelBounds.x + n.labelBounds.width : 0
				curX = Math.max(nodeRight, labelRight) + CHAIN_GAP
			}

			// Re-route edges touching the boundary event or its chain
			for (const edge of result.edges) {
				if (!chainSet.has(edge.sourceRef)) continue
				const src = nodeById.get(edge.sourceRef)
				const tgt = nodeById.get(edge.targetRef)
				if (!src || !tgt) continue

				if (edge.sourceRef === beId) {
					const srcX = Math.round(src.bounds.x + bW / 2)
					const srcY = Math.round(src.bounds.y + bH)
					const tgtX = Math.round(tgt.bounds.x)
					const tgtY = Math.round(tgt.bounds.y + tgt.bounds.height / 2)
					edge.waypoints = [
						{ x: srcX, y: srcY },
						{ x: srcX, y: tgtY },
						{ x: tgtX, y: tgtY },
					]
				} else {
					const srcX = Math.round(src.bounds.x + src.bounds.width)
					const srcY = Math.round(src.bounds.y + src.bounds.height / 2)
					const tgtX = Math.round(tgt.bounds.x)
					const tgtY = Math.round(tgt.bounds.y + tgt.bounds.height / 2)
					edge.waypoints = [
						{ x: srcX, y: srcY },
						{ x: tgtX, y: tgtY },
					]
				}
			}
		}
	}

	// Forward-placement pass: any node not in any chain but whose predecessor
	// has been relocated further right must be pushed rightward.
	// Process in topological order (Kahn's algorithm over the sequenceFlow graph).
	const inDegree = new Map<string, number>()
	for (const id of nodeById.keys()) {
		inDegree.set(id, (predIds.get(id) ?? new Set()).size)
	}
	const topoQueue: string[] = []
	for (const [id, deg] of inDegree) {
		if (deg === 0) topoQueue.push(id)
	}
	const topoOrder: string[] = []
	while (topoQueue.length > 0) {
		const id = topoQueue.shift()
		if (!id) break
		topoOrder.push(id)
		for (const succId of succIds.get(id) ?? []) {
			const newDeg = (inDegree.get(succId) ?? 1) - 1
			inDegree.set(succId, newDeg)
			if (newDeg === 0) topoQueue.push(succId)
		}
	}

	const movedInPass = new Set<string>()

	for (const id of topoOrder) {
		if (allChainNodes.has(id)) continue
		const node = nodeById.get(id)
		if (!node) continue
		const preds = predIds.get(id) ?? new Set<string>()
		if (preds.size === 0) continue

		let maxPredRight = 0
		for (const predId of preds) {
			const pred = nodeById.get(predId)
			if (pred) maxPredRight = Math.max(maxPredRight, pred.bounds.x + pred.bounds.width)
		}

		const minX = maxPredRight + CHAIN_GAP
		if (minX > node.bounds.x) {
			const delta = minX - node.bounds.x
			node.bounds.x = minX
			if (node.labelBounds) node.labelBounds.x += delta
			movedInPass.add(id)
		}
	}

	// Spatial bump: if a moved node now overlaps a non-chain node on a parallel
	// path (no predecessor/successor relationship), push it clear and cascade.
	let bumped = true
	while (bumped) {
		bumped = false
		for (const movedId of movedInPass) {
			const moved = nodeById.get(movedId)
			if (!moved) continue
			const movedRight = moved.bounds.x + moved.bounds.width
			for (const [otherId, other] of nodeById) {
				if (otherId === movedId) continue
				if (allChainNodes.has(otherId)) continue
				if (movedInPass.has(otherId)) continue
				// Check y overlap
				if (other.bounds.y + other.bounds.height <= moved.bounds.y) continue
				if (other.bounds.y >= moved.bounds.y + moved.bounds.height) continue
				// Check x overlap (moved node intrudes into other's space)
				if (other.bounds.x >= movedRight) continue
				if (other.bounds.x + other.bounds.width <= moved.bounds.x) continue
				// Push other right of moved
				const newX = movedRight + CHAIN_GAP
				if (newX > other.bounds.x) {
					const delta = newX - other.bounds.x
					other.bounds.x = newX
					if (other.labelBounds) other.labelBounds.x += delta
					movedInPass.add(otherId)
					bumped = true
				}
			}
		}
	}

	// Re-route edges where a chain source now points at a moved target,
	// or where the source itself was moved by the forward pass.
	for (const edge of result.edges) {
		const srcMoved = movedInPass.has(edge.sourceRef)
		const tgtMoved = movedInPass.has(edge.targetRef)
		if (!srcMoved && !tgtMoved) continue
		const src = nodeById.get(edge.sourceRef)
		const tgt = nodeById.get(edge.targetRef)
		if (!src || !tgt) continue
		const srcX = Math.round(src.bounds.x + src.bounds.width)
		const srcY = Math.round(src.bounds.y + src.bounds.height / 2)
		const tgtX = Math.round(tgt.bounds.x)
		const tgtY = Math.round(tgt.bounds.y + tgt.bounds.height / 2)
		edge.waypoints = [
			{ x: srcX, y: srcY },
			{ x: tgtX, y: tgtY },
		]
	}
}

/**
 * Auto-layout a BPMN process using the Sugiyama/layered algorithm.
 *
 * Phases:
 * 1. Cycle removal — DFS back-edge detection and reversal
 * 2. Layer assignment — Longest-path layering
 * 3. Crossing minimization — Barycenter heuristic
 * 4. Coordinate assignment — Fixed element sizes with spacing
 * 5. Sub-process layout — Recursive nested passes
 * 6. Edge routing — Orthogonal waypoints
 * 7. Boundary event repositioning — place events on host border
 * 8. Overlap assertion — Post-condition validation
 */
export function layoutProcess(process: BpmnProcess): LayoutResult {
	const result = layoutFlowNodes(process.flowElements, process.sequenceFlows)
	repositionBoundaryEvents(process.flowElements, result)
	assertNoOverlap(result)
	return result
}

/**
 * Layout a set of flow nodes and sequence flows.
 * Used both for top-level processes and recursively for sub-processes.
 */
export function layoutFlowNodes(
	flowNodes: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
): LayoutResult {
	if (flowNodes.length === 0) {
		return { nodes: [], edges: [] }
	}

	// Build node index
	const nodeIndex = new Map<string, BpmnFlowElement>()
	for (const node of flowNodes) {
		nodeIndex.set(node.id, node)
	}

	// Phase 1: Build graph and detect/remove cycles
	const graph = buildGraph(flowNodes, sequenceFlows)
	const backEdges = detectBackEdges(graph, sequenceFlows)
	const dag = backEdges.length > 0 ? reverseBackEdges(graph, backEdges) : graph

	// Phase 2: Try block-based layout (primary path for structured processes)
	// Block layout only works well for processes without back-edges (loops).
	let layoutNodes: LayoutNode[]
	const blockTree = backEdges.length === 0 ? buildBlockTree(dag, nodeIndex) : null
	const usedBlockLayout = blockTree !== null

	if (blockTree) {
		layoutNodes = applyBlockLayout(blockTree, nodeIndex)
	} else {
		layoutNodes = sugiyamaLayout(dag, nodeIndex, backEdges)
	}

	// Phase 5: Sub-process layout — expand containers and lay out children
	const childResults = layoutSubProcesses(layoutNodes, nodeIndex)

	// After subprocess expansion, push nodes that now overlap with expanded containers.
	// For block layout, assign unique layer indices first so resolveLayerOverlaps works
	// correctly (block layout nodes all start at layer=0).
	if (usedBlockLayout && childResults.length > 0) {
		// Assign each block-layout node a unique layer so overlap resolution doesn't
		// collapse them all into the same bucket and push them vertically apart.
		for (let idx = 0; idx < layoutNodes.length; idx++) {
			const n = layoutNodes[idx]
			if (n) n.layer = idx
		}
	}

	resolveSubProcessOverlaps(layoutNodes)

	// Phase 5b: Resolve Y-direction overlaps caused by subprocess expansion.
	// Expanded subprocesses grow in-place and can overlap same-layer siblings.
	// For block layout without subprocesses, skip this — overlaps are impossible by construction.
	if (!usedBlockLayout || childResults.length > 0) {
		resolveLayerOverlaps(layoutNodes)
	}

	// Phase 5c: Sync child positions to their subprocess containers.
	// resolveLayerOverlaps (including its Y-normalization pass) may have shifted
	// subprocess containers after their children were already translated to
	// absolute coordinates — children must follow.
	syncSubProcessChildren(childResults, layoutNodes)

	// Assign grid-row indices based on final center-Y positions (eliminates pixel-tolerance
	// guessing in port-side decisions).
	assignGridRows(layoutNodes)

	// Phase 6: Edge routing (uses original back-edges for routing, not reversed)
	const nodeMap = new Map<string, LayoutNode>()
	for (const node of layoutNodes) {
		nodeMap.set(node.id, node)
	}

	const edges = routeEdges(sequenceFlows, nodeMap, backEdges)

	// Flatten child results into the main layout
	const allNodes = [...layoutNodes]
	const allEdges = [...edges]
	for (const child of childResults) {
		for (const cn of child.result.nodes) {
			allNodes.push(cn)
		}
		for (const ce of child.result.edges) {
			allEdges.push(ce)
		}
	}

	return { nodes: allNodes, edges: allEdges }
}

/**
 * Run the Sugiyama layered layout pipeline.
 * Used as fallback for unstructured or loop-containing processes.
 */
function sugiyamaLayout(
	dag: ReturnType<typeof buildGraph>,
	nodeIndex: Map<string, BpmnFlowElement>,
	backEdges: ReturnType<typeof detectBackEdges>,
): LayoutNode[] {
	// Phase 2: Layer assignment
	const layers = assignLayers(dag)

	// Phase 3: Group by layer and minimize crossings
	const layerGroups = groupByLayer(layers)
	const orderedLayers = minimizeCrossings(layerGroups, dag)

	// Phase 4: Coordinate assignment
	const layoutNodes = assignCoordinates(orderedLayers, nodeIndex)

	// Phase 4b: Align linear sequences to a common y-baseline
	alignBranchBaselines(layoutNodes, dag)

	// Phase 4c: Align split/join gateway pairs to same y-coordinate
	alignSplitJoinPairs(layoutNodes, dag, backEdges)

	// Phase 4d: Align all baseline-path nodes to the same center-Y
	alignBaselinePath(layoutNodes, dag, backEdges)

	// Phase 4e: Ensure early-return branches are never on the baseline
	ensureEarlyReturnOffBaseline(layoutNodes, dag, backEdges)

	// Re-align linear chains that may have been disrupted by position swaps
	alignBranchBaselines(layoutNodes, dag)

	// Phase 4f: Distribute split gateway branches symmetrically
	distributeSplitBranches(layoutNodes, dag, backEdges)

	// Re-align split/join pairs that may have been separated during branch distribution
	alignSplitJoinPairs(layoutNodes, dag, backEdges)

	// Re-align branch spines after distribution moved chains and alignSplitJoinPairs
	// adjusted join gateways (continuation nodes after joins must follow)
	alignBranchBaselines(layoutNodes, dag)

	// Phase 4g: Resolve any layer overlaps from redistribution
	resolveLayerOverlaps(layoutNodes)

	// Phase 4h: Re-align baseline after overlap resolution (overlap resolution may push
	// baseline nodes off-center when they share a layer with branch nodes)
	alignBaselinePath(layoutNodes, dag, backEdges)

	// Phase 4i: Final overlap resolution — baseline re-alignment may pull a node back into
	// an overlap that resolveLayerOverlaps already fixed; one more pass eliminates these.
	resolveLayerOverlaps(layoutNodes)

	// Phase 4j: Branch compaction — pull branch subtrees toward baseline
	compactBranches(layoutNodes, dag, backEdges)
	resolveLayerOverlaps(layoutNodes)
	alignBaselinePath(layoutNodes, dag, backEdges)

	// Phase 4k: Row snapping — merge close Y rows for matrix-like alignment
	snapToYRows(layoutNodes)
	resolveLayerOverlaps(layoutNodes)

	return layoutNodes
}

/**
 * After subprocess expansion, cascade-shift all subsequent layers
 * so that inter-layer spacing is preserved.
 */
function resolveSubProcessOverlaps(nodes: LayoutNode[]): void {
	const expanded = nodes.filter((n) => n.isExpanded)
	if (expanded.length === 0) return

	// Group nodes by layer
	const byLayer = new Map<number, LayoutNode[]>()
	for (const n of nodes) {
		const arr = byLayer.get(n.layer)
		if (arr) arr.push(n)
		else byLayer.set(n.layer, [n])
	}

	const layers = [...byLayer.keys()].sort((a, b) => a - b)
	const MIN_GAP = 50

	// Cascade: ensure each layer starts after previous layer's rightmost edge
	for (let i = 1; i < layers.length; i++) {
		const prevKey = layers[i - 1]
		const curKey = layers[i]
		if (prevKey === undefined || curKey === undefined) continue
		const prevNodes = byLayer.get(prevKey)
		const curNodes = byLayer.get(curKey)
		if (!prevNodes || !curNodes) continue

		// Find rightmost edge in previous layer (including labels)
		let prevRight = 0
		for (const n of prevNodes) {
			prevRight = Math.max(prevRight, n.bounds.x + n.bounds.width)
			if (n.labelBounds) {
				prevRight = Math.max(prevRight, n.labelBounds.x + n.labelBounds.width)
			}
		}

		// Find leftmost edge in current layer
		let curLeft = Number.POSITIVE_INFINITY
		for (const n of curNodes) {
			curLeft = Math.min(curLeft, n.bounds.x)
		}

		const gap = curLeft - prevRight
		if (gap < MIN_GAP) {
			const dx = MIN_GAP - gap
			for (const n of curNodes) {
				n.bounds.x += dx
				if (n.labelBounds) {
					n.labelBounds.x += dx
				}
			}
		}
	}
}

/**
 * After post-expansion adjustments (resolveSubProcessOverlaps, resolveLayerOverlaps),
 * subprocess containers may have been shifted. Translate their children by the same
 * delta so that children remain correctly positioned inside their parent.
 */
function syncSubProcessChildren(
	childResults: SubProcessChildResult[],
	layoutNodes: LayoutNode[],
): void {
	if (childResults.length === 0) return

	const nodeMap = new Map<string, LayoutNode>()
	for (const n of layoutNodes) nodeMap.set(n.id, n)

	for (const cr of childResults) {
		const parent = nodeMap.get(cr.parentId)
		if (!parent) continue
		const dx = parent.bounds.x - cr.parentX
		const dy = parent.bounds.y - cr.parentY
		if (dx === 0 && dy === 0) continue

		for (const child of cr.result.nodes) {
			child.bounds.x += dx
			child.bounds.y += dy
			if (child.labelBounds) {
				child.labelBounds.x += dx
				child.labelBounds.y += dy
			}
		}
		for (const edge of cr.result.edges) {
			for (const wp of edge.waypoints) {
				wp.x += dx
				wp.y += dy
			}
			if (edge.labelBounds) {
				edge.labelBounds.x += dx
				edge.labelBounds.y += dy
			}
		}
	}
}
