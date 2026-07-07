/**
 * Deterministic constructor for the Camunda 8 "AI Agent Sub-process" pattern
 * (`io.camunda.agenticai:aiagent-job-worker:1`, template
 * `io.camunda.connectors.agenticai.aiagent.jobworker.v1`).
 *
 * Modeled as an `adHocSubProcess` carrying a `zeebe:taskDefinition` (the
 * presence of which is what makes an ad-hoc sub-process a "job worker
 * implementation" — there is no separate `zeebe:adHocImplementation`
 * attribute). Each tool is a root-node activity (no incoming sequence flow),
 * per the connector's tool-discovery rule; its `fromAi()` input mappings
 * describe the parameters the LLM must supply, and its documentation becomes
 * the tool description shown to the model.
 *
 * Binding keys below (`provider.type`, `data.systemPrompt.prompt`, …) are
 * verified against the bundled element template
 * (packages/plugins/src/config-panel-bpmn/templates/generated.ts,
 * template id io.camunda.connectors.agenticai.aiagent.jobworker.v1, version 3).
 */
import type {
	AdHocSubProcessOptions,
	ServiceTaskOptions,
	SubProcessContentBuilder,
} from "./bpmn-builder.js"
import { SubProcessContentBuilder as SubProcessContentBuilderImpl } from "./bpmn-builder.js"

/** AI Agent job-worker connector task type — the pattern that marks an ad-hoc sub-process as an AI Agent. */
export const AI_AGENT_JOB_WORKER_TASK_TYPE = "io.camunda.agenticai:aiagent-job-worker:1"

/** Default FEEL expression aggregating each tool's result into `outputCollection`. */
export const AI_AGENT_DEFAULT_OUTPUT_ELEMENT =
	"={\n  id: toolCall._meta.id,\n  name: toolCall._meta.name,\n  content: toolCallResult\n}"

/** JSON-schema-ish primitive types accepted by the AI Agent connector's `fromAi()` tool parameters. */
export type AiAgentToolParamType = "string" | "number" | "boolean" | "integer" | "array" | "object"

/** One parameter the LLM must supply when calling a tool, expressed as a `fromAi()` input mapping. */
export interface AiAgentToolParam {
	/** Parameter name — becomes `toolCall.<name>` in the generated FEEL expression. */
	name: string
	/** Description shown to the LLM for this parameter. */
	description: string
	/** JSON-schema type hint (default "string"). */
	type?: AiAgentToolParamType
	/** Whether the LLM must always supply this parameter (passed to `fromAi()`'s `options.required`). */
	required?: boolean
	/** JSON Schema object for complex/nested parameter shapes (passed as `fromAi()`'s 4th argument). */
	schema?: Record<string, unknown>
	/** IO-mapping target on the tool activity that receives the `fromAi()` value (e.g. "channel"). */
	target: string
}

/** One tool available to the agent — a root-node activity inside the ad-hoc sub-process. */
export interface AiAgentToolSpec {
	/** Element ID — also the tool name shown to the LLM. */
	id: string
	/** Tool description shown to the LLM (becomes the activity's `<bpmn:documentation>`). */
	description: string
	/**
	 * Pre-resolved service task options for this tool — e.g. the output of
	 * `applyConnectorTemplate()` from `@bpmnkit/connectors`, or a plain
	 * `{ name, taskType }` for a hand-scaffolded worker.
	 */
	serviceTask: ServiceTaskOptions
	/** Parameters the LLM supplies at call time, mapped via `fromAi()`. */
	params?: AiAgentToolParam[]
	/** FEEL expression producing the tool's result (default `"=response"`), mapped to the `toolCallResult` process variable. */
	resultSource?: string
}

/** Model provider + its dotted `zeebe:input` bindings for the AI Agent connector. */
export interface AiAgentModelConfig {
	/**
	 * Provider dropdown value — must match the connector's `provider.type`
	 * choices exactly: "anthropic" | "bedrock" | "azureOpenAi" | "google-vertex-ai" | "openai" | "openaiCompatible".
	 */
	provider: string
	/**
	 * Dotted `zeebe:input` target → value for provider/model/auth fields, e.g.
	 * `{ "provider.anthropic.model.model": "claude-sonnet-5",
	 *    "provider.anthropic.authentication.apiKey": "{{secrets.ANTHROPIC_API_KEY}}" }`.
	 * A value without a leading "=" is a literal string; a leading "=" makes it a FEEL expression
	 * (matches Zeebe's `zeebe:input`/`zeebe:output` source convention throughout this SDK).
	 */
	inputs: Record<string, string>
}

export interface AiAgentOptions {
	/** Element ID for the ad-hoc sub-process. */
	id: string
	/** Display name. */
	name?: string
	/** Model provider + its bindings. */
	model: AiAgentModelConfig
	/** System prompt — literal text or a FEEL expression (leading "="). */
	systemPrompt: string
	/** User prompt — literal text or a FEEL expression (leading "="). */
	userPrompt: string
	/** Memory storage type (default `"in-process"`). */
	memoryStorageType?: string
	/** Safety limit on model calls per agent run (default 10). */
	maxModelCalls?: number
	/** Escape hatch for any other dotted `zeebe:input` target not covered above (e.g. `"data.response.format.type"`). */
	extraInputs?: Record<string, string>
	/** Job retries (default "3"). */
	retries?: string
	/** Tools available to the agent — each becomes a root-node activity. */
	tools: AiAgentToolSpec[]
	/** Process variable that receives the agent's final response (`zeebe:output source="=agent"`, default `"agent"`). */
	outputVariable?: string
	/** Variable that collects tool call results (default `"toolCallResults"`). */
	outputCollection?: string
	/** FEEL expression aggregating each tool result (default {@link AI_AGENT_DEFAULT_OUTPUT_ELEMENT}). */
	outputElement?: string
	/** FEEL expression ending the ad-hoc scope early. */
	completionCondition?: string
	/** Whether still-running tool instances are cancelled once the completion condition is met (default true). */
	cancelRemainingInstances?: boolean
}

/** The two pieces `adHocSubProcess(id, content, options)` needs to build the agent. */
export interface AiAgentBuild {
	content: (b: SubProcessContentBuilder) => void
	options: AdHocSubProcessOptions
}

function fromAiExpression(param: AiAgentToolParam): string {
	const args = [`toolCall.${param.name}`, JSON.stringify(param.description)]
	const needsType = param.type !== undefined || param.schema !== undefined || param.required === false
	if (needsType) args.push(JSON.stringify(param.type ?? "string"))
	if (param.schema !== undefined) args.push(JSON.stringify(param.schema))
	if (param.required === false) {
		if (param.schema === undefined) args.push("null")
		args.push("{ required: false }")
	}
	return `=fromAi(${args.join(", ")})`
}

/** Builds a single tool activity (a root node with no incoming sequence flow) from its spec. */
function buildToolElement(spec: AiAgentToolSpec) {
	const inputs = [
		...(spec.serviceTask.ioMapping?.inputs ?? []),
		...(spec.params ?? []).map((p) => ({
			target: p.target,
			source: fromAiExpression(p),
		})),
	]
	const outputs = [
		...(spec.serviceTask.ioMapping?.outputs ?? []),
		{ source: spec.resultSource ?? "=response", target: "toolCallResult" },
	]

	const scratch = new SubProcessContentBuilderImpl()
	scratch.serviceTask(spec.id, {
		...spec.serviceTask,
		documentation: spec.description,
		ioMapping: { inputs, outputs },
	})
	// A fresh scratch builder's very first element never gets an auto-connected
	// sequence flow, so `_elements[0]` is exactly the disconnected tool element.
	const [element] = scratch._elements
	if (!element) throw new Error(`buildAiAgentSubProcess: failed to build tool "${spec.id}"`)
	return element
}

/**
 * Builds the ad-hoc sub-process content callback + options for the Camunda 8
 * AI Agent Sub-process connector. Feed the result into `.adHocSubProcess()`:
 *
 * ```ts
 * const agent = buildAiAgentSubProcess({ ... })
 * builder.adHocSubProcess(agent.options.id ?? "Agent_1", agent.content, agent.options)
 * ```
 */
export function buildAiAgentSubProcess(opts: AiAgentOptions): AiAgentBuild {
	if (opts.tools.length === 0) {
		throw new Error("buildAiAgentSubProcess: at least one tool is required")
	}
	const ids = new Set<string>()
	for (const tool of opts.tools) {
		if (ids.has(tool.id)) {
			throw new Error(`buildAiAgentSubProcess: duplicate tool id "${tool.id}"`)
		}
		ids.add(tool.id)
	}

	const inputs: Record<string, string> = {
		"provider.type": opts.model.provider,
		...opts.model.inputs,
		"data.systemPrompt.prompt": opts.systemPrompt,
		"data.userPrompt.prompt": opts.userPrompt,
		"data.memory.storage.type": opts.memoryStorageType ?? "in-process",
		"data.limits.maxModelCalls": String(opts.maxModelCalls ?? 10),
		...opts.extraInputs,
	}

	const options: AdHocSubProcessOptions = {
		name: opts.name,
		taskDefinition: { type: AI_AGENT_JOB_WORKER_TASK_TYPE, retries: opts.retries },
		ioMapping: {
			inputs: Object.entries(inputs).map(([target, source]) => ({ source, target })),
			outputs: [{ source: "=agent", target: opts.outputVariable ?? "agent" }],
		},
		outputCollection: opts.outputCollection ?? "toolCallResults",
		outputElement: opts.outputElement ?? AI_AGENT_DEFAULT_OUTPUT_ELEMENT,
		completionCondition: opts.completionCondition,
		cancelRemainingInstances: opts.cancelRemainingInstances,
	}

	const content = (b: SubProcessContentBuilder): void => {
		for (const tool of opts.tools) {
			b.addDisconnected(buildToolElement(tool))
		}
	}

	return { content, options }
}
