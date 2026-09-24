import type { BpmnFlowElement, BpmnProcess, BpmnSequenceFlow } from "@bpmnkit/core"

/** How much of one kind of model element the runs reached. */
export interface CoverageCount {
	readonly total: number
	readonly covered: number
	/** `covered / total` as a percentage, 100 when there is nothing to cover. */
	readonly percent: number
	/** Ids never reached, in model order. */
	readonly uncovered: readonly string[]
}

/** Coverage of one deployed process. */
export interface ProcessCoverage {
	readonly processId: string
	/** Flow nodes (events, activities, gateways — including those inside sub-processes) entered. */
	readonly elements: CoverageCount
	/** Sequence flows taken. */
	readonly flows: CoverageCount
}

/** Coverage across every run of a {@link ProcessTest}. */
export interface CoverageReport {
	readonly processes: readonly ProcessCoverage[]
	readonly elements: CoverageCount
	readonly flows: CoverageCount
}

/** Data elements sit in the process but never hold a token. */
const NOT_FLOW_NODES: ReadonlySet<BpmnFlowElement["type"]> = new Set([
	"dataObject",
	"dataObjectReference",
	"dataStoreReference",
])

interface ProcessIndex {
	readonly processId: string
	readonly elementIds: string[]
	readonly flowIds: string[]
}

/** The graph facts coverage needs, read once from the deployed processes. */
export class CoverageIndex {
	private readonly processes: ProcessIndex[] = []
	/** targetRef → flows into it */
	private readonly incoming = new Map<string, BpmnSequenceFlow[]>()
	/** Parallel gateways with more than one incoming flow — they only fire once all arrive. */
	private readonly joins = new Set<string>()

	constructor(processes: readonly BpmnProcess[]) {
		for (const process of processes) {
			const index: ProcessIndex = { processId: process.id, elementIds: [], flowIds: [] }
			this.collect(process.flowElements, process.sequenceFlows, index)
			this.processes.push(index)
		}
	}

	private collect(
		elements: BpmnFlowElement[],
		flows: BpmnSequenceFlow[],
		into: ProcessIndex,
	): void {
		for (const el of elements) {
			if (NOT_FLOW_NODES.has(el.type)) continue
			into.elementIds.push(el.id)
			if (el.type === "parallelGateway" && el.incoming.length > 1) this.joins.add(el.id)
			if ("flowElements" in el && "sequenceFlows" in el) {
				this.collect(el.flowElements, el.sequenceFlows, into)
			}
		}
		for (const flow of flows) {
			into.flowIds.push(flow.id)
			const list = this.incoming.get(flow.targetRef)
			if (list) list.push(flow)
			else this.incoming.set(flow.targetRef, [flow])
		}
	}

	/**
	 * The flows that brought a token to `elementId`. The simulator's events do not
	 * name the flow, so it is inferred: a join fires on all of its incoming flows,
	 * anything else on the incoming flow whose source completed most recently.
	 */
	flowsInto(elementId: string, lastLeft: ReadonlyMap<string, number>): string[] {
		const incoming = this.incoming.get(elementId)
		if (incoming === undefined) return []
		if (this.joins.has(elementId)) return incoming.map((f) => f.id)
		let best: BpmnSequenceFlow | undefined
		let bestSeq = -1
		for (const flow of incoming) {
			const seq = lastLeft.get(flow.sourceRef)
			if (seq !== undefined && seq > bestSeq) {
				best = flow
				bestSeq = seq
			}
		}
		return best === undefined ? [] : [best.id]
	}

	report(elements: ReadonlySet<string>, flows: ReadonlySet<string>): CoverageReport {
		const processes = this.processes.map((p) => ({
			processId: p.processId,
			elements: count(p.elementIds, elements),
			flows: count(p.flowIds, flows),
		}))
		return {
			processes,
			elements: count(
				this.processes.flatMap((p) => p.elementIds),
				elements,
			),
			flows: count(
				this.processes.flatMap((p) => p.flowIds),
				flows,
			),
		}
	}
}

function count(ids: readonly string[], reached: ReadonlySet<string>): CoverageCount {
	const uncovered = ids.filter((id) => !reached.has(id))
	const covered = ids.length - uncovered.length
	return {
		total: ids.length,
		covered,
		percent: ids.length === 0 ? 100 : Math.round((covered / ids.length) * 1000) / 10,
		uncovered,
	}
}

/**
 * A plain-text summary of a coverage report, one block per process — suitable
 * for `console.log` in an `afterAll`.
 */
export function formatCoverage(report: CoverageReport): string {
	const line = (label: string, c: CoverageCount) =>
		`${label} ${c.covered}/${c.total} (${c.percent.toFixed(1)}%)`
	const out = ["BPMN coverage"]
	for (const p of report.processes) {
		out.push(`  ${p.processId}  ${line("elements", p.elements)}  ${line("flows", p.flows)}`)
		if (p.elements.uncovered.length > 0) {
			out.push(`    elements not reached: ${p.elements.uncovered.join(", ")}`)
		}
		if (p.flows.uncovered.length > 0) {
			out.push(`    flows not taken: ${p.flows.uncovered.join(", ")}`)
		}
	}
	if (report.processes.length > 1) {
		out.push(`  total  ${line("elements", report.elements)}  ${line("flows", report.flows)}`)
	}
	return out.join("\n")
}
