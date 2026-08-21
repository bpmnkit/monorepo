import {
	Bpmn,
	type BpmnDefinitions,
	type BpmnFlowElement,
	type BpmnSequenceFlow,
	type BpmnWaypoint,
	type LayoutEngine,
	applyAutoLayout,
} from "@bpmnkit/core"
import kycOnboarding from "./layout-samples/kyc-onboarding.bpmn?raw"
import kycRiskClassification from "./layout-samples/kyc-risk-classification.bpmn?raw"
import kycVerification from "./layout-samples/kyc-verification.bpmn?raw"
import loanPrescreening from "./layout-samples/loan-prescreening.bpmn?raw"
import quoteToCash from "./layout-samples/quote-to-cash.bpmn?raw"

export interface LayoutSample {
	id: string
	title: string
	/** What makes this diagram awkward to lay out. */
	blurb: string
	/** Model-only BPMN — no diagram interchange, so both engines start from nothing. */
	xml: string
}

/**
 * Process models taken from the BPMN generation demo recordings, with their
 * diagram interchange stripped. Both engines lay them out from scratch.
 */
export const SAMPLES: LayoutSample[] = [
	{
		id: "loan-prescreening",
		title: "Loan pre-screening",
		blurb:
			"A rejection path that rejoins an end event placed earlier in the flow — the classic case where a route ends up running back through a task.",
		xml: loanPrescreening,
	},
	{
		id: "kyc-verification",
		title: "KYC verification with retry",
		blurb:
			"A retry loop plus three terminal outcomes. Branch order decides whether the outcomes stack cleanly or tangle around the happy path.",
		xml: kycVerification,
	},
	{
		id: "kyc-onboarding",
		title: "KYC onboarding with due diligence",
		blurb:
			"Two nested decisions feeding four end events. Every branch has to find a lane of its own on the way out.",
		xml: kycOnboarding,
	},
	{
		id: "kyc-risk-classification",
		title: "KYC risk classification",
		blurb:
			"Twenty-one elements, two rejoins and a retry loop — the densest of the five, and the one that gains the most from ranking the happy path first.",
		xml: kycRiskClassification,
	},
	{
		id: "quote-to-cash",
		title: "Quote-to-cash with dunning",
		blurb:
			"Two expanded sub-processes and a collections escalation, so edges have large obstacles to route around rather than through.",
		xml: quoteToCash,
	},
]

export interface LayoutStats {
	/** Pairs of segments from different edges that intersect. */
	crossings: number
	/** Edge segments that run across a shape they neither start nor end at. */
	overlaps: number
	/** Non-loop flows drawn right-to-left, against the reading direction. */
	backwards: number
	/** Total orthogonal edge length, in diagram units. */
	length: number
	/** Waypoints that are neither the start nor the end of an edge. */
	bends: number
}

export function layoutWith(xml: string, engine: LayoutEngine): BpmnDefinitions {
	return applyAutoLayout(Bpmn.parse(xml), engine)
}

/**
 * Ids of expanded sub-processes: edges are expected to pass over them, so they
 * are excluded from the overlap count. Every sample here is a plain process —
 * a sample with pools or lanes would need those ids collected too.
 */
function containerIds(defs: BpmnDefinitions): Set<string> {
	const ids = new Set<string>()
	const walk = (elements: BpmnFlowElement[]): void => {
		for (const element of elements) {
			if ("flowElements" in element) {
				ids.add(element.id)
				walk(element.flowElements)
			}
		}
	}
	for (const process of defs.processes) walk(process.flowElements)
	return ids
}

function allFlows(defs: BpmnDefinitions): BpmnSequenceFlow[] {
	const flows: BpmnSequenceFlow[] = []
	const walk = (elements: BpmnFlowElement[], own: BpmnSequenceFlow[]): void => {
		flows.push(...own)
		for (const element of elements)
			if ("flowElements" in element) walk(element.flowElements, element.sequenceFlows)
	}
	for (const process of defs.processes) walk(process.flowElements, process.sequenceFlows)
	return flows
}

/**
 * Flows whose target can reach their source again — genuine loops, which any
 * engine has to draw right-to-left. Everything else drawn right-to-left is a
 * flow-order violation.
 */
function loopFlows(flows: BpmnSequenceFlow[]): Set<string> {
	const next = new Map<string, string[]>()
	for (const flow of flows) {
		const targets = next.get(flow.sourceRef)
		if (targets) targets.push(flow.targetRef)
		else next.set(flow.sourceRef, [flow.targetRef])
	}
	const loops = new Set<string>()
	for (const flow of flows) {
		const seen = new Set<string>([flow.targetRef])
		const stack = [flow.targetRef]
		while (stack.length > 0) {
			const node = stack.pop()
			if (node === undefined) break
			if (node === flow.sourceRef) {
				loops.add(flow.id)
				break
			}
			for (const target of next.get(node) ?? [])
				if (!seen.has(target)) {
					seen.add(target)
					stack.push(target)
				}
		}
	}
	return loops
}

function intersects(
	p1: BpmnWaypoint,
	p2: BpmnWaypoint,
	p3: BpmnWaypoint,
	p4: BpmnWaypoint,
): boolean {
	const cross = (x1: number, y1: number, x2: number, y2: number): number => x1 * y2 - y1 * x2
	const r = { x: p2.x - p1.x, y: p2.y - p1.y }
	const s = { x: p4.x - p3.x, y: p4.y - p3.y }
	const denominator = cross(r.x, r.y, s.x, s.y)
	if (denominator === 0) return false
	const t = cross(p3.x - p1.x, p3.y - p1.y, s.x, s.y) / denominator
	const u = cross(p3.x - p1.x, p3.y - p1.y, r.x, r.y) / denominator
	// Strictly interior on both segments: shared endpoints are not crossings.
	return t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6
}

function overlapsBox(
	a: BpmnWaypoint,
	b: BpmnWaypoint,
	box: { x: number; y: number; width: number; height: number },
): boolean {
	// Inset so an edge docking flush against a border does not count as a hit.
	const inset = 3
	const left = box.x + inset
	const right = box.x + box.width - inset
	const top = box.y + inset
	const bottom = box.y + box.height - inset
	if (right <= left || bottom <= top) return false
	return (
		Math.min(a.x, b.x) < right &&
		Math.max(a.x, b.x) > left &&
		Math.min(a.y, b.y) < bottom &&
		Math.max(a.y, b.y) > top
	)
}

/** Measure one laid-out diagram, plane by plane so sub-process planes stay separate. */
export function measure(defs: BpmnDefinitions): LayoutStats {
	const containers = containerIds(defs)
	const flows = allFlows(defs)
	const flowById = new Map(flows.map((flow) => [flow.id, flow]))
	const loops = loopFlows(flows)
	const stats: LayoutStats = { crossings: 0, overlaps: 0, backwards: 0, length: 0, bends: 0 }

	for (const diagram of defs.diagrams) {
		const segments: Array<{ from: BpmnWaypoint; to: BpmnWaypoint; edge: string }> = []
		for (const edge of diagram.plane.edges)
			for (let i = 1; i < edge.waypoints.length; i++) {
				const from = edge.waypoints[i - 1]
				const to = edge.waypoints[i]
				if (from && to) segments.push({ from, to, edge: edge.bpmnElement })
			}

		for (let i = 0; i < segments.length; i++)
			for (let j = i + 1; j < segments.length; j++) {
				const a = segments[i]
				const b = segments[j]
				if (!a || !b || a.edge === b.edge) continue
				if (intersects(a.from, a.to, b.from, b.to)) stats.crossings++
			}

		for (const { from, to } of segments)
			stats.length += Math.abs(from.x - to.x) + Math.abs(from.y - to.y)

		const solids = diagram.plane.shapes.filter((shape) => !containers.has(shape.bpmnElement))
		const boundsById = new Map(
			diagram.plane.shapes.map((shape) => [shape.bpmnElement, shape.bounds]),
		)

		for (const edge of diagram.plane.edges) {
			stats.bends += Math.max(0, edge.waypoints.length - 2)
			const flow = flowById.get(edge.bpmnElement)

			for (let i = 1; i < edge.waypoints.length; i++) {
				const from = edge.waypoints[i - 1]
				const to = edge.waypoints[i]
				if (!from || !to) continue
				for (const shape of solids) {
					if (
						flow &&
						(shape.bpmnElement === flow.sourceRef || shape.bpmnElement === flow.targetRef)
					)
						continue
					if (overlapsBox(from, to, shape.bounds)) {
						stats.overlaps++
						break
					}
				}
			}

			if (!flow || loops.has(flow.id)) continue
			const source = boundsById.get(flow.sourceRef)
			const target = boundsById.get(flow.targetRef)
			if (source && target && target.x + target.width <= source.x) stats.backwards++
		}
	}

	stats.length = Math.round(stats.length)
	return stats
}
