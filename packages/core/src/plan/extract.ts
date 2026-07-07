/**
 * Lifts an existing `BpmnDefinitions` process back into `ProcessPlan` form,
 * so `/bpmnkit:extend`-style skills can express a delta instead of
 * regenerating a whole process.
 *
 * Scope (documented, not silently exceeded): linear chains of tasks/events,
 * plus a single level of exclusive/parallel/inclusive gateway branches that
 * reconverge to a common next element. Sub-processes, ad-hoc sub-processes
 * (including AI Agent sub-processes), nested gateways, pools/lanes, and data
 * objects are not lifted — they are reported in `unsupported` rather than
 * silently dropped or guessed at. Use `mergePlan()` to add new steps to a
 * process without needing to fully extract it first.
 */
import type {
	BpmnDefinitions,
	BpmnFlowElement,
	BpmnProcess,
	BpmnSequenceFlow,
} from "../bpmn/bpmn-model.js"
import {
	readZeebeIoMapping,
	readZeebeTaskHeaders,
	readZeebeTaskType,
} from "../bpmn/optimize/utils.js"
import type { PlanBranch, PlanStep, ProcessPlan } from "./types.js"

export interface UnsupportedElement {
	id: string
	type: string
	reason: string
}

export interface ExtractResult {
	plan: ProcessPlan
	unsupported: UnsupportedElement[]
}

function ioMappingToRecords(ext: BpmnFlowElement["extensionElements"]): {
	inputs?: Record<string, string>
	outputs?: Record<string, string>
} {
	const io = readZeebeIoMapping(ext)
	if (!io) return {}
	const inputs: Record<string, string> = {}
	for (const i of io.inputs) inputs[i.target] = i.source
	const outputs: Record<string, string> = {}
	for (const o of io.outputs) outputs[o.target] = o.source
	return {
		inputs: Object.keys(inputs).length > 0 ? inputs : undefined,
		outputs: Object.keys(outputs).length > 0 ? outputs : undefined,
	}
}

function taskHeadersOf(
	ext: BpmnFlowElement["extensionElements"],
): Record<string, string> | undefined {
	const h = readZeebeTaskHeaders(ext)
	if (!h || h.headers.length === 0) return undefined
	const out: Record<string, string> = {}
	for (const entry of h.headers) out[entry.key] = entry.value
	return out
}

function findExt(el: BpmnFlowElement, name: string) {
	return el.extensionElements.find((e) => e.name === name)
}

function extractStep(
	el: BpmnFlowElement,
	unsupported: UnsupportedElement[],
	rootErrors: BpmnDefinitions["errors"],
): PlanStep | undefined {
	const base = { id: el.id, name: el.name, documentation: el.documentation }
	switch (el.type) {
		case "startEvent":
			return { ...base, kind: "start" }
		case "endEvent": {
			const errorDef = el.eventDefinitions.find((d) => d.type === "error")
			const errorCode = errorDef
				? rootErrors.find((e) => e.id === errorDef.errorRef)?.errorCode
				: undefined
			const terminate = el.eventDefinitions.some((d) => d.type === "terminate")
			return { ...base, kind: "end", errorCode, terminate: terminate || undefined }
		}
		case "serviceTask": {
			const jobType = readZeebeTaskType(el.extensionElements)
			if (!jobType) {
				unsupported.push({
					id: el.id,
					type: el.type,
					reason: "service task has no zeebe:taskDefinition type",
				})
				return undefined
			}
			return {
				...base,
				kind: "serviceTask",
				jobType,
				taskHeaders: taskHeadersOf(el.extensionElements),
				...ioMappingToRecords(el.extensionElements),
			}
		}
		case "userTask": {
			const assignment = findExt(el, "zeebe:assignmentDefinition")
			const schedule = findExt(el, "zeebe:taskSchedule")
			const priority = findExt(el, "zeebe:priorityDefinition")
			const form = findExt(el, "zeebe:formDefinition")
			return {
				...base,
				kind: "userTask",
				formId: form?.attributes.formId,
				assignee: assignment?.attributes.assignee,
				candidateGroups: assignment?.attributes.candidateGroups,
				candidateUsers: assignment?.attributes.candidateUsers,
				dueDate: schedule?.attributes.dueDate,
				followUpDate: schedule?.attributes.followUpDate,
				priority: priority?.attributes.priority ? Number(priority.attributes.priority) : undefined,
			}
		}
		case "businessRuleTask": {
			const decision = findExt(el, "zeebe:calledDecision")
			if (!decision) {
				unsupported.push({
					id: el.id,
					type: el.type,
					reason: "business rule task has no zeebe:calledDecision",
				})
				return undefined
			}
			return {
				...base,
				kind: "businessRuleTask",
				decisionId: decision.attributes.decisionId ?? "",
				resultVariable: decision.attributes.resultVariable,
			}
		}
		case "callActivity": {
			const called = findExt(el, "zeebe:calledElement")
			return {
				...base,
				kind: "callActivity",
				processId: called?.attributes.processId ?? "",
				propagateAllChildVariables: called?.attributes.propagateAllChildVariables === "true",
			}
		}
		default:
			unsupported.push({
				id: el.id,
				type: el.type,
				reason: `element type "${el.type}" is not liftable yet`,
			})
			return undefined
	}
}

/**
 * Extracts a single BPMN process into `ProcessPlan` form. Handles linear
 * chains and a single level of gateway branching that reconverges; anything
 * else is listed in `unsupported`, not fabricated.
 */
export function extractPlan(defs: BpmnDefinitions, processId?: string): ExtractResult {
	const process: BpmnProcess | undefined = processId
		? defs.processes.find((p) => p.id === processId)
		: defs.processes[0]

	if (!process) {
		return {
			plan: { version: 1, process: { id: processId ?? "unknown" }, steps: [] },
			unsupported: [{ id: processId ?? "unknown", type: "process", reason: "process not found" }],
		}
	}

	const unsupported: UnsupportedElement[] = []
	const bySource = new Map<string, BpmnSequenceFlow[]>()
	for (const flow of process.sequenceFlows) {
		const list = bySource.get(flow.sourceRef) ?? []
		list.push(flow)
		bySource.set(flow.sourceRef, list)
	}
	const byId = new Map(process.flowElements.map((e) => [e.id, e]))

	const start = process.flowElements.find((e) => e.type === "startEvent")
	if (!start) {
		return {
			plan: { version: 1, process: { id: process.id, name: process.name }, steps: [] },
			unsupported: [{ id: process.id, type: "process", reason: "no start event" }],
		}
	}

	const steps: PlanStep[] = []
	const visited = new Set<string>()

	function walkFrom(elementId: string): void {
		let currentId: string | undefined = elementId
		while (currentId && !visited.has(currentId)) {
			visited.add(currentId)
			const el = byId.get(currentId)
			if (!el) return
			const outgoing: BpmnSequenceFlow[] = bySource.get(currentId) ?? []

			const isGatewayType =
				el.type === "exclusiveGateway" ||
				el.type === "parallelGateway" ||
				el.type === "inclusiveGateway"

			// A gateway with at most one outgoing flow makes no decision — it's a
			// join the compiler auto-inserted (or an equivalent pass-through), not
			// something the plan format needs to represent as a step.
			if (isGatewayType && outgoing.length <= 1) {
				currentId = outgoing[0]?.targetRef
				continue
			}

			if (isGatewayType) {
				const gatewayType =
					el.type === "exclusiveGateway"
						? "exclusive"
						: el.type === "parallelGateway"
							? "parallel"
							: "inclusive"
				const branches: PlanBranch[] = []
				for (const flow of outgoing) {
					const branchSteps: PlanStep[] = []
					const branchVisited = new Set<string>()
					let branchCursor: string | undefined = flow.targetRef
					while (branchCursor && !visited.has(branchCursor) && !branchVisited.has(branchCursor)) {
						const branchEl = byId.get(branchCursor)
						if (!branchEl) break
						const branchOutgoing: BpmnSequenceFlow[] = bySource.get(branchCursor) ?? []
						const branchElIsGateway =
							branchEl.type === "exclusiveGateway" ||
							branchEl.type === "parallelGateway" ||
							branchEl.type === "inclusiveGateway"
						// A gateway with ≤1 outgoing flow here is the join this split
						// reconverges to — stop the branch walk without consuming it, so
						// the outer walk's convergence scan can pick it up.
						if (branchElIsGateway && branchOutgoing.length <= 1) break
						if (branchOutgoing.length > 1) {
							unsupported.push({
								id: branchCursor,
								type: branchEl.type,
								reason: "nested gateway inside a branch is not liftable yet",
							})
							branchVisited.add(branchCursor)
							break
						}
						branchVisited.add(branchCursor)
						const step = extractStep(branchEl, unsupported, defs.errors)
						if (step) branchSteps.push(step)
						branchCursor = branchOutgoing[0]?.targetRef
					}
					for (const id of branchVisited) visited.add(id)
					branches.push({
						condition: flow.conditionExpression?.text,
						default:
							el.type === "exclusiveGateway" || el.type === "inclusiveGateway"
								? flow.id === el.default
								: undefined,
						steps: branchSteps,
					})
				}
				steps.push({ id: el.id, name: el.name, kind: "gateway", gatewayType, branches })
				// All branches reconverge (or dead-end) — continue from the common next element, if any.
				const convergent = [...visited]
					.flatMap((id) => bySource.get(id) ?? [])
					.find((f) => !visited.has(f.targetRef))
				currentId = convergent?.targetRef
				continue
			}

			if (outgoing.length > 1) {
				unsupported.push({
					id: el.id,
					type: el.type,
					reason: "multiple outgoing flows on a non-gateway element",
				})
				return
			}

			const step = extractStep(el, unsupported, defs.errors)
			if (step) steps.push(step)
			currentId = outgoing[0]?.targetRef
		}
	}

	walkFrom(start.id)

	for (const el of process.flowElements) {
		if (!visited.has(el.id) && el.type !== "boundaryEvent") {
			unsupported.push({
				id: el.id,
				type: el.type,
				reason: "not reachable from the linear/branching walk",
			})
		}
	}

	return {
		plan: { version: 1, process: { id: process.id, name: process.name }, steps },
		unsupported,
	}
}
