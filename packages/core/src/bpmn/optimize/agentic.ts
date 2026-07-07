import { AI_AGENT_JOB_WORKER_TASK_TYPE } from "../agentic.js"
import type { BpmnAdHocSubProcess, BpmnProcess } from "../bpmn-model.js"
import type { OptimizationFinding } from "./types.js"
import { readZeebeIoMapping, readZeebeTaskType } from "./utils.js"

const FROM_AI_CALL = /fromAi\(\s*([^,)]+)/g

function isAiAgentSubProcess(el: BpmnAdHocSubProcess): boolean {
	return readZeebeTaskType(el.extensionElements) === AI_AGENT_JOB_WORKER_TASK_TYPE
}

/**
 * Agentic-specific checks for the Camunda 8 AI Agent Sub-process pattern:
 * tools must be root nodes with a description the LLM can read, every
 * `fromAi()` call must reference `toolCall.*`, and the agent should aggregate
 * tool results and cap its model-call budget.
 */
export function analyzeAgentic(p: BpmnProcess): OptimizationFinding[] {
	const findings: OptimizationFinding[] = []
	const processId = p.id

	for (const el of p.flowElements) {
		if (el.type !== "adHocSubProcess" || !isAiAgentSubProcess(el)) continue

		const adHocExt = el.extensionElements.find((e) => e.name === "zeebe:adHoc")
		if (!adHocExt?.attributes.outputCollection) {
			findings.push({
				id: "agentic/no-output-collection",
				category: "agentic",
				severity: "warning",
				message: `AI Agent "${el.name ?? el.id}" has no outputCollection — tool call results won't be aggregated.`,
				suggestion: 'Set zeebe:adHoc outputCollection (e.g. "toolCallResults").',
				processId,
				elementIds: [el.id],
			})
		}

		const io = readZeebeIoMapping(el.extensionElements)
		const hasLimit = io?.inputs.some((i) => i.target === "data.limits.maxModelCalls") ?? false
		if (!hasLimit) {
			findings.push({
				id: "agentic/limits-missing",
				category: "agentic",
				severity: "info",
				message: `AI Agent "${el.name ?? el.id}" has no data.limits.maxModelCalls binding.`,
				suggestion: "Set a model-call limit as a safety net against infinite tool loops.",
				processId,
				elementIds: [el.id],
			})
		}

		for (const tool of el.flowElements) {
			if (tool.incoming.length > 0) {
				findings.push({
					id: "agentic/tool-not-root",
					category: "agentic",
					severity: "error",
					message: `"${tool.name ?? tool.id}" inside AI Agent "${el.name ?? el.id}" has an incoming sequence flow — the connector only discovers tools with no incoming flow.`,
					suggestion: "Remove the incoming sequence flow; tools must be root nodes.",
					processId,
					elementIds: [tool.id],
				})
			}
			if (!tool.documentation?.trim()) {
				findings.push({
					id: "agentic/tool-no-description",
					category: "agentic",
					severity: "warning",
					message: `Tool "${tool.name ?? tool.id}" has no documentation — the LLM sees no description for this tool.`,
					suggestion: "Set <bpmn:documentation> describing what this tool does.",
					processId,
					elementIds: [tool.id],
				})
			}

			const toolIo = readZeebeIoMapping(tool.extensionElements)
			for (const input of toolIo?.inputs ?? []) {
				for (const match of input.source.matchAll(FROM_AI_CALL)) {
					const firstArg = match[1]?.trim()
					if (firstArg && !firstArg.startsWith("toolCall.")) {
						findings.push({
							id: "agentic/fromai-bad-ref",
							category: "agentic",
							severity: "error",
							message: `fromAi() on "${tool.name ?? tool.id}" input "${input.target}" references "${firstArg}", not a toolCall.* field.`,
							suggestion: 'fromAi()\'s first argument must reference "toolCall.<param>".',
							processId,
							elementIds: [tool.id],
						})
					}
				}
			}
		}
	}

	return findings
}
