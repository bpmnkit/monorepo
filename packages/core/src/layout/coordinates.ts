import type { BpmnElementType, BpmnFlowElement } from "../bpmn/bpmn-model.js";
import type { DirectedGraph } from "./graph.js";
import type { Bounds, LayoutNode } from "./types.js";
import { ELEMENT_SIZES, GRID_CELL_HEIGHT, GRID_CELL_WIDTH } from "./types.js";

/** Get the fixed size for a BPMN element type. */
export function getElementSize(type: BpmnElementType): { width: number; height: number } {
	return ELEMENT_SIZES[type] ?? { width: 100, height: 80 };
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
	const layoutNodes: LayoutNode[] = [];

	// Determine how many grid columns each layer needs (for oversized elements)
	const layerGridCols: number[] = [];
	for (const layer of orderedLayers) {
		let maxCols = 1;
		for (const nodeId of layer) {
			const node = nodeIndex.get(nodeId);
			if (node) {
				const size = getElementSize(node.type);
				const cols = Math.ceil(size.width / GRID_CELL_WIDTH);
				if (cols > maxCols) maxCols = cols;
			}
		}
		layerGridCols.push(maxCols);
	}

	// Calculate x offset for each layer based on grid columns
	const layerXOffsets: number[] = [];
	let gridCol = 0;
	for (let layerIdx = 0; layerIdx < orderedLayers.length; layerIdx++) {
		layerXOffsets.push(gridCol * GRID_CELL_WIDTH);
		gridCol += layerGridCols[layerIdx] ?? 1;
	}

	// Determine how many grid rows each position needs within each layer
	for (let layerIdx = 0; layerIdx < orderedLayers.length; layerIdx++) {
		const layer = orderedLayers[layerIdx];
		if (!layer) continue;
		const layerX = layerXOffsets[layerIdx];
		if (layerX === undefined) continue;
		const cellSpanW = (layerGridCols[layerIdx] ?? 1) * GRID_CELL_WIDTH;

		let gridRow = 0;
		for (let posIdx = 0; posIdx < layer.length; posIdx++) {
			const nodeId = layer[posIdx];
			if (!nodeId) continue;
			const node = nodeIndex.get(nodeId);
			if (!node) continue;

			const size = getElementSize(node.type);
			const rowsNeeded = Math.ceil(size.height / GRID_CELL_HEIGHT);
			const cellSpanH = rowsNeeded * GRID_CELL_HEIGHT;

			// Center element within its grid cell(s)
			const cellX = layerX;
			const cellY = gridRow * GRID_CELL_HEIGHT;
			const xOffset = (cellSpanW - size.width) / 2;
			const yOffset = (cellSpanH - size.height) / 2;

			const bounds: Bounds = {
				x: cellX + xOffset,
				y: cellY + yOffset,
				width: size.width,
				height: size.height,
			};

			const labelBounds = computeLabelBounds(node, bounds);

			layoutNodes.push({
				id: nodeId,
				type: node.type,
				bounds,
				layer: layerIdx,
				position: posIdx,
				label: node.name,
				labelBounds,
			});

			gridRow += rowsNeeded;
		}
	}

	// Center the layout vertically so all layers are balanced
	centerLayersVertically(layoutNodes, orderedLayers);

	return layoutNodes;
}

/**
 * Center each layer vertically around the midpoint of the tallest layer.
 */
function centerLayersVertically(nodes: LayoutNode[], orderedLayers: string[][]): void {
	// Find the total height of each layer
	const layerHeights: number[] = [];
	for (const layer of orderedLayers) {
		const layerNodes = nodes.filter((n) => layer.includes(n.id));
		if (layerNodes.length === 0) {
			layerHeights.push(0);
			continue;
		}
		const minY = Math.min(...layerNodes.map((n) => n.bounds.y));
		const maxY = Math.max(...layerNodes.map((n) => n.bounds.y + n.bounds.height));
		layerHeights.push(maxY - minY);
	}

	const maxHeight = Math.max(...layerHeights, 0);

	// Shift each layer so it's centered relative to the tallest layer
	for (let i = 0; i < orderedLayers.length; i++) {
		const layer = orderedLayers[i];
		if (!layer) continue;
		const layerHeight = layerHeights[i];
		if (layerHeight === undefined) continue;
		const yShift = (maxHeight - layerHeight) / 2;

		if (yShift > 0) {
			for (const node of nodes) {
				if (layer.includes(node.id)) {
					node.bounds.y += yShift;
					if (node.labelBounds) {
						node.labelBounds.y += yShift;
					}
				}
			}
		}
	}
}

/** Compute label bounds for a node based on its type. */
function computeLabelBounds(node: BpmnFlowElement, bounds: Bounds): Bounds | undefined {
	if (!node.name) return undefined;

	const labelWidth = Math.max(node.name.length * 7, 40);
	const labelHeight = 14;

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
			};
		case "exclusiveGateway":
		case "parallelGateway":
		case "inclusiveGateway":
		case "eventBasedGateway":
			// Labels at top-right of gateway diamond (avoids interfering with upward paths)
			return {
				x: bounds.x + bounds.width + 4,
				y: bounds.y - labelHeight - 4,
				width: labelWidth,
				height: labelHeight,
			};
		default:
			// Tasks/activities: labels centered inside — no separate label bounds needed
			return undefined;
	}
}

/**
 * Re-assign x-coordinates after sub-process expansion.
 * Walks layers left-to-right, shifting each layer to avoid overlap with the previous one.
 */
export function reassignXCoordinates(layoutNodes: LayoutNode[], orderedLayers: string[][]): void {
	const nodeMap = new Map<string, LayoutNode>();
	for (const n of layoutNodes) {
		nodeMap.set(n.id, n);
	}

	for (let i = 1; i < orderedLayers.length; i++) {
		const prevLayer = orderedLayers[i - 1];
		if (!prevLayer) continue;
		const currLayer = orderedLayers[i];
		if (!currLayer) continue;

		// Find the rightmost edge of the previous layer
		let prevMaxRight = 0;
		for (const id of prevLayer) {
			const n = nodeMap.get(id);
			if (n) {
				const right = n.bounds.x + n.bounds.width;
				if (right > prevMaxRight) prevMaxRight = right;
			}
		}

		// Find the leftmost edge of the current layer
		let currMinLeft = Number.POSITIVE_INFINITY;
		for (const id of currLayer) {
			const n = nodeMap.get(id);
			if (n && n.bounds.x < currMinLeft) currMinLeft = n.bounds.x;
		}

		// Snap to next grid boundary
		const prevCellEnd = Math.ceil(prevMaxRight / GRID_CELL_WIDTH) * GRID_CELL_WIDTH;
		const requiredX = prevCellEnd;
		const shift = requiredX - currMinLeft;
		if (shift > 0) {
			for (let j = i; j < orderedLayers.length; j++) {
				for (const id of orderedLayers[j] ?? []) {
					const n = nodeMap.get(id);
					if (n) {
						n.bounds.x += shift;
						if (n.labelBounds) n.labelBounds.x += shift;
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
]);

/**
 * Align nodes in linear sequences to a common y-baseline.
 * A "linear" node has ≤1 predecessor and ≤1 successor, and is not a gateway.
 * Walks forward from each chain root, setting successors to the same center-y.
 */
export function alignBranchBaselines(layoutNodes: LayoutNode[], dag: DirectedGraph): void {
	const nodeMap = new Map<string, LayoutNode>();
	for (const n of layoutNodes) {
		nodeMap.set(n.id, n);
	}

	const visited = new Set<string>();

	for (const n of layoutNodes) {
		if (visited.has(n.id)) continue;
		if (GATEWAY_TYPE_SET.has(n.type)) continue;

		// Walk backward to find the chain root
		let rootId = n.id;
		for (;;) {
			const preds = dag.predecessors.get(rootId) ?? [];
			if (preds.length !== 1) break;
			const pred = preds[0];
			if (!pred) break;
			const predNode = nodeMap.get(pred);
			if (!predNode || GATEWAY_TYPE_SET.has(predNode.type)) break;
			const predSuccs = dag.successors.get(pred) ?? [];
			if (predSuccs.length !== 1) break;
			rootId = pred;
		}

		// Walk forward from root, aligning to root's center-y
		const rootNode = nodeMap.get(rootId);
		if (!rootNode) continue;
		const baselineCenterY = rootNode.bounds.y + rootNode.bounds.height / 2;

		let currentId: string | undefined = rootId;
		while (currentId) {
			if (visited.has(currentId)) break;
			visited.add(currentId);

			const current = nodeMap.get(currentId);
			if (!current) break;
			if (GATEWAY_TYPE_SET.has(current.type)) break;

			const dy = baselineCenterY - (current.bounds.y + current.bounds.height / 2);
			if (Math.abs(dy) > 0.5) {
				current.bounds.y += dy;
				if (current.labelBounds) current.labelBounds.y += dy;
			}

			const succs: string[] = dag.successors.get(currentId) ?? [];
			if (succs.length !== 1) break;
			const nextId: string | undefined = succs[0];
			if (!nextId) break;
			const nextNode = nodeMap.get(nextId);
			if (!nextNode || GATEWAY_TYPE_SET.has(nextNode.type)) break;
			const nextPreds = dag.predecessors.get(nextId) ?? [];
			if (nextPreds.length !== 1) break;
			currentId = nextId;
		}
	}
}

/**
 * Align split/join gateway pairs to the same y-coordinate.
 * A split gateway fans out to multiple successors; the corresponding join gateway
 * is the nearest downstream gateway where all branches reconverge.
 */
export function alignSplitJoinPairs(layoutNodes: LayoutNode[], dag: DirectedGraph): void {
	const nodeMap = new Map<string, LayoutNode>();
	for (const n of layoutNodes) {
		nodeMap.set(n.id, n);
	}

	for (const n of layoutNodes) {
		if (!GATEWAY_TYPE_SET.has(n.type)) continue;
		const succs = dag.successors.get(n.id) ?? [];
		if (succs.length < 2) continue;

		// This is a split gateway — find its merge partner
		const joinId = findJoinGateway(n.id, dag, nodeMap);
		if (!joinId) continue;

		const joinNode = nodeMap.get(joinId);
		if (!joinNode) continue;

		// Force join gateway to same center-y as split gateway
		const splitCenterY = n.bounds.y + n.bounds.height / 2;
		const joinCenterY = joinNode.bounds.y + joinNode.bounds.height / 2;
		const dy = splitCenterY - joinCenterY;
		if (Math.abs(dy) > 0.5) {
			joinNode.bounds.y += dy;
			if (joinNode.labelBounds) joinNode.labelBounds.y += dy;
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
	const succs = dag.successors.get(splitId) ?? [];
	if (succs.length < 2) return undefined;

	// For each branch, walk forward to find the first downstream gateway
	const branchEndpoints = new Map<string, Set<string>>();

	for (const startId of succs) {
		const reachableGateways = new Set<string>();
		const queue = [startId];
		const seen = new Set<string>();

		while (queue.length > 0) {
			const id = queue.shift();
			if (!id || seen.has(id)) continue;
			seen.add(id);

			const node = nodeMap.get(id);
			if (!node) continue;

			if (GATEWAY_TYPE_SET.has(node.type) && id !== splitId) {
				reachableGateways.add(id);
				continue; // Don't traverse past gateways
			}

			for (const next of dag.successors.get(id) ?? []) {
				if (next !== splitId) queue.push(next);
			}
		}

		branchEndpoints.set(startId, reachableGateways);
	}

	// Find the gateway reachable from ALL branches
	const allBranches = [...branchEndpoints.values()];
	if (allBranches.length === 0) return undefined;

	const firstSet = allBranches[0];
	if (!firstSet) return undefined;

	for (const candidate of firstSet) {
		if (allBranches.every((s) => s.has(candidate))) {
			return candidate;
		}
	}

	return undefined;
}

/**
 * Ensure early-return branches (shorter paths from split to join) are never on the baseline.
 * The baseline is the split gateway's center-y. If the shortest branch sits on the baseline,
 * swap it with a longer branch.
 */
export function ensureEarlyReturnOffBaseline(layoutNodes: LayoutNode[], dag: DirectedGraph): void {
	const nodeMap = new Map<string, LayoutNode>();
	for (const n of layoutNodes) {
		nodeMap.set(n.id, n);
	}

	for (const n of layoutNodes) {
		if (!GATEWAY_TYPE_SET.has(n.type)) continue;
		const succs = dag.successors.get(n.id) ?? [];
		if (succs.length < 2) continue;

		const joinId = findJoinGateway(n.id, dag, nodeMap);

		// Measure branch length (number of nodes from split successor to join)
		const branchLengths = new Map<string, number>();
		for (const startId of succs) {
			let length = 0;
			let currentId: string | undefined = startId;
			const seen = new Set<string>();
			while (currentId && !seen.has(currentId)) {
				seen.add(currentId);
				length++;
				if (currentId === joinId) break;
				const nextSuccs: string[] = dag.successors.get(currentId) ?? [];
				currentId = nextSuccs[0];
			}
			branchLengths.set(startId, length);
		}

		const minLength = Math.min(...branchLengths.values());
		const maxLength = Math.max(...branchLengths.values());
		if (minLength >= maxLength) continue; // All branches same length

		const splitCenterY = n.bounds.y + n.bounds.height / 2;

		// Find early-return branches (shortest) that are on the baseline
		const earlyReturnOnBaseline: string[] = [];
		let longestOffBaseline: string | undefined;

		for (const startId of succs) {
			const branchNode = nodeMap.get(startId);
			if (!branchNode) continue;
			const branchCenterY = branchNode.bounds.y + branchNode.bounds.height / 2;
			const onBaseline = Math.abs(branchCenterY - splitCenterY) < 1;

			if (branchLengths.get(startId) === minLength && onBaseline) {
				earlyReturnOnBaseline.push(startId);
			}
			if (branchLengths.get(startId) === maxLength && !onBaseline) {
				longestOffBaseline = startId;
			}
		}

		if (earlyReturnOnBaseline.length === 0 || !longestOffBaseline) continue;

		// Swap the first early-return branch with the longest off-baseline branch
		const earlyId = earlyReturnOnBaseline[0];
		if (!earlyId) continue;
		const swapId = longestOffBaseline;

		swapBranchPositions(earlyId, swapId, dag, nodeMap, joinId);
	}
}

/**
 * Find the baseline path — the "spine" of the process that all paths share.
 * At split gateways, jumps directly to the corresponding join gateway.
 * Returns the ordered list of node IDs on the baseline.
 */
export function findBaselinePath(layoutNodes: LayoutNode[], dag: DirectedGraph): string[] {
	const nodeMap = new Map<string, LayoutNode>();
	for (const n of layoutNodes) {
		nodeMap.set(n.id, n);
	}

	// Find start event (first node with no predecessors)
	let startId: string | undefined;
	for (const n of layoutNodes) {
		if (n.type === "startEvent") {
			startId = n.id;
			break;
		}
	}
	if (!startId) {
		// Fallback: first node with no predecessors
		for (const n of layoutNodes) {
			const preds = dag.predecessors.get(n.id) ?? [];
			if (preds.length === 0) {
				startId = n.id;
				break;
			}
		}
	}
	if (!startId) return [];

	const path: string[] = [];
	const visited = new Set<string>();
	let currentId: string | undefined = startId;

	while (currentId && !visited.has(currentId)) {
		visited.add(currentId);
		path.push(currentId);

		const succs: string[] = dag.successors.get(currentId) ?? [];
		if (succs.length === 0) break;

		if (succs.length === 1) {
			currentId = succs[0];
		} else {
			// Split gateway: find join and jump to it
			const joinId = findJoinGateway(currentId, dag, nodeMap);
			if (joinId) {
				currentId = joinId;
			} else {
				// No join found — follow the continuation branch (not the dead-end).
				// Prefer a successor that is a gateway, or the one with the longest forward reach.
				currentId = findContinuationSuccessor(succs, dag, nodeMap, visited);
			}
		}
	}

	return path;
}

/**
 * Among split-gateway successors, find the one that continues the main flow.
 * Only follows a successor that is itself a gateway (continuation point).
 * Returns undefined if no successor is a gateway (all branches are dead-ends).
 */
function findContinuationSuccessor(
	succs: string[],
	_dag: DirectedGraph,
	nodeMap: Map<string, LayoutNode>,
	_visited: ReadonlySet<string>,
): string | undefined {
	for (const s of succs) {
		const node = nodeMap.get(s);
		if (node && GATEWAY_TYPE_SET.has(node.type)) {
			return s;
		}
	}
	return undefined;
}

/**
 * Align all nodes on the baseline path to the same center-Y.
 * Uses the first node's (start event) center-Y as the baseline.
 */
export function alignBaselinePath(layoutNodes: LayoutNode[], dag: DirectedGraph): void {
	const baselinePath = findBaselinePath(layoutNodes, dag);
	if (baselinePath.length === 0) return;

	const nodeMap = new Map<string, LayoutNode>();
	for (const n of layoutNodes) {
		nodeMap.set(n.id, n);
	}

	// Use the start event's center-Y as the baseline
	const firstId = baselinePath[0];
	if (!firstId) return;
	const firstNode = nodeMap.get(firstId);
	if (!firstNode) return;
	const baselineY = firstNode.bounds.y + firstNode.bounds.height / 2;

	for (const id of baselinePath) {
		const node = nodeMap.get(id);
		if (!node) continue;
		const currentCenterY = node.bounds.y + node.bounds.height / 2;
		const dy = baselineY - currentCenterY;
		if (Math.abs(dy) > 0.5) {
			node.bounds.y += dy;
			if (node.labelBounds) node.labelBounds.y += dy;
		}
	}
}

/**
 * Distribute branches of split gateways symmetrically around the gateway center Y.
 * Pass 1: multi-branch gateways (2+) — symmetric distribution.
 * Pass 2: single-branch gateways — placed one full grid row away, with peer-aware gap enforcement.
 */
export function distributeSplitBranches(layoutNodes: LayoutNode[], dag: DirectedGraph): void {
	const nodeMap = new Map<string, LayoutNode>();
	for (const n of layoutNodes) {
		nodeMap.set(n.id, n);
	}

	const baselinePath = findBaselinePath(layoutNodes, dag);
	const baselineSet = new Set(baselinePath);

	// Collect split gateways with their non-baseline branch info
	const splitGateways: {
		node: LayoutNode;
		succs: string[];
		branchStarts: string[];
		joinId: string | undefined;
	}[] = [];

	for (const n of layoutNodes) {
		if (!GATEWAY_TYPE_SET.has(n.type)) continue;
		const succs = dag.successors.get(n.id) ?? [];
		if (succs.length < 2) continue;

		const joinId = findJoinGateway(n.id, dag, nodeMap);
		const branchStarts: string[] = [];
		for (const s of succs) {
			if (!baselineSet.has(s)) branchStarts.push(s);
		}
		if (branchStarts.length === 0) continue;
		splitGateways.push({ node: n, succs, branchStarts, joinId });
	}

	// Pass 1: multi-branch gateways (distribute symmetrically)
	for (const { node: n, branchStarts, joinId } of splitGateways) {
		if (branchStarts.length < 2) continue;

		const gatewayCY = n.bounds.y + n.bounds.height / 2;

		branchStarts.sort((a, b) => {
			const na = nodeMap.get(a);
			const nb = nodeMap.get(b);
			if (!na || !nb) return 0;
			return na.bounds.y + na.bounds.height / 2 - (nb.bounds.y + nb.bounds.height / 2);
		});

		const count = branchStarts.length;
		const spacing = GRID_CELL_HEIGHT;
		const startOffset = -((count - 1) / 2) * spacing;

		for (let i = 0; i < count; i++) {
			const branchId = branchStarts[i];
			if (!branchId) continue;
			const branchNode = nodeMap.get(branchId);
			if (!branchNode) continue;

			const targetCY = gatewayCY + startOffset + i * spacing;
			const currentCY = branchNode.bounds.y + branchNode.bounds.height / 2;
			const dy = targetCY - currentCY;

			if (Math.abs(dy) > 0.5) {
				const chain = collectBranchChain(branchId, dag, joinId);
				for (const bid of chain) {
					const bnode = nodeMap.get(bid);
					if (!bnode) continue;
					bnode.bounds.y += dy;
					if (bnode.labelBounds) bnode.labelBounds.y += dy;
				}
			}
		}
	}

	// Pass 2: single-branch gateways (peer-aware gap enforcement)
	for (const { node: n, branchStarts, joinId } of splitGateways) {
		if (branchStarts.length !== 1) continue;

		const gatewayCY = n.bounds.y + n.bounds.height / 2;
		const branchId = branchStarts[0];
		if (!branchId) continue;
		const branchNode = nodeMap.get(branchId);
		if (!branchNode) continue;

		const currentCY = branchNode.bounds.y + branchNode.bounds.height / 2;
		const direction = currentCY < gatewayCY ? -1 : 1;
		let targetCY = gatewayCY + direction * GRID_CELL_HEIGHT;

		const chain = collectBranchChain(branchId, dag, joinId);
		const chainSet = new Set(chain);
		const minGap = GRID_CELL_HEIGHT / 2;
		const initialDy = targetCY - currentCY;
		let extraDy = 0;

		for (const chainNodeId of chain) {
			const chainNode = nodeMap.get(chainNodeId);
			if (!chainNode) continue;
			const chainNodeCY = chainNode.bounds.y + chainNode.bounds.height / 2;
			const chainNodeNewCY = chainNodeCY + initialDy;

			for (const peer of layoutNodes) {
				if (peer.layer !== chainNode.layer || chainSet.has(peer.id)) continue;
				const peerCY = peer.bounds.y + peer.bounds.height / 2;
				const minDist = (chainNode.bounds.height + peer.bounds.height) / 2 + minGap;

				if (Math.abs(chainNodeNewCY + extraDy - peerCY) < minDist) {
					if (direction === -1) {
						const needed = peerCY - minDist - chainNodeNewCY;
						if (needed < extraDy) extraDy = needed;
					} else {
						const needed = peerCY + minDist - chainNodeNewCY;
						if (needed > extraDy) extraDy = needed;
					}
				}
			}
		}

		targetCY += extraDy;
		const dy = targetCY - currentCY;

		if (Math.abs(dy) > 0.5) {
			for (const bid of chain) {
				const bnode = nodeMap.get(bid);
				if (!bnode) continue;
				bnode.bounds.y += dy;
				if (bnode.labelBounds) bnode.labelBounds.y += dy;
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
	const ids: string[] = [];
	const queue = [startId];
	const seen = new Set<string>();
	while (queue.length > 0) {
		const id = queue.shift();
		if (!id || seen.has(id)) continue;
		if (joinId && id === joinId) continue;
		seen.add(id);
		ids.push(id);
		for (const s of dag.successors.get(id) ?? []) {
			if (!seen.has(s)) queue.push(s);
		}
	}
	return ids;
}

/**
 * Resolve overlaps within each layer by pushing nodes apart.
 * Sorts nodes by Y within each layer and ensures minimum gap.
 * Also normalizes coordinates so no node has negative Y.
 */
export function resolveLayerOverlaps(layoutNodes: LayoutNode[]): void {
	const byLayer = new Map<number, LayoutNode[]>();
	for (const n of layoutNodes) {
		const arr = byLayer.get(n.layer) ?? [];
		arr.push(n);
		byLayer.set(n.layer, arr);
	}

	for (const [, nodes] of byLayer) {
		if (nodes.length < 2) continue;
		nodes.sort((a, b) => a.bounds.y - b.bounds.y);

		for (let i = 1; i < nodes.length; i++) {
			const prev = nodes[i - 1];
			const curr = nodes[i];
			if (!prev || !curr) continue;
			const prevBottom = prev.bounds.y + prev.bounds.height;
			if (curr.bounds.y < prevBottom + 1) {
				const shift = prevBottom + 1 - curr.bounds.y;
				curr.bounds.y += shift;
				if (curr.labelBounds) curr.labelBounds.y += shift;
			}
		}
	}

	// Normalize: ensure no node has negative y
	let minY = 0;
	for (const n of layoutNodes) {
		const y = n.labelBounds ? Math.min(n.bounds.y, n.labelBounds.y) : n.bounds.y;
		if (y < minY) minY = y;
	}
	if (minY < 0) {
		const shift = -minY;
		for (const n of layoutNodes) {
			n.bounds.y += shift;
			if (n.labelBounds) n.labelBounds.y += shift;
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
		const ids: string[] = [];
		let currentId: string | undefined = startId;
		const seen = new Set<string>();
		while (currentId && !seen.has(currentId)) {
			if (currentId === joinId) break;
			seen.add(currentId);
			ids.push(currentId);
			const succs: string[] = dag.successors.get(currentId) ?? [];
			currentId = succs.length === 1 ? succs[0] : undefined;
		}
		return ids;
	};

	const nodesA = collectBranch(branchA);
	const nodesB = collectBranch(branchB);

	// Swap y-positions pairwise; if one branch is shorter, remaining nodes keep position
	const swapCount = Math.min(nodesA.length, nodesB.length);
	for (let i = 0; i < swapCount; i++) {
		const idA = nodesA[i];
		const idB = nodesB[i];
		if (!idA || !idB) continue;
		const a = nodeMap.get(idA);
		const b = nodeMap.get(idB);
		if (!a || !b) continue;

		const tmpY = a.bounds.y;
		a.bounds.y = b.bounds.y;
		b.bounds.y = tmpY;

		if (a.labelBounds && b.labelBounds) {
			const tmpLabelY = a.labelBounds.y;
			a.labelBounds.y = b.labelBounds.y;
			b.labelBounds.y = tmpLabelY;
		} else if (a.labelBounds) {
			a.labelBounds.y += b.bounds.y - a.bounds.y;
		} else if (b.labelBounds) {
			b.labelBounds.y += a.bounds.y - b.bounds.y;
		}
	}
}
