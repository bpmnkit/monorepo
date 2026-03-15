import type { BpmnDefinitions, DmnDecision, DmnDefinitions, FormDefinition } from "@bpmnkit/core"
import { ProcessInstance } from "./instance.js"
import type { JobHandler } from "./types.js"

/** Options for {@link Engine.start}. */
export interface StartOptions {
	/**
	 * Hook called just before each element completes. Return a Promise to pause
	 * execution at that point — useful for step-by-step simulation.
	 */
	beforeComplete?: (elementId: string) => Promise<void>
}

export class Engine {
	private readonly processes = new Map<string, import("@bpmnkit/core").BpmnProcess>()
	private readonly decisions = new Map<string, DmnDecision>()
	private readonly forms = new Map<string, FormDefinition>()
	private readonly workers = new Map<string, JobHandler>()

	/**
	 * Deploy BPMN processes, DMN decisions, and form definitions.
	 * Calling deploy multiple times merges into the registry.
	 */
	deploy(d: {
		bpmn?: BpmnDefinitions | BpmnDefinitions[]
		forms?: FormDefinition | FormDefinition[]
		decisions?: DmnDefinitions | DmnDefinitions[]
	}): void {
		if (d.bpmn !== undefined) {
			const defs = Array.isArray(d.bpmn) ? d.bpmn : [d.bpmn]
			for (const def of defs) {
				for (const process of def.processes) {
					this.processes.set(process.id, process)
				}
			}
		}

		if (d.decisions !== undefined) {
			const defs = Array.isArray(d.decisions) ? d.decisions : [d.decisions]
			for (const def of defs) {
				for (const decision of def.decisions) {
					this.decisions.set(decision.id, decision)
				}
			}
		}

		if (d.forms !== undefined) {
			const defs = Array.isArray(d.forms) ? d.forms : [d.forms]
			for (const form of defs) {
				const id = (form as { id?: string }).id
				if (id !== undefined) this.forms.set(id, form)
			}
		}
	}

	/** Start a new process instance. Throws if processId is not deployed. */
	start(
		processId: string,
		variables?: Record<string, unknown>,
		options?: StartOptions,
	): ProcessInstance {
		const process = this.processes.get(processId)
		if (process === undefined) {
			throw new Error(`Process "${processId}" is not deployed`)
		}

		const instance = new ProcessInstance(
			process,
			this.decisions,
			this.forms,
			this.workers,
			variables ?? {},
		)
		if (options?.beforeComplete !== undefined) {
			instance.beforeComplete = options.beforeComplete
		}
		instance.start()
		return instance
	}

	/**
	 * Register a job worker for a given task type.
	 * Returns an unsubscribe function.
	 */
	registerJobWorker(type: string, handler: JobHandler): () => void {
		this.workers.set(type, handler)
		return () => {
			if (this.workers.get(type) === handler) this.workers.delete(type)
		}
	}

	/** Return all deployed process IDs. */
	getDeployedProcesses(): string[] {
		return [...this.processes.keys()]
	}
}
