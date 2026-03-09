import { generateId } from "../../types/id-generator.js"
import type {
	BpmnCallActivity,
	BpmnDefinitions,
	BpmnDiEdge,
	BpmnDiShape,
	BpmnDiagram,
	BpmnEndEvent,
	BpmnProcess,
	BpmnServiceTask,
	BpmnStartEvent,
} from "../bpmn-model.js"
import type { OptimizationFinding, ResolvedOptions } from "./types.js"
import {
	findProcess,
	readZeebeIoMapping,
	readZeebeTaskHeaders,
	readZeebeTaskType,
} from "./utils.js"

// ---------------------------------------------------------------------------
// Similarity scoring
// ---------------------------------------------------------------------------

function sameHeaderKeys(a: BpmnServiceTask, b: BpmnServiceTask): boolean {
	const ha = readZeebeTaskHeaders(a.extensionElements)
	const hb = readZeebeTaskHeaders(b.extensionElements)
	const keysA = new Set((ha?.headers ?? []).map((h) => h.key))
	const keysB = new Set((hb?.headers ?? []).map((h) => h.key))
	if (keysA.size !== keysB.size) return false
	for (const k of keysA) {
		if (!keysB.has(k)) return false
	}
	return true
}

function sameIoInputs(a: BpmnServiceTask, b: BpmnServiceTask): boolean {
	const ia = readZeebeIoMapping(a.extensionElements)
	const ib = readZeebeIoMapping(b.extensionElements)
	const inputsA = ia?.inputs ?? []
	const inputsB = ib?.inputs ?? []
	if (inputsA.length !== inputsB.length) return false
	const targetsA = inputsA.map((i) => i.target).sort()
	const targetsB = inputsB.map((i) => i.target).sort()
	return targetsA.every((t, idx) => t === targetsB[idx])
}

function sameIoOutputs(a: BpmnServiceTask, b: BpmnServiceTask): boolean {
	const ia = readZeebeIoMapping(a.extensionElements)
	const ib = readZeebeIoMapping(b.extensionElements)
	const outputsA = ia?.outputs ?? []
	const outputsB = ib?.outputs ?? []
	if (outputsA.length !== outputsB.length) return false
	const targetsA = outputsA.map((o) => o.target).sort()
	const targetsB = outputsB.map((o) => o.target).sort()
	return targetsA.every((t, idx) => t === targetsB[idx])
}

/** Returns similarity score [0, 1] or null if taskTypes differ. */
function computeSimilarity(a: BpmnServiceTask, b: BpmnServiceTask): number | null {
	const typeA = readZeebeTaskType(a.extensionElements)
	const typeB = readZeebeTaskType(b.extensionElements)
	if (typeA === null || typeB === null || typeA !== typeB) return null

	let score = 0.5 // Same taskType
	if (sameHeaderKeys(a, b)) score += 0.2
	if (sameIoInputs(a, b)) score += 0.15
	if (sameIoOutputs(a, b)) score += 0.15
	return score
}

/** Cluster service tasks into connected components above the similarity threshold. */
function cluster(tasks: BpmnServiceTask[], threshold: number): BpmnServiceTask[][] {
	const n = tasks.length
	const visited = new Array<boolean>(n).fill(false)
	const clusters: BpmnServiceTask[][] = []

	for (let i = 0; i < n; i++) {
		if (visited[i]) continue
		const group: BpmnServiceTask[] = []
		const queue = [i]
		visited[i] = true

		while (queue.length > 0) {
			const curr = queue.shift()
			if (curr === undefined) break
			const task = tasks[curr]
			if (task === undefined) break
			group.push(task)

			for (let j = 0; j < n; j++) {
				if (visited[j]) continue
				const other = tasks[j]
				if (other === undefined) continue
				const score = computeSimilarity(task, other)
				if (score !== null && score >= threshold) {
					visited[j] = true
					queue.push(j)
				}
			}
		}

		clusters.push(group)
	}

	return clusters
}

// ---------------------------------------------------------------------------
// Build the extracted BpmnDefinitions
// ---------------------------------------------------------------------------

function buildExtractedDefs(
	representative: BpmnServiceTask,
	newProcessId: string,
): BpmnDefinitions {
	const startId = generateId("StartEvent")
	const taskId = generateId("ServiceTask")
	const endId = generateId("EndEvent")
	const flow1Id = generateId("Flow")
	const flow2Id = generateId("Flow")

	const startEvent: BpmnStartEvent = {
		type: "startEvent",
		id: startId,
		incoming: [],
		outgoing: [flow1Id],
		extensionElements: [],
		unknownAttributes: {},
		eventDefinitions: [],
	}

	const serviceTask: BpmnServiceTask = {
		type: "serviceTask",
		id: taskId,
		name: representative.name,
		incoming: [flow1Id],
		outgoing: [flow2Id],
		extensionElements: [...representative.extensionElements],
		unknownAttributes: {},
	}

	const endEvent: BpmnEndEvent = {
		type: "endEvent",
		id: endId,
		incoming: [flow2Id],
		outgoing: [],
		extensionElements: [],
		unknownAttributes: {},
		eventDefinitions: [],
	}

	const extractedProcess: BpmnProcess = {
		id: newProcessId,
		isExecutable: false,
		extensionElements: [],
		flowElements: [startEvent, serviceTask, endEvent],
		sequenceFlows: [
			{
				id: flow1Id,
				sourceRef: startId,
				targetRef: taskId,
				extensionElements: [],
				unknownAttributes: {},
			},
			{
				id: flow2Id,
				sourceRef: taskId,
				targetRef: endId,
				extensionElements: [],
				unknownAttributes: {},
			},
		],
		textAnnotations: [],
		associations: [],
		unknownAttributes: {},
	}

	// Layout: start @ x=152, task @ x=260, end @ x=432, all y=100
	const startShape: BpmnDiShape = {
		id: `${startId}_di`,
		bpmnElement: startId,
		bounds: { x: 152, y: 100, width: 36, height: 36 },
		unknownAttributes: {},
	}
	const taskShape: BpmnDiShape = {
		id: `${taskId}_di`,
		bpmnElement: taskId,
		bounds: { x: 260, y: 100, width: 100, height: 80 },
		unknownAttributes: {},
	}
	const endShape: BpmnDiShape = {
		id: `${endId}_di`,
		bpmnElement: endId,
		bounds: { x: 432, y: 100, width: 36, height: 36 },
		unknownAttributes: {},
	}

	const flow1Edge: BpmnDiEdge = {
		id: `${flow1Id}_di`,
		bpmnElement: flow1Id,
		waypoints: [
			{ x: 188, y: 118 },
			{ x: 260, y: 118 },
		],
		unknownAttributes: {},
	}
	const flow2Edge: BpmnDiEdge = {
		id: `${flow2Id}_di`,
		bpmnElement: flow2Id,
		waypoints: [
			{ x: 360, y: 118 },
			{ x: 432, y: 118 },
		],
		unknownAttributes: {},
	}

	const diagram: BpmnDiagram = {
		id: generateId("BPMNDiagram"),
		plane: {
			id: generateId("BPMNPlane"),
			bpmnElement: newProcessId,
			shapes: [startShape, taskShape, endShape],
			edges: [flow1Edge, flow2Edge],
		},
	}

	return {
		id: generateId("Definitions"),
		targetNamespace: "http://bpmn.io/schema/bpmn",
		namespaces: {},
		unknownAttributes: {},
		errors: [],
		escalations: [],
		messages: [],
		collaborations: [],
		processes: [extractedProcess],
		diagrams: [diagram],
	}
}

// ---------------------------------------------------------------------------
// Task reuse analyzer
// ---------------------------------------------------------------------------

export function analyzeTasks(p: BpmnProcess, opts: ResolvedOptions): OptimizationFinding[] {
	const findings: OptimizationFinding[] = []
	const processId = p.id

	const serviceTasks = p.flowElements.filter(
		(el): el is BpmnServiceTask => el.type === "serviceTask",
	)

	if (serviceTasks.length < 2) return findings

	const groups = cluster(serviceTasks, 0.7).filter((g) => g.length >= opts.reuseThreshold)

	for (const group of groups) {
		const representative = group[0]
		if (!representative) continue

		const taskType = readZeebeTaskType(representative.extensionElements) ?? "Unknown"
		const elementIds = group.map((t) => t.id)

		findings.push({
			id: "task/reusable-group",
			category: "task-reuse",
			severity: "warning",
			message: `${group.length} service tasks share a similar configuration (taskType="${taskType}") and could be reused via a call activity.`,
			suggestion:
				"Extract the repeated service task into a reusable sub-process and replace occurrences with call activities.",
			processId,
			elementIds,
			applyFix: (defs: BpmnDefinitions) => {
				const proc = findProcess(defs, processId)
				if (!proc) return { description: "Process not found" }

				const newProcessId = `Reusable_${taskType}_${generateId("proc")}`
				const generated = buildExtractedDefs(representative, newProcessId)

				// Replace each task in the group with a call activity
				for (const taskId of elementIds) {
					const orig = proc.flowElements.find((e) => e.id === taskId)
					if (!orig || orig.type !== "serviceTask") continue

					const callActivity: BpmnCallActivity = {
						type: "callActivity",
						id: orig.id,
						name: orig.name,
						incoming: [...orig.incoming],
						outgoing: [...orig.outgoing],
						extensionElements: [
							{
								name: "zeebe:calledElement",
								attributes: { processId: newProcessId },
								children: [],
							},
						],
						unknownAttributes: {},
					}

					proc.flowElements = proc.flowElements.map((e) => (e.id === taskId ? callActivity : e))
				}

				return {
					description: `Extracted ${group.length} service tasks to call activity referencing "${newProcessId}"`,
					generated,
				}
			},
		})
	}

	return findings
}
