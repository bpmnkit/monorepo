import type { BpmnElementType, BpmnFlowElement } from "../bpmn/bpmn-model.js"
import type { BackEdge, DirectedGraph } from "./graph.js"
import type { Bounds, LayoutNode } from "./types.js"
import { ELEMENT_SIZES, GRID_CELL_HEIGHT, GRID_CELL_WIDTH } from "./types.js"

/** Get the fixed size for a BPMN element type. */
export function getElementSize(type: BpmnElementType): { width: number; height: number } {
	return ELEMENT_SIZES[type] ?? { width: 100, height: 80 }
}

/**
 * Assign x,y coordinates to all nodes based on a virtual grid.
 * Each grid cell is GRID_CELL_WIDTH × GRID_CELL_HEIGHT.
 * Elements are centered within their grid cell.
 * If an element is larger than a single cell, adjacent cells are merged.
 */
export function assignCoordinates(
	orderedLayers: string[][],
	nodeIndex: Map<string, BpmnFlowElement>,
): LayoutNode[] {
	const layoutNodes: LayoutNode[] = []

	// Determine how many grid columns each layer needs (for oversized elements)
	const layerGridCols: number[] = []
	for (const layer of orderedLayers) {
		let maxCols = 1
		for (const nodeId of layer) {
			const node = nodeIndex.get(nodeId)
			if (node) {
				const size = getElementSize(node.type)
				const cols = Math.ceil(size.width / GRID_CELL_WIDTH)
				if (cols > maxCols) maxCols = cols
			}
		}
		layerGridCols.push(maxCols)
	}

	// Calculate x offset for each layer based on grid columns
	const layerXOffsets: number[] = []
	let gridCol = 0
	for (let layerIdx = 0; layerIdx < orderedLayers.length; layerIdx++) {
		layerXOffsets.push(gridCol * GRID_CELL_WIDTH)
		gridCol += layerGridCols[layerIdx] ?? 1
	}

	// Determine how many grid rows each position needs within each layer
	for (let layerIdx = 0; layerIdx < orderedLayers.length; layerIdx++) {
		const layer = orderedLayers[layerIdx]
		if (!layer) continue
		const layerX = layerXOffsets[layerIdx]
		if (layerX === undefined) continue
		const cellSpanW = (layerGridCols[layerIdx] ?? 1) * GRID_CELL_WIDTH

		let gridRow = 0
		for (let posIdx = 0; posIdx < layer.length; posIdx++) {
			const nodeId = layer[posIdx]
			if (!nodeId) continue
			const node = nodeIndex.get(nodeId)

			// Dummy nodes (injected for multi-span edge routing) have 0×0 size and
			// are placed at the center of their grid cell for use as routing waypoints.
			const size = node ? getElementSize(node.type) : { width: 0, height: 0 }
			const rowsNeeded = Math.max(1, Math.ceil(size.height / GRID_CELL_HEIGHT))
			const cellSpanH = rowsNeeded * GRID_CELL_HEIGHT

			// Center element within its grid cell(s)
			const cellX = layerX
			const cellY = gridRow * GRID_CELL_HEIGHT
			const xOffset = (cellSpanW - size.width) / 2
			const yOffset = (cellSpanH - size.height) / 2

			const bounds: Bounds = {
				x: cellX + xOffset,
				y: cellY + yOffset,
				width: size.width,
				height: size.height,
			}

			const labelBounds = node ? computeLabelBounds(node, bounds) : undefined

			layoutNodes.push({
				id: nodeId,
				type: node?.type ?? "serviceTask",
				bounds,
				layer: layerIdx,
				position: posIdx,
				label: node?.name,
				labelBounds,
				isDummy: !node,
			})

			gridRow += rowsNeeded
		}
	}

	// Center the layout vertically so all layers are balanced
	centerLayersVertically(layoutNodes, orderedLayers)

	return layoutNodes
}

/**
 * Center each layer vertically around the midpoint of the tallest layer.
 */
function centerLayersVertically(nodes: LayoutNode[], orderedLayers: string[][]): void {
	// Find the total height of each layer
	const layerHeights: number[] = []
	for (const layer of orderedLayers) {
		const layerNodes = nodes.filter((n) => layer.includes(n.id))
		if (layerNodes.length === 0) {
			layerHeights.push(0)
			continue
		}
		const minY = Math.min(...layerNodes.map((n) => n.bounds.y))
		const maxY = Math.max(...layerNodes.map((n) => n.bounds.y + n.bounds.height))
		layerHeights.push(maxY - minY)
	}

	const maxHeight = Math.max(...layerHeights, 0)

	// Shift each layer so it's centered relative to the tallest layer
	for (let i = 0; i < orderedLayers.length; i++) {
		const layer = orderedLayers[i]
		if (!layer) continue
		const layerHeight = layerHeights[i]
		if (layerHeight === undefined) continue
		const yShift = (maxHeight - layerHeight) / 2

		if (yShift > 0) {
			for (const node of nodes) {
				if (layer.includes(node.id)) {
					node.bounds.y += yShift
					if (node.labelBounds) {
						node.labelBounds.y += yShift
					}
				}
			}
		}
	}
}

/** Compute label bounds for a node based on its type. */
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

/**
 * Re-assign x-coordinates after sub-process expansion.
 * Walks layers left-to-right, shifting each layer to avoid overlap with the previous one.
 */
export function reassignXCoordinates(layoutNodes: LayoutNode[], orderedLayers: string[][]): void {
	const nodeMap = new Map<string, LayoutNode>()
	for (const n of layoutNodes) {
		nodeMap.set(n.id, n)
	}

	for (let i = 1; i < orderedLayers.length; i++) {
		const prevLayer = orderedLayers[i - 1]
		if (!prevLayer) continue
		const currLayer = orderedLayers[i]
		if (!currLayer) continue

		// Find the rightmost edge of the previous layer
		let prevMaxRight = 0
		for (const id of prevLayer) {
			const n = nodeMap.get(id)
			if (n) {
				const right = n.bounds.x + n.bounds.width
				if (right > prevMaxRight) prevMaxRight = right
			}
		}

		// Find the leftmost edge of the current layer
		let currMinLeft = Number.POSITIVE_INFINITY
		for (const id of currLayer) {
			const n = nodeMap.get(id)
			if (n && n.bounds.x < currMinLeft) currMinLeft = n.bounds.x
		}

		// Snap to next grid boundary
		const prevCellEnd = Math.ceil(prevMaxRight / GRID_CELL_WIDTH) * GRID_CELL_WIDTH
		const requiredX = prevCellEnd
		const shift = requiredX - currMinLeft
		if (shift > 0) {
			for (let j = i; j < orderedLayers.length; j++) {
				for (const id of orderedLayers[j] ?? []) {
					const n = nodeMap.get(id)
					if (n) {
						n.bounds.x += shift
						if (n.labelBounds) n.labelBounds.x += shift
					}
				}
			}
		}
	}
}

const GATEWAY_TYPE_SET: ReadonlySet<string> = new Set([
	"exclusiveGateway",
	"parallelGateway",
	"inclusiveGateway",
	"eventBasedGateway",
])

/** Build a set of "sourceRef->targetRef" strings from original back edges. */
function buildBackEdgeOriginals(backEdges: BackEdge[]): Set<string> {
	const s = new Set<string>()
	for (const be of backEdges) {
		s.add(`${be.sourceRef}->${be.targetRef}`)
	}
	return s
}

/**
 * Get the "true" forward successors of a node in the DAG,
 * excluding successors that were added by reversing back edges.
 * A DAG edge (node→s) is a reversed back edge if the original back edge was (s→node).
 */
function getTrueSuccessors(
	nodeId: string,
	dag: DirectedGraph,
	backEdgeOriginals: Set<string>,
): string[] {
	return (dag.successors.get(nodeId) ?? []).filter((s) => !backEdgeOriginals.has(`${s}->${nodeId}`))
}

/** Count total forward-reachable nodes from startId in the DAG. */
function countForwardReachable(startId: string, dag: DirectedGraph): number {
	const seen = new Set<string>()
	const queue = [startId]
	while (queue.length > 0) {
		const id = queue.shift()
		if (!id || seen.has(id)) continue
		seen.add(id)
		for (const s of dag.successors.get(id) ?? []) {
			queue.push(s)
		}
	}
	return seen.size
}

/**
 * Align nodes in linear sequences to a common y-baseline.
 * A "linear" node has ≤1 predecessor and ≤1 successor, and is not a gateway.
 * Walks forward from each chain root, setting successors to the same center-y.
 * Crosses split/join gateway pairs to align the full branch spine.
 */
export function alignBranchBaselines(layoutNodes: LayoutNode[], dag: DirectedGraph): void {
	const nodeMap = new Map<string, LayoutNode>()
	for (const n of layoutNodes) {
		nodeMap.set(n.id, n)
	}

	const visited = new Set<string>()

	for (const n of layoutNodes) {
		if (visited.has(n.id)) continue
		if (GATEWAY_TYPE_SET.has(n.type)) continue

		// Walk backward to find the chain root
		let rootId = n.id
		for (;;) {
			const preds = dag.predecessors.get(rootId) ?? []
			if (preds.length !== 1) break
			const pred = preds[0]
			if (!pred) break
			const predNode = nodeMap.get(pred)
			if (!predNode || GATEWAY_TYPE_SET.has(predNode.type)) break
			const predSuccs = dag.successors.get(pred) ?? []
			if (predSuccs.length !== 1 && GATEWAY_TYPE_SET.has(predNode.type)) break
			rootId = pred
		}

		// Walk forward from root, aligning to root's center-y
		const rootNode = nodeMap.get(rootId)
		if (!rootNode) continue
		const baselineCenterY = rootNode.bounds.y + rootNode.bounds.height / 2

		let currentId: string | undefined = rootId
		while (currentId) {
			if (visited.has(currentId)) break
			visited.add(currentId)

			const current = nodeMap.get(currentId)
			if (!current) break

			if (GATEWAY_TYPE_SET.has(current.type)) {
				// If this is a split gateway, align it, find its join, align that, continue after
				const trueSuccs = dag.successors.get(currentId) ?? []
				if (trueSuccs.length >= 2) {
					const dy = baselineCenterY - (current.bounds.y + current.bounds.height / 2)
					if (Math.abs(dy) > 0.5) {
						current.bounds.y += dy
						if (current.labelBounds) current.labelBounds.y += dy
					}
					const joinId = findJoinGateway(currentId, dag, nodeMap)
					if (joinId && !visited.has(joinId)) {
						const joinNode = nodeMap.get(joinId)
						if (joinNode) {
							visited.add(joinId)
							const jdy = baselineCenterY - (joinNode.bounds.y + joinNode.bounds.height / 2)
							if (Math.abs(jdy) > 0.5) {
								joinNode.bounds.y += jdy
								if (joinNode.labelBounds) joinNode.labelBounds.y += jdy
							}
							// Continue after the join
							const joinSuccs = dag.successors.get(joinId) ?? []
							currentId = joinSuccs.length === 1 ? joinSuccs[0] : undefined
							continue
						}
					}
				}
				break
			}

			const dy = baselineCenterY - (current.bounds.y + current.bounds.height / 2)
			if (Math.abs(dy) > 0.5) {
				current.bounds.y += dy
				if (current.labelBounds) current.labelBounds.y += dy
			}

			const succs: string[] = dag.successors.get(currentId) ?? []
			let nextId: string | undefined
			if (succs.length === 1) {
				nextId = succs[0]
			} else if (succs.length > 1 && !GATEWAY_TYPE_SET.has(current.type)) {
				nextId = succs.find((s) => (dag.predecessors.get(s) ?? []).length === 1)
			} else {
				break
			}
			if (!nextId) break
			const nextNode = nodeMap.get(nextId)
			if (!nextNode) break
			const nextPreds = dag.predecessors.get(nextId) ?? []
			if (nextPreds.length !== 1 && !GATEWAY_TYPE_SET.has(nextNode.type)) break
			currentId = nextId
		}
	}
}

/**
 * Align split/join gateway pairs to the same y-coordinate.
 * A split gateway fans out to multiple successors; the corresponding join gateway
 * is the nearest downstream gateway where all branches reconverge.
 */
export function alignSplitJoinPairs(
	layoutNodes: LayoutNode[],
	dag: DirectedGraph,
	backEdges: BackEdge[] = [],
): void {
	const backEdgeOriginals = buildBackEdgeOriginals(backEdges)
	const nodeMap = new Map<string, LayoutNode>()
	for (const n of layoutNodes) {
		nodeMap.set(n.id, n)
	}

	for (const n of layoutNodes) {
		if (!GATEWAY_TYPE_SET.has(n.type)) continue
		// Use true successors (exclude reversed back-edge successors) to detect real splits
		const trueSuccs = getTrueSuccessors(n.id, dag, backEdgeOriginals)
		if (trueSuccs.length < 2) continue

		// This is a split gateway — find its merge partner
		const joinId = findJoinGateway(n.id, dag, nodeMap)
		if (!joinId) continue

		const joinNode = nodeMap.get(joinId)
		if (!joinNode) continue

		// Force join gateway to same center-y as split gateway
		const splitCenterY = n.bounds.y + n.bounds.height / 2
		const joinCenterY = joinNode.bounds.y + joinNode.bounds.height / 2
		const dy = splitCenterY - joinCenterY
		if (Math.abs(dy) > 0.5) {
			joinNode.bounds.y += dy
			if (joinNode.labelBounds) joinNode.labelBounds.y += dy
		}
	}
}

/**
 * Find the merge gateway for a given split gateway.
 * Walks forward from each successor until all paths converge at a common gateway.
 */
function findJoinGateway(
	splitId: string,
	dag: DirectedGraph,
	nodeMap: Map<string, LayoutNode>,
): string | undefined {
	const succs = dag.successors.get(splitId) ?? []
	if (succs.length < 2) return undefined

	// For each branch, walk forward to find the first downstream gateway
	const branchEndpoints = new Map<string, Set<string>>()

	for (const startId of succs) {
		const reachableGateways = new Set<string>()
		const queue = [startId]
		const seen = new Set<string>()

		while (queue.length > 0) {
			const id = queue.shift()
			if (!id || seen.has(id)) continue
			seen.add(id)

			const node = nodeMap.get(id)
			if (!node) continue

			if (GATEWAY_TYPE_SET.has(node.type) && id !== splitId) {
				reachableGateways.add(id)
				continue // Don't traverse past gateways
			}

			for (const next of dag.successors.get(id) ?? []) {
				if (next !== splitId) queue.push(next)
			}
		}

		branchEndpoints.set(startId, reachableGateways)
	}

	// Find the gateway reachable from ALL branches
	const allBranches = [...branchEndpoints.values()]
	if (allBranches.length === 0) return undefined

	const firstSet = allBranches[0]
	if (!firstSet) return undefined

	for (const candidate of firstSet) {
		if (allBranches.every((s) => s.has(candidate))) {
			return candidate
		}
	}

	return undefined
}

/**
 * Ensure early-return branches (shorter paths from split to join) are never on the baseline.
 * The baseline is the split gateway's center-y. If the shortest branch sits on the baseline,
 * swap it with a longer branch.
 */
export function ensureEarlyReturnOffBaseline(
	layoutNodes: LayoutNode[],
	dag: DirectedGraph,
	backEdges: BackEdge[] = [],
): void {
	const backEdgeOriginals = buildBackEdgeOriginals(backEdges)
	const nodeMap = new Map<string, LayoutNode>()
	for (const n of layoutNodes) {
		nodeMap.set(n.id, n)
	}

	for (const n of layoutNodes) {
		if (!GATEWAY_TYPE_SET.has(n.type)) continue
		// Only process true split gateways (not join gateways with reversed back edges)
		const trueSuccs = getTrueSuccessors(n.id, dag, backEdgeOriginals)
		if (trueSuccs.length < 2) continue

		const joinId = findJoinGateway(n.id, dag, nodeMap)

		// Measure branch length (number of nodes from split successor to join)
		const branchLengths = new Map<string, number>()
		for (const startId of trueSuccs) {
			let length = 0
			let currentId: string | undefined = startId
			const seen = new Set<string>()
			while (currentId && !seen.has(currentId)) {
				seen.add(currentId)
				length++
				if (currentId === joinId) break
				const nextSuccs: string[] = dag.successors.get(currentId) ?? []
				currentId = nextSuccs[0]
			}
			branchLengths.set(startId, length)
		}

		const minLength = Math.min(...branchLengths.values())
		const maxLength = Math.max(...branchLengths.values())
		if (minLength >= maxLength) continue // All branches same length

		const splitCenterY = n.bounds.y + n.bounds.height / 2

		// Find early-return branches (shortest) that are on the baseline
		const earlyReturnOnBaseline: string[] = []
		let longestOffBaseline: string | undefined

		for (const startId of trueSuccs) {
			const branchNode = nodeMap.get(startId)
			if (!branchNode) continue
			const branchCenterY = branchNode.bounds.y + branchNode.bounds.height / 2
			const onBaseline = Math.abs(branchCenterY - splitCenterY) < 1

			if (branchLengths.get(startId) === minLength && onBaseline) {
				earlyReturnOnBaseline.push(startId)
			}
			if (branchLengths.get(startId) === maxLength && !onBaseline) {
				longestOffBaseline = startId
			}
		}

		if (earlyReturnOnBaseline.length === 0 || !longestOffBaseline) continue

		// Swap the first early-return branch with the longest off-baseline branch
		const earlyId = earlyReturnOnBaseline[0]
		if (!earlyId) continue
		const swapId = longestOffBaseline

		swapBranchPositions(earlyId, swapId, dag, nodeMap, joinId)
	}
}

/**
 * Find the baseline path — the "spine" of the process that all paths share.
 * At split gateways, jumps directly to the corresponding join gateway.
 * Returns the ordered list of node IDs on the baseline.
 */
export function findBaselinePath(
	layoutNodes: LayoutNode[],
	dag: DirectedGraph,
	backEdges: BackEdge[] = [],
): string[] {
	const backEdgeOriginals = buildBackEdgeOriginals(backEdges)
	const nodeMap = new Map<string, LayoutNode>()
	for (const n of layoutNodes) {
		nodeMap.set(n.id, n)
	}

	// Find start event (first node with no predecessors)
	let startId: string | undefined
	for (const n of layoutNodes) {
		if (n.type === "startEvent") {
			startId = n.id
			break
		}
	}
	if (!startId) {
		// Fallback: first node with no predecessors
		for (const n of layoutNodes) {
			const preds = dag.predecessors.get(n.id) ?? []
			if (preds.length === 0) {
				startId = n.id
				break
			}
		}
	}
	if (!startId) return []

	const path: string[] = []
	const visited = new Set<string>()
	let currentId: string | undefined = startId

	while (currentId && !visited.has(currentId)) {
		visited.add(currentId)
		path.push(currentId)

		const succs: string[] = dag.successors.get(currentId) ?? []
		if (succs.length === 0) break

		if (succs.length === 1) {
			currentId = succs[0]
		} else {
			const currentNode = nodeMap.get(currentId)
			if (currentNode && GATEWAY_TYPE_SET.has(currentNode.type)) {
				// Check true successors (excluding reversed back-edge stubs)
				const trueSuccs = getTrueSuccessors(currentId, dag, backEdgeOriginals)
				if (trueSuccs.length === 1) {
					// Join gateway (e.g. loop merge): only 1 real forward successor → treat as passthrough
					currentId = trueSuccs[0]
				} else if (trueSuccs.length >= 2) {
					// True split gateway: find join and jump to it
					const joinId = findJoinGateway(currentId, dag, nodeMap)
					if (joinId) {
						// Always jump directly to the join gateway. Task-bearing branches are
						// off-baseline and distributed by distributeSplitBranches, so the direct
						// bypass edge never routes through task nodes.
						currentId = joinId
					} else {
						currentId = findContinuationSuccessor(trueSuccs, dag, nodeMap, visited)
					}
				} else {
					break
				}
			} else {
				// Non-gateway with multiple successors (back-edge reversal artifact).
				// Follow the unique-predecessor successor — the main flow continuation.
				currentId =
					succs.find((s) => !visited.has(s) && (dag.predecessors.get(s) ?? []).length === 1) ??
					succs.find((s) => !visited.has(s))
			}
		}
	}

	return path
}

/**
 * Among split-gateway successors, find the one that continues the main flow.
 * Prefers gateway-type successors (merge points), then falls back to the
 * successor with the most forward-reachable nodes (deepest path).
 * Loop-back stubs are dead-ends in the DAG and will have fewest reachable nodes.
 */
function findContinuationSuccessor(
	succs: string[],
	dag: DirectedGraph,
	nodeMap: Map<string, LayoutNode>,
	visited: ReadonlySet<string>,
): string | undefined {
	// Prefer gateway-type successors (likely the merge/join point)
	for (const s of succs) {
		const node = nodeMap.get(s)
		if (node && GATEWAY_TYPE_SET.has(node.type)) {
			return s
		}
	}
	// Fall back: pick the successor with the most forward-reachable nodes.
	// Loop-back stubs (reversed back edges) are DAG dead-ends with 0–1 reachable nodes.
	let bestId: string | undefined
	let bestDepth = -1
	for (const s of succs) {
		if (visited.has(s)) continue
		const depth = countForwardReachable(s, dag)
		if (depth > bestDepth) {
			bestDepth = depth
			bestId = s
		}
	}
	return bestId
}

/**
 * Align all nodes on the baseline path to the same center-Y.
 * Uses the first node's (start event) center-Y as the baseline.
 */
export function alignBaselinePath(
	layoutNodes: LayoutNode[],
	dag: DirectedGraph,
	backEdges: BackEdge[] = [],
): void {
	const baselinePath = findBaselinePath(layoutNodes, dag, backEdges)
	if (baselinePath.length === 0) return

	const nodeMap = new Map<string, LayoutNode>()
	for (const n of layoutNodes) {
		nodeMap.set(n.id, n)
	}

	// Use the start event's center-Y as the baseline
	const firstId = baselinePath[0]
	if (!firstId) return
	const firstNode = nodeMap.get(firstId)
	if (!firstNode) return
	const baselineY = firstNode.bounds.y + firstNode.bounds.height / 2

	for (const id of baselinePath) {
		const node = nodeMap.get(id)
		if (!node) continue
		const currentCenterY = node.bounds.y + node.bounds.height / 2
		const dy = baselineY - currentCenterY
		if (Math.abs(dy) > 0.5) {
			node.bounds.y += dy
			if (node.labelBounds) node.labelBounds.y += dy
		}
	}
}

/**
 * Distribute branches of split gateways symmetrically around the gateway center Y.
 * Pass 1: multi-branch gateways (2+) — symmetric distribution.
 * Pass 2: single-branch gateways — placed one full grid row away, with peer-aware gap enforcement.
 */
export function distributeSplitBranches(
	layoutNodes: LayoutNode[],
	dag: DirectedGraph,
	backEdges: BackEdge[] = [],
): void {
	const backEdgeOriginals = buildBackEdgeOriginals(backEdges)
	const nodeMap = new Map<string, LayoutNode>()
	for (const n of layoutNodes) {
		nodeMap.set(n.id, n)
	}

	const baselinePath = findBaselinePath(layoutNodes, dag, backEdges)
	const baselineSet = new Set(baselinePath)

	// Collect true split gateways with their non-baseline branch info
	const splitGateways: {
		node: LayoutNode
		succs: string[]
		branchStarts: string[]
		joinId: string | undefined
	}[] = []

	for (const n of layoutNodes) {
		if (!GATEWAY_TYPE_SET.has(n.type)) continue
		// Only process true split gateways (not join gateways with reversed back edges)
		const trueSuccs = getTrueSuccessors(n.id, dag, backEdgeOriginals)
		if (trueSuccs.length < 2) continue

		const joinId = findJoinGateway(n.id, dag, nodeMap)
		const branchStarts: string[] = []
		for (const s of trueSuccs) {
			if (!baselineSet.has(s)) branchStarts.push(s)
		}
		if (branchStarts.length === 0) continue
		splitGateways.push({ node: n, succs: trueSuccs, branchStarts, joinId })
	}

	// Sort deepest-first so child gateway branches are distributed before
	// parent gateways compute branch heights (avoids underestimating sub-branch area).
	splitGateways.sort((a, b) => b.node.layer - a.node.layer)

	// Process all gateways deepest-first (single loop, handles both multi- and single-branch)
	for (const { node: n, succs, branchStarts, joinId } of splitGateways) {
		const gatewayCY = n.bounds.y + n.bounds.height / 2

		// Collect baseline obstacles (actual element bboxes) for 2D collision detection.
		// Unlike the old corridor approach, this only pushes branches past elements
		// that actually overlap in both X and Y — not past the entire baseline extent.
		const branchSet = new Set(branchStarts)
		const baselineSucc = succs.find((s) => !branchSet.has(s))
		const baselineObstacles: Array<{
			x: number
			y: number
			right: number
			bottom: number
		}> = []
		if (baselineSucc) {
			for (const bid of collectBranchChain(baselineSucc, dag, joinId)) {
				const bnode = nodeMap.get(bid)
				if (!bnode) continue
				const bottom = bnode.labelBounds
					? Math.max(
							bnode.bounds.y + bnode.bounds.height,
							bnode.labelBounds.y + bnode.labelBounds.height,
						)
					: bnode.bounds.y + bnode.bounds.height
				baselineObstacles.push({
					x: bnode.bounds.x,
					y: bnode.bounds.y,
					right: bnode.bounds.x + bnode.bounds.width,
					bottom,
				})
			}
		}

		const yMargin = GRID_CELL_HEIGHT / 2
		const xMargin = GRID_CELL_WIDTH / 2

		if (branchStarts.length >= 2) {
			// Multi-branch: distribute symmetrically, heaviest branch at center
			const sorted = [...branchStarts].sort(
				(a, b) =>
					collectBranchChain(b, dag, joinId).length - collectBranchChain(a, dag, joinId).length,
			)

			const count = sorted.length
			const positioned = new Array<string>(count)
			const m = Math.floor((count - 1) / 2)
			// biome-ignore lint/style/noNonNullAssertion: sorted is non-empty (count >= 2)
			positioned[m] = sorted[0]!
			let above = m - 1
			let below = m + 1
			for (let si = 1; si < count; ) {
				// biome-ignore lint/style/noNonNullAssertion: si < count ensures element exists
				if (below < count && si < count) positioned[below++] = sorted[si++]!
				// biome-ignore lint/style/noNonNullAssertion: si < count ensures element exists
				if (above >= 0 && si < count) positioned[above--] = sorted[si++]!
			}

			// Compute anchor-relative extents and X range per branch
			// Uses backbone extent for stacking height (initial placement),
			// and full subtree extent for collision detection (safety validation).
			const branchInfo: Array<{
				chain: string[]
				extAbove: number
				extBelow: number
				backboneHeight: number
				height: number
				minX: number
				maxX: number
			} | null> = []
			for (let i = 0; i < count; i++) {
				const branchId = positioned[i]
				if (!branchId) {
					branchInfo.push(null)
					continue
				}
				const chain = collectBranchChain(branchId, dag, joinId)
				const startNode = nodeMap.get(branchId)
				if (!startNode) {
					branchInfo.push(null)
					continue
				}
				const startCY = startNode.bounds.y + startNode.bounds.height / 2
				let minY = Number.POSITIVE_INFINITY
				let maxY = Number.NEGATIVE_INFINITY
				let minX = Number.POSITIVE_INFINITY
				let maxX = Number.NEGATIVE_INFINITY
				for (const bid of chain) {
					if (baselineSet.has(bid)) continue
					const bnode = nodeMap.get(bid)
					if (!bnode) continue
					minY = Math.min(minY, bnode.bounds.y)
					maxY = Math.max(maxY, bnode.bounds.y + bnode.bounds.height)
					if (bnode.labelBounds)
						maxY = Math.max(maxY, bnode.labelBounds.y + bnode.labelBounds.height)
					minX = Math.min(minX, bnode.bounds.x)
					maxX = Math.max(maxX, bnode.bounds.x + bnode.bounds.width)
				}
				const height = minY < maxY ? Math.max(maxY - minY, GRID_CELL_HEIGHT) : GRID_CELL_HEIGHT

				// Backbone extent for stacking
				const backbone = collectBranchBackbone(branchId, dag, joinId, nodeMap)
				let bbMinY = Number.POSITIVE_INFINITY
				let bbMaxY = Number.NEGATIVE_INFINITY
				for (const bid of backbone) {
					if (baselineSet.has(bid)) continue
					const bnode = nodeMap.get(bid)
					if (!bnode) continue
					bbMinY = Math.min(bbMinY, bnode.bounds.y)
					bbMaxY = Math.max(bbMaxY, bnode.bounds.y + bnode.bounds.height)
					if (bnode.labelBounds)
						bbMaxY = Math.max(bbMaxY, bnode.labelBounds.y + bnode.labelBounds.height)
				}
				const backboneHeight =
					bbMinY < bbMaxY ? Math.max(bbMaxY - bbMinY, GRID_CELL_HEIGHT) : height

				branchInfo.push({
					chain,
					extAbove: minY < Number.POSITIVE_INFINITY ? startCY - minY : height / 2,
					extBelow: maxY > Number.NEGATIVE_INFINITY ? maxY - startCY : height / 2,
					backboneHeight,
					height,
					minX: minX < Number.POSITIVE_INFINITY ? minX : startNode.bounds.x,
					maxX:
						maxX > Number.NEGATIVE_INFINITY ? maxX : startNode.bounds.x + startNode.bounds.width,
				})
			}

			const minSpacing = GRID_CELL_HEIGHT / 2
			// Use backbone height for initial stacking (tighter spacing)
			let totalH = 0
			for (let i = 0; i < count; i++) {
				totalH += branchInfo[i]?.backboneHeight ?? GRID_CELL_HEIGHT
				if (i < count - 1) totalH += minSpacing
			}
			let currentTop = gatewayCY - totalH / 2

			// Frontier tracking: placed branch extents for branch-to-branch spacing
			let aboveFrontierY = gatewayCY
			let belowFrontierY = gatewayCY

			for (let i = 0; i < count; i++) {
				const info = branchInfo[i]
				if (!info) {
					currentTop += GRID_CELL_HEIGHT + minSpacing
					continue
				}
				const branchId = positioned[i]
				if (!branchId) continue
				const branchNode = nodeMap.get(branchId)
				if (!branchNode) continue

				// Use backbone height for initial placement, full extent for collision
				const bh = info.backboneHeight
				let targetCY = currentTop + bh / 2

				// Resolve 2D collisions with baseline obstacles (full extent)
				targetCY = resolveBranchObstacles(
					targetCY,
					info.extAbove,
					info.extBelow,
					info.minX,
					info.maxX,
					gatewayCY,
					baselineObstacles,
					yMargin,
					xMargin,
				)

				// Enforce frontier: prevent branch-to-branch overlap (full extent)
				if (targetCY >= gatewayCY) {
					const newTop = targetCY - info.extAbove
					if (newTop < belowFrontierY + minSpacing) {
						targetCY = belowFrontierY + minSpacing + info.extAbove
					}
					belowFrontierY = targetCY + info.extBelow
				} else {
					const newBottom = targetCY + info.extBelow
					if (newBottom > aboveFrontierY - minSpacing) {
						targetCY = aboveFrontierY - minSpacing - info.extBelow
					}
					aboveFrontierY = targetCY - info.extAbove
				}

				const currentCY = branchNode.bounds.y + branchNode.bounds.height / 2
				const dy = targetCY - currentCY

				if (Math.abs(dy) > 0.5) {
					for (const bid of info.chain) {
						if (baselineSet.has(bid)) continue
						const bnode = nodeMap.get(bid)
						if (!bnode) continue
						bnode.bounds.y += dy
						if (bnode.labelBounds) bnode.labelBounds.y += dy
					}
				}
				currentTop += bh + minSpacing
			}
		} else {
			// Single-branch: collision-based offset with peer-aware gap enforcement
			const branchId = branchStarts[0]
			if (!branchId) continue
			const branchNode = nodeMap.get(branchId)
			if (!branchNode) continue

			const chain = collectBranchChain(branchId, dag, joinId)

			// Compute full subtree extents (for collision validation)
			let branchMinY = Number.POSITIVE_INFINITY
			let branchMaxY = Number.NEGATIVE_INFINITY
			let branchMinX = Number.POSITIVE_INFINITY
			let branchMaxX = Number.NEGATIVE_INFINITY
			for (const bid of chain) {
				if (baselineSet.has(bid)) continue
				const bnode = nodeMap.get(bid)
				if (!bnode) continue
				branchMinY = Math.min(branchMinY, bnode.bounds.y)
				branchMaxY = Math.max(branchMaxY, bnode.bounds.y + bnode.bounds.height)
				if (bnode.labelBounds) {
					branchMaxY = Math.max(branchMaxY, bnode.labelBounds.y + bnode.labelBounds.height)
				}
				branchMinX = Math.min(branchMinX, bnode.bounds.x)
				branchMaxX = Math.max(branchMaxX, bnode.bounds.x + bnode.bounds.width)
			}

			const currentCY = branchNode.bounds.y + branchNode.bounds.height / 2
			const extAbove =
				branchMinY < Number.POSITIVE_INFINITY ? currentCY - branchMinY : GRID_CELL_HEIGHT / 2
			const extBelow =
				branchMaxY > Number.NEGATIVE_INFINITY ? branchMaxY - currentCY : GRID_CELL_HEIGHT / 2
			if (branchMinX === Number.POSITIVE_INFINITY) branchMinX = branchNode.bounds.x
			if (branchMaxX === Number.NEGATIVE_INFINITY)
				branchMaxX = branchNode.bounds.x + branchNode.bounds.width

			// Compute backbone extent (spine only, skipping sub-gateway branches)
			// for a tighter initial offset that places the branch closer to baseline.
			const backbone = collectBranchBackbone(branchId, dag, joinId, nodeMap)
			let bbMinY = Number.POSITIVE_INFINITY
			let bbMaxY = Number.NEGATIVE_INFINITY
			for (const bid of backbone) {
				if (baselineSet.has(bid)) continue
				const bnode = nodeMap.get(bid)
				if (!bnode) continue
				bbMinY = Math.min(bbMinY, bnode.bounds.y)
				bbMaxY = Math.max(bbMaxY, bnode.bounds.y + bnode.bounds.height)
				if (bnode.labelBounds) {
					bbMaxY = Math.max(bbMaxY, bnode.labelBounds.y + bnode.labelBounds.height)
				}
			}
			const bbExtAbove = bbMinY < Number.POSITIVE_INFINITY ? currentCY - bbMinY : extAbove
			const bbExtBelow = bbMaxY > Number.NEGATIVE_INFINITY ? bbMaxY - currentCY : extBelow

			// Use backbone extent for initial offset (closer to baseline)
			const basicMinOffset = Math.max(
				GRID_CELL_HEIGHT,
				bbExtAbove + bbExtBelow + n.bounds.height / 2 + 20,
			)

			const direction = currentCY < gatewayCY ? -1 : 1
			let targetCY = gatewayCY + direction * basicMinOffset

			// Validate using per-element collision against baseline obstacles.
			// Only backbone elements checked — sub-branches at different X
			// positions don't constrain placement.
			for (const obs of baselineObstacles) {
				for (const bid of backbone) {
					if (baselineSet.has(bid)) continue
					const bnode = nodeMap.get(bid)
					if (!bnode) continue
					const elemRight = bnode.bounds.x + bnode.bounds.width
					if (elemRight + xMargin < obs.x || bnode.bounds.x - xMargin > obs.right) continue
					if (direction === 1) {
						const elemNewY = bnode.bounds.y + (targetCY - currentCY)
						if (elemNewY < obs.bottom + yMargin) {
							const needed = currentCY + obs.bottom + yMargin - bnode.bounds.y
							if (needed > targetCY) targetCY = needed
						}
					} else {
						const elemNewBottom = bnode.bounds.y + bnode.bounds.height + (targetCY - currentCY)
						if (elemNewBottom > obs.y - yMargin) {
							const needed = currentCY + obs.y - yMargin - bnode.bounds.y - bnode.bounds.height
							if (needed < targetCY) targetCY = needed
						}
					}
				}
			}

			// Peer-aware gap enforcement — only backbone elements checked against
			// same-layer peers. Sub-branch elements from nested gateways are
			// handled by the nested gateway's own distribution step.
			const chainSet = new Set(chain)
			const backboneSet = new Set(backbone)
			const minGap = GRID_CELL_HEIGHT / 2
			const initialDy = targetCY - currentCY
			let extraDy = 0

			for (const chainNodeId of backbone) {
				if (baselineSet.has(chainNodeId)) continue
				const chainNode = nodeMap.get(chainNodeId)
				if (!chainNode) continue
				const chainNodeCY = chainNode.bounds.y + chainNode.bounds.height / 2
				const chainNodeNewCY = chainNodeCY + initialDy

				for (const peer of layoutNodes) {
					if (peer.layer !== chainNode.layer || chainSet.has(peer.id)) continue
					const peerCY = peer.bounds.y + peer.bounds.height / 2
					const minDist = (chainNode.bounds.height + peer.bounds.height) / 2 + minGap

					if (Math.abs(chainNodeNewCY + extraDy - peerCY) < minDist) {
						if (direction === -1) {
							const needed = peerCY - minDist - chainNodeNewCY
							if (needed < extraDy) extraDy = needed
						} else {
							const needed = peerCY + minDist - chainNodeNewCY
							if (needed > extraDy) extraDy = needed
						}
					}
				}
			}

			targetCY += extraDy
			const dy = targetCY - currentCY

			if (Math.abs(dy) > 0.5) {
				for (const bid of chain) {
					if (baselineSet.has(bid)) continue
					const bnode = nodeMap.get(bid)
					if (!bnode) continue
					bnode.bounds.y += dy
					if (bnode.labelBounds) bnode.labelBounds.y += dy
				}
			}
		}
	}
}

/**
 * Push targetCY away from gatewayCY until it no longer overlaps any obstacle in both X and Y.
 * Only elements that overlap the branch's X range (with margin) trigger a push.
 */
function resolveBranchObstacles(
	initialCY: number,
	extAbove: number,
	extBelow: number,
	branchMinX: number,
	branchMaxX: number,
	gatewayCY: number,
	obstacles: ReadonlyArray<{ x: number; y: number; right: number; bottom: number }>,
	yMargin: number,
	xMargin: number,
): number {
	let targetCY = initialCY
	const direction = targetCY >= gatewayCY ? 1 : -1
	const sorted =
		direction > 0
			? [...obstacles].sort((a, b) => a.bottom - b.bottom)
			: [...obstacles].sort((a, b) => b.y - a.y)

	for (const obs of sorted) {
		if (branchMaxX + xMargin < obs.x || branchMinX - xMargin > obs.right) continue
		const newTop = targetCY - extAbove
		const newBottom = targetCY + extBelow
		if (newBottom + yMargin <= obs.y || newTop - yMargin >= obs.bottom) continue
		if (direction > 0) {
			targetCY = obs.bottom + yMargin + extAbove
		} else {
			targetCY = obs.y - yMargin - extBelow
		}
	}
	return targetCY
}

/** Centre-Y of a layout node. */
function getCY(node: LayoutNode): number {
	return node.bounds.y + node.bounds.height / 2
}

/**
 * Assign integer grid-row indices to all nodes based on their final center-Y positions.
 * Nodes whose center-Y values are within EPSILON pixels are placed in the same row.
 * This eliminates pixel-tolerance guessing in port-side decisions: two nodes with the
 * same gridRow are on the same horizontal row and should connect left-to-right.
 *
 * Called once, after ALL coordinate adjustments, just before edge routing.
 */
export function assignGridRows(layoutNodes: LayoutNode[]): void {
	if (layoutNodes.length === 0) return
	const EPSILON = 5 // nodes within 5px center-Y share a row

	const sorted = [...layoutNodes].sort((a, b) => getCY(a) - getCY(b))
	const first = sorted[0]
	if (!first) return

	let rowIdx = 0
	let rowCY = getCY(first)

	for (const node of sorted) {
		const cy = getCY(node)
		if (cy - rowCY > EPSILON) {
			rowIdx++
			rowCY = cy
		}
		node.gridRow = rowIdx
	}
}

/**
 * Snap nodes to common Y rows for matrix-like alignment.
 * Groups nodes that share a CY (from alignment passes), then merges
 * close groups into a single row — moving entire groups as units.
 * Boundary events are excluded (they are repositioned later).
 */
export function snapToYRows(layoutNodes: LayoutNode[]): void {
	if (layoutNodes.length < 2) return

	const MERGE_THRESHOLD = 35
	const GROUP_EPSILON = 3

	// Exclude boundary events (repositioned later in auto-layout.ts)
	const candidates = layoutNodes.filter((n) => n.type !== "boundaryEvent")
	if (candidates.length < 2) return

	// Step 1: Group by current CY (nodes aligned by earlier passes share exact CY)
	const sorted = [...candidates].sort((a, b) => getCY(a) - getCY(b))
	const first = sorted[0]
	if (!first) return

	type Row = { nodes: LayoutNode[]; cy: number }
	const rows: Row[] = []
	let currentGroup: LayoutNode[] = [first]
	let groupCY = getCY(first)

	for (let i = 1; i < sorted.length; i++) {
		const node = sorted[i]
		if (!node) continue
		const cy = getCY(node)
		if (cy - groupCY <= GROUP_EPSILON) {
			currentGroup.push(node)
		} else {
			rows.push({ nodes: currentGroup, cy: groupCY })
			currentGroup = [node]
			groupCY = cy
		}
	}
	rows.push({ nodes: currentGroup, cy: groupCY })

	// Step 2: Merge close consecutive rows (move smaller row to larger row's CY)
	let changed = true
	while (changed) {
		changed = false
		for (let i = 0; i < rows.length - 1; i++) {
			const a = rows[i]
			const b = rows[i + 1]
			if (!a || !b) continue
			if (b.cy - a.cy > MERGE_THRESHOLD) continue

			// Skip if merge would create same-layer overlap
			const aLayers = new Set(a.nodes.map((n) => n.layer))
			if (b.nodes.some((n) => aLayers.has(n.layer))) continue

			// Move smaller group to larger group's CY
			const [target, source] = a.nodes.length >= b.nodes.length ? [a, b] : [b, a]
			for (const node of source.nodes) {
				const dy = target.cy - getCY(node)
				if (Math.abs(dy) > 0.5) {
					node.bounds.y += dy
					if (node.labelBounds) node.labelBounds.y += dy
				}
			}

			rows[i] = { nodes: [...a.nodes, ...b.nodes], cy: target.cy }
			rows.splice(i + 1, 1)
			changed = true
			break
		}
	}
}

/**
 * Pull each branch subtree toward the baseline, closing unnecessary vertical gaps.
 * Uses per-element 2D collision detection — only actual element-to-element overlaps
 * constrain the movement, not the branch's full bounding box.
 */
export function compactBranches(
	layoutNodes: LayoutNode[],
	dag: DirectedGraph,
	backEdges: BackEdge[] = [],
): void {
	const backEdgeOriginals = buildBackEdgeOriginals(backEdges)
	const nodeMap = new Map<string, LayoutNode>()
	for (const n of layoutNodes) nodeMap.set(n.id, n)

	const baselinePath = findBaselinePath(layoutNodes, dag, backEdges)
	const baselineSet = new Set(baselinePath)

	// Collect split gateways and their branches
	const splitGateways: {
		node: LayoutNode
		branchStarts: string[]
		joinId: string | undefined
	}[] = []

	for (const n of layoutNodes) {
		if (!GATEWAY_TYPE_SET.has(n.type)) continue
		const trueSuccs = getTrueSuccessors(n.id, dag, backEdgeOriginals)
		if (trueSuccs.length < 2) continue
		const joinId = findJoinGateway(n.id, dag, nodeMap)
		const branchStarts = trueSuccs.filter((s) => !baselineSet.has(s))
		if (branchStarts.length === 0) continue
		splitGateways.push({ node: n, branchStarts, joinId })
	}

	// Process outermost gateways first (shallowest-first)
	splitGateways.sort((a, b) => a.node.layer - b.node.layer)

	const margin = GRID_CELL_HEIGHT / 2
	const movedElements = new Set<string>()

	for (const { node: gw, branchStarts, joinId } of splitGateways) {
		// Skip open-ended branches (joinId=undefined) — unbounded chains
		if (!joinId) continue
		const gatewayCY = getCY(gw)

		for (const branchId of branchStarts) {
			const chain = collectBranchChain(branchId, dag, joinId)
			if (chain.some((id) => movedElements.has(id))) continue

			// Get non-baseline elements in the chain
			const chainElements: LayoutNode[] = []
			for (const bid of chain) {
				if (baselineSet.has(bid)) continue
				const bnode = nodeMap.get(bid)
				if (bnode) chainElements.push(bnode)
			}
			if (chainElements.length === 0) continue
			const chainSet = new Set(chain)

			const startNode = nodeMap.get(branchId)
			if (!startNode) continue
			const currentCY = getCY(startNode)
			const direction = currentCY > gatewayCY ? 1 : -1

			// Compute minimum offset from gateway (backbone + half gateway)
			const backbone = collectBranchBackbone(branchId, dag, joinId, nodeMap)
			let bbMinY = Number.POSITIVE_INFINITY
			let bbMaxY = Number.NEGATIVE_INFINITY
			for (const bid of backbone) {
				if (baselineSet.has(bid)) continue
				const bnode = nodeMap.get(bid)
				if (!bnode) continue
				bbMinY = Math.min(bbMinY, bnode.bounds.y)
				bbMaxY = Math.max(bbMaxY, bnode.bounds.y + bnode.bounds.height)
			}
			const bbExtAbove =
				bbMinY < Number.POSITIVE_INFINITY ? currentCY - bbMinY : GRID_CELL_HEIGHT / 2
			const bbExtBelow =
				bbMaxY > Number.NEGATIVE_INFINITY ? bbMaxY - currentCY : GRID_CELL_HEIGHT / 2

			const closestCY =
				direction > 0 ? gatewayCY + bbExtAbove + margin : gatewayCY - bbExtBelow - margin

			if (direction > 0 ? closestCY >= currentCY : closestCY <= currentCY) continue

			// Per-element collision detection: for each obstacle, check every element
			// in the chain. Only actual X+Y overlaps constrain movement.
			let bestCY = closestCY
			for (const obs of layoutNodes) {
				if (chainSet.has(obs.id)) continue
				const obsLeft = obs.bounds.x
				const obsRight = obs.bounds.x + obs.bounds.width
				const obsTop = obs.labelBounds ? Math.min(obs.bounds.y, obs.labelBounds.y) : obs.bounds.y
				const obsBottom = obs.labelBounds
					? Math.max(obs.bounds.y + obs.bounds.height, obs.labelBounds.y + obs.labelBounds.height)
					: obs.bounds.y + obs.bounds.height

				for (const elem of chainElements) {
					const elemRight = elem.bounds.x + elem.bounds.width
					// X overlap check
					if (elemRight < obsLeft - margin || elem.bounds.x > obsRight + margin) continue

					if (direction > 0) {
						// Element top (after moving) must be below obstacle bottom
						// elem.bounds.y + dy ≥ obsBottom + margin
						// bestCY ≥ currentCY + obsBottom + margin - elem.bounds.y
						const needed = currentCY + obsBottom + margin - elem.bounds.y
						if (needed > bestCY) bestCY = needed
					} else {
						// Element bottom (after moving) must be above obstacle top
						const elemBottom = elem.bounds.y + elem.bounds.height
						const needed = currentCY + obsTop - margin - elemBottom
						if (needed < bestCY) bestCY = needed
					}
				}
			}

			// Only move if we're actually pulling closer
			if (direction > 0 ? bestCY >= currentCY : bestCY <= currentCY) continue

			const dy = bestCY - currentCY
			for (const bid of chain) {
				if (baselineSet.has(bid)) continue
				const bnode = nodeMap.get(bid)
				if (!bnode) continue
				bnode.bounds.y += dy
				if (bnode.labelBounds) bnode.labelBounds.y += dy
				movedElements.add(bid)
			}
		}
	}
}

/** Collect all nodes in a branch subtree, stopping at the join gateway. */
function collectBranchChain(
	startId: string,
	dag: DirectedGraph,
	joinId: string | undefined,
): string[] {
	const ids: string[] = []
	const queue = [startId]
	const seen = new Set<string>()
	while (queue.length > 0) {
		const id = queue.shift()
		if (!id || seen.has(id)) continue
		if (joinId && id === joinId) continue
		seen.add(id)
		ids.push(id)
		for (const s of dag.successors.get(id) ?? []) {
			if (!seen.has(s)) queue.push(s)
		}
	}
	return ids
}

/**
 * Collect only the backbone (spine) of a branch — following the linear path
 * and jumping over nested sub-gateways via their join.
 * Used to compute a tighter extent estimate for distribution placement.
 */
function collectBranchBackbone(
	startId: string,
	dag: DirectedGraph,
	joinId: string | undefined,
	nodeMap: Map<string, LayoutNode>,
): string[] {
	const ids: string[] = []
	let currentId: string | undefined = startId
	const seen = new Set<string>()

	while (currentId && !seen.has(currentId)) {
		if (joinId && currentId === joinId) break
		seen.add(currentId)
		ids.push(currentId)

		const succs: string[] = dag.successors.get(currentId) ?? []
		if (succs.length === 0) break
		if (succs.length === 1) {
			currentId = succs[0]
		} else {
			// At a sub-split gateway: jump to its join
			const node = nodeMap.get(currentId)
			if (node && GATEWAY_TYPE_SET.has(node.type)) {
				const subJoinId = findJoinGateway(currentId, dag, nodeMap)
				if (subJoinId) {
					currentId = subJoinId
				} else {
					// No join found — stop backbone here, fall back to full extent
					break
				}
			} else {
				currentId = succs[0]
			}
		}
	}
	return ids
}

/**
 * Resolve overlaps within each layer by pushing nodes apart.
 * Sorts nodes by Y within each layer and ensures minimum gap.
 * Also normalizes coordinates so no node has negative Y.
 */
export function resolveLayerOverlaps(layoutNodes: LayoutNode[]): void {
	const byLayer = new Map<number, LayoutNode[]>()
	for (const n of layoutNodes) {
		const arr = byLayer.get(n.layer) ?? []
		arr.push(n)
		byLayer.set(n.layer, arr)
	}

	for (const [, nodes] of byLayer) {
		if (nodes.length < 2) continue
		nodes.sort((a, b) => a.bounds.y - b.bounds.y)

		for (let i = 1; i < nodes.length; i++) {
			const prev = nodes[i - 1]
			const curr = nodes[i]
			if (!prev || !curr) continue
			// Account for the previous element's below-element label (e.g. gateway labels)
			// so that labels don't overlap the next element in the same layer.
			const prevLabelBottom =
				prev.labelBounds && prev.labelBounds.y > prev.bounds.y
					? prev.labelBounds.y + prev.labelBounds.height
					: 0
			const prevBottom = Math.max(prev.bounds.y + prev.bounds.height, prevLabelBottom)
			if (curr.bounds.y < prevBottom + 1) {
				const shift = prevBottom + 1 - curr.bounds.y
				curr.bounds.y += shift
				if (curr.labelBounds) curr.labelBounds.y += shift
			}
		}
	}

	// Normalize: ensure no node has negative y
	let minY = 0
	for (const n of layoutNodes) {
		const y = n.labelBounds ? Math.min(n.bounds.y, n.labelBounds.y) : n.bounds.y
		if (y < minY) minY = y
	}
	if (minY < 0) {
		const shift = -minY
		for (const n of layoutNodes) {
			n.bounds.y += shift
			if (n.labelBounds) n.labelBounds.y += shift
		}
	}
}

/** Swap the y-positions of all nodes along two branches. */
function swapBranchPositions(
	branchA: string,
	branchB: string,
	dag: DirectedGraph,
	nodeMap: Map<string, LayoutNode>,
	joinId: string | undefined,
): void {
	const collectBranch = (startId: string): string[] => {
		const ids: string[] = []
		let currentId: string | undefined = startId
		const seen = new Set<string>()
		while (currentId && !seen.has(currentId)) {
			if (currentId === joinId) break
			seen.add(currentId)
			ids.push(currentId)
			const succs: string[] = dag.successors.get(currentId) ?? []
			currentId = succs.length === 1 ? succs[0] : undefined
		}
		return ids
	}

	const nodesA = collectBranch(branchA)
	const nodesB = collectBranch(branchB)

	// Swap center-Y pairwise (not raw Y) so elements of different heights stay aligned
	const swapCount = Math.min(nodesA.length, nodesB.length)
	for (let i = 0; i < swapCount; i++) {
		const idA = nodesA[i]
		const idB = nodesB[i]
		if (!idA || !idB) continue
		const a = nodeMap.get(idA)
		const b = nodeMap.get(idB)
		if (!a || !b) continue

		const aCY = a.bounds.y + a.bounds.height / 2
		const bCY = b.bounds.y + b.bounds.height / 2
		const aNewY = bCY - a.bounds.height / 2
		const bNewY = aCY - b.bounds.height / 2

		if (a.labelBounds) {
			a.labelBounds.y += aNewY - a.bounds.y
		}
		if (b.labelBounds) {
			b.labelBounds.y += bNewY - b.bounds.y
		}
		a.bounds.y = aNewY
		b.bounds.y = bNewY
	}
}
