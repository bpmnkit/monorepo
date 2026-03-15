import type {
	BpmnAssociation,
	BpmnBoundaryEvent,
	BpmnBounds,
	BpmnDefinitions,
	BpmnDiEdge,
	BpmnDiShape,
	BpmnEventDefinition,
	BpmnFlowElement,
	BpmnSequenceFlow,
	BpmnTextAnnotation,
	BpmnWaypoint,
	DiColor,
} from "@bpmnkit/core"
import { BIOC_NS, COLOR_NS, writeDiColor } from "@bpmnkit/core"
import {
	computeWaypoints,
	computeWaypointsAvoiding,
	computeWaypointsWithPorts,
	portFromWaypoint,
	routeEntersShape,
	routeOrthogonal,
	waypointsIntersectObstacles,
} from "./geometry.js"
import { genId } from "./id.js"
import type { CreateShapeType, PortDir } from "./types.js"

// ── Empty definitions ─────────────────────────────────────────────────────────

/** Creates a minimal valid BpmnDefinitions with one process and one diagram. */
export function createEmptyDefinitions(): BpmnDefinitions {
	const processId = genId("Process")
	const planeId = genId("BPMNPlane")
	return {
		id: genId("Definitions"),
		targetNamespace: "http://bpmn.io/schema/bpmn",
		namespaces: {
			bpmn: "http://www.omg.org/spec/BPMN/20100524/MODEL",
			bpmndi: "http://www.omg.org/spec/BPMN/20100524/DI",
			dc: "http://www.omg.org/spec/DD/20100524/DC",
			di: "http://www.omg.org/spec/DD/20100524/DI",
		},
		unknownAttributes: {},
		errors: [],
		escalations: [],
		messages: [],
		collaborations: [],
		processes: [
			{
				id: processId,
				extensionElements: [],
				flowElements: [],
				sequenceFlows: [],
				textAnnotations: [],
				associations: [],
				unknownAttributes: {},
			},
		],
		diagrams: [
			{
				id: genId("BPMNDiagram"),
				plane: {
					id: planeId,
					bpmnElement: processId,
					shapes: [],
					edges: [],
				},
			},
		],
	}
}

// ── Helper: build a new flow element ─────────────────────────────────────────

function makeFlowElement(type: CreateShapeType, id: string, name?: string): BpmnFlowElement {
	const base = {
		id,
		name,
		incoming: [] as string[],
		outgoing: [] as string[],
		extensionElements: [] as never[],
		unknownAttributes: {} as Record<string, string>,
	}

	switch (type) {
		case "startEvent":
			return { ...base, type: "startEvent", eventDefinitions: [] }
		case "messageStartEvent":
			return { ...base, type: "startEvent", eventDefinitions: [{ type: "message" }] }
		case "timerStartEvent":
			return { ...base, type: "startEvent", eventDefinitions: [{ type: "timer" }] }
		case "conditionalStartEvent":
			return { ...base, type: "startEvent", eventDefinitions: [{ type: "conditional" }] }
		case "signalStartEvent":
			return { ...base, type: "startEvent", eventDefinitions: [{ type: "signal" }] }
		case "endEvent":
			return { ...base, type: "endEvent", eventDefinitions: [] }
		case "messageEndEvent":
			return { ...base, type: "endEvent", eventDefinitions: [{ type: "message" }] }
		case "escalationEndEvent":
			return { ...base, type: "endEvent", eventDefinitions: [{ type: "escalation" }] }
		case "errorEndEvent":
			return { ...base, type: "endEvent", eventDefinitions: [{ type: "error" }] }
		case "compensationEndEvent":
			return { ...base, type: "endEvent", eventDefinitions: [{ type: "compensate" }] }
		case "signalEndEvent":
			return { ...base, type: "endEvent", eventDefinitions: [{ type: "signal" }] }
		case "terminateEndEvent":
			return { ...base, type: "endEvent", eventDefinitions: [{ type: "terminate" }] }
		case "intermediateThrowEvent":
			return { ...base, type: "intermediateThrowEvent", eventDefinitions: [] }
		case "intermediateCatchEvent":
			return { ...base, type: "intermediateCatchEvent", eventDefinitions: [] }
		case "messageCatchEvent":
			return { ...base, type: "intermediateCatchEvent", eventDefinitions: [{ type: "message" }] }
		case "messageThrowEvent":
			return { ...base, type: "intermediateThrowEvent", eventDefinitions: [{ type: "message" }] }
		case "timerCatchEvent":
			return { ...base, type: "intermediateCatchEvent", eventDefinitions: [{ type: "timer" }] }
		case "escalationThrowEvent":
			return {
				...base,
				type: "intermediateThrowEvent",
				eventDefinitions: [{ type: "escalation" }],
			}
		case "conditionalCatchEvent":
			return {
				...base,
				type: "intermediateCatchEvent",
				eventDefinitions: [{ type: "conditional" }],
			}
		case "linkCatchEvent":
			return { ...base, type: "intermediateCatchEvent", eventDefinitions: [{ type: "link" }] }
		case "linkThrowEvent":
			return { ...base, type: "intermediateThrowEvent", eventDefinitions: [{ type: "link" }] }
		case "compensationThrowEvent":
			return {
				...base,
				type: "intermediateThrowEvent",
				eventDefinitions: [{ type: "compensate" }],
			}
		case "signalCatchEvent":
			return { ...base, type: "intermediateCatchEvent", eventDefinitions: [{ type: "signal" }] }
		case "signalThrowEvent":
			return { ...base, type: "intermediateThrowEvent", eventDefinitions: [{ type: "signal" }] }
		case "task":
			return { ...base, type: "task" }
		case "serviceTask":
			return { ...base, type: "serviceTask" }
		case "userTask":
			return { ...base, type: "userTask" }
		case "scriptTask":
			return { ...base, type: "scriptTask" }
		case "sendTask":
			return { ...base, type: "sendTask" }
		case "receiveTask":
			return { ...base, type: "receiveTask" }
		case "businessRuleTask":
			return { ...base, type: "businessRuleTask" }
		case "manualTask":
			return { ...base, type: "manualTask" }
		case "callActivity":
			return { ...base, type: "callActivity" }
		case "subProcess":
			return {
				...base,
				type: "subProcess",
				flowElements: [],
				sequenceFlows: [],
				textAnnotations: [],
				associations: [],
			}
		case "adHocSubProcess":
			return {
				...base,
				type: "adHocSubProcess",
				flowElements: [],
				sequenceFlows: [],
				textAnnotations: [],
				associations: [],
			}
		case "transaction":
			return {
				...base,
				type: "transaction",
				flowElements: [],
				sequenceFlows: [],
				textAnnotations: [],
				associations: [],
			}
		case "exclusiveGateway":
			return { ...base, type: "exclusiveGateway" }
		case "parallelGateway":
			return { ...base, type: "parallelGateway" }
		case "inclusiveGateway":
			return { ...base, type: "inclusiveGateway" }
		case "eventBasedGateway":
			return { ...base, type: "eventBasedGateway" }
		case "complexGateway":
			return { ...base, type: "complexGateway" }
		case "textAnnotation":
			throw new Error("textAnnotation is not a flow element — use createAnnotation()")
	}
}

// ── Container subprocess helpers ──────────────────────────────────────────────

/** Recursively collects all descendant flow element IDs and sequence flow IDs. */
function collectDescendantIds(el: BpmnFlowElement, out: Set<string>): void {
	if (
		el.type !== "subProcess" &&
		el.type !== "adHocSubProcess" &&
		el.type !== "eventSubProcess" &&
		el.type !== "transaction"
	)
		return
	for (const child of el.flowElements) {
		out.add(child.id)
		collectDescendantIds(child, out)
	}
	for (const sf of el.sequenceFlows) {
		out.add(sf.id)
	}
}

/** Flattens all sequence flows from all nesting levels into a Map. */
function collectAllSequenceFlows(
	flowElements: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
	out: Map<string, BpmnSequenceFlow>,
): void {
	for (const sf of sequenceFlows) {
		out.set(sf.id, sf)
	}
	for (const el of flowElements) {
		if (
			el.type === "subProcess" ||
			el.type === "adHocSubProcess" ||
			el.type === "eventSubProcess" ||
			el.type === "transaction"
		) {
			collectAllSequenceFlows(el.flowElements, el.sequenceFlows, out)
		}
	}
}

/** Returns the innermost container element ID whose bounds contain (cx, cy), or null. */
function findContainerForPoint(defs: BpmnDefinitions, cx: number, cy: number): string | null {
	const process = defs.processes[0]
	const diagram = defs.diagrams[0]
	if (!process || !diagram) return null

	const containerIds = new Set<string>()
	const gatherContainers = (elements: BpmnFlowElement[]): void => {
		for (const el of elements) {
			if (
				el.type === "subProcess" ||
				el.type === "adHocSubProcess" ||
				el.type === "eventSubProcess" ||
				el.type === "transaction"
			) {
				containerIds.add(el.id)
				gatherContainers(el.flowElements)
			}
		}
	}
	gatherContainers(process.flowElements)

	let bestId: string | null = null
	let bestArea = Number.POSITIVE_INFINITY
	for (const shape of diagram.plane.shapes) {
		if (!containerIds.has(shape.bpmnElement)) continue
		const { x, y, width, height } = shape.bounds
		if (cx >= x && cx <= x + width && cy >= y && cy <= y + height) {
			const area = width * height
			if (area < bestArea) {
				bestArea = area
				bestId = shape.bpmnElement
			}
		}
	}
	return bestId
}

/** Recursively finds the container by ID and appends newElement to its flowElements. */
function addToContainer(
	flowElements: BpmnFlowElement[],
	containerId: string,
	newElement: BpmnFlowElement,
): BpmnFlowElement[] {
	return flowElements.map((el) => {
		if (
			el.type !== "subProcess" &&
			el.type !== "adHocSubProcess" &&
			el.type !== "eventSubProcess" &&
			el.type !== "transaction"
		)
			return el
		if (el.id === containerId) {
			return { ...el, flowElements: [...el.flowElements, newElement] }
		}
		return { ...el, flowElements: addToContainer(el.flowElements, containerId, newElement) }
	})
}

/** Recursively searches all levels for an element/flow by ID and updates its name. */
function updateNameInElements(
	flowElements: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
	id: string,
	name: string,
): { elements: BpmnFlowElement[]; flows: BpmnSequenceFlow[]; updated: boolean } {
	const elIndex = flowElements.findIndex((el) => el.id === id)
	if (elIndex >= 0) {
		const newElements = [...flowElements]
		const el = newElements[elIndex]
		if (el) newElements[elIndex] = { ...el, name }
		return { elements: newElements, flows: sequenceFlows, updated: true }
	}

	const sfIndex = sequenceFlows.findIndex((sf) => sf.id === id)
	if (sfIndex >= 0) {
		const newFlows = [...sequenceFlows]
		const sf = newFlows[sfIndex]
		if (sf) newFlows[sfIndex] = { ...sf, name }
		return { elements: flowElements, flows: newFlows, updated: true }
	}

	for (let i = 0; i < flowElements.length; i++) {
		const el = flowElements[i]
		if (
			el &&
			(el.type === "subProcess" ||
				el.type === "adHocSubProcess" ||
				el.type === "eventSubProcess" ||
				el.type === "transaction")
		) {
			const r = updateNameInElements(el.flowElements, el.sequenceFlows, id, name)
			if (r.updated) {
				const newElements = [...flowElements]
				newElements[i] = { ...el, flowElements: r.elements, sequenceFlows: r.flows }
				return { elements: newElements, flows: sequenceFlows, updated: true }
			}
		}
	}

	return { elements: flowElements, flows: sequenceFlows, updated: false }
}

/**
 * Recursively removes deleted elements from all nesting levels.
 * Mutates allRemovedIds (adds removed flow IDs) for DI edge cleanup.
 */
function removeFromContainers(
	flowElements: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
	idSet: Set<string>,
	allRemovedIds: Set<string>,
): { flowElements: BpmnFlowElement[]; sequenceFlows: BpmnSequenceFlow[] } {
	const flowsToRemove = new Set(
		sequenceFlows
			.filter((sf) => idSet.has(sf.id) || idSet.has(sf.sourceRef) || idSet.has(sf.targetRef))
			.map((sf) => sf.id),
	)
	for (const fid of flowsToRemove) allRemovedIds.add(fid)

	const newSequenceFlows = sequenceFlows.filter((sf) => !flowsToRemove.has(sf.id))
	const newFlowElements = flowElements
		.filter((el) => !idSet.has(el.id))
		.map((el): BpmnFlowElement => {
			const cleaned = {
				...el,
				incoming: el.incoming.filter((ref) => !allRemovedIds.has(ref)),
				outgoing: el.outgoing.filter((ref) => !allRemovedIds.has(ref)),
			} as BpmnFlowElement
			if (
				cleaned.type === "subProcess" ||
				cleaned.type === "adHocSubProcess" ||
				cleaned.type === "eventSubProcess" ||
				cleaned.type === "transaction"
			) {
				const r = removeFromContainers(
					cleaned.flowElements,
					cleaned.sequenceFlows,
					idSet,
					allRemovedIds,
				)
				return { ...cleaned, flowElements: r.flowElements, sequenceFlows: r.sequenceFlows }
			}
			return cleaned
		})

	return { flowElements: newFlowElements, sequenceFlows: newSequenceFlows }
}

/** Recursively finds element by ID and applies updateFn to it. */
function updateRefInElements(
	flowElements: BpmnFlowElement[],
	id: string,
	updateFn: (el: BpmnFlowElement) => BpmnFlowElement,
): BpmnFlowElement[] {
	return flowElements.map((el) => {
		if (el.id === id) return updateFn(el)
		if (
			el.type === "subProcess" ||
			el.type === "adHocSubProcess" ||
			el.type === "eventSubProcess" ||
			el.type === "transaction"
		) {
			return { ...el, flowElements: updateRefInElements(el.flowElements, id, updateFn) }
		}
		return el
	})
}

// ── Create shape ─────────────────────────────────────────────────────────────

export function createShape(
	defs: BpmnDefinitions,
	type: CreateShapeType,
	bounds: BpmnBounds,
	name?: string,
): { defs: BpmnDefinitions; id: string } {
	const id = genId(type)
	const shapeId = genId(`${type}_di`)
	const flowElement = makeFlowElement(type, id, name)

	const process = defs.processes[0]
	if (!process) return { defs, id }

	const diagram = defs.diagrams[0]
	if (!diagram) return { defs, id }

	const diShape: BpmnDiShape = {
		id: shapeId,
		bpmnElement: id,
		bounds,
		unknownAttributes: {},
	}

	const cx = bounds.x + bounds.width / 2
	const cy = bounds.y + bounds.height / 2
	const containerId = findContainerForPoint(defs, cx, cy)

	const newDefs: BpmnDefinitions = {
		...defs,
		processes: [
			{
				...process,
				flowElements:
					containerId !== null
						? addToContainer(process.flowElements, containerId, flowElement)
						: [...process.flowElements, flowElement],
			},
			...defs.processes.slice(1),
		],
		diagrams: [
			{
				...diagram,
				plane: {
					...diagram.plane,
					shapes: [...diagram.plane.shapes, diShape],
				},
			},
			...defs.diagrams.slice(1),
		],
	}

	return { defs: newDefs, id }
}

// ── Create boundary event ─────────────────────────────────────────────────────

export function createBoundaryEvent(
	defs: BpmnDefinitions,
	hostId: string,
	eventDefType: string | null,
	bounds: BpmnBounds,
	cancelActivity = true,
): { defs: BpmnDefinitions; id: string } {
	const id = genId("BoundaryEvent")
	const shapeId = genId("BoundaryEvent_di")

	const process = defs.processes[0]
	if (!process) return { defs, id }
	const diagram = defs.diagrams[0]
	if (!diagram) return { defs, id }

	const eventDefs = eventDefType ? [{ type: eventDefType } as BpmnEventDefinition] : []
	const boundaryEvent: BpmnBoundaryEvent = {
		type: "boundaryEvent",
		id,
		attachedToRef: hostId,
		cancelActivity,
		eventDefinitions: eventDefs,
		incoming: [],
		outgoing: [],
		extensionElements: [],
		unknownAttributes: {},
	}

	const diShape: BpmnDiShape = {
		id: shapeId,
		bpmnElement: id,
		bounds,
		unknownAttributes: {},
	}

	return {
		defs: {
			...defs,
			processes: [
				{
					...process,
					flowElements: [...process.flowElements, boundaryEvent],
				},
				...defs.processes.slice(1),
			],
			diagrams: [
				{
					...diagram,
					plane: {
						...diagram.plane,
						shapes: [...diagram.plane.shapes, diShape],
					},
				},
				...defs.diagrams.slice(1),
			],
		},
		id,
	}
}

// ── Create connection ─────────────────────────────────────────────────────────

export function createConnection(
	defs: BpmnDefinitions,
	sourceId: string,
	targetId: string,
	waypoints: BpmnWaypoint[],
): { defs: BpmnDefinitions; id: string } {
	const id = genId("Flow")
	const edgeId = genId("Flow_di")

	const process = defs.processes[0]
	if (!process) return { defs, id }

	const diagram = defs.diagrams[0]
	if (!diagram) return { defs, id }

	const sf: BpmnSequenceFlow = {
		id,
		sourceRef: sourceId,
		targetRef: targetId,
		extensionElements: [],
		unknownAttributes: {},
	}

	const edge: BpmnDiEdge = {
		id: edgeId,
		bpmnElement: id,
		waypoints,
		unknownAttributes: {},
	}

	// Update source.outgoing and target.incoming (recursive — handles subprocess children)
	let updatedElements = updateRefInElements(
		process.flowElements,
		sourceId,
		(el) => ({ ...el, outgoing: [...el.outgoing, id] }) as BpmnFlowElement,
	)
	updatedElements = updateRefInElements(
		updatedElements,
		targetId,
		(el) => ({ ...el, incoming: [...el.incoming, id] }) as BpmnFlowElement,
	)

	const newDefs: BpmnDefinitions = {
		...defs,
		processes: [
			{
				...process,
				flowElements: updatedElements,
				sequenceFlows: [...process.sequenceFlows, sf],
			},
			...defs.processes.slice(1),
		],
		diagrams: [
			{
				...diagram,
				plane: {
					...diagram.plane,
					edges: [...diagram.plane.edges, edge],
				},
			},
			...defs.diagrams.slice(1),
		],
	}

	return { defs: newDefs, id }
}

// ── Move shapes ───────────────────────────────────────────────────────────────

/** Returns true if the boundary event center is within the host bounds (with a margin). */
function isOnHostBoundary(eventBounds: BpmnBounds, hostBounds: BpmnBounds): boolean {
	const margin = 24
	const cx = eventBounds.x + eventBounds.width / 2
	const cy = eventBounds.y + eventBounds.height / 2
	return (
		cx >= hostBounds.x - margin &&
		cx <= hostBounds.x + hostBounds.width + margin &&
		cy >= hostBounds.y - margin &&
		cy <= hostBounds.y + hostBounds.height + margin
	)
}

export function moveShapes(
	defs: BpmnDefinitions,
	moves: Array<{ id: string; dx: number; dy: number }>,
): BpmnDefinitions {
	if (moves.length === 0) return defs

	const moveMap = new Map(moves.map((m) => [m.id, m]))

	const process = defs.processes[0]
	const diagram = defs.diagrams[0]
	if (!process || !diagram) return defs

	// Cascade: boundary events attached to moved shapes also move, but only if they
	// are currently positioned on/near the host boundary (not moved away by the user).
	const extendedMoves = [...moves]
	for (const el of process.flowElements) {
		if (el.type === "boundaryEvent" && moveMap.has(el.attachedToRef) && !moveMap.has(el.id)) {
			const hostShape = diagram.plane.shapes.find((s) => s.bpmnElement === el.attachedToRef)
			const eventShape = diagram.plane.shapes.find((s) => s.bpmnElement === el.id)
			if (hostShape && eventShape && isOnHostBoundary(eventShape.bounds, hostShape.bounds)) {
				const hostMove = moveMap.get(el.attachedToRef)
				if (hostMove) extendedMoves.push({ id: el.id, dx: hostMove.dx, dy: hostMove.dy })
			}
		}
	}

	// Cascade: descendants of moving container elements (subprocesses) also move.
	const seenIds = new Set(extendedMoves.map((m) => m.id))
	const cascadeDescendants = (elements: BpmnFlowElement[]): void => {
		for (const el of elements) {
			if (
				el.type === "subProcess" ||
				el.type === "adHocSubProcess" ||
				el.type === "eventSubProcess" ||
				el.type === "transaction"
			) {
				if (moveMap.has(el.id)) {
					const move = moveMap.get(el.id)
					if (move) {
						const descIds = new Set<string>()
						collectDescendantIds(el, descIds)
						for (const descId of descIds) {
							if (!seenIds.has(descId)) {
								seenIds.add(descId)
								extendedMoves.push({ id: descId, dx: move.dx, dy: move.dy })
							}
						}
					}
				}
				cascadeDescendants(el.flowElements)
			}
		}
	}
	cascadeDescendants(process.flowElements)

	const extendedMoveMap = new Map(extendedMoves.map((m) => [m.id, m]))

	// Update DI shape bounds (and label bounds, if present)
	const newShapes = diagram.plane.shapes.map((s) => {
		const m = extendedMoveMap.get(s.bpmnElement)
		if (!m) return s
		return {
			...s,
			bounds: {
				...s.bounds,
				x: s.bounds.x + m.dx,
				y: s.bounds.y + m.dy,
			},
			label:
				s.label?.bounds !== undefined
					? {
							...s.label,
							bounds: {
								x: s.label.bounds.x + m.dx,
								y: s.label.bounds.y + m.dy,
								width: s.label.bounds.width,
								height: s.label.bounds.height,
							},
						}
					: s.label,
		}
	})

	// Update edge waypoints
	// After each move, ensure sequence flows:
	//  1. Never pass behind/through other elements (obstacle avoidance)
	//  2. Never share the same connection point on an element (port deconfliction)
	const allFlows = new Map<string, BpmnSequenceFlow>()
	collectAllSequenceFlows(process.flowElements, process.sequenceFlows, allFlows)

	// Build a lookup of post-move shape bounds
	const shapeBoundsMap = new Map<string, BpmnBounds>()
	for (const s of newShapes) {
		shapeBoundsMap.set(s.bpmnElement, s.bounds)
	}

	const newEdges = diagram.plane.edges.map((edge) => {
		// Handle sequence flows (search all nesting levels)
		const flow = allFlows.get(edge.bpmnElement)
		if (flow) {
			if (edge.waypoints.length < 2) return edge

			const srcMove = extendedMoveMap.get(flow.sourceRef)
			const tgtMove = extendedMoveMap.get(flow.targetRef)
			const srcShape = newShapes.find((s) => s.bpmnElement === flow.sourceRef)
			const tgtShape = newShapes.find((s) => s.bpmnElement === flow.targetRef)
			if (!srcShape || !tgtShape) return edge

			// Obstacles = all shapes except this edge's source and target
			const obstacles = newShapes
				.filter((s) => s.bpmnElement !== flow.sourceRef && s.bpmnElement !== flow.targetRef)
				.map((s) => s.bounds)

			if (srcMove || tgtMove) {
				// At least one endpoint moved — always re-route from port midpoints so that
				// connection points are centered on the side and obstacles are avoided.
				return {
					...edge,
					waypoints: computeWaypointsAvoiding(srcShape.bounds, tgtShape.bounds, obstacles),
				}
			}

			// Neither endpoint moves — validate the existing waypoints fully.
			// This catches both: (a) a moved shape now blocking the path, and
			// (b) pre-existing invalid paths loaded from XML that pass through
			// a shape's interior.  Any invalid path is re-routed.
			if (
				waypointsIntersectObstacles(edge.waypoints, obstacles) ||
				routeEntersShape(edge.waypoints, srcShape.bounds) ||
				routeEntersShape(edge.waypoints, tgtShape.bounds)
			) {
				return {
					...edge,
					waypoints: computeWaypointsAvoiding(srcShape.bounds, tgtShape.bounds, obstacles),
				}
			}

			return edge
		}

		// Handle association edges
		const assoc = process.associations.find((a) => a.id === edge.bpmnElement)
		if (assoc) {
			const srcMove = extendedMoveMap.get(assoc.sourceRef)
			const tgtMove = extendedMoveMap.get(assoc.targetRef)
			if (!srcMove && !tgtMove) return edge

			if (srcMove && tgtMove) {
				return {
					...edge,
					waypoints: edge.waypoints.map((wp) => ({ x: wp.x + srcMove.dx, y: wp.y + srcMove.dy })),
				}
			}
			const srcShape = newShapes.find((s) => s.bpmnElement === assoc.sourceRef)
			const tgtShape = newShapes.find((s) => s.bpmnElement === assoc.targetRef)
			if (srcShape && tgtShape) {
				return { ...edge, waypoints: computeWaypoints(srcShape.bounds, tgtShape.bounds) }
			}
		}

		return edge
	})

	// Port deconfliction: spread edges that share the same connection point on a shape
	const deconflictedEdges = deconflictPorts(newEdges, shapeBoundsMap, allFlows)

	return {
		...defs,
		diagrams: [
			{
				...diagram,
				plane: { ...diagram.plane, shapes: newShapes, edges: deconflictedEdges },
			},
			...defs.diagrams.slice(1),
		],
	}
}

// ── Port deconfliction ────────────────────────────────────────────────────────

/**
 * Spreads edge connection points when multiple flows share the same port
 * midpoint on a shape.  Groups edges by (shapeId, port-side) and offsets
 * them evenly along that side so no two flows touch the exact same point.
 */
function deconflictPorts(
	edges: BpmnDiEdge[],
	shapeBoundsMap: Map<string, BpmnBounds>,
	allFlows: Map<string, BpmnSequenceFlow>,
): BpmnDiEdge[] {
	type TermRef = { edgeIdx: number; isSource: boolean; port: PortDir }
	const groups = new Map<string, TermRef[]>()

	for (let i = 0; i < edges.length; i++) {
		const edge = edges[i]
		if (!edge || edge.waypoints.length < 2) continue
		const flow = allFlows.get(edge.bpmnElement)
		if (!flow) continue
		const srcBounds = shapeBoundsMap.get(flow.sourceRef)
		const tgtBounds = shapeBoundsMap.get(flow.targetRef)
		if (!srcBounds || !tgtBounds) continue

		const firstWp = edge.waypoints[0]
		const lastWp = edge.waypoints[edge.waypoints.length - 1]
		if (!firstWp || !lastWp) continue

		const srcPort = portFromWaypoint(firstWp, srcBounds)
		const tgtPort = portFromWaypoint(lastWp, tgtBounds)

		const srcKey = `${flow.sourceRef}:${srcPort}`
		const tgtKey = `${flow.targetRef}:${tgtPort}`

		const sg = groups.get(srcKey) ?? []
		sg.push({ edgeIdx: i, isSource: true, port: srcPort })
		groups.set(srcKey, sg)

		const tg = groups.get(tgtKey) ?? []
		tg.push({ edgeIdx: i, isSource: false, port: tgtPort })
		groups.set(tgtKey, tg)
	}

	// Compute spread waypoints for groups with collisions
	const newSrcTerminals = new Map<number, BpmnWaypoint>()
	const newSrcPorts = new Map<number, PortDir>()
	const newTgtTerminals = new Map<number, BpmnWaypoint>()
	const newTgtPorts = new Map<number, PortDir>()

	for (const [key, group] of groups) {
		if (group.length <= 1) continue
		const colonIdx = key.indexOf(":")
		const shapeId = key.slice(0, colonIdx)
		const portStr = key.slice(colonIdx + 1)
		if (portStr !== "top" && portStr !== "right" && portStr !== "bottom" && portStr !== "left")
			continue
		const port: PortDir = portStr
		const bounds = shapeBoundsMap.get(shapeId)
		if (!bounds) continue

		const n = group.length
		const isH = port === "left" || port === "right"
		const available = isH ? bounds.height - 30 : bounds.width - 30
		const spacing = Math.min(25, available / Math.max(n - 1, 1))

		for (let i = 0; i < n; i++) {
			const term = group[i]
			if (!term) continue
			const offset = (i - (n - 1) / 2) * spacing
			let newPt: BpmnWaypoint
			if (port === "right") {
				newPt = { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 + offset }
			} else if (port === "left") {
				newPt = { x: bounds.x, y: bounds.y + bounds.height / 2 + offset }
			} else if (port === "bottom") {
				newPt = { x: bounds.x + bounds.width / 2 + offset, y: bounds.y + bounds.height }
			} else {
				newPt = { x: bounds.x + bounds.width / 2 + offset, y: bounds.y }
			}

			if (term.isSource) {
				newSrcTerminals.set(term.edgeIdx, newPt)
				newSrcPorts.set(term.edgeIdx, port)
			} else {
				newTgtTerminals.set(term.edgeIdx, newPt)
				newTgtPorts.set(term.edgeIdx, port)
			}
		}
	}

	if (newSrcTerminals.size === 0 && newTgtTerminals.size === 0) return edges

	const result = [...edges]
	for (let i = 0; i < result.length; i++) {
		const newSrcPt = newSrcTerminals.get(i)
		const newTgtPt = newTgtTerminals.get(i)
		if (!newSrcPt && !newTgtPt) continue

		const edge = result[i]
		if (!edge || edge.waypoints.length < 2) continue
		const flow = allFlows.get(edge.bpmnElement)
		if (!flow) continue
		const srcBounds = shapeBoundsMap.get(flow.sourceRef)
		const tgtBounds = shapeBoundsMap.get(flow.targetRef)
		if (!srcBounds || !tgtBounds) continue

		const firstWp = edge.waypoints[0]
		const lastWp = edge.waypoints[edge.waypoints.length - 1]
		if (!firstWp || !lastWp) continue

		const srcPt = newSrcPt ?? firstWp
		const tgtPt = newTgtPt ?? lastWp
		const srcPort = newSrcPorts.get(i) ?? portFromWaypoint(srcPt, srcBounds)
		const tgtPort = newTgtPorts.get(i) ?? portFromWaypoint(tgtPt, tgtBounds)

		// Compute obstacles for this edge (all shapes except its src and tgt)
		const obstacles: BpmnBounds[] = []
		for (const [shapeId, bounds] of shapeBoundsMap) {
			if (shapeId !== flow.sourceRef && shapeId !== flow.targetRef) {
				obstacles.push(bounds)
			}
		}

		const candidate = routeOrthogonal(srcPt, srcPort, tgtPt, tgtPort)
		// If the spread route passes through an obstacle, fall back to the obstacle-avoiding
		// route (which exits from the port midpoint, but never goes behind an element).
		result[i] = {
			...edge,
			waypoints: waypointsIntersectObstacles(candidate, obstacles)
				? computeWaypointsAvoiding(srcBounds, tgtBounds, obstacles)
				: candidate,
		}
	}

	return result
}

// ── Resize shape ──────────────────────────────────────────────────────────────

export function resizeShape(
	defs: BpmnDefinitions,
	id: string,
	newBounds: BpmnBounds,
): BpmnDefinitions {
	const process = defs.processes[0]
	const diagram = defs.diagrams[0]
	if (!process || !diagram) return defs

	const newShapes = diagram.plane.shapes.map((s) =>
		s.bpmnElement === id ? { ...s, bounds: newBounds } : s,
	)

	// Recompute terminal waypoints for connected edges
	const newEdges = diagram.plane.edges.map((edge) => {
		const flow = process.sequenceFlows.find((sf) => sf.id === edge.bpmnElement)
		if (!flow) return edge

		const isSource = flow.sourceRef === id
		const isTarget = flow.targetRef === id
		if (!isSource && !isTarget) return edge

		// Find the other shape's bounds
		const otherId = isSource ? flow.targetRef : flow.sourceRef
		const otherShape = diagram.plane.shapes.find((s) => s.bpmnElement === otherId)
		if (!otherShape) return edge

		const wps = isSource
			? computeWaypoints(newBounds, otherShape.bounds)
			: computeWaypoints(otherShape.bounds, newBounds)

		return { ...edge, waypoints: wps }
	})

	return {
		...defs,
		diagrams: [
			{
				...diagram,
				plane: { ...diagram.plane, shapes: newShapes, edges: newEdges },
			},
			...defs.diagrams.slice(1),
		],
	}
}

// ── Delete elements ───────────────────────────────────────────────────────────

export function deleteElements(defs: BpmnDefinitions, ids: string[]): BpmnDefinitions {
	if (ids.length === 0) return defs

	const idSet = new Set(ids)

	// Cascade: boundary events whose host is deleted are also deleted
	const process0 = defs.processes[0]
	if (process0) {
		for (const el of process0.flowElements) {
			if (el.type === "boundaryEvent" && idSet.has(el.attachedToRef)) {
				idSet.add(el.id)
			}
		}
	}

	// Cascade: descendants of deleted container elements are also deleted
	if (process0) {
		for (const el of process0.flowElements) {
			if (idSet.has(el.id)) collectDescendantIds(el, idSet)
		}
	}

	const process = defs.processes[0]
	const diagram = defs.diagrams[0]
	if (!process || !diagram) return defs

	// Find associations to remove (directly specified, or whose source/target is deleted)
	const assocsToRemove = new Set(
		process.associations
			.filter((a) => idSet.has(a.id) || idSet.has(a.sourceRef) || idSet.has(a.targetRef))
			.map((a) => a.id),
	)

	// Recursively remove elements and collect all removed flow IDs into allRemovedIds
	const allRemovedIds = new Set<string>(idSet)
	const { flowElements: newFlowElements, sequenceFlows: newSequenceFlows } = removeFromContainers(
		process.flowElements,
		process.sequenceFlows,
		idSet,
		allRemovedIds,
	)

	// Add association IDs for DI edge cleanup
	for (const aid of assocsToRemove) allRemovedIds.add(aid)

	// Remove text annotations and associations
	const newTextAnnotations = process.textAnnotations.filter((ta) => !idSet.has(ta.id))
	const newAssociations = process.associations.filter((a) => !assocsToRemove.has(a.id))

	// Remove DI shapes and edges
	const newDiShapes = diagram.plane.shapes.filter((s) => !idSet.has(s.bpmnElement))
	const newDiEdges = diagram.plane.edges.filter((e) => !allRemovedIds.has(e.bpmnElement))

	return {
		...defs,
		processes: [
			{
				...process,
				flowElements: newFlowElements,
				sequenceFlows: newSequenceFlows,
				textAnnotations: newTextAnnotations,
				associations: newAssociations,
			},
			...defs.processes.slice(1),
		],
		diagrams: [
			{
				...diagram,
				plane: { ...diagram.plane, shapes: newDiShapes, edges: newDiEdges },
			},
			...defs.diagrams.slice(1),
		],
	}
}

// ── Update label ──────────────────────────────────────────────────────────────

export function updateLabel(defs: BpmnDefinitions, id: string, name: string): BpmnDefinitions {
	const process = defs.processes[0]
	if (!process) return defs

	// Check flow elements and sequence flows (recursive — handles subprocess children)
	const r = updateNameInElements(process.flowElements, process.sequenceFlows, id, name)
	if (r.updated) {
		return {
			...defs,
			processes: [
				{ ...process, flowElements: r.elements, sequenceFlows: r.flows },
				...defs.processes.slice(1),
			],
		}
	}

	// Check text annotations (text field, not name)
	const taIndex = process.textAnnotations.findIndex((ta) => ta.id === id)
	if (taIndex >= 0) {
		const newAnnotations = [...process.textAnnotations]
		const ta = newAnnotations[taIndex]
		if (ta) {
			newAnnotations[taIndex] = { ...ta, text: name }
		}
		return {
			...defs,
			processes: [{ ...process, textAnnotations: newAnnotations }, ...defs.processes.slice(1)],
		}
	}

	return defs
}

// ── Update label position ─────────────────────────────────────────────────────

/** Updates the DI label bounds for a shape (sets explicit external label position). */
export function updateLabelPosition(
	defs: BpmnDefinitions,
	shapeId: string,
	labelBounds: BpmnBounds,
): BpmnDefinitions {
	const diagram = defs.diagrams[0]
	if (!diagram) return defs

	const newShapes = diagram.plane.shapes.map((s) =>
		s.bpmnElement === shapeId ? { ...s, label: { bounds: labelBounds } } : s,
	)

	return {
		...defs,
		diagrams: [
			{ ...diagram, plane: { ...diagram.plane, shapes: newShapes } },
			...defs.diagrams.slice(1),
		],
	}
}

// ── Update edge endpoint ──────────────────────────────────────────────────────

/**
 * Reconnects one endpoint of an edge to a different port on the same
 * source or target shape, recomputing the orthogonal route.
 */
export function updateEdgeEndpoint(
	defs: BpmnDefinitions,
	edgeId: string,
	isStart: boolean,
	newPort: PortDir,
): BpmnDefinitions {
	const process = defs.processes[0]
	const diagram = defs.diagrams[0]
	if (!process || !diagram) return defs

	const edge = diagram.plane.edges.find((e) => e.bpmnElement === edgeId)
	if (!edge || edge.waypoints.length < 2) return defs

	const flow = process.sequenceFlows.find((sf) => sf.id === edgeId)
	if (!flow) return defs

	const srcShape = diagram.plane.shapes.find((s) => s.bpmnElement === flow.sourceRef)
	const tgtShape = diagram.plane.shapes.find((s) => s.bpmnElement === flow.targetRef)
	if (!srcShape || !tgtShape) return defs

	const first = edge.waypoints[0]
	const last = edge.waypoints[edge.waypoints.length - 1]
	if (!first || !last) return defs

	const srcPort = isStart ? newPort : portFromWaypoint(first, srcShape.bounds)
	const tgtPort = isStart ? portFromWaypoint(last, tgtShape.bounds) : newPort

	const newWaypoints = computeWaypointsWithPorts(srcShape.bounds, srcPort, tgtShape.bounds, tgtPort)

	const newEdges = diagram.plane.edges.map((e) =>
		e.bpmnElement === edgeId ? { ...e, waypoints: newWaypoints } : e,
	)

	return {
		...defs,
		diagrams: [
			{ ...diagram, plane: { ...diagram.plane, edges: newEdges } },
			...defs.diagrams.slice(1),
		],
	}
}

// ── Edge segment / waypoint manipulation ──────────────────────────────────────

/**
 * Moves an orthogonal edge segment perpendicularly by `delta` units.
 * For horizontal segments delta shifts Y; for vertical segments delta shifts X.
 * Both waypoints of the segment move together, stretching adjacent segments.
 */
export function moveEdgeSegment(
	defs: BpmnDefinitions,
	edgeId: string,
	segIdx: number,
	isHoriz: boolean,
	delta: number,
): BpmnDefinitions {
	const diagram = defs.diagrams[0]
	if (!diagram) return defs
	const edge = diagram.plane.edges.find((e) => e.bpmnElement === edgeId)
	if (!edge || segIdx >= edge.waypoints.length - 1) return defs
	const newWaypoints = edge.waypoints.map((wp, i) => {
		if (i === segIdx || i === segIdx + 1) {
			return isHoriz ? { ...wp, y: wp.y + delta } : { ...wp, x: wp.x + delta }
		}
		return wp
	})
	const newEdges = diagram.plane.edges.map((e) =>
		e.bpmnElement === edgeId ? { ...e, waypoints: newWaypoints } : e,
	)
	return {
		...defs,
		diagrams: [
			{ ...diagram, plane: { ...diagram.plane, edges: newEdges } },
			...defs.diagrams.slice(1),
		],
	}
}

/**
 * Inserts a new waypoint between waypoints[segIdx] and waypoints[segIdx+1].
 * Used for free-form bend creation (diagonal movement allowed).
 */
export function insertEdgeWaypoint(
	defs: BpmnDefinitions,
	edgeId: string,
	segIdx: number,
	pt: { x: number; y: number },
): BpmnDefinitions {
	const diagram = defs.diagrams[0]
	if (!diagram) return defs
	const edge = diagram.plane.edges.find((e) => e.bpmnElement === edgeId)
	if (!edge) return defs
	const newWaypoints = [
		...edge.waypoints.slice(0, segIdx + 1),
		pt,
		...edge.waypoints.slice(segIdx + 1),
	]
	const newEdges = diagram.plane.edges.map((e) =>
		e.bpmnElement === edgeId ? { ...e, waypoints: newWaypoints } : e,
	)
	return {
		...defs,
		diagrams: [
			{ ...diagram, plane: { ...diagram.plane, edges: newEdges } },
			...defs.diagrams.slice(1),
		],
	}
}

/**
 * Moves a single intermediate waypoint (by index) to a new position.
 * Start (0) and end (last) waypoints are not moveable via this function.
 */
export function moveEdgeWaypoint(
	defs: BpmnDefinitions,
	edgeId: string,
	wpIdx: number,
	pt: { x: number; y: number },
): BpmnDefinitions {
	const diagram = defs.diagrams[0]
	if (!diagram) return defs
	const edge = diagram.plane.edges.find((e) => e.bpmnElement === edgeId)
	if (!edge || wpIdx <= 0 || wpIdx >= edge.waypoints.length - 1) return defs
	const newWaypoints = edge.waypoints.map((wp, i) => (i === wpIdx ? { ...pt } : wp))
	const newEdges = diagram.plane.edges.map((e) =>
		e.bpmnElement === edgeId ? { ...e, waypoints: newWaypoints } : e,
	)
	return {
		...defs,
		diagrams: [
			{ ...diagram, plane: { ...diagram.plane, edges: newEdges } },
			...defs.diagrams.slice(1),
		],
	}
}

/**
 * Removes intermediate waypoints that lie exactly on the straight line between
 * their neighbours. Runs iteratively until no more collinear waypoints remain.
 */
export function removeCollinearWaypoints(defs: BpmnDefinitions, edgeId: string): BpmnDefinitions {
	const diagram = defs.diagrams[0]
	if (!diagram) return defs
	const edge = diagram.plane.edges.find((e) => e.bpmnElement === edgeId)
	if (!edge || edge.waypoints.length < 3) return defs

	const EPS = 1.0
	let waypoints = [...edge.waypoints]
	let changed = true
	while (changed) {
		changed = false
		const filtered: BpmnWaypoint[] = [waypoints[0] as BpmnWaypoint]
		for (let i = 1; i < waypoints.length - 1; i++) {
			const a = waypoints[i - 1] as BpmnWaypoint
			const b = waypoints[i] as BpmnWaypoint
			const c = waypoints[i + 1] as BpmnWaypoint
			const cross = Math.abs((c.x - a.x) * (b.y - a.y) - (b.x - a.x) * (c.y - a.y))
			if (cross < EPS) {
				changed = true
			} else {
				filtered.push(b)
			}
		}
		filtered.push(waypoints[waypoints.length - 1] as BpmnWaypoint)
		waypoints = filtered
	}

	const newEdges = diagram.plane.edges.map((e) =>
		e.bpmnElement === edgeId ? { ...e, waypoints } : e,
	)
	return {
		...defs,
		diagrams: [
			{ ...diagram, plane: { ...diagram.plane, edges: newEdges } },
			...defs.diagrams.slice(1),
		],
	}
}

// ── Change element type ───────────────────────────────────────────────────────

/**
 * Replaces a flow element's type while preserving its id, name, and connections.
 * Use this for gateway type-switching (exclusive ↔ parallel) and task type-switching.
 */
export function changeElementType(
	defs: BpmnDefinitions,
	id: string,
	newType: CreateShapeType,
): BpmnDefinitions {
	const process = defs.processes[0]
	if (!process) return defs

	const elIndex = process.flowElements.findIndex((el) => el.id === id)
	if (elIndex < 0) return defs
	const el = process.flowElements[elIndex]
	if (!el) return defs

	const base = {
		id: el.id,
		name: el.name,
		incoming: el.incoming,
		outgoing: el.outgoing,
		extensionElements: el.extensionElements,
		unknownAttributes: el.unknownAttributes,
	}

	let newEl: BpmnFlowElement
	switch (newType) {
		case "startEvent":
			newEl = { ...base, type: "startEvent", eventDefinitions: [] }
			break
		case "messageStartEvent":
			newEl = { ...base, type: "startEvent", eventDefinitions: [{ type: "message" }] }
			break
		case "timerStartEvent":
			newEl = { ...base, type: "startEvent", eventDefinitions: [{ type: "timer" }] }
			break
		case "conditionalStartEvent":
			newEl = { ...base, type: "startEvent", eventDefinitions: [{ type: "conditional" }] }
			break
		case "signalStartEvent":
			newEl = { ...base, type: "startEvent", eventDefinitions: [{ type: "signal" }] }
			break
		case "endEvent":
			newEl = { ...base, type: "endEvent", eventDefinitions: [] }
			break
		case "messageEndEvent":
			newEl = { ...base, type: "endEvent", eventDefinitions: [{ type: "message" }] }
			break
		case "escalationEndEvent":
			newEl = { ...base, type: "endEvent", eventDefinitions: [{ type: "escalation" }] }
			break
		case "errorEndEvent":
			newEl = { ...base, type: "endEvent", eventDefinitions: [{ type: "error" }] }
			break
		case "compensationEndEvent":
			newEl = { ...base, type: "endEvent", eventDefinitions: [{ type: "compensate" }] }
			break
		case "signalEndEvent":
			newEl = { ...base, type: "endEvent", eventDefinitions: [{ type: "signal" }] }
			break
		case "terminateEndEvent":
			newEl = { ...base, type: "endEvent", eventDefinitions: [{ type: "terminate" }] }
			break
		case "intermediateThrowEvent":
			newEl = { ...base, type: "intermediateThrowEvent", eventDefinitions: [] }
			break
		case "intermediateCatchEvent":
			newEl = { ...base, type: "intermediateCatchEvent", eventDefinitions: [] }
			break
		case "messageCatchEvent":
			newEl = { ...base, type: "intermediateCatchEvent", eventDefinitions: [{ type: "message" }] }
			break
		case "messageThrowEvent":
			newEl = { ...base, type: "intermediateThrowEvent", eventDefinitions: [{ type: "message" }] }
			break
		case "timerCatchEvent":
			newEl = { ...base, type: "intermediateCatchEvent", eventDefinitions: [{ type: "timer" }] }
			break
		case "escalationThrowEvent":
			newEl = {
				...base,
				type: "intermediateThrowEvent",
				eventDefinitions: [{ type: "escalation" }],
			}
			break
		case "conditionalCatchEvent":
			newEl = {
				...base,
				type: "intermediateCatchEvent",
				eventDefinitions: [{ type: "conditional" }],
			}
			break
		case "linkCatchEvent":
			newEl = { ...base, type: "intermediateCatchEvent", eventDefinitions: [{ type: "link" }] }
			break
		case "linkThrowEvent":
			newEl = { ...base, type: "intermediateThrowEvent", eventDefinitions: [{ type: "link" }] }
			break
		case "compensationThrowEvent":
			newEl = {
				...base,
				type: "intermediateThrowEvent",
				eventDefinitions: [{ type: "compensate" }],
			}
			break
		case "signalCatchEvent":
			newEl = { ...base, type: "intermediateCatchEvent", eventDefinitions: [{ type: "signal" }] }
			break
		case "signalThrowEvent":
			newEl = { ...base, type: "intermediateThrowEvent", eventDefinitions: [{ type: "signal" }] }
			break
		case "task":
			newEl = { ...base, type: "task" }
			break
		case "serviceTask":
			newEl = { ...base, type: "serviceTask" }
			break
		case "userTask":
			newEl = { ...base, type: "userTask" }
			break
		case "scriptTask":
			newEl = { ...base, type: "scriptTask" }
			break
		case "sendTask":
			newEl = { ...base, type: "sendTask" }
			break
		case "receiveTask":
			newEl = { ...base, type: "receiveTask" }
			break
		case "businessRuleTask":
			newEl = { ...base, type: "businessRuleTask" }
			break
		case "manualTask":
			newEl = { ...base, type: "manualTask" }
			break
		case "callActivity":
			newEl = { ...base, type: "callActivity" }
			break
		case "subProcess":
			newEl = {
				...base,
				type: "subProcess",
				flowElements: el.type === "subProcess" ? el.flowElements : [],
				sequenceFlows: el.type === "subProcess" ? el.sequenceFlows : [],
				textAnnotations: el.type === "subProcess" ? el.textAnnotations : [],
				associations: el.type === "subProcess" ? el.associations : [],
			}
			break
		case "adHocSubProcess":
			newEl = {
				...base,
				type: "adHocSubProcess",
				flowElements: el.type === "adHocSubProcess" ? el.flowElements : [],
				sequenceFlows: el.type === "adHocSubProcess" ? el.sequenceFlows : [],
				textAnnotations: el.type === "adHocSubProcess" ? el.textAnnotations : [],
				associations: el.type === "adHocSubProcess" ? el.associations : [],
			}
			break
		case "transaction":
			newEl = {
				...base,
				type: "transaction",
				flowElements: el.type === "transaction" ? el.flowElements : [],
				sequenceFlows: el.type === "transaction" ? el.sequenceFlows : [],
				textAnnotations: el.type === "transaction" ? el.textAnnotations : [],
				associations: el.type === "transaction" ? el.associations : [],
			}
			break
		case "exclusiveGateway":
			newEl = { ...base, type: "exclusiveGateway" }
			break
		case "parallelGateway":
			newEl = { ...base, type: "parallelGateway" }
			break
		case "inclusiveGateway":
			newEl = { ...base, type: "inclusiveGateway" }
			break
		case "eventBasedGateway":
			newEl = { ...base, type: "eventBasedGateway" }
			break
		case "complexGateway":
			newEl = { ...base, type: "complexGateway" }
			break
		case "textAnnotation":
			throw new Error("textAnnotation is not a flow element — use createAnnotation()")
	}

	const newElements = [...process.flowElements]
	newElements[elIndex] = newEl

	return {
		...defs,
		processes: [{ ...process, flowElements: newElements }, ...defs.processes.slice(1)],
	}
}

// ── Insert shape on edge ──────────────────────────────────────────────────────

/**
 * Splits an existing sequence flow by inserting a shape between its source and
 * target: removes the original edge and creates two new connections
 * (source → shapeId and shapeId → target).
 */
export function insertShapeOnEdge(
	defs: BpmnDefinitions,
	edgeId: string,
	shapeId: string,
): BpmnDefinitions {
	const process = defs.processes[0]
	const diagram = defs.diagrams[0]
	if (!process || !diagram) return defs

	const flow = process.sequenceFlows.find((sf) => sf.id === edgeId)
	if (!flow) return defs

	const srcDi = diagram.plane.shapes.find((s) => s.bpmnElement === flow.sourceRef)
	const tgtDi = diagram.plane.shapes.find((s) => s.bpmnElement === flow.targetRef)
	const newDi = diagram.plane.shapes.find((s) => s.bpmnElement === shapeId)
	if (!srcDi || !tgtDi || !newDi) return defs

	const withoutEdge = deleteElements(defs, [edgeId])
	const r1 = createConnection(
		withoutEdge,
		flow.sourceRef,
		shapeId,
		computeWaypoints(srcDi.bounds, newDi.bounds),
	)
	const r2 = createConnection(
		r1.defs,
		shapeId,
		flow.targetRef,
		computeWaypoints(newDi.bounds, tgtDi.bounds),
	)
	return r2.defs
}

// ── Copy / paste ──────────────────────────────────────────────────────────────

export interface Clipboard {
	elements: BpmnFlowElement[]
	flows: BpmnSequenceFlow[]
	shapes: BpmnDiShape[]
	edges: BpmnDiEdge[]
}

export function copyElements(defs: BpmnDefinitions, ids: string[]): Clipboard {
	const idSet = new Set(ids)

	const process = defs.processes[0]
	const diagram = defs.diagrams[0]
	if (!process || !diagram) {
		return { elements: [], flows: [], shapes: [], edges: [] }
	}

	const elements = process.flowElements.filter((el) => idSet.has(el.id))
	const flows = process.sequenceFlows.filter(
		(sf) => idSet.has(sf.sourceRef) && idSet.has(sf.targetRef),
	)
	const flowIds = new Set(flows.map((sf) => sf.id))
	const shapes = diagram.plane.shapes.filter((s) => idSet.has(s.bpmnElement))
	const edges = diagram.plane.edges.filter((e) => flowIds.has(e.bpmnElement))

	return { elements, flows, shapes, edges }
}

export function pasteElements(
	defs: BpmnDefinitions,
	clipboard: Clipboard,
	offsetX: number,
	offsetY: number,
): { defs: BpmnDefinitions; newIds: Map<string, string> } {
	const newIds = new Map<string, string>()

	// Generate new IDs for elements
	for (const el of clipboard.elements) {
		newIds.set(el.id, genId(el.type))
	}
	for (const sf of clipboard.flows) {
		newIds.set(sf.id, genId("Flow"))
	}

	const process = defs.processes[0]
	const diagram = defs.diagrams[0]
	if (!process || !diagram) return { defs, newIds }

	// Create new flow elements with new IDs, offset positions handled via DI
	const newElements: BpmnFlowElement[] = clipboard.elements.map((el) => {
		const newId = newIds.get(el.id) ?? genId(el.type)
		const newIncoming = el.incoming
			.map((ref) => newIds.get(ref))
			.filter((r): r is string => r !== undefined)
		const newOutgoing = el.outgoing
			.map((ref) => newIds.get(ref))
			.filter((r): r is string => r !== undefined)
		return { ...el, id: newId, incoming: newIncoming, outgoing: newOutgoing }
	})

	// Create new sequence flows
	const newFlows: BpmnSequenceFlow[] = clipboard.flows.map((sf) => {
		const newId = newIds.get(sf.id) ?? genId("Flow")
		const newSrc = newIds.get(sf.sourceRef) ?? sf.sourceRef
		const newTgt = newIds.get(sf.targetRef) ?? sf.targetRef
		return { ...sf, id: newId, sourceRef: newSrc, targetRef: newTgt }
	})

	// Create new DI shapes with offset
	const newDiShapes: BpmnDiShape[] = clipboard.shapes.map((s) => {
		const newElId = newIds.get(s.bpmnElement) ?? s.bpmnElement
		return {
			...s,
			id: genId(`${newElId}_di`),
			bpmnElement: newElId,
			bounds: {
				...s.bounds,
				x: s.bounds.x + offsetX,
				y: s.bounds.y + offsetY,
			},
		}
	})

	// Create new DI edges with offset waypoints
	const newDiEdges: BpmnDiEdge[] = clipboard.edges.map((e) => {
		const newFlowId = newIds.get(e.bpmnElement) ?? e.bpmnElement
		return {
			...e,
			id: genId(`${newFlowId}_di`),
			bpmnElement: newFlowId,
			waypoints: e.waypoints.map((wp) => ({
				x: wp.x + offsetX,
				y: wp.y + offsetY,
			})),
		}
	})

	const newDefs: BpmnDefinitions = {
		...defs,
		processes: [
			{
				...process,
				flowElements: [...process.flowElements, ...newElements],
				sequenceFlows: [...process.sequenceFlows, ...newFlows],
			},
			...defs.processes.slice(1),
		],
		diagrams: [
			{
				...diagram,
				plane: {
					...diagram.plane,
					shapes: [...diagram.plane.shapes, ...newDiShapes],
					edges: [...diagram.plane.edges, ...newDiEdges],
				},
			},
			...defs.diagrams.slice(1),
		],
	}

	return { defs: newDefs, newIds }
}

// ── Create text annotation ────────────────────────────────────────────────────

export function createAnnotation(
	defs: BpmnDefinitions,
	bounds: BpmnBounds,
	text?: string,
): { defs: BpmnDefinitions; id: string } {
	const id = genId("TextAnnotation")
	const shapeId = genId("TextAnnotation_di")

	const annotation: BpmnTextAnnotation = { id, text, unknownAttributes: {} }
	const diShape: BpmnDiShape = { id: shapeId, bpmnElement: id, bounds, unknownAttributes: {} }

	const process = defs.processes[0]
	if (!process) return { defs, id }
	const diagram = defs.diagrams[0]
	if (!diagram) return { defs, id }

	return {
		defs: {
			...defs,
			processes: [
				{ ...process, textAnnotations: [...process.textAnnotations, annotation] },
				...defs.processes.slice(1),
			],
			diagrams: [
				{
					...diagram,
					plane: { ...diagram.plane, shapes: [...diagram.plane.shapes, diShape] },
				},
				...defs.diagrams.slice(1),
			],
		},
		id,
	}
}

export function createAnnotationWithLink(
	defs: BpmnDefinitions,
	bounds: BpmnBounds,
	sourceId: string,
	sourceBounds: BpmnBounds,
	text?: string,
): { defs: BpmnDefinitions; annotationId: string; associationId: string } {
	const annotResult = createAnnotation(defs, bounds, text)
	const annotationId = annotResult.id
	const assocId = genId("Association")
	const edgeId = genId("Association_di")

	const assoc: BpmnAssociation = {
		id: assocId,
		sourceRef: sourceId,
		targetRef: annotationId,
		associationDirection: "None",
		unknownAttributes: {},
	}
	const waypoints = computeWaypoints(sourceBounds, bounds)
	const edge: BpmnDiEdge = { id: edgeId, bpmnElement: assocId, waypoints, unknownAttributes: {} }

	const d = annotResult.defs
	const process = d.processes[0]
	const diagram = d.diagrams[0]
	if (!process || !diagram) return { defs: d, annotationId, associationId: assocId }

	return {
		defs: {
			...d,
			processes: [
				{ ...process, associations: [...process.associations, assoc] },
				...d.processes.slice(1),
			],
			diagrams: [
				{
					...diagram,
					plane: { ...diagram.plane, edges: [...diagram.plane.edges, edge] },
				},
				...d.diagrams.slice(1),
			],
		},
		annotationId,
		associationId: assocId,
	}
}

// ── Update shape color ────────────────────────────────────────────────────────

export function updateShapeColor(
	defs: BpmnDefinitions,
	id: string,
	color: DiColor,
): BpmnDefinitions {
	const diagram = defs.diagrams[0]
	if (!diagram) return defs

	const newShapes = diagram.plane.shapes.map((s) =>
		s.bpmnElement === id
			? { ...s, unknownAttributes: writeDiColor(s.unknownAttributes, color) }
			: s,
	)

	// Add color namespaces when any color is set
	const needsNs = !!(color.fill ?? color.stroke)
	const newNamespaces = needsNs
		? { ...defs.namespaces, bioc: BIOC_NS, color: COLOR_NS }
		: defs.namespaces

	return {
		...defs,
		namespaces: newNamespaces,
		diagrams: [
			{ ...diagram, plane: { ...diagram.plane, shapes: newShapes } },
			...defs.diagrams.slice(1),
		],
	}
}
