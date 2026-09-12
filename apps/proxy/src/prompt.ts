import type { CompactDiagram } from "@bpmnkit/core"

// ── Shared format blocks (used by non-MCP fallback adapters) ──────────────────

export const COMPACT_FORMAT = [
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
	"Tasks: serviceTask, userTask (add formId), businessRuleTask (add decisionId+resultVariable), callActivity (add calledProcess), scriptTask, sendTask, receiveTask, manualTask (no worker — done outside the engine), task (abstract)",
	"Gateways: exclusiveGateway, parallelGateway, inclusiveGateway, eventBasedGateway, complexGateway",
	"Containers: subProcess, adHocSubProcess, eventSubProcess, transaction",
	"Data: dataObject, dataObjectReference (add dataObjectRef), dataStoreReference (add dataStoreRef) — wired by data associations, not sequence flows",
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

// ── Operate chat prompt ────────────────────────────────────────────────────────

export interface OperateStats {
	runningInstances: number
	activeIncidents: number
	pendingTasks: number
	deployedDefinitions: number
	activeJobs: number
}

export function buildOperateChatSystemPrompt(stats: OperateStats | null): string {
	const lines = [
		"You are an operations assistant for Camunda 8 process automation.",
		"Help operators understand what is running in their cluster and what actions to take.",
		"Be concise, actionable, and prioritize incidents (they block process execution).",
		"Use markdown for formatting. Keep responses short unless detail is specifically requested.",
		"",
	]

	if (stats) {
		lines.push(
			"## Current cluster state",
			`- Running instances: ${stats.runningInstances}`,
			`- Active incidents: ${stats.activeIncidents}`,
			`- Pending user tasks: ${stats.pendingTasks}`,
			`- Deployed process definitions: ${stats.deployedDefinitions}`,
			`- Active jobs: ${stats.activeJobs}`,
			"",
		)
		if (stats.activeIncidents > 0) {
			lines.push(
				`There are ${stats.activeIncidents} active incident(s) — these are blocking process execution.`,
				"When asked what to do next, prioritize resolving incidents first.",
				"",
			)
		}
	}

	lines.push(
		"## Available actions (user performs these in the UI)",
		"- View and cancel running instances → Instances page",
		"- View and retry failed incidents → Incidents page",
		"- Claim and complete user tasks → Tasks page",
		"- Start new process instances → Definitions page → Start Instance button",
		"- Deploy new processes → Models page → Deploy button",
		"",
		"When asked to do something, explain which UI page to visit and what to click.",
		"If asked about a specific instance/incident/task, say you can only see aggregate counts unless you query for details.",
	)

	return lines.join("\n")
}

// ── Improve prompt builders ───────────────────────────────────────────────────

const OPERATIONS_FORMAT = `
BpmnOperation types (use stable element IDs, never array positions):
  { "op": "rename",        "id": "...", "name": "new name" }
  { "op": "update",        "id": "...", "patch": { /* partial CompactElement fields */ } }
  { "op": "delete",        "id": "..." }
  { "op": "insert",        "element": { /* full CompactElement with new unique id */ }, "after"?: "id", "before"?: "id", "parent"?: "sub-process-id" }
  { "op": "add_flow",      "from": "id", "to": "id", "condition"?: "FEEL expr", "name"?: "...", "parent"?: "sub-process-id" }
  { "op": "delete_flow",   "id": "..." }
  { "op": "redirect_flow", "id": "...", "from"?: "new-source-id", "to"?: "new-target-id" }`.trim()

export function buildImproveSystemPrompt(): string {
	return [
		"You are a BPMN 2.0 process improvement expert.",
		"",
		"Output format — follow this EXACTLY:",
		"1. Write 2–4 sentences explaining what you will change and why.",
		"2. Then output a single ```json block containing ONLY a JSON array of BpmnOperation objects.",
		"",
		OPERATIONS_FORMAT,
		"",
		"Rules:",
		"- Reference only IDs that exist in the provided model (except 'insert' adds new IDs).",
		"- For 'insert': generate a short, unique camelCase ID (e.g. 'task_notify', 'gw_valid').",
		"- Output ONLY the operations array in the ```json block — no prose inside it.",
		"- If no changes are needed, output [].",
		"",
		"Apply Camunda BPMN best practices:",
		'  • Tasks: "Verb Object" — "Verify Invoice", "Send Notification"',
		'  • Start events: past participle — "Order Received", "Payment Initiated"',
		'  • End events: object + state — "Order Fulfilled", "Payment Failed"',
		'  • XOR split gateways: yes/no question ending in "?" — "Invoice valid?"',
		'  • XOR split outgoing flows: label with condition — "Yes"/"No", "Approved"/"Rejected"',
		"  • Join gateways: no label",
		"  • Never send >1 incoming flow to a task without a join gateway first",
	].join("\n")
}

export interface ImproveContext {
	compact: CompactDiagram
	findings: FindingInfo[]
	autoFixCount: number
	instruction?: string | null
}

export function buildImproveUserMessage(ctx: ImproveContext): string {
	const lines: string[] = []

	if (ctx.autoFixCount > 0) {
		lines.push(
			`Note: ${ctx.autoFixCount} structural issue(s) were already auto-fixed before this analysis.`,
			"",
		)
	}

	lines.push("Current process model:", "```json", JSON.stringify(ctx.compact, null, 2), "```", "")

	if (ctx.findings.length > 0) {
		lines.push("Detected issues to fix:")
		for (const f of ctx.findings) {
			const els = f.elementIds.length > 0 ? ` [elements: ${f.elementIds.join(", ")}]` : ""
			lines.push(`- [${f.severity}/${f.category}] ${f.message}${els}`)
			lines.push(`  → ${f.suggestion}`)
		}
		lines.push("")
	}

	if (ctx.instruction) {
		lines.push(`Additional instructions: ${ctx.instruction}`, "")
	}

	lines.push("Explain your changes, then output the BpmnOperation array in a ```json block.")
	return lines.join("\n")
}

// ── Form / DMN creation prompt builders ──────────────────────────────────────

export function buildFormCreateSystemPrompt(taskName: string, taskContext: string): string {
	return [
		"You are a Camunda Form expert.",
		`Task name: ${taskName}`,
		`Process context: ${taskContext}`,
		"",
		"Generate a Camunda Form JSON for this user task.",
		"",
		"Output format:",
		"```json",
		"{",
		'  "id": "<formId>",',
		'  "fields": [',
		'    { "type": "...", "id": "...", "label": "...", "key": "...", "required": true }',
		"  ]",
		"}",
		"```",
		"",
		'Valid field types: "textfield", "textarea", "number", "select" (add a values array), "checkbox", "datetime", "group" (contains nested fields).',
		"Infer sensible fields from the task name and process context.",
		"Return ONLY valid JSON inside a ```json code block — no explanation.",
	].join("\n")
}

export function buildDmnCreateSystemPrompt(decisionId: string, taskContext: string): string {
	return [
		"You are a DMN expert.",
		`Decision ID: ${decisionId}`,
		`Process context: ${taskContext}`,
		"",
		"Generate a complete, valid DMN 1.3 decision table XML for this decision.",
		"",
		"Requirements:",
		"- <definitions> with namespace https://www.omg.org/spec/DMN/20191111/MODEL/",
		`- <decision id="${decisionId}"> containing a <decisionTable>`,
		"- At least one input column, one output column, and one rule row.",
		"",
		"Infer sensible inputs and outputs from the decision ID and process context.",
		"Return ONLY the DMN XML inside a ```xml code block — no explanation.",
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
