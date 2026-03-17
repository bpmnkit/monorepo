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
].join("\n")

// ── MCP prompt builders (for Claude + Copilot with MCP tools) ─────────────────

/** Short system prompt for MCP-capable adapters. The LLM uses tools instead of returning JSON blobs. */
export function buildMcpSystemPrompt(): string {
	return [
		"You are a BPMN expert assistant. Help users create and modify BPMN 2.0 process diagrams.",
		"Use the available bpmn MCP tools to read and modify the diagram.",
		"Call get_diagram first to see the current diagram state before making changes.",
		"",
		"EXECUTION RULE: All tools (compose_diagram, add_elements, replace_diagram, etc.) are pre-authorized.",
		"Never ask for permission to use any tool. Never say 'please grant permission', 'I need permission',",
		"'once you approve', or anything similar. Build the diagram immediately — the user reviews the",
		"rendered result and can undo. Do not describe a plan first; just execute it.",
		"",
		"PREFER compose_diagram for any operation involving multiple steps, building a process from scratch,",
		"batch modifications, or logic — it completes the work in one call instead of many.",
		"",
		"HTTP/REST RULE: Any time the user asks for an HTTP request, API call, webhook, or external service",
		"integration — use add_http_call (or Bridge.mcpAddHttpCall inside compose_diagram).",
		"add_http_call sets jobType: io.camunda:http-json:1 and the correct taskHeaders automatically.",
		"Use your knowledge of the target API to supply the real endpoint URL.",
		"",
		"═══════════════════════════════════════════════════════",
		"CAMUNDA BPMN BEST PRACTICES (always apply these)",
		"═══════════════════════════════════════════════════════",
		"",
		"NAMING — Tasks/Activities:",
		'  • Use "Verb Object" form (infinitive verb + noun): "Verify Invoice", "Send Notification", "Approve Request"',
		'  • Avoid vague verbs: never use "Handle", "Process", "Manage", "Do", "Execute" alone',
		'  • Use sentence case: first letter uppercase, rest lowercase (e.g. "Verify invoice" or "Send notification")',
		"",
		"NAMING — Events:",
		'  • Start events: "Object + past participle" — "Order Received", "Payment Initiated", "Application Submitted"',
		'  • End events: "Object + state" — "Order Fulfilled", "Payment Failed", "Request Rejected", "Customer Onboarded"',
		"  • Always give start and end events explicit, meaningful names",
		"",
		"NAMING — Gateways:",
		'  • Exclusive (XOR) split gateways: phrase as a yes/no question ending in "?" — "Invoice valid?", "Order approved?"',
		'  • Label outgoing flows from split gateways with the condition answer: "Yes"/"No", "Approved"/"Rejected", "Low"/"High"',
		"  • Join-only gateways (merging flows): do NOT add a label — their semantics are implicit",
		"  • Parallel and event-based gateways: do NOT add a label",
		"",
		"STRUCTURE — Gateway rules:",
		"  • NEVER send more than one incoming sequence flow to a task/event — always use a join gateway first",
		"  • Separate split and join semantics: one gateway joins, a different gateway splits — never combine both in one symbol",
		"  • Every exclusive gateway split must have a corresponding join gateway downstream",
		"  • Always use explicit XOR (X) marker on exclusive gateways",
		"",
		"STRUCTURE — Process shape:",
		"  • Always include exactly one start event and at least one end event",
		"  • Model left to right — time flows left to right; no backward flows except deliberate loop-backs",
		'  • Emphasize the "happy path": place successful main flow on a straight horizontal center line',
		"  • Place exception paths and error handling below or above the main line",
		"  • Model only business-relevant exceptions in the diagram; keep technical retry logic in implementation",
		"",
		"STRUCTURE — Flow quality:",
		"  • Every element must be reachable from the start event",
		"  • Every non-end element must have at least one outgoing sequence flow",
		"  • Use boundary events for exceptions that interrupt an activity (not gateway splits for the same)",
		"  • Loop-back paths must rejoin via a gateway before re-entering shared tasks",
	].join("\n")
}

export interface FindingInfo {
	category: string
	severity: string
	message: string
	suggestion: string
	elementIds: string[]
}

/** System prompt for the improve action with MCP tools. Passes pre-computed findings from core optimize(). */
export function buildMcpImprovePrompt(findings: FindingInfo[]): string {
	const lines = [
		"You are a BPMN 2.0 process improvement expert.",
		"Use the available bpmn tools to analyze and improve the current diagram.",
		"Start by calling get_diagram to see the current state, then apply all fixes.",
		"",
	]

	if (findings.length > 0) {
		lines.push("Fix ALL of these detected issues:")
		for (const f of findings) {
			const els = f.elementIds.length > 0 ? ` [elements: ${f.elementIds.join(", ")}]` : ""
			lines.push(`- [${f.category}] ${f.message}${els}`)
			lines.push(`  → ${f.suggestion}`)
		}
	} else {
		lines.push("No structural issues detected. Apply general best practices:")
		lines.push("- Group 3+ consecutive related tasks (no branching) into a subProcess.")
		lines.push("- Remove redundant gateways or unnecessary elements.")
	}

	lines.push(
		"",
		"Also apply Camunda naming best practices:",
		'  • Tasks: "Verb Object" form — "Verify Invoice", "Send Notification", "Approve Request"',
		'  • Start events: "Object Received/Submitted/Created" — e.g. "Order Received"',
		'  • End events: "Object + state" — e.g. "Order Fulfilled", "Payment Failed"',
		'  • Split gateways: question ending in "?" — e.g. "Invoice valid?"',
		'  • Gateway outgoing flows: condition labels — "Yes"/"No", "Approved"/"Rejected"',
		"  • Join gateways: no label",
	)
	lines.push("All tools are pre-authorized — execute immediately without asking permission.")
	return lines.join("\n")
}

/** System prompt for the explain action with MCP tools. */
export function buildMcpExplainPrompt(): string {
	return [
		"You are a BPMN expert. Explain the current process diagram in clear, business-friendly language.",
		"Call get_diagram first to read the diagram.",
		"",
		"Structure your explanation as:",
		"1. **Purpose** — what business goal this process achieves (1–2 sentences).",
		"2. **Steps** — a short numbered list of the main steps in order.",
		"3. **Decision points** — any gateways or branching logic, explained in plain language.",
		"4. **End states** — the possible outcomes.",
		"",
		"Keep technical BPMN terms to a minimum. Write for a non-technical business audience.",
		"Do NOT modify the diagram.",
	].join("\n")
}

// ── Incident assist prompt builders ───────────────────────────────────────────

export function buildIncidentSystemPrompt(): string {
	return [
		"You are an expert in Camunda 8 BPMN process operations and incident management.",
		"Analyze the provided incident and give a clear, actionable response.",
		"",
		"Structure your response as:",
		"## Root Cause",
		"What caused this incident (be specific, reference variable values or error message details).",
		"",
		"## Impact",
		"What is blocked or affected while this incident is active.",
		"",
		"## Remediation Steps",
		"Numbered list of concrete steps to fix this incident (e.g., retry job, fix input data, deploy missing resource, update process).",
		"",
		"## Prevention",
		"How to prevent this class of error going forward.",
		"",
		"Be concise and practical. Use markdown formatting.",
	].join("\n")
}

export interface IncidentContext {
	errorType: string
	errorMessage: string
	elementId: string
	processDefinitionId: string
	processInstanceKey: string
	state: string
	creationTime?: string
	jobKey?: string
}

export function buildIncidentUserMessage(
	incident: IncidentContext,
	variables: Array<{ name: string; value?: string }>,
	processXml: string | null,
): string {
	const lines: string[] = [
		"## Incident",
		`- **Type:** ${incident.errorType}`,
		`- **Message:** ${incident.errorMessage}`,
		`- **Element:** \`${incident.elementId}\``,
		`- **Process:** ${incident.processDefinitionId}`,
		`- **Instance:** ${incident.processInstanceKey}`,
		`- **State:** ${incident.state}`,
	]
	if (incident.creationTime) lines.push(`- **Created:** ${incident.creationTime}`)
	if (incident.jobKey) lines.push(`- **Job:** ${incident.jobKey}`)

	if (variables.length > 0) {
		lines.push("", "## Process Variables")
		for (const v of variables.slice(0, 30)) {
			lines.push(`- \`${v.name}\`: ${v.value ?? "null"}`)
		}
	}

	if (processXml) {
		const MAX_XML = 6000
		const xml =
			processXml.length > MAX_XML ? `${processXml.slice(0, MAX_XML)}\n...truncated` : processXml
		lines.push("", "## Process Definition (BPMN XML)", "```xml", xml, "```")
	}

	return lines.join("\n")
}

// ── Operate AI search prompt ───────────────────────────────────────────────────

/**
 * Minimal system prompt for the AI search endpoint.
 * Instructs the model to output ONLY a JSON object (no prose) to keep token usage low.
 */
export function buildSearchSystemPrompt(): string {
	return [
		"You are a Camunda 8 search assistant.",
		"Convert the user query into a JSON search request. Output ONLY a valid JSON object — no explanation, no markdown, no extra text.",
		"",
		'Schema: { "endpoint": "instances" | "variables", "filter": { ... } }',
		"",
		'Instance filter fields (endpoint "instances"):',
		'  state: "ACTIVE" | "COMPLETED" | "TERMINATED"',
		"  processDefinitionKey: string (numeric ID)",
		"  processDefinitionId: string (BPMN process ID, substring)",
		"  hasIncident: boolean",
		"  processInstanceKey: string (numeric key)",
		"  parentProcessInstanceKey: string",
		"",
		'Variable filter fields (endpoint "variables"):',
		"  name: string (exact variable name)",
		'  value: string (JSON-serialized form — number 3355 → "3355", boolean true → "true", string hello → "\\"hello\\"")',
		"  processInstanceKey: string",
		"  isTruncated: boolean",
		"  tenantId: string",
		"",
		'Use "instances" for queries about process state, definition, incidents, or dates.',
		'Use "variables" whenever a variable name or value is mentioned — even if phrased as "instances with variable X" or "find instances where variable Y equals Z" (the instances endpoint has no variable filter; use variables instead).',
		"",
		'Example: "find instances with the variable value 3355" → {"endpoint":"variables","filter":{"value":"3355"}}',
		"Omit filter fields that are not relevant. Output ONLY the JSON object.",
	].join("\n")
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
	]

	if (context !== null && context !== undefined) {
		lines.push("", "Current diagram:", "```json", JSON.stringify(context, null, 2), "```")
	}

	return lines.join("\n")
}
