// ── Shared format blocks (used by non-MCP fallback adapters) ──────────────────

const COMPACT_FORMAT = [
	"CompactDiagram JSON format:",
	"```json",
	"{",
	'  "id": "Definitions_1",',
	'  "processes": [{',
	'    "id": "Process_1", "name": "My Process",',
	'    "elements": [',
	'      { "id": "start", "type": "startEvent", "name": "Start" },',
	'      { "id": "task1", "type": "serviceTask", "name": "Do Work", "jobType": "my-worker" },',
	'      { "id": "end", "type": "endEvent", "name": "End" }',
	"    ],",
	'    "flows": [{ "id": "f1", "from": "start", "to": "task1" }, { "id": "f2", "from": "task1", "to": "end" }]',
	"  }]",
	"}",
	"```",
	"Element types — Events: startEvent, endEvent, intermediateThrowEvent, intermediateCatchEvent (add eventType: timer|message|signal|error), boundaryEvent (add attachedTo + eventType)",
	"Tasks: serviceTask, userTask (add formId), businessRuleTask (add decisionId+resultVariable), callActivity (add calledProcess), scriptTask, sendTask, manualTask",
	"Gateways: exclusiveGateway, parallelGateway, inclusiveGateway, eventBasedGateway  |  Containers: subProcess, adHocSubProcess",
	'HTTP REST calls: always use jobType: "io.camunda:http-json:1" with taskHeaders {url, method, headers?, body?} and resultVariable.',
].join("\n");

// ── MCP prompt builders (for Claude + Copilot with MCP tools) ─────────────────

/** Short system prompt for MCP-capable adapters. The LLM uses tools instead of returning JSON blobs. */
export function buildMcpSystemPrompt(): string {
	return [
		"You are a BPMN expert assistant. Help users create and modify BPMN 2.0 process diagrams.",
		"Use the available bpmn MCP tools to read and modify the diagram.",
		"Call get_diagram first to see the current diagram state before making changes.",
		"",
		"PREFER execute_code for any operation involving multiple steps, building a process from scratch,",
		"batch modifications, or logic — it completes the work in one call instead of many.",
		"",
		"HTTP/REST RULE: Any time the user asks for an HTTP request, API call, webhook, or external service",
		"integration — use add_http_call (or Bridge.mcpAddHttpCall inside execute_code).",
		"add_http_call sets jobType: io.camunda:http-json:1 and the correct taskHeaders automatically.",
		"Use your knowledge of the target API to supply the real endpoint URL.",
	].join("\n");
}

export interface FindingInfo {
	category: string;
	severity: string;
	message: string;
	suggestion: string;
	elementIds: string[];
}

/** System prompt for the improve action with MCP tools. Passes pre-computed findings from core optimize(). */
export function buildMcpImprovePrompt(findings: FindingInfo[]): string {
	const lines = [
		"You are a BPMN 2.0 process improvement expert.",
		"Use the available bpmn tools to analyze and improve the current diagram.",
		"Start by calling get_diagram to see the current state, then apply all fixes.",
		"",
	];

	if (findings.length > 0) {
		lines.push("Fix ALL of these detected issues:");
		for (const f of findings) {
			const els = f.elementIds.length > 0 ? ` [elements: ${f.elementIds.join(", ")}]` : "";
			lines.push(`- [${f.category}] ${f.message}${els}`);
			lines.push(`  → ${f.suggestion}`);
		}
	} else {
		lines.push("No structural issues detected. Apply general best practices:");
		lines.push("- Group 3+ consecutive related tasks (no branching) into a subProcess.");
		lines.push("- Remove redundant gateways or unnecessary elements.");
	}

	lines.push("", 'Also normalize element names to verb-noun title case (e.g. "Validate Order").');
	return lines.join("\n");
}

// ── Fallback prompt builders (for non-MCP adapters like Gemini) ───────────────

/** Full system prompt for non-MCP adapters that must return a CompactDiagram JSON block. */
export function buildSystemPrompt(context: unknown): string {
	const lines = [
		"You are a BPMN expert assistant. Help users create and modify BPMN 2.0 process diagrams.",
		"",
		COMPACT_FORMAT,
		"",
		"Return exactly one JSON code block containing the complete updated CompactDiagram. Explain your changes briefly.",
	];

	if (context !== null && context !== undefined) {
		lines.push("", "Current diagram:", "```json", JSON.stringify(context, null, 2), "```");
	}

	return lines.join("\n");
}
