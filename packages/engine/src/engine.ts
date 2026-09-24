import type {
	BpmnDefinitions,
	BpmnProcess,
	DmnDecision,
	DmnDefinitions,
	FormDefinition,
} from "@bpmnkit/core"
import { ProcessInstance } from "./instance.js"
import type { EventRefs, InstanceHost, ParentLink } from "./instance.js"
import type { SecretResolver } from "./secrets.js"
import type { JobHandler } from "./types.js"

/** Options for {@link Engine.start}. */
export interface StartOptions {
	/**
	 * Hook called just before each element completes. Return a Promise to pause
	 * execution at that point — useful for step-by-step simulation.
	 */
	beforeComplete?: (elementId: string) => Promise<void>
}

/** Options for the {@link Engine} constructor. */
export interface EngineOptions {
	/** Resolver for `{{secrets.NAME}}` placeholders in connector configurations. */
	secretResolver?: SecretResolver
}

export class Engine {
	private readonly processes = new Map<string, BpmnProcess>()
	private readonly decisions = new Map<string, DmnDecision>()
	private readonly forms = new Map<string, FormDefinition>()
	private readonly workers = new Map<string, JobHandler>()
	private readonly secretResolver: SecretResolver | undefined
	private readonly refs = {
		messages: new Map<string, string>(),
		signals: new Map<string, string>(),
		errors: new Map<string, string>(),
		escalations: new Map<string, string>(),
		messageCorrelationKeys: new Map<string, string>(),
	} satisfies EventRefs
	/** Instances started by this engine that may still be running — signal broadcast targets. */
	private readonly running = new Set<ProcessInstance>()
	private readonly host: InstanceHost = {
		processes: this.processes,
		refs: this.refs,
		broadcastSignal: (name, variables) => {
			this.broadcastSignal(name, variables)
		},
		startChild: (process, variables, beforeComplete, parent) =>
			this.launch(process, variables, { beforeComplete, parent }),
	}

	constructor(options?: EngineOptions) {
		this.secretResolver = options?.secretResolver
	}

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
				for (const m of def.messages) {
					if (m.name !== undefined) this.refs.messages.set(m.id, m.name)
					const key = m.extensionElements?.find((e) => e.name === "zeebe:subscription")?.attributes
						.correlationKey
					if (key !== undefined) this.refs.messageCorrelationKeys.set(m.id, key)
				}
				for (const s of def.signals) {
					if (s.name !== undefined) this.refs.signals.set(s.id, s.name)
				}
				for (const e of def.errors) {
					if (e.errorCode !== undefined) this.refs.errors.set(e.id, e.errorCode)
				}
				for (const e of def.escalations) {
					if (e.escalationCode !== undefined) this.refs.escalations.set(e.id, e.escalationCode)
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
		return this.launch(process, variables ?? {}, { beforeComplete: options?.beforeComplete })
	}

	/**
	 * Broadcast a signal to every running instance of this engine — child
	 * instances of call activities included — and start an instance of every
	 * deployed process whose top-level signal start event matches. `signalName`
	 * matches a signal's `name`, or its id when it has no name.
	 *
	 * Returns the instances the signal started.
	 */
	broadcastSignal(signalName: string, variables?: Record<string, unknown>): ProcessInstance[] {
		for (const instance of [...this.running]) {
			if (instance.state !== "active") {
				this.running.delete(instance)
				continue
			}
			instance.deliverSignal(signalName, variables)
		}

		const started: ProcessInstance[] = []
		for (const process of this.processes.values()) {
			for (const el of process.flowElements) {
				if (el.type !== "startEvent" || el.incoming.length > 0) continue
				const def = el.eventDefinitions[0]
				if (def?.type !== "signal") continue
				const ref = def.signalRef ?? el.id
				if (ref !== signalName && this.refs.signals.get(ref) !== signalName) continue
				started.push(this.launch(process, { ...variables }, { startEventId: el.id }))
			}
		}
		return started
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

	private launch(
		process: BpmnProcess,
		variables: Record<string, unknown>,
		options: {
			beforeComplete?: (elementId: string) => Promise<void>
			parent?: ParentLink
			startEventId?: string
		},
	): ProcessInstance {
		// Finished instances are dropped here rather than through an onChange
		// listener: any listener makes every instance build FEEL evaluation events.
		for (const instance of this.running) {
			if (instance.state !== "active") this.running.delete(instance)
		}
		const instance = new ProcessInstance(
			process,
			this.decisions,
			this.forms,
			this.workers,
			variables,
			this.secretResolver,
			this.host,
			options.parent,
		)
		if (options.beforeComplete !== undefined) {
			instance.beforeComplete = options.beforeComplete
		}
		this.running.add(instance)
		instance.start(options.startEventId)
		return instance
	}
}
