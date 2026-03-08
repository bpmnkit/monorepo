import type { BpmnElementType } from "../bpmn/bpmn-model.js";

/** Fixed element dimensions by type. */
export const ELEMENT_SIZES: Record<string, { width: number; height: number }> = {
	startEvent: { width: 36, height: 36 },
	endEvent: { width: 36, height: 36 },
	intermediateThrowEvent: { width: 36, height: 36 },
	intermediateCatchEvent: { width: 36, height: 36 },
	boundaryEvent: { width: 36, height: 36 },
	serviceTask: { width: 100, height: 80 },
	scriptTask: { width: 100, height: 80 },
	userTask: { width: 100, height: 80 },
	sendTask: { width: 100, height: 80 },
	receiveTask: { width: 100, height: 80 },
	businessRuleTask: { width: 100, height: 80 },
	callActivity: { width: 100, height: 80 },
	exclusiveGateway: { width: 36, height: 36 },
	parallelGateway: { width: 36, height: 36 },
	inclusiveGateway: { width: 36, height: 36 },
	eventBasedGateway: { width: 36, height: 36 },
	// Sub-processes are sized dynamically
	subProcess: { width: 100, height: 80 },
	adHocSubProcess: { width: 100, height: 80 },
	eventSubProcess: { width: 100, height: 80 },
};

/** Virtual grid cell dimensions for element placement. */
export const GRID_CELL_WIDTH = 200;
export const GRID_CELL_HEIGHT = 160;

/** Minimum spacing between elements (derived from grid). */
export const HORIZONTAL_SPACING = GRID_CELL_WIDTH - 100; // 100 = max element width
export const VERTICAL_SPACING = GRID_CELL_HEIGHT - 80; // 80 = max element height

/** Padding inside sub-process containers. */
export const SUBPROCESS_PADDING = 20;

/** Edge-label sizing constants (used for placement & collision detection). */
export const LABEL_CHAR_WIDTH = 7;
export const LABEL_MIN_WIDTH = 40;
export const LABEL_HEIGHT = 14;
export const LABEL_VERTICAL_OFFSET = 10;

/** Axis-aligned bounding box. */
export interface Bounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** A waypoint in an edge route. */
export interface Waypoint {
	x: number;
	y: number;
}

/** A node in the layout graph. */
export interface LayoutNode {
	id: string;
	type: BpmnElementType;
	bounds: Bounds;
	/** Layer (column) index assigned by Sugiyama algorithm. */
	layer: number;
	/** Position within the layer (row index). */
	position: number;
	/** Label text for the node. */
	label?: string;
	/** Label bounds for overlap checking. */
	labelBounds?: Bounds;
	/** Whether this node is an expanded sub-process container. */
	isExpanded?: boolean;
}

/** A routed edge in the layout. */
export interface LayoutEdge {
	id: string;
	sourceRef: string;
	targetRef: string;
	waypoints: Waypoint[];
	/** Label text for the edge. */
	label?: string;
	/** Label bounds for overlap checking. */
	labelBounds?: Bounds;
}

/** Result of laying out a sub-process's children, linked to its parent. */
export interface SubProcessChildResult {
	parentId: string;
	result: LayoutResult;
}

/** Complete layout result for a process. */
export interface LayoutResult {
	nodes: LayoutNode[];
	edges: LayoutEdge[];
}
