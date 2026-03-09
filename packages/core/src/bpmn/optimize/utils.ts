import type { XmlElement } from "../../types/xml-element.js"
import type {
	BpmnDefinitions,
	BpmnDiPlane,
	BpmnElementType,
	BpmnFlowElement,
	BpmnProcess,
	BpmnSequenceFlow,
} from "../bpmn-model.js"
import type { ZeebeIoMapping, ZeebeTaskHeaders } from "../zeebe-extensions.js"

// ---------------------------------------------------------------------------
// Extension readers
// ---------------------------------------------------------------------------

export function readZeebeTaskType(ext: XmlElement[]): string | null {
	for (const el of ext) {
		if (el.name === "zeebe:taskDefinition") {
			return el.attributes.type ?? null
		}
	}
	return null
}

export function readZeebeIoMapping(ext: XmlElement[]): ZeebeIoMapping | null {
	for (const el of ext) {
		if (el.name === "zeebe:ioMapping") {
			const inputs: { source: string; target: string }[] = []
			const outputs: { source: string; target: string }[] = []
			for (const child of el.children) {
				if (child.name === "zeebe:input") {
					inputs.push({
						source: child.attributes.source ?? "",
						target: child.attributes.target ?? "",
					})
				} else if (child.name === "zeebe:output") {
					outputs.push({
						source: child.attributes.source ?? "",
						target: child.attributes.target ?? "",
					})
				}
			}
			return { inputs, outputs }
		}
	}
	return null
}

export function readZeebeTaskHeaders(ext: XmlElement[]): ZeebeTaskHeaders | null {
	for (const el of ext) {
		if (el.name === "zeebe:taskHeaders") {
			const headers: { key: string; value: string }[] = []
			for (const child of el.children) {
				if (child.name === "zeebe:header") {
					headers.push({
						key: child.attributes.key ?? "",
						value: child.attributes.value ?? "",
					})
				}
			}
			return { headers }
		}
	}
	return null
}

// ---------------------------------------------------------------------------
// Flow graph
// ---------------------------------------------------------------------------

export interface FlowIndex {
	byId: Map<string, BpmnFlowElement>
	bySource: Map<string, BpmnSequenceFlow[]>
	byTarget: Map<string, BpmnSequenceFlow[]>
}

export function buildFlowIndex(p: BpmnProcess): FlowIndex {
	const byId = new Map<string, BpmnFlowElement>()
	const bySource = new Map<string, BpmnSequenceFlow[]>()
	const byTarget = new Map<string, BpmnSequenceFlow[]>()

	for (const el of p.flowElements) {
		byId.set(el.id, el)
	}
	for (const flow of p.sequenceFlows) {
		const srcList = bySource.get(flow.sourceRef) ?? []
		srcList.push(flow)
		bySource.set(flow.sourceRef, srcList)

		const tgtList = byTarget.get(flow.targetRef) ?? []
		tgtList.push(flow)
		byTarget.set(flow.targetRef, tgtList)
	}
	return { byId, bySource, byTarget }
}

export function reachableFrom(
	startIds: string[],
	bySource: Map<string, BpmnSequenceFlow[]>,
): Set<string> {
	const visited = new Set<string>(startIds)
	const queue = [...startIds]
	while (queue.length > 0) {
		const current = queue.shift()
		if (current === undefined) break
		const outflows = bySource.get(current) ?? []
		for (const flow of outflows) {
			if (!visited.has(flow.targetRef)) {
				visited.add(flow.targetRef)
				queue.push(flow.targetRef)
			}
		}
	}
	return visited
}

export function isGateway(type: BpmnElementType): boolean {
	return (
		type === "exclusiveGateway" ||
		type === "inclusiveGateway" ||
		type === "complexGateway" ||
		type === "parallelGateway" ||
		type === "eventBasedGateway"
	)
}

export function isEndEvent(type: BpmnElementType): boolean {
	return type === "endEvent"
}

export function isStartEvent(type: BpmnElementType): boolean {
	return type === "startEvent"
}

// ---------------------------------------------------------------------------
// Mutation helpers
// ---------------------------------------------------------------------------

export function insertElement(p: BpmnProcess, el: BpmnFlowElement): void {
	p.flowElements.push(el)
}

export function removeElement(p: BpmnProcess, id: string): void {
	p.flowElements = p.flowElements.filter((e) => e.id !== id)
}

export function insertFlow(p: BpmnProcess, flow: BpmnSequenceFlow): void {
	p.sequenceFlows.push(flow)
}

export function removeFlow(p: BpmnProcess, id: string): void {
	p.sequenceFlows = p.sequenceFlows.filter((f) => f.id !== id)
}

export function findProcess(defs: BpmnDefinitions, processId: string): BpmnProcess | null {
	for (const p of defs.processes) {
		if (p.id === processId) return p
	}
	return null
}

export function findDiPlane(defs: BpmnDefinitions, processId: string): BpmnDiPlane | null {
	for (const diagram of defs.diagrams) {
		if (diagram.plane.bpmnElement === processId) return diagram.plane
	}
	return null
}
