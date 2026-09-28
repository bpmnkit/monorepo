import type {
	BpmnAssociation,
	BpmnBoundaryEvent,
	BpmnCompensateEventDefinition,
	BpmnEscalationEventDefinition,
	BpmnFlowElement,
	BpmnMultiInstanceLoopCharacteristics,
	BpmnProcess,
	BpmnSequenceFlow,
	BpmnSignalEventDefinition,
	BpmnStartEvent,
	DmnDecision,
	FormDefinition,
} from "@bpmnkit/core"
import { generateId } from "@bpmnkit/core"
import { evaluate, parseExpression } from "@bpmnkit/feel"
import type { FeelValue } from "@bpmnkit/feel"
import { adHocActivatableElements, describeAdHocElement } from "./ad-hoc.js"
import { evaluateDecision } from "./dmn.js"
import { resolveSecretString } from "./secrets.js"
import type { SecretResolver } from "./secrets.js"
import { scheduleTimer } from "./timers.js"
import type { Job, JobHandler, JobResult, ProcessEvent } from "./types.js"
import { VariableStore } from "./variables.js"
import { parseZeebeExt, parseZeebeLoop } from "./zeebe.js"
import type { ParsedZeebeExt } from "./zeebe.js"

// ── Engine-facing types ────────────────────────────────────────────────────────

/** Names and codes of the root-level definitions events refer to, keyed by id. */
export interface EventRefs {
	readonly messages: ReadonlyMap<string, string>
	readonly signals: ReadonlyMap<string, string>
	readonly errors: ReadonlyMap<string, string>
	readonly escalations: ReadonlyMap<string, string>
	/** Message id → the `zeebe:subscription` correlationKey expression on the message. */
	readonly messageCorrelationKeys: ReadonlyMap<string, string>
}

/** What an instance needs from the {@link Engine} that started it. */
export interface InstanceHost {
	readonly processes: ReadonlyMap<string, BpmnProcess>
	readonly refs: EventRefs
	broadcastSignal(name: string, variables: Record<string, unknown> | undefined): void
	startChild(
		process: BpmnProcess,
		variables: Record<string, unknown>,
		beforeComplete: ((elementId: string) => Promise<void>) | undefined,
		parent: ParentLink,
	): ProcessInstance
}

/** How a call activity's child instance hands an uncaught error or escalation to its caller. */
export interface ParentLink {
	/** Returns true when the calling instance caught it. */
	propagate(
		kind: "error" | "escalation",
		code: string,
		variables: Record<string, unknown> | undefined,
	): boolean
}

// ── Internal types ─────────────────────────────────────────────────────────────

interface Token {
	readonly id: string
	readonly elementId: string
	readonly scopeId: string
	/**
	 * Variable scope of the element itself: a child of `scopeId` holding its
	 * input mappings when it has an ioMapping, otherwise `scopeId`.
	 */
	readonly varScopeId: string
}

type InstanceState = "active" | "completed" | "terminated" | "failed"

type Vars = Record<string, unknown>

/** How a worker finished a job. */
type JobOutcome =
	| { readonly kind: "completed"; readonly result: JobResult | undefined }
	| { readonly kind: "failed"; readonly error: string }
	| { readonly kind: "thrown"; readonly code: string; readonly message: string }

/** How an element was entered when it was not simply reached over a sequence flow. */
type Entry =
	/** A catch event whose event already happened (after an event-based gateway). */
	| { readonly kind: "eventTriggered" }
	| { readonly kind: "eventSubProcess"; readonly startEventId: string }

/** Elements with a flow of their own inside. */
type Container = Extract<BpmnFlowElement, { flowElements: BpmnFlowElement[] }>

interface EventSubProcessDef {
	readonly container: Container
	readonly start: BpmnStartEvent
}

/** Execution context for a scope (process or sub-process). */
interface ScopeCtx {
	readonly scopeId: string
	readonly parentScopeId: string | undefined
	/** Resolve when this scope completes (used for sub-processes). */
	readonly onComplete: (() => void) | undefined
	/** All flow elements (flat) within this scope */
	readonly elements: Map<string, BpmnFlowElement>
	/** elementId → outgoing flows */
	readonly outgoing: Map<string, BpmnSequenceFlow[]>
	/** flowId → flow */
	readonly flows: Map<string, BpmnSequenceFlow>
	/** elementId → boundary events attached to it */
	readonly boundaries: Map<string, BpmnBoundaryEvent[]>
	/** Active tokens in this scope */
	readonly tokens: Set<string>
	/**
	 * Activations started but not yet holding a token. Without it, the first
	 * branch of a split that ends straight away would end the scope before its
	 * sibling branches are entered.
	 */
	pending: number
	/** Token of the activity this scope runs inside; undefined for the process scope. */
	readonly hostToken: Token | undefined
	/** activityId → the handler associated with its compensation boundary event. */
	readonly compensationHandlers: Map<string, BpmnFlowElement>
	readonly eventSubProcesses: EventSubProcessDef[]
	/** Run when the scope ends — event sub-process subscriptions and timers. */
	readonly cleanups: Array<() => void>
}

interface Subscription {
	readonly kind: "message" | "signal"
	/** The definition's name and id — a delivery matches either. */
	readonly keys: readonly string[]
	/** A message subscription's correlation key, evaluated when it opened. */
	readonly correlationKey: string | undefined
	readonly fire: (variables: Vars | undefined) => void
}

interface CompensationEntry {
	readonly activityId: string
	readonly handler: BpmnFlowElement
	readonly scopeId: string
	/** The scope and its ancestors, innermost first. */
	readonly scopePath: readonly string[]
}

function isEventSubProcess(el: BpmnFlowElement): el is Container {
	return el.type === "eventSubProcess" || (el.type === "subProcess" && el.triggeredByEvent === true)
}

function loopOf(el: BpmnFlowElement): BpmnMultiInstanceLoopCharacteristics | undefined {
	// An ad-hoc sub-process's loop characteristics configure its tool activations.
	if (el.type === "adHocSubProcess") return undefined
	return "loopCharacteristics" in el ? el.loopCharacteristics : undefined
}

// ── ProcessInstance ────────────────────────────────────────────────────────────

export class ProcessInstance {
	readonly id: string
	readonly processId: string

	private _state: InstanceState = "active"
	private _error: string | undefined

	/** tokenId → Token */
	private readonly allTokens = new Map<string, Token>()
	/** tokenId → what to undo when the token leaves: timers, subscriptions, child scopes. */
	private readonly tokenCleanups = new Map<string, Array<() => void>>()
	/** Zeebe extensions parsed once per element for the life of this instance. */
	private readonly zeebeExtCache = new WeakMap<BpmnFlowElement, ParsedZeebeExt>()

	/** Scope stack: rootScopeId + any active sub-process scopes */
	private readonly scopes = new Map<string, ScopeCtx>()

	/** Open message and signal subscriptions, in the order they were opened. */
	private readonly subscriptions = new Set<Subscription>()

	/** Completed activities with a compensation handler, in completion order. */
	private compensationLog: CompensationEntry[] = []

	/** Running child instances of call activities. */
	private readonly children = new Set<ProcessInstance>()

	/** Activation count per scope and element — used to detect infinite loops. */
	private readonly activationCount = new Map<string, number>()
	private static readonly MAX_ACTIVATIONS = 100

	private readonly variables: VariableStore
	private readonly rootScopeId: string

	private readonly listeners: Array<(e: ProcessEvent) => void> = []

	private readonly decisions: Map<string, DmnDecision>
	private readonly forms: Map<string, FormDefinition>
	private readonly jobWorkers: Map<string, JobHandler>
	private readonly secretResolver: SecretResolver | undefined
	private readonly host: InstanceHost | undefined
	private readonly parent: ParentLink | undefined

	/**
	 * Optional hook called just before an element completes (token moves on).
	 * Returning a Promise lets the caller pause execution — useful for
	 * step-by-step simulation. Set via {@link Engine.start} options.
	 */
	beforeComplete?: (elementId: string) => Promise<void>

	constructor(
		process: BpmnProcess,
		decisions: Map<string, DmnDecision>,
		forms: Map<string, FormDefinition>,
		jobWorkers: Map<string, JobHandler>,
		initialVars: Record<string, unknown>,
		secretResolver?: SecretResolver,
		host?: InstanceHost,
		parent?: ParentLink,
	) {
		this.id = generateId("pi")
		this.processId = process.id
		this.decisions = decisions
		this.forms = forms
		this.jobWorkers = jobWorkers
		this.secretResolver = secretResolver
		this.host = host
		this.parent = parent

		this.variables = new VariableStore()
		this.rootScopeId = `scope_${this.id}`
		this.variables.createScope(this.rootScopeId)
		for (const [k, v] of Object.entries(initialVars)) {
			this.variables.setLocal(this.rootScopeId, k, v)
		}

		const rootCtx = this.buildScopeCtx(
			this.rootScopeId,
			undefined,
			undefined,
			process.flowElements,
			process.sequenceFlows,
			process.associations,
			undefined,
		)
		this.scopes.set(this.rootScopeId, rootCtx)
	}

	// ── Public API ─────────────────────────────────────────────────────────────

	get state(): InstanceState {
		return this._state
	}

	get error(): string | undefined {
		return this._error
	}

	get activeElements(): string[] {
		return [...this.allTokens.values()].map((t) => t.elementId)
	}

	get variables_snapshot(): Record<string, unknown> {
		return this.variables.getAll(this.rootScopeId)
	}

	onChange(callback: (event: ProcessEvent) => void): () => void {
		this.listeners.push(callback)
		return () => {
			const idx = this.listeners.indexOf(callback)
			if (idx !== -1) this.listeners.splice(idx, 1)
		}
	}

	/** Stop the instance, its timers and subscriptions, and any child instances. */
	cancel(): void {
		this._state = "terminated"
		this.releaseAll(false)
	}

	/**
	 * Kick off execution. Called by Engine after construction. Without
	 * `startEventId`, the none start events run — or, when the process has
	 * none, every start event.
	 */
	start(startEventId?: string): void {
		const ctx = this.scopes.get(this.rootScopeId)
		if (ctx === undefined) return
		const starts = this.startEventsOf(ctx, startEventId)
		// Defer activation so callers can attach onChange listeners before events fire.
		void Promise.resolve().then(() => {
			if (this._state !== "active") return
			// Emit variable:set for initial variables so listeners (e.g. play panel) see them.
			for (const [name, value] of Object.entries(this.variables.getAll(this.rootScopeId))) {
				this.emit({ type: "variable:set", name, value, scopeId: this.rootScopeId })
			}
			this.armEventSubProcesses(ctx)
			void this.activateAll(
				starts.map((s) => ({ targetRef: s.id, id: undefined })),
				ctx,
				undefined,
			)
		})
	}

	/**
	 * Deliver a message to the oldest waiting subscription — a message catch
	 * event, message boundary event, event-based gateway branch or message
	 * event sub-process. `messageName` matches the message's `name`, or its id.
	 * With a `correlationKey`, only a subscription whose `zeebe:subscription`
	 * correlationKey — on the event or on its message, evaluated when the
	 * subscription opened — equals it receives the message.
	 * When nothing here waits for it, running call-activity children get it.
	 * Returns whether anything received the message.
	 */
	deliverMessage(
		messageName: string,
		variables?: Record<string, unknown>,
		correlationKey?: string,
	): boolean {
		for (const sub of this.subscriptions) {
			if (
				sub.kind === "message" &&
				sub.keys.includes(messageName) &&
				(correlationKey === undefined || sub.correlationKey === correlationKey)
			) {
				sub.fire(variables)
				return true
			}
		}
		for (const child of this.children) {
			if (child.state === "active" && child.deliverMessage(messageName, variables, correlationKey))
				return true
		}
		return false
	}

	/**
	 * Deliver a signal to every subscription of this instance. Use
	 * {@link Engine.broadcastSignal} to reach every instance of an engine.
	 * Returns whether anything caught the signal.
	 */
	deliverSignal(signalName: string, variables?: Record<string, unknown>): boolean {
		let caught = false
		for (const sub of [...this.subscriptions]) {
			// An earlier catch may have interrupted the scope this one belongs to.
			if (sub.kind !== "signal" || !sub.keys.includes(signalName) || !this.subscriptions.has(sub))
				continue
			caught = true
			sub.fire(variables)
		}
		return caught
	}

	// ── Scope building ─────────────────────────────────────────────────────────

	private buildScopeCtx(
		scopeId: string,
		parentScopeId: string | undefined,
		onComplete: (() => void) | undefined,
		elements: BpmnFlowElement[],
		flows: BpmnSequenceFlow[],
		associations: BpmnAssociation[],
		hostToken: Token | undefined,
	): ScopeCtx {
		const elemMap = new Map<string, BpmnFlowElement>()
		const outgoing = new Map<string, BpmnSequenceFlow[]>()
		const flowMap = new Map<string, BpmnSequenceFlow>()
		const boundaries = new Map<string, BpmnBoundaryEvent[]>()
		const eventSubProcesses: EventSubProcessDef[] = []

		for (const el of elements) {
			elemMap.set(el.id, el)
			if (el.type === "boundaryEvent") {
				const list = boundaries.get(el.attachedToRef) ?? []
				list.push(el)
				boundaries.set(el.attachedToRef, list)
			} else if (isEventSubProcess(el)) {
				const start = el.flowElements.find((e): e is BpmnStartEvent => e.type === "startEvent")
				if (start !== undefined) eventSubProcesses.push({ container: el, start })
			}
		}
		for (const flow of flows) {
			flowMap.set(flow.id, flow)
			const list = outgoing.get(flow.sourceRef) ?? []
			list.push(flow)
			outgoing.set(flow.sourceRef, list)
		}

		// A compensation boundary event is linked to its handler by an association, not a flow.
		const compensationHandlers = new Map<string, BpmnFlowElement>()
		for (const list of boundaries.values()) {
			for (const be of list) {
				if (be.eventDefinitions[0]?.type !== "compensate") continue
				const association = associations.find((a) => a.sourceRef === be.id)
				const handler = association !== undefined ? elemMap.get(association.targetRef) : undefined
				if (handler !== undefined) compensationHandlers.set(be.attachedToRef, handler)
			}
		}

		return {
			scopeId,
			parentScopeId,
			onComplete,
			elements: elemMap,
			outgoing,
			flows: flowMap,
			boundaries,
			tokens: new Set(),
			pending: 0,
			hostToken,
			compensationHandlers,
			eventSubProcesses,
			cleanups: [],
		}
	}

	private startEventsOf(ctx: ScopeCtx, startEventId: string | undefined): BpmnFlowElement[] {
		const starts = [...ctx.elements.values()].filter(
			(el) => el.type === "startEvent" && el.incoming.length === 0,
		)
		if (startEventId !== undefined) return starts.filter((s) => s.id === startEventId)
		const none = starts.filter((s) => s.type === "startEvent" && s.eventDefinitions.length === 0)
		return none.length > 0 ? none : starts
	}

	/** End a scope early: terminate its tokens, close its subscriptions, drop its variables. */
	private endScope(ctx: ScopeCtx): void {
		if (this.scopes.get(ctx.scopeId) !== ctx) return
		for (const id of [...ctx.tokens]) {
			const token = this.allTokens.get(id)
			if (token !== undefined) this.terminateToken(token)
		}
		for (const cleanup of ctx.cleanups.splice(0)) cleanup()
		this.scopes.delete(ctx.scopeId)
		this.variables.removeScope(ctx.scopeId)
		// Activities of a terminated scope are never compensated.
		this.compensationLog = this.compensationLog.filter((e) => !e.scopePath.includes(ctx.scopeId))
	}

	/** The last token of a scope has left. */
	private scopeDone(ctx: ScopeCtx): void {
		for (const cleanup of ctx.cleanups.splice(0)) cleanup()
		if (ctx.onComplete !== undefined) {
			ctx.onComplete()
		} else if (ctx.parentScopeId === undefined) {
			this.finishProcess()
		}
	}

	private scopePath(ctx: ScopeCtx): string[] {
		const path: string[] = []
		let current: ScopeCtx | undefined = ctx
		while (current !== undefined) {
			path.push(current.scopeId)
			current =
				current.parentScopeId !== undefined ? this.scopes.get(current.parentScopeId) : undefined
		}
		return path
	}

	/** Remove every token and close every subscription, timer and child instance. */
	private releaseAll(emitTerminated: boolean): void {
		for (const token of [...this.allTokens.values()]) {
			if (emitTerminated) this.terminateToken(token)
			else this.removeToken(token)
		}
		for (const ctx of this.scopes.values()) {
			for (const cleanup of ctx.cleanups.splice(0)) cleanup()
		}
	}

	// ── Token lifecycle ────────────────────────────────────────────────────────

	private createToken(elementId: string, scopeId: string, varScopeId: string): Token {
		const token: Token = { id: generateId("tok"), elementId, scopeId, varScopeId }
		this.allTokens.set(token.id, token)
		this.scopes.get(scopeId)?.tokens.add(token.id)
		return token
	}

	private alive(token: Token): boolean {
		return this.allTokens.has(token.id)
	}

	/** Run `cleanup` when the token leaves its element, however it leaves. */
	private onTokenEnd(token: Token, cleanup: () => void): void {
		const list = this.tokenCleanups.get(token.id)
		if (list !== undefined) list.push(cleanup)
		else this.tokenCleanups.set(token.id, [cleanup])
	}

	private zeebeExt(el: BpmnFlowElement): ParsedZeebeExt {
		let ext = this.zeebeExtCache.get(el)
		if (ext === undefined) {
			ext = parseZeebeExt(el.extensionElements)
			this.zeebeExtCache.set(el, ext)
		}
		return ext
	}

	private removeToken(token: Token): void {
		if (!this.allTokens.delete(token.id)) return
		this.scopes.get(token.scopeId)?.tokens.delete(token.id)
		const cleanups = this.tokenCleanups.get(token.id)
		if (cleanups !== undefined) {
			this.tokenCleanups.delete(token.id)
			for (const cleanup of cleanups) cleanup()
		}
	}

	/** Remove a token that did not complete, and say so. */
	private terminateToken(token: Token): void {
		if (!this.alive(token)) return
		const el = this.scopes.get(token.scopeId)?.elements.get(token.elementId)
		this.removeToken(token)
		this.emit({
			type: "element:terminated",
			elementId: token.elementId,
			elementName: el?.name,
			elementType: el?.type ?? "unknown",
		})
	}

	// ── Parallel join tracking ─────────────────────────────────────────────────

	/** scope/elementId → set of incomingFlowIds received */
	private readonly joins = new Map<string, Set<string>>()

	// ── Activation ─────────────────────────────────────────────────────────────

	private async enter(
		elementId: string,
		scopeId: string,
		incomingFlowId: string | undefined,
		entry: Entry | undefined,
		release: () => void,
	): Promise<void> {
		if (this._state !== "active") return

		const ctx = this.scopes.get(scopeId)
		if (ctx === undefined) return

		const el = ctx.elements.get(elementId)
		if (el === undefined) return

		// ── Infinite-loop guard ────────────────────────────────────────────────
		// Keyed by scope: a loop always stays inside one scope, while multi-instance
		// iterations and repeated sub-process runs each get a scope of their own.
		const key = `${scopeId}/${elementId}`
		const activations = (this.activationCount.get(key) ?? 0) + 1
		this.activationCount.set(key, activations)
		if (activations > ProcessInstance.MAX_ACTIVATIONS) {
			const error = `Infinite loop detected at element "${elementId}" (activated ${activations} times)`
			this.emit({ type: "element:failed", elementId, error })
			this._state = "failed"
			this._error = error
			this.emit({ type: "process:failed", error })
			return
		}

		// ── Parallel gateway join ──────────────────────────────────────────────
		if (el.type === "parallelGateway" && el.incoming.length > 1) {
			const seen = this.joins.get(key) ?? new Set<string>()
			if (incomingFlowId !== undefined) seen.add(incomingFlowId)
			this.joins.set(key, seen)
			if (seen.size < el.incoming.length) {
				release()
				return
			}
			this.joins.delete(key)
		}

		this.emit({ type: "element:entering", elementId, elementName: el.name, elementType: el.type })

		// Input mappings create local variables of the element, as in Zeebe, so an
		// element with an ioMapping gets a variable scope of its own. A multi-instance
		// body has none: its iterations apply the mappings.
		const ext = this.zeebeExt(el)
		const mapped = ext.ioMapping !== undefined && loopOf(el) === undefined
		const varScopeId = mapped ? `scope_el_${generateId("el")}` : scopeId
		if (mapped) this.variables.createScope(varScopeId, scopeId)
		if (ext.ioMapping && mapped) {
			for (const inp of ext.ioMapping.inputs) {
				let val: unknown
				if (this.secretResolver !== undefined && inp.source.includes("{{secrets.")) {
					const resolved = await resolveSecretString(inp.source, this.secretResolver)
					// If source starts with "=", it's a FEEL expression — evaluate after secret substitution.
					// Otherwise it's a literal string — use the resolved value directly.
					if (inp.source.trimStart().startsWith("=")) {
						val = this.evalFeel(resolved, varScopeId, {
							elementId: el.id,
							property: `input:${inp.target}`,
						})
					} else {
						val = resolved
					}
				} else if (inp.source.trimStart().startsWith("=")) {
					val = this.evalFeel(inp.source, varScopeId, {
						elementId: el.id,
						property: `input:${inp.target}`,
					})
				} else {
					// A zeebe:input source without a leading "=" is a literal value, not FEEL.
					val = inp.source
				}
				this.variables.setLocal(varScopeId, inp.target, val)
				this.emit({ type: "variable:set", name: inp.target, value: val, scopeId: varScopeId })
			}
		}

		const token = this.createToken(elementId, scopeId, varScopeId)
		if (mapped) this.onTokenEnd(token, () => this.variables.removeScope(varScopeId))
		release()
		this.emit({ type: "element:entered", elementId, elementName: el.name, elementType: el.type })

		this.armBoundaries(el.id, token, ctx)

		await this.dispatch(token, el, ext, ctx, entry)
	}

	/**
	 * Enter an element. `reservedIn` is the scope whose pending count
	 * {@link activateAll} raised for this activation; it drops once the
	 * element holds a token, or when the activation stops short of one.
	 */
	private async activate(
		elementId: string,
		scopeId: string,
		incomingFlowId: string | undefined,
		entry?: Entry,
		reservedIn?: ScopeCtx,
	): Promise<void> {
		let reserved = reservedIn
		const release = (): void => {
			if (reserved !== undefined) reserved.pending--
			reserved = undefined
		}
		try {
			await this.enter(elementId, scopeId, incomingFlowId, entry, release)
		} finally {
			release()
		}
	}

	// ── Dispatch ───────────────────────────────────────────────────────────────

	private async dispatch(
		token: Token,
		el: BpmnFlowElement,
		ext: ReturnType<typeof parseZeebeExt>,
		ctx: ScopeCtx,
		entry: Entry | undefined,
	): Promise<void> {
		const loop = loopOf(el)
		if (loop !== undefined) {
			await this.handleMultiInstance(token, el, loop, ctx)
			return
		}

		switch (el.type) {
			case "startEvent":
			case "task":
			case "manualTask":
			case "sendTask":
			case "receiveTask":
				await this.complete(token, ctx)
				break

			case "intermediateThrowEvent":
				await this.handleThrowEvent(token, el, ctx)
				break

			case "endEvent":
				await this.handleEndEvent(token, el, ctx)
				break

			case "serviceTask":
			case "userTask":
				await this.handleJobTask(token, el, ext, ctx)
				break

			case "scriptTask":
				this.handleScriptTask(el, ext, token)
				await this.complete(token, ctx)
				break

			case "businessRuleTask":
				this.handleBusinessRuleTask(el, ext, token)
				await this.complete(token, ctx)
				break

			case "exclusiveGateway":
				await this.handleExclusiveGateway(token, el, ctx)
				break

			case "parallelGateway":
				await this.complete(token, ctx)
				break

			case "inclusiveGateway":
			case "complexGateway":
				// A complex gateway splits like an inclusive one; its activation condition is not modelled.
				await this.handleInclusiveGateway(token, el, ctx)
				break

			case "eventBasedGateway":
				this.handleEventBasedGateway(token, el, ctx)
				break

			case "intermediateCatchEvent":
				await this.handleIntermediateCatchEvent(token, el, ctx, entry)
				break

			case "subProcess":
			case "transaction":
			case "eventSubProcess":
				await this.handleSubProcess(
					token,
					el,
					ctx,
					isEventSubProcess(el) && entry?.kind === "eventSubProcess"
						? entry.startEventId
						: undefined,
				)
				break

			case "callActivity":
				await this.handleCallActivity(token, el, ext, ctx)
				break

			case "adHocSubProcess":
				if (ext.taskDefinition) {
					// Job-worker implementation (e.g. the AI Agent Sub-process connector).
					// Without a worker, handleJobTask applies the example output and moves on.
					const handler = this.jobWorkers.get(ext.taskDefinition.type)
					if (handler !== undefined) {
						await this.handleAdHocJobWorker(token, el, ext, ctx, ext.taskDefinition.type, handler)
					} else {
						await this.handleJobTask(token, el, ext, ctx)
					}
				} else {
					// BPMN-native ad-hoc sub-process — auto-complete (tools not executed).
					await this.complete(token, ctx)
				}
				break

			default:
				// Boundary events and anything else without behaviour of its own.
				await this.complete(token, ctx)
				break
		}
	}

	// ── Element handlers ───────────────────────────────────────────────────────

	private async handleEndEvent(
		token: Token,
		el: BpmnFlowElement & { type: "endEvent" },
		ctx: ScopeCtx,
	): Promise<void> {
		const eventDef = el.eventDefinitions[0]

		if (eventDef?.type === "terminate") {
			this.removeToken(token)
			this.releaseAll(true)
			this.emit({
				type: "element:leaving",
				elementId: el.id,
				elementName: el.name,
				elementType: el.type,
			})
			this.emit({
				type: "element:left",
				elementId: el.id,
				elementName: el.name,
				elementType: el.type,
			})
			this.finishProcess()
			return
		}

		if (eventDef?.type === "error") {
			this.removeToken(token)
			this.emit({
				type: "element:leaving",
				elementId: el.id,
				elementName: el.name,
				elementType: el.type,
			})
			this.emit({
				type: "element:left",
				elementId: el.id,
				elementName: el.name,
				elementType: el.type,
			})
			const ref = eventDef.errorRef ?? "unknown"
			this.throwError(this.host?.refs.errors.get(ref) ?? ref, ref, ctx, undefined)
			return
		}

		if (eventDef?.type === "signal") this.throwSignal(eventDef, el.id)
		else if (eventDef?.type === "escalation") this.throwEscalation(eventDef, ctx)
		else if (eventDef?.type === "compensate") await this.compensate(eventDef, token, ctx)

		await this.complete(token, ctx)
	}

	private async handleThrowEvent(
		token: Token,
		el: BpmnFlowElement & { type: "intermediateThrowEvent" },
		ctx: ScopeCtx,
	): Promise<void> {
		const eventDef = el.eventDefinitions[0]
		switch (eventDef?.type) {
			case "link": {
				const target = [...ctx.elements.values()].find(
					(e) =>
						e.type === "intermediateCatchEvent" &&
						e.eventDefinitions[0]?.type === "link" &&
						e.eventDefinitions[0].name === eventDef.name,
				)
				if (target === undefined) {
					this.failElement(
						el.id,
						`No link catch event named "${eventDef.name ?? ""}" in the scope of "${el.id}"`,
					)
					return
				}
				const jump: BpmnSequenceFlow = {
					id: `${el.id}->${target.id}`,
					sourceRef: el.id,
					targetRef: target.id,
					extensionElements: [],
					unknownAttributes: {},
				}
				await this.complete(token, ctx, [jump])
				return
			}
			case "signal":
				this.throwSignal(eventDef, el.id)
				break
			case "escalation":
				this.throwEscalation(eventDef, ctx)
				break
			case "compensate":
				await this.compensate(eventDef, token, ctx)
				break
		}
		await this.complete(token, ctx)
	}

	private async handleJobTask(
		token: Token,
		el: BpmnFlowElement,
		ext: ReturnType<typeof parseZeebeExt>,
		ctx: ScopeCtx,
	): Promise<void> {
		const jobType = ext.taskDefinition?.type ?? el.type
		const handler = this.jobWorkers.get(jobType)

		if (handler === undefined) {
			// No real worker — apply example output JSON if configured (play mode simulation)
			if (ext.exampleOutputJson) {
				try {
					this.mergeResult(token, ext, JSON.parse(ext.exampleOutputJson) as Record<string, unknown>)
				} catch {
					// Invalid JSON — skip silently
				}
			}
			await this.complete(token, ctx)
			return
		}

		const outcome = await this.runJob(el, jobType, handler, ext, token.varScopeId, (outVars) => {
			if (this.alive(token)) this.mergeResult(token, ext, outVars)
		})

		// An interrupting event ended the task while the worker ran — its result is void.
		if (!this.alive(token)) return
		if (this.jobFailed(outcome, ctx, token)) return

		await this.complete(token, ctx)
	}

	/**
	 * Create a job for `el`, hand it to `handler` and wait until the worker
	 * completes, fails or throws. `onComplete` runs synchronously on completion.
	 */
	private async runJob(
		el: BpmnFlowElement,
		jobType: string,
		handler: JobHandler,
		ext: ParsedZeebeExt,
		varScopeId: string,
		onComplete: (variables: Vars | undefined, result: JobResult | undefined) => void,
	): Promise<JobOutcome> {
		const rawHeaders = ext.taskHeaders ?? {}
		let headers: Record<string, string>
		if (this.secretResolver !== undefined) {
			headers = {}
			for (const [k, v] of Object.entries(rawHeaders)) {
				headers[k] = await resolveSecretString(v, this.secretResolver)
			}
		} else {
			headers = rawHeaders
		}

		return new Promise<JobOutcome>((resolve) => {
			const job: Job = {
				id: generateId("job"),
				type: jobType,
				headers,
				variables: this.variables.getAll(varScopeId),
				complete: (outVars, result) => {
					onComplete(outVars, result)
					resolve({ kind: "completed", result })
				},
				fail: (error) => resolve({ kind: "failed", error }),
				throwError: (code, message) => resolve({ kind: "thrown", code, message }),
			}

			this.emit({ type: "job:created", job, elementId: el.id })
			void Promise.resolve(handler(job)).catch((err: unknown) => {
				resolve({ kind: "failed", error: err instanceof Error ? err.message : String(err) })
			})
		})
	}

	/** Act on a failed or thrown job; returns false when the job completed. */
	private jobFailed(outcome: JobOutcome, ctx: ScopeCtx, token: Token): boolean {
		if (outcome.kind === "thrown") {
			this.throwError(outcome.code, outcome.message, ctx, token)
			return true
		}
		if (outcome.kind === "failed") {
			this._state = "failed"
			this._error = outcome.error
			this.emit({ type: "process:failed", error: outcome.error })
			return true
		}
		return false
	}

	/**
	 * An ad-hoc sub-process implemented by a job worker, such as the AI Agent
	 * Sub-process connector. The worker's job sees `adHocSubProcessElements`
	 * and completes with a job result naming the inner elements to activate.
	 * Each activation runs in a scope of its own holding the variables it was
	 * given; when it ends, `outputElement` is appended to `outputCollection`
	 * and a new job asks the worker what next — one job at a time. A job result
	 * that fulfils the completion condition (or no job result at all) completes
	 * the sub-process.
	 */
	private async handleAdHocJobWorker(
		token: Token,
		el: Extract<BpmnFlowElement, { type: "adHocSubProcess" }>,
		ext: ParsedZeebeExt,
		ctx: ScopeCtx,
		jobType: string,
		handler: JobHandler,
	): Promise<void> {
		const scopeId = `scope_adhoc_${token.id}`
		this.variables.createScope(scopeId, token.varScopeId)
		const activatable = adHocActivatableElements(el)
		const activatableIds = new Set(activatable.map((e) => e.id))
		this.setLocal(scopeId, "adHocSubProcessElements", activatable.map(describeAdHocElement))
		const collection = ext.adHoc?.outputCollection || undefined
		const outputElement = ext.adHoc?.outputElement || undefined
		const results: unknown[] = []
		if (collection !== undefined) this.setLocal(scopeId, collection, [])

		const running = new Set<ScopeCtx>()
		let activations = 0
		let changed = false
		let wake: (() => void) | undefined
		const notify = (): void => {
			changed = true
			const resume = wake
			wake = undefined
			resume?.()
		}
		const nextChange = (): Promise<void> =>
			changed
				? Promise.resolve()
				: new Promise((resolve) => {
						wake = resolve
					})
		this.onTokenEnd(token, () => {
			for (const inner of running) this.endScope(inner)
			running.clear()
			this.variables.removeScope(scopeId)
			notify()
		})

		const activateInner = (elementId: string, variables: Vars | undefined): void => {
			const innerId = `${scopeId}_${++activations}`
			this.variables.createScope(innerId, scopeId, true)
			for (const [name, value] of Object.entries(variables ?? {}))
				this.setLocal(innerId, name, value)
			const inner = this.buildScopeCtx(
				innerId,
				ctx.scopeId,
				() => {
					running.delete(inner)
					if (collection !== undefined && outputElement !== undefined) {
						results.push(
							this.evalFeel(outputElement, innerId, {
								elementId: el.id,
								property: "outputElement",
							}) ?? null,
						)
						this.setLocal(scopeId, collection, [...results])
					}
					this.scopes.delete(innerId)
					this.variables.removeScope(innerId)
					notify()
				},
				el.flowElements,
				el.sequenceFlows,
				el.associations,
				token,
			)
			this.scopes.set(innerId, inner)
			running.add(inner)
			void this.activate(elementId, innerId, undefined)
		}

		let cancelRemaining = true
		for (;;) {
			changed = false
			const outcome = await this.runJob(el, jobType, handler, ext, scopeId, (outVars) => {
				if (!this.alive(token)) return
				// With output mappings the job's variables stay in the sub-process; the mappings pick what leaves.
				if ((ext.ioMapping?.outputs.length ?? 0) > 0) {
					for (const [name, value] of Object.entries(outVars ?? {})) {
						this.setLocal(scopeId, name, value)
					}
				} else {
					this.setVariables(outVars, scopeId)
				}
			})
			if (!this.alive(token)) return
			if (this.jobFailed(outcome, ctx, token)) return
			const result = outcome.kind === "completed" ? outcome.result : undefined
			if (result === undefined) break

			const activate = result.activateElements ?? []
			const problem =
				result.type !== "adHocSubProcess"
					? `a job result of type "${String(result.type)}" does not apply to it`
					: result.isCompletionConditionFulfilled === true && activate.length > 0
						? "the job result both activates elements and fulfils the completion condition"
						: activate
								.filter((a) => !activatableIds.has(a.elementId))
								.map(
									(a) =>
										`"${a.elementId}" is not an element it can activate (activatable: ${[...activatableIds].join(", ") || "none"})`,
								)[0]
			if (problem !== undefined) {
				this.failElement(el.id, `Ad-hoc sub-process "${el.id}": ${problem}`)
				return
			}
			for (const a of activate) activateInner(a.elementId, a.variables)
			if (result.isCompletionConditionFulfilled === true) {
				cancelRemaining = result.isCancelRemainingInstances === true
				break
			}
			await nextChange()
			if (!this.alive(token)) return
		}

		if (cancelRemaining) {
			for (const inner of running) this.endScope(inner)
			running.clear()
		}
		while (running.size > 0) {
			changed = false
			await nextChange()
			if (!this.alive(token)) return
		}
		if (collection !== undefined) this.setVariables({ [collection]: [...results] }, ctx.scopeId)
		this.applyOutputs(el, ext, scopeId, ctx.scopeId)
		this.variables.removeScope(scopeId)
		await this.complete(token, ctx, undefined, { skipOutputs: true })
	}

	private setLocal(scopeId: string, name: string, value: unknown): void {
		this.variables.setLocal(scopeId, name, value)
		this.emit({ type: "variable:set", name, value, scopeId })
	}

	private handleScriptTask(
		el: BpmnFlowElement,
		ext: ReturnType<typeof parseZeebeExt>,
		token: Token,
	): void {
		const script = ext.scriptTask
		if (script === undefined || script.expression.trim() === "") return
		const result = this.evalFeel(script.expression, token.varScopeId, {
			elementId: el.id,
			property: "script",
		})
		if (script.resultVariable !== "") {
			this.mergeResult(token, ext, { [script.resultVariable]: result })
		}
	}

	private handleBusinessRuleTask(
		_el: BpmnFlowElement,
		ext: ReturnType<typeof parseZeebeExt>,
		token: Token,
	): void {
		const cd = ext.calledDecision
		if (cd === undefined) return
		const decision = this.decisions.get(cd.decisionId)
		if (decision === undefined) {
			this.emit({
				type: "element:failed",
				elementId: _el.id,
				error: `DMN decision '${cd.decisionId}' not found. Deploy the DMN before running the process.`,
			})
			return
		}
		const result = evaluateDecision(decision, this.variables.snapshot(token.varScopeId))
		this.mergeResult(token, ext, { [cd.resultVariable]: result })
	}

	private async handleExclusiveGateway(
		token: Token,
		el: BpmnFlowElement & { type: "exclusiveGateway" },
		ctx: ScopeCtx,
	): Promise<void> {
		const outflows = ctx.outgoing.get(el.id) ?? []
		const defaultFlowId = el.default

		// First pass: conditioned flows (the default flow is always skipped here).
		let taken: BpmnSequenceFlow | undefined
		for (const flow of outflows) {
			if (flow.id === defaultFlowId) continue
			if (flow.conditionExpression === undefined) continue
			if (
				this.evalCondition(flow.conditionExpression.text, ctx.scopeId, {
					elementId: el.id,
					property: `flow:${flow.id}`,
				})
			) {
				taken = flow
				break
			}
		}

		// Second pass: unconditioned non-default flows act as fallback (lower priority than
		// conditioned flows so they behave like an implicit "else" branch).
		if (taken === undefined) {
			for (const flow of outflows) {
				if (flow.id === defaultFlowId) continue
				if (flow.conditionExpression === undefined) {
					taken = flow
					break
				}
			}
		}

		// Last resort: explicit default flow. Its conditionExpression (if any) is intentionally
		// ignored — the default flow is unconditional by definition.
		if (taken === undefined && defaultFlowId !== undefined) {
			taken = ctx.flows.get(defaultFlowId)
		}

		if (taken === undefined) {
			const error =
				outflows.length === 0
					? `Gateway "${el.id}" has no outgoing flows`
					: `No condition matched at gateway "${el.id}" — add conditions to flows or mark one as the default`
			this.emit({ type: "element:failed", elementId: el.id, error })
			this._state = "failed"
			this._error = error
			this.emit({ type: "process:failed", error })
			return
		}

		await this.complete(token, ctx, [taken])
	}

	private async handleInclusiveGateway(
		token: Token,
		el: BpmnFlowElement & { type: "inclusiveGateway" | "complexGateway" },
		ctx: ScopeCtx,
	): Promise<void> {
		const outflows = ctx.outgoing.get(el.id) ?? []
		const defaultFlowId = el.default

		const matching = outflows.filter((f) => {
			if (f.id === defaultFlowId) return false
			if (f.conditionExpression === undefined) return true
			return this.evalCondition(f.conditionExpression.text, ctx.scopeId, {
				elementId: el.id,
				property: `flow:${f.id}`,
			})
		})

		const flows =
			matching.length > 0
				? matching
				: defaultFlowId !== undefined
					? [ctx.flows.get(defaultFlowId)].filter((f): f is BpmnSequenceFlow => f !== undefined)
					: []

		await this.complete(token, ctx, flows)
	}

	/**
	 * Arm every catch event after the gateway; the first to fire takes its
	 * branch and disarms the others. The gateway's token waits until then.
	 */
	private handleEventBasedGateway(
		token: Token,
		el: BpmnFlowElement & { type: "eventBasedGateway" },
		ctx: ScopeCtx,
	): void {
		const disarms: Array<() => void> = []
		let fired = false
		const fire = (flow: BpmnSequenceFlow, vars: Vars | undefined): void => {
			if (fired || !this.alive(token)) return
			fired = true
			for (const disarm of disarms) disarm()
			this.setVariables(vars, ctx.scopeId)
			void this.complete(token, ctx, [flow], { targetEntry: { kind: "eventTriggered" } })
		}

		for (const flow of ctx.outgoing.get(el.id) ?? []) {
			const target = ctx.elements.get(flow.targetRef)
			const def = target?.type === "intermediateCatchEvent" ? target.eventDefinitions[0] : undefined
			let disarm: () => void
			if (def?.type === "timer") {
				if (this.beforeComplete === undefined) {
					disarm = scheduleTimer(def, () => fire(flow, undefined))
				} else {
					// Controlled mode skips real timer waits, as for a lone timer catch event.
					const id = setTimeout(() => fire(flow, undefined), 0)
					disarm = () => clearTimeout(id)
				}
			} else if (target !== undefined && def?.type === "message") {
				disarm = this.subscribeMessage(target, def.messageRef, ctx.scopeId, (v) => fire(flow, v))
			} else if (def?.type === "signal") {
				disarm = this.subscribe("signal", this.signalKeys(def.signalRef, flow.targetRef), (v) =>
					fire(flow, v),
				)
			} else if (target?.type === "receiveTask") {
				disarm = this.subscribeMessage(target, target.messageRef, ctx.scopeId, (v) => fire(flow, v))
			} else {
				this.emit({
					type: "element:warning",
					elementId: el.id,
					message: `"${flow.targetRef}" after event-based gateway "${el.id}" is not a message, timer or signal catch event or a receive task — it is never armed`,
				})
				continue
			}
			disarms.push(disarm)
			this.onTokenEnd(token, disarm)
		}

		if (disarms.length === 0) {
			this.failElement(
				el.id,
				`Event-based gateway "${el.id}" has no message, timer or signal catch event to wait for`,
			)
		}
	}

	private async handleIntermediateCatchEvent(
		token: Token,
		el: BpmnFlowElement & { type: "intermediateCatchEvent" },
		ctx: ScopeCtx,
		entry: Entry | undefined,
	): Promise<void> {
		const eventDef = el.eventDefinitions[0]

		// After an event-based gateway the event has already happened.
		if (entry?.kind !== "eventTriggered") {
			if (eventDef?.type === "timer") {
				if (this.beforeComplete === undefined) {
					// Normal mode: honour the real timer duration.
					await new Promise<void>((resolve) => {
						this.onTokenEnd(token, scheduleTimer(eventDef, resolve))
					})
				}
				// Controlled mode (step / auto-play): skip the real wait — the
				// beforeComplete hook in complete() is the user-visible pause point.
			} else if (eventDef?.type === "message") {
				const vars = await this.waitFor(token, (fire) =>
					this.subscribeMessage(el, eventDef.messageRef, token.varScopeId, fire),
				)
				this.mergeResult(token, this.zeebeExt(el), vars)
			} else if (eventDef?.type === "signal") {
				const vars = await this.waitFor(token, (fire) =>
					this.subscribe("signal", this.signalKeys(eventDef.signalRef, el.id), fire),
				)
				this.mergeResult(token, this.zeebeExt(el), vars)
			}
		}

		await this.complete(token, ctx)
	}

	/**
	 * Run a sub-process, transaction or event sub-process in a child scope and
	 * complete it when the scope's last token leaves. An event sub-process
	 * starts at the start event that triggered it.
	 */
	private async handleSubProcess(
		token: Token,
		el: Container,
		parentCtx: ScopeCtx,
		startEventId: string | undefined,
	): Promise<void> {
		const childScopeId = `scope_sub_${token.id}`
		this.variables.createScope(childScopeId, token.varScopeId)

		await new Promise<void>((resolve) => {
			const childCtx = this.buildScopeCtx(
				childScopeId,
				parentCtx.scopeId,
				resolve,
				el.flowElements,
				el.sequenceFlows,
				el.associations,
				token,
			)
			this.scopes.set(childScopeId, childCtx)
			this.onTokenEnd(token, () => this.endScope(childCtx))

			const starts = this.startEventsOf(childCtx, startEventId)
			if (starts.length === 0) {
				resolve()
				return
			}

			this.armEventSubProcesses(childCtx)
			void this.activateAll(
				starts.map((s) => ({ targetRef: s.id, id: undefined })),
				childCtx,
				undefined,
			)
		})

		if (!this.alive(token)) return
		// Output mappings are how a sub-process's local variables leave it, so they
		// are evaluated before its scope goes.
		this.applyOutputs(el, this.zeebeExt(el), childScopeId, parentCtx.scopeId)
		this.scopes.delete(childScopeId)
		this.variables.removeScope(childScopeId)
		await this.complete(token, parentCtx, undefined, { skipOutputs: true })
	}

	/**
	 * Run the called process as a child instance of the same engine. Without a
	 * deployed process the call activity completes as before, with a warning.
	 */
	private async handleCallActivity(
		token: Token,
		el: BpmnFlowElement,
		ext: ReturnType<typeof parseZeebeExt>,
		ctx: ScopeCtx,
	): Promise<void> {
		const called = ext.calledElement
		const host = this.host
		let processId: string | undefined
		if (called !== undefined && called.processId !== "") {
			processId = called.processId.trimStart().startsWith("=")
				? String(
						this.evalFeel(called.processId, token.varScopeId, {
							elementId: el.id,
							property: "processId",
						}) ?? "",
					)
				: called.processId
		}
		const process = processId !== undefined ? host?.processes.get(processId) : undefined

		if (called === undefined || host === undefined || process === undefined) {
			this.emit({
				type: "element:warning",
				elementId: el.id,
				message:
					processId === undefined
						? `Call activity "${el.id}" has no zeebe:calledElement processId — completed without running a child process`
						: `Process "${processId}" is not deployed in this engine — call activity "${el.id}" completed without running it`,
			})
			await this.complete(token, ctx)
			return
		}

		const parentVars = this.variables.getAll(token.varScopeId)
		const childVars = called.propagateAllParentVariables
			? parentVars
			: Object.fromEntries(
					(ext.ioMapping?.inputs ?? []).map((inp) => [inp.target, parentVars[inp.target]]),
				)

		const outcome = await new Promise<{ variables: Vars } | { error: string }>((resolve) => {
			const child = host.startChild(process, childVars, this.beforeComplete, {
				propagate: (kind, code, vars) =>
					this.alive(token) && this.propagate(kind, code, ctx, token, vars),
			})
			this.children.add(child)
			this.onTokenEnd(token, () => {
				this.children.delete(child)
				if (child.state === "active") child.cancel()
			})
			child.onChange((e) => {
				if (e.type === "process:completed") resolve({ variables: e.variables })
				else if (e.type === "process:failed") resolve({ error: e.error })
			})
		})

		if (!this.alive(token)) return
		if ("error" in outcome) {
			this.fail(outcome.error)
			return
		}

		// With output mappings the child's variables stay local to the call
		// activity and the mappings pick what reaches the caller.
		if ((ext.ioMapping?.outputs.length ?? 0) > 0 || called.propagateAllChildVariables) {
			this.mergeResult(token, ext, outcome.variables)
		}
		await this.complete(token, ctx)
	}

	/**
	 * Run a multi-instance body: one iteration per `inputCollection` item (or
	 * `loopCardinality` times), each in its own scope holding `inputElement` and
	 * `loopCounter`, collecting `outputElement` into `outputCollection` by index.
	 */
	private async handleMultiInstance(
		token: Token,
		el: BpmnFlowElement,
		lc: BpmnMultiInstanceLoopCharacteristics,
		ctx: ScopeCtx,
	): Promise<void> {
		const loop = parseZeebeLoop(lc.extensionElements)
		let items: unknown[]
		if (loop.inputCollection !== undefined && loop.inputCollection.trim() !== "") {
			const value = this.evalFeel(loop.inputCollection, ctx.scopeId, {
				elementId: el.id,
				property: "inputCollection",
			})
			if (!Array.isArray(value)) {
				this.failElement(
					el.id,
					`Multi-instance "${el.id}": inputCollection "${loop.inputCollection}" is not a list`,
				)
				return
			}
			items = value
		} else if (lc.loopCardinality !== undefined && lc.loopCardinality.text.trim() !== "") {
			const n = this.evalFeel(lc.loopCardinality.text, ctx.scopeId, {
				elementId: el.id,
				property: "loopCardinality",
			})
			if (typeof n !== "number" || !Number.isInteger(n) || n < 0) {
				this.failElement(
					el.id,
					`Multi-instance "${el.id}": loopCardinality "${lc.loopCardinality.text}" is not a non-negative integer`,
				)
				return
			}
			items = Array.from({ length: n }, (_, i) => i + 1)
		} else {
			this.failElement(
				el.id,
				`Multi-instance "${el.id}" has neither a zeebe:loopCharacteristics inputCollection nor a loopCardinality`,
			)
			return
		}

		const bodyScopeId = `scope_mi_${token.id}`
		this.variables.createScope(bodyScopeId, ctx.scopeId)
		const inner = { ...el, loopCharacteristics: undefined } as BpmnFlowElement
		// An outputElement that only reads a variable makes that variable local to each iteration.
		const outputVar =
			loop.outputElement !== undefined
				? /^\s*=?\s*([A-Za-z_$][\w$]*)(?:\.[A-Za-z_$][\w$]*)*\s*$/.exec(loop.outputElement)?.[1]
				: undefined
		const completion = lc.completionCondition?.text.trim() ?? ""
		const results: unknown[] = items.map(() => null)
		const running = new Map<number, ScopeCtx>()
		let completed = 0
		let terminated = 0
		this.onTokenEnd(token, () => {
			for (const iteration of running.values()) this.endScope(iteration)
			this.variables.removeScope(bodyScopeId)
		})

		/** Resolves true when the completion condition holds after this iteration. */
		const runIteration = (index: number): Promise<boolean> =>
			new Promise((resolve) => {
				const scopeId = `${bodyScopeId}_${index}`
				this.variables.createScope(scopeId, bodyScopeId)
				if (loop.inputElement !== undefined && loop.inputElement !== "") {
					this.variables.setLocal(scopeId, loop.inputElement, items[index])
				}
				this.variables.setLocal(scopeId, "loopCounter", index + 1)
				if (outputVar !== undefined) this.variables.setLocal(scopeId, outputVar, null)

				const iteration = this.buildScopeCtx(
					scopeId,
					ctx.scopeId,
					() => {
						running.delete(index)
						completed++
						if (loop.outputElement !== undefined && loop.outputElement !== "") {
							results[index] =
								this.evalFeel(loop.outputElement, scopeId, {
									elementId: el.id,
									property: "outputElement",
								}) ?? null
						}
						const done =
							completion !== "" &&
							this.evalCondition(
								completion,
								scopeId,
								{ elementId: el.id, property: "completionCondition" },
								{
									numberOfInstances: items.length,
									numberOfActiveInstances: running.size,
									numberOfCompletedInstances: completed,
									numberOfTerminatedInstances: terminated,
								},
							)
						this.scopes.delete(scopeId)
						this.variables.removeScope(scopeId)
						resolve(done)
					},
					[inner],
					[],
					[],
					token,
				)
				this.scopes.set(scopeId, iteration)
				running.set(index, iteration)
				void this.activate(inner.id, scopeId, undefined)
			})

		if (lc.isSequential === true) {
			for (let i = 0; i < items.length; i++) {
				const done = await runIteration(i)
				if (!this.alive(token)) return
				if (done) break
			}
		} else if (items.length > 0) {
			await new Promise<void>((resolve) => {
				let remaining = items.length
				for (let i = 0; i < items.length; i++) {
					void runIteration(i).then((done) => {
						remaining--
						if (done) {
							for (const iteration of [...running.values()]) {
								terminated++
								this.endScope(iteration)
							}
							running.clear()
							resolve()
						} else if (remaining === 0) {
							resolve()
						}
					})
				}
			})
			if (!this.alive(token)) return
		}

		if (loop.outputCollection !== undefined && loop.outputCollection !== "") {
			this.setVariables({ [loop.outputCollection]: results }, ctx.scopeId)
		}
		this.variables.removeScope(bodyScopeId)
		await this.complete(token, ctx, undefined, { skipOutputs: true })
	}

	// ── Boundary events and event sub-processes ────────────────────────────────

	/** Arm the timer, message and signal boundary events of an activity for as long as it runs. */
	private armBoundaries(elementId: string, token: Token, ctx: ScopeCtx): void {
		for (const be of ctx.boundaries.get(elementId) ?? []) {
			const def = be.eventDefinitions[0]
			if (def?.type === "timer") {
				// A cycle keeps firing a non-interrupting boundary while the activity runs.
				this.onTokenEnd(
					token,
					scheduleTimer(def, () => this.triggerBoundary(be, token, ctx, undefined, false)),
				)
			} else if (def?.type === "message") {
				this.onTokenEnd(
					token,
					this.subscribeMessage(be, def.messageRef, token.varScopeId, (vars) =>
						this.triggerBoundary(be, token, ctx, vars, false),
					),
				)
			} else if (def?.type === "signal") {
				this.onTokenEnd(
					token,
					this.subscribe("signal", this.signalKeys(def.signalRef, be.id), (vars) =>
						this.triggerBoundary(be, token, ctx, vars, false),
					),
				)
			}
		}
	}

	private triggerBoundary(
		be: BpmnBoundaryEvent,
		host: Token,
		ctx: ScopeCtx,
		vars: Vars | undefined,
		alwaysInterrupts: boolean,
	): void {
		if (this._state !== "active" || !this.alive(host)) return
		if (alwaysInterrupts || be.cancelActivity !== false) this.terminateToken(host)
		this.setVariables(vars, ctx.scopeId)
		void this.activate(be.id, ctx.scopeId, undefined)
	}

	/** Open the timer, message and signal subscriptions of a scope's event sub-processes. */
	private armEventSubProcesses(ctx: ScopeCtx): void {
		for (const esp of ctx.eventSubProcesses) {
			const def = esp.start.eventDefinitions[0]
			const trigger = (vars: Vars | undefined): void => this.triggerEventSubProcess(ctx, esp, vars)
			if (def?.type === "timer") {
				ctx.cleanups.push(scheduleTimer(def, () => trigger(undefined)))
			} else if (def?.type === "message") {
				ctx.cleanups.push(this.subscribeMessage(esp.start, def.messageRef, ctx.scopeId, trigger))
			} else if (def?.type === "signal") {
				ctx.cleanups.push(
					this.subscribe("signal", this.signalKeys(def.signalRef, esp.start.id), trigger),
				)
			}
		}
	}

	private triggerEventSubProcess(
		ctx: ScopeCtx,
		esp: EventSubProcessDef,
		vars: Vars | undefined,
	): void {
		if (this._state !== "active" || this.scopes.get(ctx.scopeId) !== ctx) return
		if (esp.start.isInterrupting !== false) {
			for (const id of [...ctx.tokens]) {
				const token = this.allTokens.get(id)
				if (token !== undefined) this.terminateToken(token)
			}
			for (const cleanup of ctx.cleanups.splice(0)) cleanup()
		}
		this.setVariables(vars, ctx.scopeId)
		void this.activate(esp.container.id, ctx.scopeId, undefined, {
			kind: "eventSubProcess",
			startEventId: esp.start.id,
		})
	}

	// ── Errors, escalations, signals, compensation ─────────────────────────────

	/** Throw a BPMN error; the instance fails with `message` when nothing catches it. */
	private throwError(
		code: string,
		message: string,
		ctx: ScopeCtx,
		thrower: Token | undefined,
	): void {
		if (!this.propagate("error", code, ctx, thrower, undefined)) this.fail(message)
	}

	/** An escalation nobody catches is not a failure: the thrower simply continues. */
	private throwEscalation(def: BpmnEscalationEventDefinition, ctx: ScopeCtx): void {
		const ref = def.escalationRef ?? "unknown"
		this.propagate(
			"escalation",
			this.host?.refs.escalations.get(ref) ?? ref,
			ctx,
			undefined,
			undefined,
		)
	}

	private throwSignal(def: BpmnSignalEventDefinition, elementId: string): void {
		const ref = def.signalRef ?? elementId
		const name = this.host?.refs.signals.get(ref) ?? ref
		if (this.host !== undefined) this.host.broadcastSignal(name, undefined)
		else this.deliverSignal(name)
	}

	/**
	 * Find the catcher of an error or escalation: a boundary event on the
	 * throwing activity, then — scope by scope outwards — an event sub-process
	 * of the scope and a boundary event on the activity that runs the scope, and
	 * finally the call activity that started this instance.
	 */
	private propagate(
		kind: "error" | "escalation",
		code: string,
		fromCtx: ScopeCtx,
		thrower: Token | undefined,
		vars: Vars | undefined,
	): boolean {
		if (thrower !== undefined && this.catchOnBoundary(kind, code, thrower, fromCtx, vars)) {
			return true
		}
		let ctx: ScopeCtx | undefined = fromCtx
		// An event sub-process does not catch what its own run throws.
		let from: string | undefined
		while (ctx !== undefined) {
			if (this.catchInEventSubProcess(kind, code, ctx, from, vars)) return true
			const parentCtx: ScopeCtx | undefined =
				ctx.parentScopeId !== undefined ? this.scopes.get(ctx.parentScopeId) : undefined
			const host = ctx.hostToken
			if (host !== undefined && parentCtx !== undefined) {
				if (this.catchOnBoundary(kind, code, host, parentCtx, vars)) return true
			}
			from = host?.elementId
			ctx = parentCtx
		}
		return this.parent?.propagate(kind, code, vars) ?? false
	}

	/** The catch code of an error or escalation definition; undefined catches everything. */
	private catchCode(
		kind: "error" | "escalation",
		def: { errorRef?: string; escalationRef?: string },
	): string | undefined {
		if (kind === "error") {
			return def.errorRef !== undefined
				? (this.host?.refs.errors.get(def.errorRef) ?? def.errorRef)
				: undefined
		}
		return def.escalationRef !== undefined
			? (this.host?.refs.escalations.get(def.escalationRef) ?? def.escalationRef)
			: undefined
	}

	/** Pick the definition matching `code`, preferring an exact match over a catch-all. */
	private pickCatcher<T>(
		kind: "error" | "escalation",
		code: string,
		candidates: Array<{
			item: T
			def: { type: string; errorRef?: string; escalationRef?: string }
		}>,
	): T | undefined {
		const ofKind = candidates.filter((c) => c.def.type === kind)
		return (
			ofKind.find((c) => this.catchCode(kind, c.def) === code)?.item ??
			ofKind.find((c) => this.catchCode(kind, c.def) === undefined)?.item
		)
	}

	private catchOnBoundary(
		kind: "error" | "escalation",
		code: string,
		host: Token,
		ctx: ScopeCtx,
		vars: Vars | undefined,
	): boolean {
		if (!this.alive(host)) return false
		const candidates = (ctx.boundaries.get(host.elementId) ?? []).flatMap((be) => {
			const def = be.eventDefinitions[0]
			return def !== undefined ? [{ item: be, def }] : []
		})
		const be = this.pickCatcher(kind, code, candidates)
		if (be === undefined) return false
		this.triggerBoundary(be, host, ctx, vars, kind === "error")
		return true
	}

	private catchInEventSubProcess(
		kind: "error" | "escalation",
		code: string,
		ctx: ScopeCtx,
		skipId: string | undefined,
		vars: Vars | undefined,
	): boolean {
		const candidates = ctx.eventSubProcesses.flatMap((esp) => {
			const def = esp.start.eventDefinitions[0]
			return def !== undefined && esp.container.id !== skipId ? [{ item: esp, def }] : []
		})
		const esp = this.pickCatcher(kind, code, candidates)
		if (esp === undefined) return false
		this.triggerEventSubProcess(ctx, esp, vars)
		return true
	}

	/**
	 * Run the compensation handlers of completed activities in this scope — and
	 * in completed sub-processes inside it — in reverse completion order, one
	 * after another. `activityRef` limits it to one activity of this scope.
	 */
	private async compensate(
		def: BpmnCompensateEventDefinition,
		token: Token,
		ctx: ScopeCtx,
	): Promise<void> {
		const entries = this.compensationLog.filter((e) =>
			def.activityRef !== undefined
				? e.activityId === def.activityRef && e.scopeId === ctx.scopeId
				: e.scopePath.includes(ctx.scopeId) &&
					(e.scopeId === ctx.scopeId || !this.scopes.has(e.scopeId)),
		)
		// Each completed activity is compensated at most once.
		this.compensationLog = this.compensationLog.filter((e) => !entries.includes(e))
		for (const entry of entries.reverse()) {
			await this.runCompensationHandler(entry.handler, token, ctx)
			if (this._state !== "active" || !this.alive(token)) return
		}
	}

	private async runCompensationHandler(
		handler: BpmnFlowElement,
		token: Token,
		ctx: ScopeCtx,
	): Promise<void> {
		const scopeId = `scope_comp_${generateId("c")}`
		this.variables.createScope(scopeId, ctx.scopeId)
		await new Promise<void>((resolve) => {
			const handlerCtx = this.buildScopeCtx(scopeId, ctx.scopeId, resolve, [handler], [], [], token)
			this.scopes.set(scopeId, handlerCtx)
			this.onTokenEnd(token, () => this.endScope(handlerCtx))
			void this.activate(handler.id, scopeId, undefined)
		})
		this.scopes.delete(scopeId)
		this.variables.removeScope(scopeId)
	}

	// ── Subscriptions ──────────────────────────────────────────────────────────

	/** Returns the unsubscribe function. */
	private subscribe(
		kind: Subscription["kind"],
		keys: readonly string[],
		fire: Subscription["fire"],
		correlationKey?: string,
	): () => void {
		const sub: Subscription = { kind, keys, correlationKey, fire }
		this.subscriptions.add(sub)
		return () => {
			this.subscriptions.delete(sub)
		}
	}

	/**
	 * Subscribe `el` to its message. The correlation key comes from a
	 * `zeebe:subscription` on the element or, failing that, on the message, and
	 * is evaluated now, in `scopeId`.
	 */
	private subscribeMessage(
		el: BpmnFlowElement,
		messageRef: string | undefined,
		scopeId: string,
		fire: Subscription["fire"],
	): () => void {
		const expression =
			el.extensionElements.find((e) => e.name === "zeebe:subscription")?.attributes
				.correlationKey ??
			(messageRef !== undefined
				? this.host?.refs.messageCorrelationKeys.get(messageRef)
				: undefined)
		let correlationKey: string | undefined
		if (expression !== undefined && expression.trim() !== "") {
			const value = expression.trimStart().startsWith("=")
				? this.evalFeel(expression, scopeId, { elementId: el.id, property: "correlationKey" })
				: expression
			if (value !== null && value !== undefined) correlationKey = String(value)
		}
		return this.subscribe("message", this.messageKeys(messageRef, el.id), fire, correlationKey)
	}

	/** Wait for one delivery to the subscription `open` makes while the token is alive. */
	private waitFor(
		token: Token,
		open: (fire: Subscription["fire"]) => () => void,
	): Promise<Vars | undefined> {
		return new Promise((resolve) => {
			const unsubscribe = open((vars) => {
				unsubscribe()
				resolve(vars)
			})
			this.onTokenEnd(token, unsubscribe)
		})
	}

	/** A message definition is delivered by its name or its id. */
	private messageKeys(ref: string | undefined, fallbackId: string): string[] {
		const key = ref ?? fallbackId
		const name = this.host?.refs.messages.get(key)
		return name !== undefined && name !== key ? [key, name] : [key]
	}

	private signalKeys(ref: string | undefined, fallbackId: string): string[] {
		const key = ref ?? fallbackId
		const name = this.host?.refs.signals.get(key)
		return name !== undefined && name !== key ? [key, name] : [key]
	}

	/** Merge variables into the instance from `scopeId` upwards, as Zeebe propagates them. */
	private setVariables(vars: Vars | undefined, scopeId: string): void {
		if (vars === undefined) return
		for (const [name, value] of Object.entries(vars)) {
			this.variables.propagate(scopeId, name, value)
			this.emit({ type: "variable:set", name, value, scopeId })
		}
	}

	/**
	 * Merge an element's result — job variables, a script or decision result, a
	 * message or signal payload, a child process's variables. With output
	 * mappings it stays local to the element and the mappings decide what
	 * leaves; without, it propagates like {@link setVariables}.
	 */
	private mergeResult(token: Token, ext: ParsedZeebeExt, vars: Vars | undefined): void {
		if ((ext.ioMapping?.outputs.length ?? 0) === 0) {
			this.setVariables(vars, token.varScopeId)
			return
		}
		for (const [name, value] of Object.entries(vars ?? {})) {
			this.variables.setLocal(token.varScopeId, name, value)
			this.emit({ type: "variable:set", name, value, scopeId: token.varScopeId })
		}
	}

	// ── Complete ───────────────────────────────────────────────────────────────

	private async complete(
		token: Token,
		ctx: ScopeCtx,
		forcedFlows?: BpmnSequenceFlow[],
		options?: { skipOutputs?: boolean; targetEntry?: Entry },
	): Promise<void> {
		// A token terminated while its element was busy never completes.
		if (this._state !== "active" || !this.alive(token)) return

		const el = ctx.elements.get(token.elementId)
		if (el === undefined) return

		const ext = this.zeebeExt(el)
		if (options?.skipOutputs !== true) this.applyOutputs(el, ext, token.varScopeId, ctx.scopeId)

		if (this.beforeComplete !== undefined) {
			await this.beforeComplete(token.elementId)
			if (this._state !== "active" || !this.alive(token)) return
		}

		this.emit({
			type: "element:leaving",
			elementId: el.id,
			elementName: el.name,
			elementType: el.type,
		})
		this.removeToken(token)
		const handler = ctx.compensationHandlers.get(el.id)
		if (handler !== undefined) {
			this.compensationLog.push({
				activityId: el.id,
				handler,
				scopeId: ctx.scopeId,
				scopePath: this.scopePath(ctx),
			})
		}
		this.emit({
			type: "element:left",
			elementId: el.id,
			elementName: el.name,
			elementType: el.type,
		})

		const flows = forcedFlows ?? this.getOutgoingFlows(el.id, ctx)

		if (flows.length === 0) {
			if (ctx.tokens.size === 0 && ctx.pending === 0) this.scopeDone(ctx)
			return
		}

		await this.activateAll(flows, ctx, options?.targetEntry)
	}

	/** Enter several elements of one scope; the scope cannot end before each is entered. */
	private async activateAll(
		targets: ReadonlyArray<{ targetRef: string; id: string | undefined }>,
		ctx: ScopeCtx,
		entry: Entry | undefined,
	): Promise<void> {
		ctx.pending += targets.length
		await Promise.all(targets.map((t) => this.activate(t.targetRef, ctx.scopeId, t.id, entry, ctx)))
	}

	/** Evaluate ioMapping outputs in `evalScopeId` and merge them from `targetScopeId` upwards. */
	private applyOutputs(
		el: BpmnFlowElement,
		ext: ParsedZeebeExt,
		evalScopeId: string,
		targetScopeId: string,
	): void {
		if (!ext.ioMapping) return
		for (const out of ext.ioMapping.outputs) {
			const val = this.evalFeel(out.source, evalScopeId, {
				elementId: el.id,
				property: `output:${out.target}`,
			})
			this.setVariables({ [out.target]: val }, targetScopeId)
		}
	}

	private getOutgoingFlows(elementId: string, ctx: ScopeCtx): BpmnSequenceFlow[] {
		// Condition expressions are only meaningful on exclusive/inclusive gateway outgoing flows
		// (handled by their dedicated handlers). For all other elements, take every outgoing flow.
		return ctx.outgoing.get(elementId) ?? []
	}

	private finishProcess(): void {
		if (this._state !== "active") return
		this._state = "completed"
		this.emit({
			type: "process:completed",
			variables: this.variables.getAll(this.rootScopeId),
		})
	}

	private fail(error: string): void {
		if (this._state !== "active") return
		this._state = "failed"
		this._error = error
		this.emit({ type: "process:failed", error })
	}

	private failElement(elementId: string, error: string): void {
		this.emit({ type: "element:failed", elementId, error })
		this.fail(error)
	}

	// ── FEEL helpers ───────────────────────────────────────────────────────────

	private evalFeel(
		expr: string,
		scopeId: string,
		emitCtx?: { elementId: string; property: string },
		extraVars?: Vars,
	): unknown {
		const scoped = this.variables.snapshot(scopeId)
		const vars = extraVars !== undefined ? { ...scoped, ...extraVars } : scoped
		// Strip Camunda FEEL prefix ("= expr") — the leading "=" is a type indicator, not part of the expression.
		const normalized = expr.trim().replace(/^=\s*/, "")
		const parsed = parseExpression(normalized)
		if (parsed.ast === null) return undefined
		const result = evaluate(parsed.ast, { vars: vars as Record<string, FeelValue> })
		// The event carries a copy of every variable; skip building it when nobody listens.
		if (emitCtx !== undefined && this.listeners.length > 0) {
			this.emit({
				type: "feel:evaluated",
				elementId: emitCtx.elementId,
				property: emitCtx.property,
				expression: expr.trim(),
				result,
				variables: { ...vars },
			})
		}
		return result
	}

	private evalCondition(
		expr: string,
		scopeId: string,
		emitCtx?: { elementId: string; property: string },
		extraVars?: Vars,
	): boolean {
		return this.evalFeel(expr, scopeId, emitCtx, extraVars) === true
	}

	// ── Emit ───────────────────────────────────────────────────────────────────

	private emit(event: ProcessEvent): void {
		for (const listener of this.listeners) listener(event)
	}
}
