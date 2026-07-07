import { parseExpression } from "@bpmnkit/feel"
import { buildAiAgentSubProcess } from "../bpmn/agentic.js"
import { applyAutoLayout } from "../bpmn/auto-layout.js"
import type {
	AdHocSubProcessOptions,
	BoundaryEventOptions,
	BranchBuilder,
	BusinessRuleTaskOptions,
	CallActivityOptions,
	ElementOptions,
	EndEventOptions,
	GatewayOptions,
	IntermediateCatchEventOptions,
	MessageTaskOptions,
	ProcessBuilder,
	ScriptTaskOptions,
	ServiceTaskOptions,
	StartEventOptions,
	SubProcessContentBuilder,
	SubProcessOptions,
	UserTaskOptions,
} from "../bpmn/bpmn-builder.js"
import type { BpmnDefinitions } from "../bpmn/bpmn-model.js"
import { Bpmn } from "../bpmn/index.js"
import { optimize } from "../bpmn/optimize/index.js"
import { slugify, uniqueId } from "./slug.js"
import type { PlanAgentTool, PlanBranch, PlanConnectorRef, PlanStep, ProcessPlan } from "./types.js"

export interface PlanProblem {
	/** A path into the plan, e.g. "steps[2].branches[0].condition", for pinpointing the offending field. */
	path: string
	message: string
}

export interface SynthResult {
	defs?: BpmnDefinitions
	xml?: string
	problems: PlanProblem[]
}

/** What a connector template resolves to — structurally matches `@bpmnkit/connectors`' `ApplyResult`. */
export interface ConnectorApplyResult {
	serviceTask?: ServiceTaskOptions
	adHocSubProcess?: Partial<AdHocSubProcessOptions>
	startEvent?: Partial<StartEventOptions>
	boundaryEvent?: Partial<BoundaryEventOptions>
	intermediateEvent?: Partial<IntermediateCatchEventOptions>
	problems: Array<{ key?: string; message: string }>
}

export type ConnectorResolver = (
	templateId: string,
	values: Record<string, string>,
) => ConnectorApplyResult

export interface CompilePlanOptions {
	/** Resolves `PlanConnectorRef`s — pass `applyConnectorTemplate` from `@bpmnkit/connectors`. Without it, connector steps produce a problem. */
	resolveConnector?: ConnectorResolver
	/** Skip auto-applying safe optimizer fixes (default false). */
	skipAutoFix?: boolean
}

// ---------------------------------------------------------------------------
// ID assignment — every step gets a stable id before any builder call is made,
// so gateway branches can `connectTo()` the right target up front.
// ---------------------------------------------------------------------------

function assignIds(steps: PlanStep[], taken: Set<string>, idOf: Map<PlanStep, string>): void {
	for (const step of steps) {
		const base = step.id ?? slugify(step.name ?? step.kind)
		idOf.set(step, uniqueId(base, taken))
		if (step.errorBoundary) assignIds(step.errorBoundary.steps, taken, idOf)
		if (step.timerBoundary) assignIds(step.timerBoundary.steps, taken, idOf)
		if (step.kind === "gateway") {
			for (const branch of step.branches) assignIds(branch.steps, taken, idOf)
		}
		if (step.kind === "subProcess") assignIds(step.steps, taken, idOf)
	}
}

// ---------------------------------------------------------------------------
// FEEL validation
// ---------------------------------------------------------------------------

function checkFeel(path: string, value: string | undefined, problems: PlanProblem[]): void {
	if (!value || !value.startsWith("=")) return
	const { errors } = parseExpression(value.slice(1))
	for (const err of errors) {
		problems.push({ path, message: `Invalid FEEL expression: ${err.message}` })
	}
}

// ---------------------------------------------------------------------------
// Connector / agent tool resolution
// ---------------------------------------------------------------------------

function resolveConnectorOrProblem(
	ref: PlanConnectorRef,
	path: string,
	resolve: ConnectorResolver | undefined,
	problems: PlanProblem[],
): ConnectorApplyResult | undefined {
	if (!resolve) {
		problems.push({
			path,
			message: `Step references connector template "${ref.template}" but no connector resolver was provided to compilePlan()`,
		})
		return undefined
	}
	const result = resolve(ref.template, ref.values ?? {})
	for (const p of result.problems) {
		problems.push({ path: p.key ? `${path}.values.${p.key}` : path, message: p.message })
	}
	return result
}

function toolServiceTaskOptions(
	tool: PlanAgentTool,
	path: string,
	resolve: ConnectorResolver | undefined,
	problems: PlanProblem[],
): ServiceTaskOptions {
	if (tool.connector) {
		const result = resolveConnectorOrProblem(tool.connector, path, resolve, problems)
		if (result?.serviceTask) return result.serviceTask
		return { name: tool.id, taskType: "" }
	}
	return { name: tool.id, taskType: tool.jobType ?? "" }
}

// ---------------------------------------------------------------------------
// Structural builder interface — satisfied by ProcessBuilder, BranchBuilder,
// and SubProcessContentBuilder alike (they share identical method shapes).
// ---------------------------------------------------------------------------

interface StepBuilder {
	serviceTask(id: string, options: ServiceTaskOptions): unknown
	userTask(id: string, options?: UserTaskOptions): unknown
	scriptTask(id: string, options: ScriptTaskOptions): unknown
	sendTask(id: string, options?: MessageTaskOptions): unknown
	receiveTask(id: string, options?: MessageTaskOptions): unknown
	businessRuleTask(id: string, options?: BusinessRuleTaskOptions): unknown
	callActivity(id: string, options: CallActivityOptions): unknown
	endEvent(id: string, options?: EndEventOptions): unknown
	intermediateCatchEvent(id: string, options?: IntermediateCatchEventOptions): unknown
	exclusiveGateway(id: string, options?: GatewayOptions): unknown
	parallelGateway(id: string, options?: ElementOptions): unknown
	inclusiveGateway(id: string, options?: GatewayOptions): unknown
	eventBasedGateway(id: string, options?: ElementOptions): unknown
	adHocSubProcess(
		id: string,
		content: (b: SubProcessContentBuilder) => void,
		options?: AdHocSubProcessOptions,
	): unknown
	subProcess(
		id: string,
		content: (b: SubProcessContentBuilder) => void,
		options?: SubProcessOptions,
	): unknown
	branch(name: string, callback: (b: BranchBuilder) => void): unknown
	withBoundary(
		id: string,
		options: Omit<BoundaryEventOptions, "attachedTo">,
		handler: (b: StepBuilder) => void,
	): unknown
}

// ---------------------------------------------------------------------------
// Step emission
// ---------------------------------------------------------------------------

function emitStep(
	b: StepBuilder,
	step: PlanStep,
	id: string,
	path: string,
	nextId: string | undefined,
	idOf: Map<PlanStep, string>,
	resolve: ConnectorResolver | undefined,
	problems: PlanProblem[],
): void {
	switch (step.kind) {
		case "start":
			// Handled by the caller — start steps are only valid as plan.steps[0].
			return
		case "connector": {
			const result = resolveConnectorOrProblem(
				step.connector,
				`${path}.connector`,
				resolve,
				problems,
			)
			b.serviceTask(id, {
				...(result?.serviceTask ?? { name: step.name ?? id, taskType: "" }),
				documentation: step.documentation,
				...(step.retries ? { retries: step.retries } : {}),
			})
			return
		}
		case "serviceTask": {
			const inputs = Object.entries(step.inputs ?? {}).map(([target, source]) => ({
				source,
				target,
			}))
			const outputs = Object.entries(step.outputs ?? {}).map(([target, source]) => ({
				source,
				target,
			}))
			for (const [k, v] of Object.entries(step.inputs ?? {}))
				checkFeel(`${path}.inputs.${k}`, v, problems)
			for (const [k, v] of Object.entries(step.outputs ?? {}))
				checkFeel(`${path}.outputs.${k}`, v, problems)
			b.serviceTask(id, {
				name: step.name ?? id,
				documentation: step.documentation,
				taskType: step.jobType,
				retries: step.retries,
				taskHeaders: step.taskHeaders,
				ioMapping: inputs.length || outputs.length ? { inputs, outputs } : undefined,
			})
			return
		}
		case "userTask":
			b.userTask(id, {
				name: step.name ?? id,
				documentation: step.documentation,
				zeebeUserTask: true,
				formId: step.formId,
				assignee: step.assignee,
				candidateGroups: step.candidateGroups,
				candidateUsers: step.candidateUsers,
				dueDate: step.dueDate,
				followUpDate: step.followUpDate,
				priority: step.priority,
			})
			return
		case "businessRuleTask":
			b.businessRuleTask(id, {
				name: step.name ?? id,
				documentation: step.documentation,
				decisionId: step.decisionId,
				resultVariable: step.resultVariable,
			})
			return
		case "scriptTask":
			checkFeel(`${path}.expression`, step.expression, problems)
			b.scriptTask(id, {
				name: step.name ?? id,
				documentation: step.documentation,
				expression: step.expression,
				resultVariable: step.resultVariable,
			})
			return
		case "sendTask":
			b.sendTask(id, {
				name: step.name ?? id,
				documentation: step.documentation,
				messageName: step.messageName,
			})
			return
		case "receiveTask":
			b.receiveTask(id, {
				name: step.name ?? id,
				documentation: step.documentation,
				messageName: step.messageName,
				correlationKey: step.correlationKey,
			})
			return
		case "callActivity":
			b.callActivity(id, {
				name: step.name ?? id,
				documentation: step.documentation,
				processId: step.processId,
				propagateAllChildVariables: step.propagateAllChildVariables,
			})
			return
		case "aiAgent": {
			checkFeel(`${path}.systemPrompt`, step.systemPrompt, problems)
			checkFeel(`${path}.userPrompt`, step.userPrompt, problems)
			checkFeel(`${path}.completionCondition`, step.completionCondition, problems)
			if (step.tools.length === 0) {
				problems.push({ path: `${path}.tools`, message: "aiAgent step has no tools" })
			}
			const agent = buildAiAgentSubProcess({
				id,
				name: step.name,
				model: {
					provider: step.provider,
					inputs: { [`provider.${step.provider}.model.model`]: step.model, ...step.providerInputs },
				},
				systemPrompt: step.systemPrompt,
				userPrompt: step.userPrompt,
				memoryStorageType: step.memoryStorageType,
				maxModelCalls: step.maxModelCalls,
				outputVariable: step.outputVariable,
				retries: step.retries,
				completionCondition: step.completionCondition,
				cancelRemainingInstances: step.cancelRemainingInstances,
				tools: step.tools.map((tool) => ({
					id: tool.id,
					description: tool.description,
					serviceTask: toolServiceTaskOptions(tool, `${path}.tools[${tool.id}]`, resolve, problems),
					params: (tool.params ?? []).map((p) => ({
						name: p.name,
						description: p.description,
						type: p.type,
						required: p.required,
						schema: p.schema,
						target: p.target ?? p.name,
					})),
					resultSource: tool.resultExpression,
				})),
			})
			b.adHocSubProcess(id, agent.content, agent.options)
			return
		}
		case "gateway": {
			const gwOptions: GatewayOptions = { name: step.name, documentation: step.documentation }
			switch (step.gatewayType) {
				case "exclusive":
					b.exclusiveGateway(id, gwOptions)
					break
				case "parallel":
					b.parallelGateway(id, gwOptions)
					break
				case "inclusive":
					b.inclusiveGateway(id, gwOptions)
					break
				case "eventBased":
					b.eventBasedGateway(id, gwOptions)
					break
			}
			for (let bi = 0; bi < step.branches.length; bi++) {
				const branch = step.branches[bi] as PlanBranch
				checkFeel(`${path}.branches[${bi}].condition`, branch.condition, problems)
				b.branch(branch.name ?? `branch_${bi + 1}`, (bb) => {
					if (branch.default) bb.defaultFlow()
					else if (branch.condition) bb.condition(branch.condition)
					emitSteps(bb, branch.steps, idOf, resolve, problems, `${path}.branches[${bi}].steps`)
					if (nextId) bb.connectTo(nextId)
				})
			}
			return
		}
		case "subProcess":
			b.subProcess(
				id,
				(sb) => emitSteps(sb, step.steps, idOf, resolve, problems, `${path}.steps`),
				{
					name: step.name,
					documentation: step.documentation,
					multiInstance: step.multiInstance
						? {
								isSequential: step.multiInstance.isSequential,
								collection: step.multiInstance.collection,
								elementVariable: step.multiInstance.elementVariable,
								completionCondition: step.multiInstance.completionCondition,
							}
						: undefined,
				},
			)
			return
		case "wait":
			checkFeel(`${path}.message.correlationKey`, step.message?.correlationKey, problems)
			b.intermediateCatchEvent(id, {
				name: step.name ?? id,
				documentation: step.documentation,
				timerDuration: step.timer?.duration,
				timerDate: step.timer?.date,
				timerCycle: step.timer?.cycle,
				messageName: step.message?.name,
				correlationKey: step.message?.correlationKey,
			})
			return
		case "end":
			b.endEvent(id, {
				name: step.name ?? id,
				documentation: step.documentation,
				errorCode: step.errorCode,
			})
			return
		case "raw":
			problems.push({
				path,
				message: `"raw" steps are not yet compiled — element type "${step.elementType}" was skipped`,
			})
			return
	}
}

function emitBoundaries(
	b: StepBuilder,
	step: PlanStep,
	id: string,
	path: string,
	idOf: Map<PlanStep, string>,
	resolve: ConnectorResolver | undefined,
	problems: PlanProblem[],
): void {
	if (step.errorBoundary) {
		b.withBoundary(
			`${id}_error`,
			{
				errorCode: step.errorBoundary.errorCode,
				cancelActivity: step.errorBoundary.interrupting ?? true,
			},
			(hb) =>
				emitSteps(
					hb,
					(step.errorBoundary as NonNullable<typeof step.errorBoundary>).steps,
					idOf,
					resolve,
					problems,
					`${path}.errorBoundary.steps`,
				),
		)
	}
	if (step.timerBoundary) {
		b.withBoundary(
			`${id}_timer`,
			{
				timerDuration: step.timerBoundary.duration,
				timerDate: step.timerBoundary.date,
				timerCycle: step.timerBoundary.cycle,
				cancelActivity: step.timerBoundary.interrupting ?? true,
			},
			(hb) =>
				emitSteps(
					hb,
					(step.timerBoundary as NonNullable<typeof step.timerBoundary>).steps,
					idOf,
					resolve,
					problems,
					`${path}.timerBoundary.steps`,
				),
		)
	}
}

function emitSteps(
	b: StepBuilder,
	steps: PlanStep[],
	idOf: Map<PlanStep, string>,
	resolve: ConnectorResolver | undefined,
	problems: PlanProblem[],
	path: string,
	indexOffset = 0,
): void {
	for (let i = 0; i < steps.length; i++) {
		const step = steps[i] as PlanStep
		const id = idOf.get(step)
		if (!id) continue
		const stepPath = `${path}[${i + indexOffset}]`
		const nextStep = steps[i + 1]
		const nextId = nextStep ? idOf.get(nextStep) : undefined
		emitStep(b, step, id, stepPath, nextId, idOf, resolve, problems)
		emitBoundaries(b, step, id, stepPath, idOf, resolve, problems)
	}
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compiles a `ProcessPlan` into laid-out, validated BPMN XML. Deterministic:
 * the same plan always produces the same XML. Problems are collected, not
 * thrown — check `result.problems` before using `result.xml`.
 */
export function compilePlan(plan: ProcessPlan, opts: CompilePlanOptions = {}): SynthResult {
	const problems: PlanProblem[] = []

	if (plan.version !== 1) {
		problems.push({ path: "version", message: `Unsupported plan version ${String(plan.version)}` })
		return { problems }
	}
	if (!plan.process?.id) {
		problems.push({ path: "process.id", message: "process.id is required" })
		return { problems }
	}
	if (!plan.steps || plan.steps.length === 0) {
		problems.push({ path: "steps", message: "Plan has no steps" })
		return { problems }
	}

	const [firstStep, ...restSteps] = plan.steps
	if (!firstStep || firstStep.kind !== "start") {
		problems.push({ path: "steps[0]", message: 'The first step must have kind "start"' })
		return { problems }
	}

	const taken = new Set<string>()
	const idOf = new Map<PlanStep, string>()
	assignIds(plan.steps, taken, idOf)

	const builder: ProcessBuilder = Bpmn.createProcess(plan.process.id)
	if (plan.process.name) builder.name(plan.process.name)
	if (plan.process.versionTag) builder.versionTag(plan.process.versionTag)

	let startResult: ConnectorApplyResult | undefined
	if (firstStep.connector) {
		startResult = resolveConnectorOrProblem(
			firstStep.connector,
			"steps[0].connector",
			opts.resolveConnector,
			problems,
		)
	}
	const startId = idOf.get(firstStep) as string
	builder.startEvent(startId, {
		name: firstStep.name ?? "Start",
		documentation: firstStep.documentation,
		timerDuration: firstStep.timer?.duration,
		timerDate: firstStep.timer?.date,
		timerCycle: firstStep.timer?.cycle,
		messageName: firstStep.message?.name,
		zeebeProperties: startResult?.startEvent?.zeebeProperties,
	})

	emitSteps(builder, restSteps, idOf, opts.resolveConnector, problems, "steps", 1)

	let defs: BpmnDefinitions
	try {
		defs = builder.build()
	} catch (err) {
		problems.push({
			path: "steps",
			message: `Build failed: ${err instanceof Error ? err.message : String(err)}`,
		})
		return { problems }
	}

	let laidOut = applyAutoLayout(defs)

	if (!opts.skipAutoFix) {
		const report = optimize(laidOut)
		for (const finding of report.findings) {
			finding.applyFix?.(laidOut)
		}
		laidOut = applyAutoLayout(laidOut)
	}

	const finalReport = optimize(laidOut)
	for (const finding of finalReport.findings) {
		if (finding.severity === "error") {
			problems.push({
				path: finding.elementIds.length > 0 ? `element:${finding.elementIds.join(",")}` : "process",
				message: finding.message,
			})
		}
	}

	const xml = Bpmn.export(laidOut)
	return { defs: laidOut, xml, problems }
}
