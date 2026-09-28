import type { ServiceTaskOptions } from "@bpmnkit/core"

/** Job type of Camunda's AI Agent Task outbound connector (one model call per job, no tools). */
export const AI_AGENT_TASK_TYPE = "io.camunda.agenticai:aiagent:1"

/** Model used by every AI step in the templates. Change it in one place in your copy. */
export const TEMPLATE_MODEL = "claude-sonnet-4-5"

/** API key reference — resolved from the cluster's connector secrets, never stored in the model. */
export const TEMPLATE_API_KEY = "{{secrets.ANTHROPIC_API_KEY}}"

interface AiTaskOptions {
	name: string
	/** Literal text or a FEEL expression (leading "="). */
	systemPrompt: string
	/** Literal text or a FEEL expression (leading "="). */
	userPrompt: string
	/** `json` asks the model for a JSON object and parses it into `agent.responseJson`. */
	responseFormat?: "text" | "json"
	/** Output mappings from the connector's `agent` result into process variables. */
	outputs: Array<{ source: string; target: string }>
}

/**
 * Service task options for one model call through the AI Agent Task connector
 * (element template `io.camunda.connectors.agenticai.aiagent.v1`). The connector
 * returns its result as `agent` (`agent.responseText`, `agent.responseJson`); the
 * output mappings copy what the process needs, so every step keeps its own
 * variable even though they share a job type.
 */
export function aiTask(options: AiTaskOptions): ServiceTaskOptions {
	const format = options.responseFormat ?? "text"
	return {
		name: options.name,
		taskType: AI_AGENT_TASK_TYPE,
		modelerTemplate: "io.camunda.connectors.agenticai.aiagent.v1",
		modelerTemplateVersion: "1",
		ioMapping: {
			inputs: [
				{ source: "anthropic", target: "provider.type" },
				{ source: TEMPLATE_API_KEY, target: "provider.anthropic.authentication.apiKey" },
				{ source: TEMPLATE_MODEL, target: "provider.anthropic.model.model" },
				{ source: options.systemPrompt, target: "data.systemPrompt.prompt" },
				{ source: options.userPrompt, target: "data.userPrompt.prompt" },
				{ source: "in-process", target: "data.memory.storage.type" },
				{ source: "5", target: "data.limits.maxModelCalls" },
				{ source: format, target: "data.response.format.type" },
				...(format === "json"
					? [{ source: "=true", target: "data.response.format.parseJson" }]
					: []),
			],
			outputs: options.outputs,
		},
		taskHeaders: {
			elementTemplateVersion: "1",
			elementTemplateId: "io.camunda.connectors.agenticai.aiagent.v1",
			resultVariable: "agent",
		},
	}
}
