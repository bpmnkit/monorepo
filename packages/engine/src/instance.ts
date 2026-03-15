import type {
	BpmnBoundaryEvent,
	BpmnFlowElement,
	BpmnProcess,
	BpmnSequenceFlow,
	DmnDecision,
	FormDefinition,
} from "@bpmnkit/core"
import { generateId } from "@bpmnkit/core"
import { evaluate, parseExpression } from "@bpmnkit/feel"
import type { FeelValue } from "@bpmnkit/feel"
import { evaluateDecision } from "./dmn.js"
import { scheduleTimer } from "./timers.js"
import type { JobHandler, ProcessEvent } from "./types.js"
import { VariableStore } from "./variables.js"
import { parseZeebeExt } from "./zeebe.js"

// ── Internal types ─────────────────────────────────────────────────────────────

interface Token {
	readonly id: string
	readonly elementId: string
	readonly scopeId: string
}

type InstanceState = "active" | "completed" | "terminated" | "failed"

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
}

// ── ProcessInstance ────────────────────────────────────────────────────────────

export class ProcessInstance {
	readonly id: string
	readonly processId: string

	private _state: InstanceState = "active"
	private _error: string | undefined

	/** tokenId → Token */
	private readonly allTokens = new Map<string, Token>()

	/** Scope stack: rootScopeId + any active sub-process scopes */
	private readonly scopes = new Map<string, ScopeCtx>()

	/** Message correlation: messageName → resolve callback */
	private readonly messageSubscriptions = new Map<string, () => void>()

	/** Timer cancel functions keyed by tokenId */
	private readonly timerCancels = new Map<string, () => void>()

	/** Activation count per elementId — used to detect infinite loops. */
	private readonly activationCount = new Map<string, number>()
	private static readonly MAX_ACTIVATIONS = 100

	/** Active boundary timer cancels, keyed by elementId */
	private readonly boundaryTimerCancels = new Map<string, () => void>()

	private readonly variables: VariableStore
	private readonly rootScopeId: string

	private readonly listeners: Array<(e: ProcessEvent) => void> = []

	private readonly decisions: Map<string, DmnDecision>
	private readonly forms: Map<string, FormDefinition>
	private readonly jobWorkers: Map<string, JobHandler>

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
	) {
		this.id = generateId("pi")
		this.processId = process.id
		this.decisions = decisions
		this.forms = forms
		this.jobWorkers = jobWorkers

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

	cancel(): void {
		this._state = "terminated"
		this.cancelAllTimers()
		this.allTokens.clear()
		for (const ctx of this.scopes.values()) ctx.tokens.clear()
	}

	/** Kick off execution. Called by Engine after construction. */
	start(): void {
		const ctx = this.scopes.get(this.rootScopeId)
		if (ctx === undefined) return
		const starts = [...ctx.elements.values()].filter(
			(el) => el.type === "startEvent" && el.incoming.length === 0,
		)
		// Defer activation so callers can attach onChange listeners before events fire.
		void Promise.resolve().then(() => {
			// Emit variable:set for initial variables so listeners (e.g. play panel) see them.
			for (const [name, value] of Object.entries(this.variables.getAll(this.rootScopeId))) {
				this.emit({ type: "variable:set", name, value, scopeId: this.rootScopeId })
			}
			for (const s of starts) {
				void this.activate(s.id, this.rootScopeId, undefined)
			}
		})
	}

	/** Deliver a message to a waiting element. */
	deliverMessage(messageName: string): void {
		const resolve = this.messageSubscriptions.get(messageName)
		if (resolve !== undefined) {
			this.messageSubscriptions.delete(messageName)
			resolve()
		}
	}

	// ── Scope building ─────────────────────────────────────────────────────────

	private buildScopeCtx(
		scopeId: string,
		parentScopeId: string | undefined,
		onComplete: (() => void) | undefined,
		elements: BpmnFlowElement[],
		flows: BpmnSequenceFlow[],
	): ScopeCtx {
		const elemMap = new Map<string, BpmnFlowElement>()
		const outgoing = new Map<string, BpmnSequenceFlow[]>()
		const flowMap = new Map<string, BpmnSequenceFlow>()
		const boundaries = new Map<string, BpmnBoundaryEvent[]>()

		for (const el of elements) {
			elemMap.set(el.id, el)
			if (el.type === "boundaryEvent") {
				const list = boundaries.get(el.attachedToRef) ?? []
				list.push(el)
				boundaries.set(el.attachedToRef, list)
			}
		}
		for (const flow of flows) {
			flowMap.set(flow.id, flow)
			const list = outgoing.get(flow.sourceRef) ?? []
			list.push(flow)
			outgoing.set(flow.sourceRef, list)
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
		}
	}

	// ── Token lifecycle ────────────────────────────────────────────────────────

	private createToken(elementId: string, scopeId: string): Token {
		const token: Token = { id: generateId("tok"), elementId, scopeId }
		this.allTokens.set(token.id, token)
		this.scopes.get(scopeId)?.tokens.add(token.id)
		return token
	}

	private removeToken(token: Token): void {
		this.allTokens.delete(token.id)
		this.scopes.get(token.scopeId)?.tokens.delete(token.id)
		this.timerCancels.get(token.id)?.()
		this.timerCancels.delete(token.id)
	}

	// ── Parallel join tracking ─────────────────────────────────────────────────

	/** elementId → set of incomingFlowIds received */
	private readonly joins = new Map<string, Set<string>>()

	// ── Activation ─────────────────────────────────────────────────────────────

	private async activate(
		elementId: string,
		scopeId: string,
		incomingFlowId: string | undefined,
	): Promise<void> {
		if (this._state !== "active") return

		const ctx = this.scopes.get(scopeId)
		if (ctx === undefined) return

		const el = ctx.elements.get(elementId)
		if (el === undefined) return

		// ── Infinite-loop guard ────────────────────────────────────────────────
		const activations = (this.activationCount.get(elementId) ?? 0) + 1
		this.activationCount.set(elementId, activations)
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
			const seen = this.joins.get(elementId) ?? new Set<string>()
			if (incomingFlowId !== undefined) seen.add(incomingFlowId)
			this.joins.set(elementId, seen)
			if (seen.size < el.incoming.length) return
			this.joins.delete(elementId)
		}

		this.emit({ type: "element:entering", elementId, elementName: el.name, elementType: el.type })

		// Apply ioMapping inputs
		const ext = parseZeebeExt(el.extensionElements)
		if (ext.ioMapping) {
			for (const inp of ext.ioMapping.inputs) {
				const val = this.evalFeel(inp.source, scopeId, {
					elementId: el.id,
					property: `input:${inp.target}`,
				})
				this.variables.setLocal(scopeId, inp.target, val)
				this.emit({ type: "variable:set", name: inp.target, value: val, scopeId })
			}
		}

		const token = this.createToken(elementId, scopeId)
		this.emit({ type: "element:entered", elementId, elementName: el.name, elementType: el.type })

		// Schedule boundary events for activities
		this.scheduleBoundaryTimers(el.id, token, scopeId, ctx)

		await this.dispatch(token, el, ext, ctx)
	}

	// ── Dispatch ───────────────────────────────────────────────────────────────

	private async dispatch(
		token: Token,
		el: BpmnFlowElement,
		ext: ReturnType<typeof parseZeebeExt>,
		ctx: ScopeCtx,
	): Promise<void> {
		switch (el.type) {
			case "startEvent":
			case "task":
			case "manualTask":
			case "sendTask":
			case "receiveTask":
			case "intermediateThrowEvent":
				await this.complete(token, ctx)
				break

			case "endEvent":
				await this.handleEndEvent(token, el, ctx)
				break

			case "serviceTask":
			case "userTask":
				await this.handleJobTask(token, el, ext, ctx)
				break

			case "scriptTask":
				this.handleScriptTask(el, ext, ctx.scopeId)
				await this.complete(token, ctx)
				break

			case "businessRuleTask":
				this.handleBusinessRuleTask(el, ext, ctx.scopeId)
				await this.complete(token, ctx)
				break

			case "exclusiveGateway":
				await this.handleExclusiveGateway(token, el, ctx)
				break

			case "parallelGateway":
				await this.complete(token, ctx)
				break

			case "inclusiveGateway":
				await this.handleInclusiveGateway(token, el, ctx)
				break

			case "intermediateCatchEvent":
				await this.handleIntermediateCatchEvent(token, el, ctx)
				break

			case "subProcess":
			case "transaction":
				await this.handleSubProcess(token, el, ctx)
				break

			default:
				// eventSubProcess, adHocSubProcess, callActivity, etc. — auto-complete
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
			this.cancelAllTimers()
			for (const [id] of this.allTokens) {
				const tok = this.allTokens.get(id)
				if (tok !== undefined) this.scopes.get(tok.scopeId)?.tokens.delete(id)
			}
			this.allTokens.clear()
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
			this.propagateError(eventDef.errorRef ?? "unknown", ctx)
			return
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
					const example = JSON.parse(ext.exampleOutputJson) as Record<string, unknown>
					for (const [k, v] of Object.entries(example)) {
						this.variables.set(ctx.scopeId, k, v)
						this.emit({ type: "variable:set", name: k, value: v, scopeId: ctx.scopeId })
					}
				} catch {
					// Invalid JSON — skip silently
				}
			}
			await this.complete(token, ctx)
			return
		}

		const jobId = generateId("job")
		const headers = ext.taskHeaders ?? {}
		const vars = this.variables.getAll(ctx.scopeId)

		let jobError: string | undefined

		await new Promise<void>((resolve) => {
			const job = {
				id: jobId,
				type: jobType,
				headers,
				variables: vars,
				complete: (outVars?: Record<string, unknown>) => {
					if (outVars) {
						for (const [k, v] of Object.entries(outVars)) {
							this.variables.set(ctx.scopeId, k, v)
							this.emit({ type: "variable:set", name: k, value: v, scopeId: ctx.scopeId })
						}
					}
					resolve()
				},
				fail: (error: string) => {
					jobError = error
					resolve()
				},
				throwError: (_code: string, message: string) => {
					jobError = message
					resolve()
				},
			}

			this.emit({ type: "job:created", job })
			void Promise.resolve(handler(job)).catch((err: unknown) => {
				jobError = err instanceof Error ? err.message : String(err)
				resolve()
			})
		})

		if (jobError !== undefined) {
			this._state = "failed"
			this._error = jobError
			this.emit({ type: "process:failed", error: jobError })
			return
		}

		if (this._state === "active") {
			this.cancelBoundaryTimers(el.id)
			await this.complete(token, ctx)
		}
	}

	private handleScriptTask(
		el: BpmnFlowElement,
		ext: ReturnType<typeof parseZeebeExt>,
		scopeId: string,
	): void {
		const script = ext.scriptTask
		if (script === undefined || script.expression.trim() === "") return
		const result = this.evalFeel(script.expression, scopeId, {
			elementId: el.id,
			property: "script",
		})
		if (script.resultVariable !== "") {
			this.variables.set(scopeId, script.resultVariable, result)
			this.emit({ type: "variable:set", name: script.resultVariable, value: result, scopeId })
		}
	}

	private handleBusinessRuleTask(
		_el: BpmnFlowElement,
		ext: ReturnType<typeof parseZeebeExt>,
		scopeId: string,
	): void {
		const cd = ext.calledDecision
		if (cd === undefined) return
		const decision = this.decisions.get(cd.decisionId)
		if (decision === undefined) return
		const result = evaluateDecision(decision, this.variables.getAll(scopeId))
		this.variables.set(scopeId, cd.resultVariable, result)
		this.emit({ type: "variable:set", name: cd.resultVariable, value: result, scopeId })
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
		el: BpmnFlowElement & { type: "inclusiveGateway" },
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

	private async handleIntermediateCatchEvent(
		token: Token,
		el: BpmnFlowElement & { type: "intermediateCatchEvent" },
		ctx: ScopeCtx,
	): Promise<void> {
		const eventDef = el.eventDefinitions[0]

		if (eventDef?.type === "timer") {
			if (this.beforeComplete === undefined) {
				// Normal mode: honour the real timer duration.
				await new Promise<void>((resolve) => {
					const cancel = scheduleTimer(eventDef, resolve)
					this.timerCancels.set(token.id, cancel)
				})
				this.timerCancels.delete(token.id)
			}
			// Controlled mode (step / auto-play): skip the real wait — the
			// beforeComplete hook in complete() is the user-visible pause point.
		} else if (eventDef?.type === "message") {
			const msgRef = eventDef.messageRef ?? el.id
			await new Promise<void>((resolve) => {
				this.messageSubscriptions.set(msgRef, resolve)
			})
		}

		await this.complete(token, ctx)
	}

	private async handleSubProcess(
		token: Token,
		el: BpmnFlowElement & { type: "subProcess" | "transaction" },
		parentCtx: ScopeCtx,
	): Promise<void> {
		const childScopeId = `scope_sub_${token.id}`
		this.variables.createScope(childScopeId, parentCtx.scopeId)

		await new Promise<void>((resolve) => {
			const childCtx = this.buildScopeCtx(
				childScopeId,
				parentCtx.scopeId,
				resolve,
				el.flowElements,
				el.sequenceFlows,
			)
			this.scopes.set(childScopeId, childCtx)

			const starts = [...childCtx.elements.values()].filter(
				(e) => e.type === "startEvent" && e.incoming.length === 0,
			)

			if (starts.length === 0) {
				resolve()
				return
			}

			for (const s of starts) {
				void this.activate(s.id, childScopeId, undefined)
			}
		})

		this.scopes.delete(childScopeId)
		this.variables.removeScope(childScopeId)
		await this.complete(token, parentCtx)
	}

	// ── Boundary events ────────────────────────────────────────────────────────

	private scheduleBoundaryTimers(
		elementId: string,
		_parentToken: Token,
		scopeId: string,
		ctx: ScopeCtx,
	): void {
		const boundaries = ctx.boundaries.get(elementId) ?? []
		for (const be of boundaries) {
			const timerDef = be.eventDefinitions.find((d) => d.type === "timer")
			if (timerDef === undefined) continue
			const cancel = scheduleTimer(timerDef, () => {
				this.boundaryTimerCancels.delete(elementId)
				// Remove the parent token
				for (const [, tok] of this.allTokens) {
					if (tok.elementId === elementId) {
						this.removeToken(tok)
						break
					}
				}
				if (be.cancelActivity !== false) {
					void this.activate(be.id, scopeId, undefined)
				}
			})
			this.boundaryTimerCancels.set(elementId, cancel)
		}
	}

	private cancelBoundaryTimers(elementId: string): void {
		this.boundaryTimerCancels.get(elementId)?.()
		this.boundaryTimerCancels.delete(elementId)
	}

	private propagateError(errorCode: string, ctx: ScopeCtx): void {
		// Search boundary events in the current scope
		for (const [attachedTo, boundaries] of ctx.boundaries) {
			for (const be of boundaries) {
				const errDef = be.eventDefinitions.find((d) => d.type === "error")
				if (errDef === undefined) continue
				if (errDef.errorRef !== undefined && errDef.errorRef !== errorCode) continue
				for (const [, tok] of this.allTokens) {
					if (tok.elementId === attachedTo) {
						this.removeToken(tok)
						break
					}
				}
				void this.activate(be.id, ctx.scopeId, undefined)
				return
			}
		}
		// Propagate to parent scope
		if (ctx.parentScopeId !== undefined) {
			const parentCtx = this.scopes.get(ctx.parentScopeId)
			if (parentCtx !== undefined) {
				this.propagateError(errorCode, parentCtx)
				return
			}
		}
		this._state = "failed"
		this._error = errorCode
		this.emit({ type: "process:failed", error: errorCode })
	}

	// ── Complete ───────────────────────────────────────────────────────────────

	private async complete(
		token: Token,
		ctx: ScopeCtx,
		forcedFlows?: BpmnSequenceFlow[],
	): Promise<void> {
		if (this._state !== "active") return

		const el = ctx.elements.get(token.elementId)
		if (el === undefined) return

		const ext = parseZeebeExt(el.extensionElements)

		// Apply ioMapping outputs
		if (ext.ioMapping) {
			for (const out of ext.ioMapping.outputs) {
				const val = this.evalFeel(out.source, ctx.scopeId, {
					elementId: el.id,
					property: `output:${out.target}`,
				})
				this.variables.set(ctx.scopeId, out.target, val)
				this.emit({ type: "variable:set", name: out.target, value: val, scopeId: ctx.scopeId })
			}
		}

		if (this.beforeComplete !== undefined) {
			await this.beforeComplete(token.elementId)
			if (this._state !== "active") return
		}

		this.emit({
			type: "element:leaving",
			elementId: el.id,
			elementName: el.name,
			elementType: el.type,
		})
		this.cancelBoundaryTimers(el.id)
		this.removeToken(token)
		this.emit({
			type: "element:left",
			elementId: el.id,
			elementName: el.name,
			elementType: el.type,
		})

		const flows = forcedFlows ?? this.getOutgoingFlows(el.id, ctx)

		if (flows.length === 0) {
			// Sub-process scope: notify parent when scope tokens are exhausted
			if (ctx.tokens.size === 0 && ctx.onComplete !== undefined) {
				ctx.onComplete()
			} else if (ctx.tokens.size === 0 && ctx.parentScopeId === undefined) {
				this.finishProcess()
			}
			return
		}

		await Promise.all(flows.map((f) => this.activate(f.targetRef, ctx.scopeId, f.id)))
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

	private cancelAllTimers(): void {
		for (const cancel of this.timerCancels.values()) cancel()
		this.timerCancels.clear()
		for (const cancel of this.boundaryTimerCancels.values()) cancel()
		this.boundaryTimerCancels.clear()
	}

	// ── FEEL helpers ───────────────────────────────────────────────────────────

	private evalFeel(
		expr: string,
		scopeId: string,
		emitCtx?: { elementId: string; property: string },
	): unknown {
		const vars = this.variables.getAll(scopeId)
		// Strip Camunda FEEL prefix ("= expr") — the leading "=" is a type indicator, not part of the expression.
		const normalized = expr.trim().replace(/^=\s*/, "")
		const parsed = parseExpression(normalized)
		if (parsed.ast === null) return undefined
		const result = evaluate(parsed.ast, { vars: vars as Record<string, FeelValue> })
		if (emitCtx !== undefined) {
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
	): boolean {
		return this.evalFeel(expr, scopeId, emitCtx) === true
	}

	// ── Emit ───────────────────────────────────────────────────────────────────

	private emit(event: ProcessEvent): void {
		for (const listener of this.listeners) listener(event)
	}
}
