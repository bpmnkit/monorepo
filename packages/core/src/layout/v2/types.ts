/** Track bands for Y placement (0=top-annotations, 5=bottom-annotations). */
export type NodeTrack = 0 | 1 | 2 | 3 | 4 | 5

/** Y-center for each track band. Flow nodes use tracks 1–4; 0 and 5 are for annotations. */
export const TRACK_Y: Record<NodeTrack, number> = {
	0: 40,
	1: 160,
	2: 360,
	3: 560,
	4: 760,
	5: 960,
}

/** All positions snap to multiples of this value. */
export const CELL_SIZE = 40

/** Minimum horizontal gap between adjacent layer columns (px). */
export const MIN_COL_GAP = 80

/** Vertical gap when stacking multiple nodes in the same track+layer (px). */
export const STACK_V_GAP = 20

/** Left margin before the first layer (px). */
export const LEFT_MARGIN = 50

/** Padding around nodes for obstacle-avoidance routing (px). */
export const OBSTACLE_PAD = 20

/** Annotation height (px). */
export const ANN_HEIGHT = 50

/** Pattern for rejection/error/escalation nodes and flows. */
export const REJECTION_PATTERN = /reject|escalat|error|cancel|declin/i

export interface V2Node {
	id: string
	/** BPMN element type string (e.g. 'serviceTask', 'exclusiveGateway'). */
	type: string
	width: number
	height: number
	/** Assigned X coordinate (left edge). Set in Module 5. */
	x: number
	/** Assigned Y coordinate (top edge). Set in Module 5. */
	y: number
	/** Column index from Module 4 layer assignment. */
	layer: number
	/** Y-band track from Module 5. */
	track: NodeTrack
	/** True when this node is on the trunk (happy-path). */
	isTrunk: boolean
	/** True when this node is the source of a back-edge. */
	isBackEdgeSource: boolean
	/** True for virtual placeholder nodes inserted for multi-span edges. */
	isDummy: boolean
	label?: string
	/** Width of the widest annotation associated with this node (px). Used for dynamic X gaps. */
	annotationWidth?: number
}

export interface V2Edge {
	id: string
	sourceId: string
	targetId: string
	/** True when this edge forms a loop (back-edge). Routed through Track 1 highway. */
	isBackEdge: boolean
	waypoints: Array<{ x: number; y: number }>
	label?: string
}

export interface PortPoint {
	x: number
	y: number
}

export interface PortAssignment {
	edgeId: string
	source: PortPoint
	target: PortPoint
}

export const GATEWAY_TYPES = new Set([
	"exclusiveGateway",
	"parallelGateway",
	"inclusiveGateway",
	"eventBasedGateway",
	"complexGateway",
])

export function isGateway(type: string): boolean {
	return GATEWAY_TYPES.has(type)
}
