import type {
	BpmnBoundaryEvent,
	BpmnFlowElement,
	BpmnProcess,
	BpmnSequenceFlow,
	DmnDecision,
	FormDefinition,
} from "@bpmn-sdk/core";
import { generateId } from "@bpmn-sdk/core";
import { evaluate, parseExpression } from "@bpmn-sdk/feel";
import type { FeelValue } from "@bpmn-sdk/feel";
import { evaluateDecision } from "./dmn.js";
import { scheduleTimer } from "./timers.js";
import type { JobHandler, ProcessEvent } from "./types.js";
import { VariableStore } from "./variables.js";
import { parseZeebeExt } from "./zeebe.js";

// ── Internal types ─────────────────────────────────────────────────────────────

interface Token {
	readonly id: string;
	readonly elementId: string;
	readonly scopeId: string;
}

type InstanceState = "active" | "completed" | "terminated" | "failed";

/** Execution context for a scope (process or sub-process). */
interface ScopeCtx {
	readonly scopeId: string;
	readonly parentScopeId: string | undefined;
	/** Resolve when this scope completes (used for sub-processes). */
	readonly onComplete: (() => void) | undefined;
	/** All flow elements (flat) within this scope */
	readonly elements: Map<string, BpmnFlowElement>;
	/** elementId → outgoing flows */
	readonly outgoing: Map<string, BpmnSequenceFlow[]>;
	/** flowId → flow */
	readonly flows: Map<string, BpmnSequenceFlow>;
	/** elementId → boundary events attached to it */
	readonly boundaries: Map<string, BpmnBoundaryEvent[]>;
	/** Active tokens in this scope */
	readonly tokens: Set<string>;
}

// ── ProcessInstance ────────────────────────────────────────────────────────────

export class ProcessInstance {
	readonly id: string;
	readonly processId: string;

	private _state: InstanceState = "active";
	private _error: string | undefined;

	/** tokenId → Token */
	private readonly allTokens = new Map<string, Token>();

	/** Scope stack: rootScopeId + any active sub-process scopes */
	private readonly scopes = new Map<string, ScopeCtx>();

	/** Message correlation: messageName → resolve callback */
	private readonly messageSubscriptions = new Map<string, () => void>();

	/** Timer cancel functions keyed by tokenId */
	private readonly timerCancels = new Map<string, () => void>();

	/** Active boundary timer cancels, keyed by elementId */
	private readonly boundaryTimerCancels = new Map<string, () => void>();

	private readonly variables: VariableStore;
	private readonly rootScopeId: string;

	private readonly listeners: Array<(e: ProcessEvent) => void> = [];

	private readonly decisions: Map<string, DmnDecision>;
	private readonly forms: Map<string, FormDefinition>;
	private readonly jobWorkers: Map<string, JobHandler>;

	constructor(
		process: BpmnProcess,
		decisions: Map<string, DmnDecision>,
		forms: Map<string, FormDefinition>,
		jobWorkers: Map<string, JobHandler>,
		initialVars: Record<string, unknown>,
	) {
		this.id = generateId("pi");
		this.processId = process.id;
		this.decisions = decisions;
		this.forms = forms;
		this.jobWorkers = jobWorkers;

		this.variables = new VariableStore();
		this.rootScopeId = `scope_${this.id}`;
		this.variables.createScope(this.rootScopeId);
		for (const [k, v] of Object.entries(initialVars)) {
			this.variables.setLocal(this.rootScopeId, k, v);
		}

		const rootCtx = this.buildScopeCtx(
			this.rootScopeId,
			undefined,
			undefined,
			process.flowElements,
			process.sequenceFlows,
		);
		this.scopes.set(this.rootScopeId, rootCtx);
	}

	// ── Public API ─────────────────────────────────────────────────────────────

	get state(): InstanceState {
		return this._state;
	}

	get error(): string | undefined {
		return this._error;
	}

	get activeElements(): string[] {
		return [...this.allTokens.values()].map((t) => t.elementId);
	}

	get variables_snapshot(): Record<string, unknown> {
		return this.variables.getAll(this.rootScopeId);
	}

	onChange(callback: (event: ProcessEvent) => void): () => void {
		this.listeners.push(callback);
		return () => {
			const idx = this.listeners.indexOf(callback);
			if (idx !== -1) this.listeners.splice(idx, 1);
		};
	}

	cancel(): void {
		this._state = "terminated";
		this.cancelAllTimers();
		this.allTokens.clear();
		for (const ctx of this.scopes.values()) ctx.tokens.clear();
	}

	/** Kick off execution. Called by Engine after construction. */
	start(): void {
		const ctx = this.scopes.get(this.rootScopeId);
		if (ctx === undefined) return;
		const starts = [...ctx.elements.values()].filter(
			(el) => el.type === "startEvent" && el.incoming.length === 0,
		);
		for (const s of starts) {
			void this.activate(s.id, this.rootScopeId, undefined);
		}
	}

	/** Deliver a message to a waiting element. */
	deliverMessage(messageName: string): void {
		const resolve = this.messageSubscriptions.get(messageName);
		if (resolve !== undefined) {
			this.messageSubscriptions.delete(messageName);
			resolve();
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
		const elemMap = new Map<string, BpmnFlowElement>();
		const outgoing = new Map<string, BpmnSequenceFlow[]>();
		const flowMap = new Map<string, BpmnSequenceFlow>();
		const boundaries = new Map<string, BpmnBoundaryEvent[]>();

		for (const el of elements) {
			elemMap.set(el.id, el);
			if (el.type === "boundaryEvent") {
				const list = boundaries.get(el.attachedToRef) ?? [];
				list.push(el);
				boundaries.set(el.attachedToRef, list);
			}
		}
		for (const flow of flows) {
			flowMap.set(flow.id, flow);
			const list = outgoing.get(flow.sourceRef) ?? [];
			list.push(flow);
			outgoing.set(flow.sourceRef, list);
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
		};
	}

	// ── Token lifecycle ────────────────────────────────────────────────────────

	private createToken(elementId: string, scopeId: string): Token {
		const token: Token = { id: generateId("tok"), elementId, scopeId };
		this.allTokens.set(token.id, token);
		this.scopes.get(scopeId)?.tokens.add(token.id);
		return token;
	}

	private removeToken(token: Token): void {
		this.allTokens.delete(token.id);
		this.scopes.get(token.scopeId)?.tokens.delete(token.id);
		this.timerCancels.get(token.id)?.();
		this.timerCancels.delete(token.id);
	}

	// ── Parallel join tracking ─────────────────────────────────────────────────

	/** elementId → set of incomingFlowIds received */
	private readonly joins = new Map<string, Set<string>>();

	// ── Activation ─────────────────────────────────────────────────────────────

	private async activate(
		elementId: string,
		scopeId: string,
		incomingFlowId: string | undefined,
	): Promise<void> {
		if (this._state !== "active") return;

		const ctx = this.scopes.get(scopeId);
		if (ctx === undefined) return;

		const el = ctx.elements.get(elementId);
		if (el === undefined) return;

		// ── Parallel gateway join ──────────────────────────────────────────────
		if (el.type === "parallelGateway" && el.incoming.length > 1) {
			const seen = this.joins.get(elementId) ?? new Set<string>();
			if (incomingFlowId !== undefined) seen.add(incomingFlowId);
			this.joins.set(elementId, seen);
			if (seen.size < el.incoming.length) return;
			this.joins.delete(elementId);
		}

		this.emit({ type: "element:entering", elementId, elementName: el.name, elementType: el.type });

		// Apply ioMapping inputs
		const ext = parseZeebeExt(el.extensionElements);
		if (ext.ioMapping) {
			for (const inp of ext.ioMapping.inputs) {
				const val = this.evalFeel(inp.source, scopeId);
				this.variables.setLocal(scopeId, inp.target, val);
				this.emit({ type: "variable:set", name: inp.target, value: val, scopeId });
			}
		}

		const token = this.createToken(elementId, scopeId);
		this.emit({ type: "element:entered", elementId, elementName: el.name, elementType: el.type });

		// Schedule boundary events for activities
		this.scheduleBoundaryTimers(el.id, token, scopeId, ctx);

		await this.dispatch(token, el, ext, ctx);
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
				await this.complete(token, ctx);
				break;

			case "endEvent":
				await this.handleEndEvent(token, el, ctx);
				break;

			case "serviceTask":
			case "userTask":
				await this.handleJobTask(token, el, ext, ctx);
				break;

			case "scriptTask":
				this.handleScriptTask(el, ext, ctx.scopeId);
				await this.complete(token, ctx);
				break;

			case "businessRuleTask":
				this.handleBusinessRuleTask(el, ext, ctx.scopeId);
				await this.complete(token, ctx);
				break;

			case "exclusiveGateway":
				await this.handleExclusiveGateway(token, el, ctx);
				break;

			case "parallelGateway":
				await this.complete(token, ctx);
				break;

			case "inclusiveGateway":
				await this.handleInclusiveGateway(token, el, ctx);
				break;

			case "intermediateCatchEvent":
				await this.handleIntermediateCatchEvent(token, el, ctx);
				break;

			case "subProcess":
			case "transaction":
				await this.handleSubProcess(token, el, ctx);
				break;

			default:
				// eventSubProcess, adHocSubProcess, callActivity, etc. — auto-complete
				await this.complete(token, ctx);
				break;
		}
	}

	// ── Element handlers ───────────────────────────────────────────────────────

	private async handleEndEvent(
		token: Token,
		el: BpmnFlowElement & { type: "endEvent" },
		ctx: ScopeCtx,
	): Promise<void> {
		const eventDef = el.eventDefinitions[0];

		if (eventDef?.type === "terminate") {
			this.cancelAllTimers();
			for (const [id] of this.allTokens) {
				const tok = this.allTokens.get(id);
				if (tok !== undefined) this.scopes.get(tok.scopeId)?.tokens.delete(id);
			}
			this.allTokens.clear();
			this.emit({
				type: "element:leaving",
				elementId: el.id,
				elementName: el.name,
				elementType: el.type,
			});
			this.emit({
				type: "element:left",
				elementId: el.id,
				elementName: el.name,
				elementType: el.type,
			});
			this.finishProcess();
			return;
		}

		if (eventDef?.type === "error") {
			this.removeToken(token);
			this.emit({
				type: "element:leaving",
				elementId: el.id,
				elementName: el.name,
				elementType: el.type,
			});
			this.emit({
				type: "element:left",
				elementId: el.id,
				elementName: el.name,
				elementType: el.type,
			});
			this.propagateError(eventDef.errorRef ?? "unknown", ctx);
			return;
		}

		await this.complete(token, ctx);
	}

	private async handleJobTask(
		token: Token,
		el: BpmnFlowElement,
		ext: ReturnType<typeof parseZeebeExt>,
		ctx: ScopeCtx,
	): Promise<void> {
		const jobType = ext.taskDefinition?.type ?? el.type;
		const handler = this.jobWorkers.get(jobType);

		if (handler === undefined) {
			await this.complete(token, ctx);
			return;
		}

		const jobId = generateId("job");
		const headers = ext.taskHeaders ?? {};
		const vars = this.variables.getAll(ctx.scopeId);

		let jobError: string | undefined;

		await new Promise<void>((resolve) => {
			const job = {
				id: jobId,
				type: jobType,
				headers,
				variables: vars,
				complete: (outVars?: Record<string, unknown>) => {
					if (outVars) {
						for (const [k, v] of Object.entries(outVars)) {
							this.variables.set(ctx.scopeId, k, v);
							this.emit({ type: "variable:set", name: k, value: v, scopeId: ctx.scopeId });
						}
					}
					resolve();
				},
				fail: (error: string) => {
					jobError = error;
					resolve();
				},
				throwError: (_code: string, message: string) => {
					jobError = message;
					resolve();
				},
			};

			this.emit({ type: "job:created", job });
			void Promise.resolve(handler(job)).catch((err: unknown) => {
				jobError = err instanceof Error ? err.message : String(err);
				resolve();
			});
		});

		if (jobError !== undefined) {
			this._state = "failed";
			this._error = jobError;
			this.emit({ type: "process:failed", error: jobError });
			return;
		}

		if (this._state === "active") {
			this.cancelBoundaryTimers(el.id);
			await this.complete(token, ctx);
		}
	}

	private handleScriptTask(
		el: BpmnFlowElement,
		ext: ReturnType<typeof parseZeebeExt>,
		scopeId: string,
	): void {
		const script = ext.scriptTask;
		if (script === undefined || script.expression.trim() === "") return;
		const result = this.evalFeel(script.expression, scopeId);
		if (script.resultVariable !== "") {
			this.variables.set(scopeId, script.resultVariable, result);
			this.emit({ type: "variable:set", name: script.resultVariable, value: result, scopeId });
		}
	}

	private handleBusinessRuleTask(
		_el: BpmnFlowElement,
		ext: ReturnType<typeof parseZeebeExt>,
		scopeId: string,
	): void {
		const cd = ext.calledDecision;
		if (cd === undefined) return;
		const decision = this.decisions.get(cd.decisionId);
		if (decision === undefined) return;
		const result = evaluateDecision(decision, this.variables.getAll(scopeId));
		this.variables.set(scopeId, cd.resultVariable, result);
		this.emit({ type: "variable:set", name: cd.resultVariable, value: result, scopeId });
	}

	private async handleExclusiveGateway(
		token: Token,
		el: BpmnFlowElement & { type: "exclusiveGateway" },
		ctx: ScopeCtx,
	): Promise<void> {
		const outflows = ctx.outgoing.get(el.id) ?? [];
		const defaultFlowId = el.default;

		let taken: BpmnSequenceFlow | undefined;
		for (const flow of outflows) {
			if (flow.id === defaultFlowId) continue;
			if (flow.conditionExpression === undefined) {
				taken = flow;
				break;
			}
			if (this.evalCondition(flow.conditionExpression.text, ctx.scopeId)) {
				taken = flow;
				break;
			}
		}

		if (taken === undefined && defaultFlowId !== undefined) {
			taken = ctx.flows.get(defaultFlowId);
		}

		await this.complete(token, ctx, taken !== undefined ? [taken] : []);
	}

	private async handleInclusiveGateway(
		token: Token,
		el: BpmnFlowElement & { type: "inclusiveGateway" },
		ctx: ScopeCtx,
	): Promise<void> {
		const outflows = ctx.outgoing.get(el.id) ?? [];
		const defaultFlowId = el.default;

		const matching = outflows.filter((f) => {
			if (f.id === defaultFlowId) return false;
			if (f.conditionExpression === undefined) return true;
			return this.evalCondition(f.conditionExpression.text, ctx.scopeId);
		});

		const flows =
			matching.length > 0
				? matching
				: defaultFlowId !== undefined
					? [ctx.flows.get(defaultFlowId)].filter((f): f is BpmnSequenceFlow => f !== undefined)
					: [];

		await this.complete(token, ctx, flows);
	}

	private async handleIntermediateCatchEvent(
		token: Token,
		el: BpmnFlowElement & { type: "intermediateCatchEvent" },
		ctx: ScopeCtx,
	): Promise<void> {
		const eventDef = el.eventDefinitions[0];

		if (eventDef?.type === "timer") {
			await new Promise<void>((resolve) => {
				const cancel = scheduleTimer(eventDef, resolve);
				this.timerCancels.set(token.id, cancel);
			});
			this.timerCancels.delete(token.id);
		} else if (eventDef?.type === "message") {
			const msgRef = eventDef.messageRef ?? el.id;
			await new Promise<void>((resolve) => {
				this.messageSubscriptions.set(msgRef, resolve);
			});
		}

		await this.complete(token, ctx);
	}

	private async handleSubProcess(
		token: Token,
		el: BpmnFlowElement & { type: "subProcess" | "transaction" },
		parentCtx: ScopeCtx,
	): Promise<void> {
		const childScopeId = `scope_sub_${token.id}`;
		this.variables.createScope(childScopeId, parentCtx.scopeId);

		await new Promise<void>((resolve) => {
			const childCtx = this.buildScopeCtx(
				childScopeId,
				parentCtx.scopeId,
				resolve,
				el.flowElements,
				el.sequenceFlows,
			);
			this.scopes.set(childScopeId, childCtx);

			const starts = [...childCtx.elements.values()].filter(
				(e) => e.type === "startEvent" && e.incoming.length === 0,
			);

			if (starts.length === 0) {
				resolve();
				return;
			}

			for (const s of starts) {
				void this.activate(s.id, childScopeId, undefined);
			}
		});

		this.scopes.delete(childScopeId);
		this.variables.removeScope(childScopeId);
		await this.complete(token, parentCtx);
	}

	// ── Boundary events ────────────────────────────────────────────────────────

	private scheduleBoundaryTimers(
		elementId: string,
		_parentToken: Token,
		scopeId: string,
		ctx: ScopeCtx,
	): void {
		const boundaries = ctx.boundaries.get(elementId) ?? [];
		for (const be of boundaries) {
			const timerDef = be.eventDefinitions.find((d) => d.type === "timer");
			if (timerDef === undefined) continue;
			const cancel = scheduleTimer(timerDef, () => {
				this.boundaryTimerCancels.delete(elementId);
				// Remove the parent token
				for (const [, tok] of this.allTokens) {
					if (tok.elementId === elementId) {
						this.removeToken(tok);
						break;
					}
				}
				if (be.cancelActivity !== false) {
					void this.activate(be.id, scopeId, undefined);
				}
			});
			this.boundaryTimerCancels.set(elementId, cancel);
		}
	}

	private cancelBoundaryTimers(elementId: string): void {
		this.boundaryTimerCancels.get(elementId)?.();
		this.boundaryTimerCancels.delete(elementId);
	}

	private propagateError(errorCode: string, ctx: ScopeCtx): void {
		// Search boundary events in the current scope
		for (const [attachedTo, boundaries] of ctx.boundaries) {
			for (const be of boundaries) {
				const errDef = be.eventDefinitions.find((d) => d.type === "error");
				if (errDef === undefined) continue;
				if (errDef.errorRef !== undefined && errDef.errorRef !== errorCode) continue;
				for (const [, tok] of this.allTokens) {
					if (tok.elementId === attachedTo) {
						this.removeToken(tok);
						break;
					}
				}
				void this.activate(be.id, ctx.scopeId, undefined);
				return;
			}
		}
		// Propagate to parent scope
		if (ctx.parentScopeId !== undefined) {
			const parentCtx = this.scopes.get(ctx.parentScopeId);
			if (parentCtx !== undefined) {
				this.propagateError(errorCode, parentCtx);
				return;
			}
		}
		this._state = "failed";
		this._error = errorCode;
		this.emit({ type: "process:failed", error: errorCode });
	}

	// ── Complete ───────────────────────────────────────────────────────────────

	private async complete(
		token: Token,
		ctx: ScopeCtx,
		forcedFlows?: BpmnSequenceFlow[],
	): Promise<void> {
		if (this._state !== "active") return;

		const el = ctx.elements.get(token.elementId);
		if (el === undefined) return;

		const ext = parseZeebeExt(el.extensionElements);

		// Apply ioMapping outputs
		if (ext.ioMapping) {
			for (const out of ext.ioMapping.outputs) {
				const val = this.evalFeel(out.source, ctx.scopeId);
				this.variables.set(ctx.scopeId, out.target, val);
				this.emit({ type: "variable:set", name: out.target, value: val, scopeId: ctx.scopeId });
			}
		}

		this.emit({
			type: "element:leaving",
			elementId: el.id,
			elementName: el.name,
			elementType: el.type,
		});
		this.cancelBoundaryTimers(el.id);
		this.removeToken(token);
		this.emit({
			type: "element:left",
			elementId: el.id,
			elementName: el.name,
			elementType: el.type,
		});

		const flows = forcedFlows ?? this.getOutgoingFlows(el.id, ctx);

		if (flows.length === 0) {
			// Sub-process scope: notify parent when scope tokens are exhausted
			if (ctx.tokens.size === 0 && ctx.onComplete !== undefined) {
				ctx.onComplete();
			} else if (ctx.tokens.size === 0 && ctx.parentScopeId === undefined) {
				this.finishProcess();
			}
			return;
		}

		await Promise.all(flows.map((f) => this.activate(f.targetRef, ctx.scopeId, f.id)));
	}

	private getOutgoingFlows(elementId: string, ctx: ScopeCtx): BpmnSequenceFlow[] {
		return (ctx.outgoing.get(elementId) ?? []).filter((f) => {
			if (f.conditionExpression === undefined) return true;
			return this.evalCondition(f.conditionExpression.text, ctx.scopeId);
		});
	}

	private finishProcess(): void {
		if (this._state !== "active") return;
		this._state = "completed";
		this.emit({
			type: "process:completed",
			variables: this.variables.getAll(this.rootScopeId),
		});
	}

	private cancelAllTimers(): void {
		for (const cancel of this.timerCancels.values()) cancel();
		this.timerCancels.clear();
		for (const cancel of this.boundaryTimerCancels.values()) cancel();
		this.boundaryTimerCancels.clear();
	}

	// ── FEEL helpers ───────────────────────────────────────────────────────────

	private evalFeel(expr: string, scopeId: string): unknown {
		const vars = this.variables.getAll(scopeId);
		const parsed = parseExpression(expr.trim());
		if (parsed.ast === null) return undefined;
		return evaluate(parsed.ast, { vars: vars as Record<string, FeelValue> });
	}

	private evalCondition(expr: string, scopeId: string): boolean {
		return this.evalFeel(expr, scopeId) === true;
	}

	// ── Emit ───────────────────────────────────────────────────────────────────

	private emit(event: ProcessEvent): void {
		for (const listener of this.listeners) listener(event);
	}
}
