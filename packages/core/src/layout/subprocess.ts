import type { BpmnAdHocSubProcess, BpmnFlowElement } from "../bpmn/bpmn-model.js";
import { layoutFlowNodes } from "./layout-engine.js";
import type { LayoutNode, SubProcessChildResult } from "./types.js";
import { SUBPROCESS_PADDING } from "./types.js";

/** Sub-process types that contain child elements. */
type SubProcessElement = BpmnAdHocSubProcess;

/**
 * Check if a node type is a sub-process container.
 */
export function isSubProcess(type: string): boolean {
	return type === "subProcess" || type === "adHocSubProcess" || type === "eventSubProcess";
}

/**
 * Perform recursive layout for sub-process containers.
 * Lays out internal elements in local coordinates, then sizes the
 * sub-process to fit its content with padding, and translates internal
 * elements into the parent coordinate space.
 */
export function layoutSubProcesses(
	layoutNodes: LayoutNode[],
	nodeIndex: Map<string, BpmnFlowElement>,
): SubProcessChildResult[] {
	const childResults: SubProcessChildResult[] = [];

	for (const layoutNode of layoutNodes) {
		const bpmnNode = nodeIndex.get(layoutNode.id);
		if (!bpmnNode || !isSubProcess(bpmnNode.type)) continue;
		const subProcess = bpmnNode as SubProcessElement;
		if (!subProcess.flowElements || subProcess.flowElements.length === 0) continue;

		const childResult = layoutFlowNodes(subProcess.flowElements, subProcess.sequenceFlows ?? []);

		if (childResult.nodes.length === 0) continue;

		// Compute bounding box of child elements
		let minX = Number.POSITIVE_INFINITY;
		let minY = Number.POSITIVE_INFINITY;
		let maxX = Number.NEGATIVE_INFINITY;
		let maxY = Number.NEGATIVE_INFINITY;

		for (const child of childResult.nodes) {
			minX = Math.min(minX, child.bounds.x);
			minY = Math.min(minY, child.bounds.y);
			maxX = Math.max(maxX, child.bounds.x + child.bounds.width);
			maxY = Math.max(maxY, child.bounds.y + child.bounds.height);
		}

		const contentWidth = maxX - minX;
		const contentHeight = maxY - minY;

		// Size the sub-process to fit content with padding
		const originalCenterY = layoutNode.bounds.y + layoutNode.bounds.height / 2;
		layoutNode.bounds.width = contentWidth + SUBPROCESS_PADDING * 2;
		layoutNode.bounds.height = contentHeight + SUBPROCESS_PADDING * 2;
		layoutNode.isExpanded = true;

		// Re-center vertically on the original baseline position
		layoutNode.bounds.y = originalCenterY - layoutNode.bounds.height / 2;

		// Translate child coordinates into parent space
		const offsetX = layoutNode.bounds.x + SUBPROCESS_PADDING - minX;
		const offsetY = layoutNode.bounds.y + SUBPROCESS_PADDING - minY;

		for (const child of childResult.nodes) {
			child.bounds.x += offsetX;
			child.bounds.y += offsetY;
			if (child.labelBounds) {
				child.labelBounds.x += offsetX;
				child.labelBounds.y += offsetY;
			}
		}

		for (const edge of childResult.edges) {
			for (const wp of edge.waypoints) {
				wp.x += offsetX;
				wp.y += offsetY;
			}
			if (edge.labelBounds) {
				edge.labelBounds.x += offsetX;
				edge.labelBounds.y += offsetY;
			}
		}

		childResults.push({ parentId: layoutNode.id, result: childResult });
	}

	return childResults;
}
