#!/usr/bin/env node
/**
 * Minimal stdio MCP server for BPMN/DMN/Form editing.
 * Zero external dependencies — pure Node.js built-ins + @bpmnkit/core (workspace package).
 *
 * State is stored as the native model (BpmnDefinitions, DmnDefinitions, or FormDefinition)
 * so core builder APIs produce the correct structure.
 *
 * Usage:
 *   node dist/mcp-server.js [--input <file>] [--output <file>]
 *
 * File type is detected from input file content:
 *   - DMN XML  → DmnDefinitions
 *   - Form JSON → FormDefinition
 *   - BPMN XML  → BpmnDefinitions (default)
 */

import { readFileSync, writeFileSync } from "node:fs"
import { createInterface } from "node:readline"
import vm from "node:vm"
import {
	Bpmn,
	type BpmnDefinitions,
	type BpmnDiEdge,
	type BpmnDiShape,
	type BpmnDiagram,
	type BpmnFlowElement,
	type BpmnProcess,
	type CompactDiagram,
	type CompactElement,
	type CompactFlow,
	Dmn,
	type DmnDefinitions,
	Form,
	type FormDefinition,
	type RestConnectorConfig,
	compactify,
	compactifyDmn,
	compactifyForm,
	expand,
	expandDmn,
	expandForm,
	layoutDmn,
	layoutProcess,
} from "@bpmnkit/core"
import type { CompactDmn, CompactForm } from "@bpmnkit/core"

// ── CLI args ──────────────────────────────────────────────────────────────────

function getArg(flag: string): string | undefined {
	const idx = process.argv.indexOf(flag)
	return idx !== -1 ? process.argv[idx + 1] : undefined
}

const inputFile = getArg("--input")
const outputFile = getArg("--output")

// ── State ─────────────────────────────────────────────────────────────────────

type McpState =
	| { kind: "bpmn"; data: BpmnDefinitions }
	| { kind: "dmn"; data: DmnDefinitions }
	| { kind: "form"; data: FormDefinition }

function detectStateKind(content: string): "bpmn" | "dmn" | "form" {
	const trimmed = content.trimStart()
	if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "form"
	if (
		trimmed.includes("https://www.omg.org/spec/DMN") ||
		(trimmed.includes("<definitions") && trimmed.includes("decision"))
	)
		return "dmn"
	return "bpmn"
}

let state: McpState = {
	kind: "bpmn",
	data: Bpmn.parse(Bpmn.makeEmpty("Process_1", "New Process")),
}

if (inputFile) {
	try {
		const content = readFileSync(inputFile, "utf8")
		const kind = detectStateKind(content)
		if (kind === "dmn") {
			state = { kind: "dmn", data: Dmn.parse(content) }
		} else if (kind === "form") {
			state = { kind: "form", data: Form.parse(content) }
		} else {
			state = { kind: "bpmn", data: Bpmn.parse(content) }
		}
	} catch {
		/* start with empty BPMN diagram if file is unreadable */
	}
}

// ── BPMN helpers ──────────────────────────────────────────────────────────────

function buildBpmnDiagram(proc: BpmnProcess): BpmnDiagram {
	const layout = layoutProcess(proc)
	const shapes: BpmnDiShape[] = layout.nodes.map((n) => ({
		id: `${n.id}_di`,
		bpmnElement: n.id,
		isExpanded: n.isExpanded,
		bounds: n.bounds,
		label: n.labelBounds ? { bounds: n.labelBounds } : undefined,
		unknownAttributes: {},
	}))
	const edges: BpmnDiEdge[] = layout.edges.map((e) => ({
		id: `${e.id}_di`,
		bpmnElement: e.id,
		waypoints: e.waypoints,
		unknownAttributes: {},
	}))
	return {
		id: `BPMNDiagram_${proc.id}`,
		plane: {
			id: `BPMNPlane_${proc.id}`,
			bpmnElement: proc.id,
			shapes,
			edges,
		},
	}
}

function saveState(): void {
	if (!outputFile) return
	if (state.kind === "bpmn") {
		state.data.diagrams = state.data.processes.map((proc) => buildBpmnDiagram(proc))
		writeFileSync(outputFile, Bpmn.export(state.data))
	} else if (state.kind === "dmn") {
		const laid = layoutDmn(state.data)
		writeFileSync(outputFile, Dmn.export(laid))
	} else {
		writeFileSync(outputFile, Form.export(state.data))
	}
}

function recomputeIncomingOutgoing(proc: BpmnProcess): void {
	const elementMap = new Map<string, BpmnFlowElement>()
	for (const el of proc.flowElements) {
		el.incoming = []
		el.outgoing = []
		elementMap.set(el.id, el)
	}
	for (const sf of proc.sequenceFlows) {
		const src = elementMap.get(sf.sourceRef)
		const tgt = elementMap.get(sf.targetRef)
		if (src) src.outgoing.push(sf.id)
		if (tgt) tgt.incoming.push(sf.id)
	}
}

function findProcess(processId: string): BpmnProcess | undefined {
	if (state.kind !== "bpmn") return undefined
	return state.data.processes.find((p) => p.id === processId)
}

function ensureProcess(processId: string): BpmnProcess {
	if (state.kind !== "bpmn") throw new Error("Current file is not a BPMN diagram")
	let proc = state.data.processes.find((p) => p.id === processId)
	if (!proc) {
		proc = {
			id: processId,
			isExecutable: true,
			extensionElements: [],
			flowElements: [],
			sequenceFlows: [],
			textAnnotations: [],
			associations: [],
			unknownAttributes: {},
		}
		state.data.processes.push(proc)
	}
	return proc
}

// ── Tool definitions ──────────────────────────────────────────────────────────

const ELEMENT_SCHEMA = {
	type: "object",
	properties: {
		id: { type: "string", description: "Unique element ID" },
		type: {
			type: "string",
			description:
				"BPMN element type. Events: startEvent | endEvent | intermediateThrowEvent | intermediateCatchEvent | boundaryEvent. " +
				"Tasks: serviceTask | userTask | businessRuleTask | callActivity | scriptTask | sendTask | manualTask. " +
				"Gateways: exclusiveGateway | parallelGateway | inclusiveGateway | eventBasedGateway. " +
				"Containers: subProcess | adHocSubProcess.",
		},
		name: { type: "string", description: "Display name shown on the diagram" },
		eventType: {
			type: "string",
			description:
				"For events: timer | message | signal | error | escalation | cancel | terminate | conditional | link | compensate",
		},
		attachedTo: { type: "string", description: "boundaryEvent only: ID of the host activity" },
		interrupting: {
			type: "boolean",
			description: "boundaryEvent only: false = non-interrupting (default true)",
		},
		jobType: {
			type: "string",
			description:
				"serviceTask only: Zeebe worker job type. " +
				"⚠️ For HTTP/REST API calls do NOT set this here — use the add_http_call tool instead.",
		},
		formId: { type: "string", description: "userTask only: linked Camunda form ID" },
		calledProcess: { type: "string", description: "callActivity only: ID of the called process" },
		decisionId: { type: "string", description: "businessRuleTask only: DMN decision ID" },
		resultVariable: {
			type: "string",
			description: "businessRuleTask / serviceTask: process variable to store the task output",
		},
	},
	required: ["id", "type"],
}

const FLOW_SCHEMA = {
	type: "object",
	properties: {
		id: { type: "string" },
		from: { type: "string", description: "Source element ID" },
		to: { type: "string", description: "Target element ID" },
		name: { type: "string" },
		condition: { type: "string", description: "FEEL condition expression" },
	},
	required: ["id", "from", "to"],
}

const COMPOSE_TOOL = {
	name: "compose_diagram",
	description:
		"Run a JavaScript snippet to make complex multi-step changes in a single call.\n" +
		"Prefer this over multiple separate tool calls when building from scratch or doing batch edits.\n" +
		"\n" +
		"BPMN Bridge API:\n" +
		"  Bridge.mcpGetDiagram() → CompactDiagram JSON\n" +
		"  Bridge.mcpAddElements(processId, elementsJson, flowsJson) → result\n" +
		"  Bridge.mcpRemoveElements(processId, elementIdsJson, flowIdsJson) → result\n" +
		"  Bridge.mcpUpdateElement(processId, elementId, changesJson) → result\n" +
		"  Bridge.mcpSetCondition(processId, flowId, conditionJson) → result\n" +
		"  Bridge.mcpReplaceDiagram(compactJson) → result\n" +
		"  Bridge.mcpAddHttpCall(processId, configJson) → result\n" +
		"  Bridge.mcpExportXml() → XML string\n" +
		"\n" +
		"DMN Bridge API:\n" +
		"  Bridge.mcpGetDiagram() → CompactDmn JSON\n" +
		"  Bridge.mcpReplaceDiagram(compactDmnJson) → result\n" +
		"  Bridge.mcpExportXml() → DMN XML string\n" +
		"\n" +
		"Form Bridge API:\n" +
		"  Bridge.mcpGetDiagram() → CompactForm JSON\n" +
		"  Bridge.mcpReplaceDiagram(compactFormJson) → result\n" +
		"  Bridge.mcpExportXml() → Form JSON string\n" +
		"\n" +
		"Use `return` to return the final result string.",
	inputSchema: {
		type: "object",
		properties: {
			code: { type: "string", description: "JavaScript snippet to run against the Bridge API" },
		},
		required: ["code"],
	},
}

const BPMN_TOOLS = [
	{
		name: "get_diagram",
		description:
			"Return the current BPMN diagram as a compact JSON. Call this first before making any changes.",
		inputSchema: { type: "object", properties: {} },
	},
	COMPOSE_TOOL,
	{
		name: "add_http_call",
		description:
			"⚠️ ALWAYS use this tool — not add_elements — for any HTTP/REST API call, webhook, or external service integration.\n" +
			"Adds a Camunda HTTP connector service task (jobType: io.camunda:http-json:1) with the correct zeebe:ioMapping inputs.",
		inputSchema: {
			type: "object",
			properties: {
				processId: { type: "string" },
				id: { type: "string" },
				name: { type: "string" },
				url: { type: "string" },
				method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] },
				headers: { type: "string" },
				body: { type: "string" },
				resultVariable: { type: "string" },
			},
			required: ["processId", "id", "name", "url", "method"],
		},
	},
	{
		name: "add_elements",
		description:
			"Add BPMN elements (tasks, events, gateways) and/or sequence flows to a process.\n" +
			"⚠️ NOT for HTTP/REST API calls — use add_http_call for those.",
		inputSchema: {
			type: "object",
			properties: {
				processId: { type: "string" },
				elements: { type: "array", items: ELEMENT_SCHEMA },
				flows: { type: "array", items: FLOW_SCHEMA },
			},
			required: ["processId"],
		},
	},
	{
		name: "remove_elements",
		description: "Remove BPMN elements and/or sequence flows.",
		inputSchema: {
			type: "object",
			properties: {
				processId: { type: "string" },
				elementIds: { type: "array", items: { type: "string" } },
				flowIds: { type: "array", items: { type: "string" } },
			},
			required: ["processId"],
		},
	},
	{
		name: "update_element",
		description: "Rename an existing BPMN element or change its display name.",
		inputSchema: {
			type: "object",
			properties: {
				processId: { type: "string" },
				elementId: { type: "string" },
				changes: {
					type: "object",
					properties: { name: { type: "string" } },
				},
			},
			required: ["processId", "elementId", "changes"],
		},
	},
	{
		name: "set_condition",
		description: "Set or clear a FEEL condition expression on a sequence flow.",
		inputSchema: {
			type: "object",
			properties: {
				processId: { type: "string" },
				flowId: { type: "string" },
				condition: { description: "FEEL expression string, or null to remove" },
			},
			required: ["processId", "flowId", "condition"],
		},
	},
	{
		name: "replace_diagram",
		description: "Replace the entire BPMN diagram. Use only when creating from scratch.",
		inputSchema: {
			type: "object",
			properties: {
				diagram: {
					type: "object",
					description:
						"CompactDiagram: { id, processes: [{ id, name?, elements: [...], flows: [...] }] }",
				},
			},
			required: ["diagram"],
		},
	},
]

const DMN_TOOLS = [
	{
		name: "get_diagram",
		description:
			"Return the current DMN diagram as a compact JSON. Call this first before making any changes.",
		inputSchema: { type: "object", properties: {} },
	},
	COMPOSE_TOOL,
	{
		name: "replace_diagram",
		description:
			"Replace the entire DMN diagram. Use when creating from scratch or doing a full rewrite.",
		inputSchema: {
			type: "object",
			properties: {
				diagram: {
					type: "object",
					description:
						"CompactDmn: { id, name, decisions: [{ id, name?, inputs, outputs, rules, requires? }], inputData: [...] }",
				},
			},
			required: ["diagram"],
		},
	},
]

const FORM_TOOLS = [
	{
		name: "get_diagram",
		description:
			"Return the current form as a compact JSON. Call this first before making any changes.",
		inputSchema: { type: "object", properties: {} },
	},
	COMPOSE_TOOL,
	{
		name: "replace_diagram",
		description: "Replace the entire form. Use when creating from scratch or doing a full rewrite.",
		inputSchema: {
			type: "object",
			properties: {
				diagram: {
					type: "object",
					description:
						"CompactForm: { id, fields: [{ type, id, label?, key?, required?, values?, fields? }] }",
				},
			},
			required: ["diagram"],
		},
	},
]

function getTools(): typeof BPMN_TOOLS {
	if (state.kind === "dmn") return DMN_TOOLS
	if (state.kind === "form") return FORM_TOOLS
	return BPMN_TOOLS
}

// ── Tool execution ────────────────────────────────────────────────────────────

function callTool(name: string, args: Record<string, unknown>): string {
	process.stderr.write(`[mcp] tool: ${name} args: ${JSON.stringify(args)}\n`)
	switch (name) {
		case "get_diagram": {
			if (state.kind === "dmn") return JSON.stringify(compactifyDmn(state.data), null, 2)
			if (state.kind === "form") return JSON.stringify(compactifyForm(state.data), null, 2)
			return JSON.stringify(compactify(state.data), null, 2)
		}

		case "add_elements": {
			const proc = ensureProcess(args.processId as string)
			const elements = (args.elements as CompactElement[] | undefined) ?? []
			const flows = (args.flows as CompactFlow[] | undefined) ?? []

			const miniCompact: CompactDiagram = {
				id: "__temp__",
				processes: [{ id: proc.id, elements, flows }],
			}
			const tempDefs = expand(miniCompact)
			const tempProc = tempDefs.processes[0]
			if (!tempProc) return "Failed to expand elements."

			let addedEls = 0
			let addedFlows = 0
			for (const el of tempProc.flowElements) {
				if (!proc.flowElements.some((e) => e.id === el.id)) {
					proc.flowElements.push(el)
					addedEls++
				}
			}
			for (const sf of tempProc.sequenceFlows) {
				if (!proc.sequenceFlows.some((f) => f.id === sf.id)) {
					proc.sequenceFlows.push(sf)
					addedFlows++
				}
			}
			recomputeIncomingOutgoing(proc)
			saveState()
			return `Added ${addedEls} element(s) and ${addedFlows} flow(s) to ${args.processId as string}.`
		}

		case "remove_elements": {
			const proc = findProcess(args.processId as string)
			if (!proc) return `Process ${args.processId as string} not found.`
			const dropEls = new Set((args.elementIds as string[] | undefined) ?? [])
			const dropFlows = new Set((args.flowIds as string[] | undefined) ?? [])
			const removedEls = proc.flowElements.filter((e) => dropEls.has(e.id)).length
			proc.flowElements = proc.flowElements.filter((e) => !dropEls.has(e.id))
			const removedFlows = proc.sequenceFlows.filter(
				(f) => dropFlows.has(f.id) || dropEls.has(f.sourceRef) || dropEls.has(f.targetRef),
			).length
			proc.sequenceFlows = proc.sequenceFlows.filter(
				(f) => !dropFlows.has(f.id) && !dropEls.has(f.sourceRef) && !dropEls.has(f.targetRef),
			)
			recomputeIncomingOutgoing(proc)
			saveState()
			return `Removed ${removedEls} element(s) and ${removedFlows} flow(s).`
		}

		case "update_element": {
			const proc = findProcess(args.processId as string)
			if (!proc) return `Process ${args.processId as string} not found.`
			const el = proc.flowElements.find((e) => e.id === (args.elementId as string))
			if (!el)
				return `Element ${args.elementId as string} not found in ${args.processId as string}.`
			const changes = args.changes as Record<string, unknown>
			if (changes.name !== undefined) el.name = changes.name as string
			saveState()
			return `Updated element ${args.elementId as string}.`
		}

		case "set_condition": {
			const proc = findProcess(args.processId as string)
			if (!proc) return `Process ${args.processId as string} not found.`
			const sf = proc.sequenceFlows.find((f) => f.id === (args.flowId as string))
			if (!sf) return `Flow ${args.flowId as string} not found in ${args.processId as string}.`
			if (args.condition === null) {
				sf.conditionExpression = undefined
			} else {
				sf.conditionExpression = { text: args.condition as string, attributes: {} }
			}
			saveState()
			return `Condition set on flow ${args.flowId as string}.`
		}

		case "add_http_call": {
			const proc = ensureProcess(args.processId as string)
			const config: RestConnectorConfig = {
				name: args.name as string,
				method: args.method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
				url: args.url as string,
			}
			if (args.headers) config.headers = args.headers as string
			if (args.body) config.body = args.body as string
			if (args.resultVariable) config.resultVariable = args.resultVariable as string

			const tempDefs = Bpmn.createProcess("__temp__")
				.restConnector(args.id as string, config)
				.build()
			const tempProc = tempDefs.processes[0]
			const el = tempProc?.flowElements.find((e) => e.id === (args.id as string))
			if (!el) return "Failed to create REST connector element."

			if (!proc.flowElements.some((e) => e.id === el.id)) {
				el.incoming = []
				el.outgoing = []
				proc.flowElements.push(el)
			}
			saveState()
			return `Added HTTP task "${args.name as string}" (${args.method as string} ${args.url as string}).`
		}

		case "replace_diagram": {
			const raw = args.diagram as unknown
			if (state.kind === "dmn") {
				state = { kind: "dmn", data: expandDmn(raw as CompactDmn) }
			} else if (state.kind === "form") {
				state = { kind: "form", data: expandForm(raw as CompactForm) }
			} else {
				state = { kind: "bpmn", data: expand(raw as CompactDiagram) }
			}
			saveState()
			return "Diagram replaced."
		}

		case "compose_diagram": {
			const code = args.code as string

			// Build Bridge object that mirrors bridge.ts API, extended for DMN/Form types.
			const bridge = buildBridge()
			const ctx = vm.createContext({ Bridge: bridge })
			try {
				const result = vm.runInContext(`(function(){\n${code}\n})()`, ctx, { timeout: 5000 })
				return typeof result === "string" ? result : JSON.stringify(result ?? null)
			} catch (err) {
				throw new Error(
					`Code execution failed: ${err instanceof Error ? err.message : String(err)}`,
				)
			}
		}

		default:
			throw new Error(`Unknown tool: ${name}`)
	}
}

function buildBridge(): Record<string, unknown> {
	const base = {
		mcpGetDiagram: () => callTool("get_diagram", {}),
		mcpReplaceDiagram: (compactJson: string) =>
			callTool("replace_diagram", { diagram: JSON.parse(compactJson) }),
		mcpExportXml: () => {
			if (state.kind === "dmn") {
				return Dmn.export(layoutDmn(state.data))
			}
			if (state.kind === "form") {
				return Form.export(state.data)
			}
			state.data.diagrams = state.data.processes.map((proc) => buildBpmnDiagram(proc))
			return Bpmn.export(state.data)
		},
	}

	if (state.kind !== "bpmn") return base

	// BPMN-specific methods
	return {
		...base,
		mcpAddElements: (processId: string, elementsJson: string, flowsJson: string) =>
			callTool("add_elements", {
				processId,
				elements: JSON.parse(elementsJson),
				flows: JSON.parse(flowsJson),
			}),
		mcpRemoveElements: (processId: string, elementIdsJson: string, flowIdsJson: string) =>
			callTool("remove_elements", {
				processId,
				elementIds: JSON.parse(elementIdsJson),
				flowIds: JSON.parse(flowIdsJson),
			}),
		mcpUpdateElement: (processId: string, elementId: string, changesJson: string) =>
			callTool("update_element", {
				processId,
				elementId,
				changes: JSON.parse(changesJson),
			}),
		mcpSetCondition: (processId: string, flowId: string, conditionJson: string) =>
			callTool("set_condition", {
				processId,
				flowId,
				condition: JSON.parse(conditionJson),
			}),
		mcpAddHttpCall: (processId: string, configJson: string) => {
			const cfg = JSON.parse(configJson) as Record<string, unknown>
			return callTool("add_http_call", { processId, ...cfg })
		},
	}
}

// ── JSON-RPC 2.0 stdio loop ───────────────────────────────────────────────────

interface JsonRpcRequest {
	jsonrpc: string
	id?: number | string
	method: string
	params?: unknown
}

interface JsonRpcResponse {
	jsonrpc: "2.0"
	id: number | string | undefined
	result?: unknown
	error?: { code: number; message: string }
}

const rl = createInterface({ input: process.stdin, crlfDelay: Number.POSITIVE_INFINITY })

rl.on("line", (line) => {
	const trimmed = line.trim()
	if (!trimmed) return

	let req: JsonRpcRequest
	try {
		req = JSON.parse(trimmed) as JsonRpcRequest
	} catch {
		return
	}

	// Notifications have no id — ignore them (no response needed)
	if (!("id" in req)) return

	let result: unknown
	let error: { code: number; message: string } | undefined

	try {
		switch (req.method) {
			case "initialize":
				result = {
					protocolVersion: "2024-11-05",
					capabilities: { tools: {} },
					serverInfo: { name: "bpmnkit-mcp", version: "1.0.0" },
				}
				break

			case "tools/list":
				result = { tools: getTools() }
				break

			case "tools/call": {
				const params = req.params as { name: string; arguments?: Record<string, unknown> }
				const text = callTool(params.name, params.arguments ?? {})
				result = { content: [{ type: "text", text }], isError: false }
				break
			}

			case "ping":
				result = {}
				break

			default:
				error = { code: -32601, message: "Method not found" }
		}
	} catch (err) {
		if (req.method === "tools/call") {
			result = { content: [{ type: "text", text: String(err) }], isError: true }
		} else {
			error = { code: -32603, message: String(err) }
		}
	}

	const response: JsonRpcResponse = error
		? { jsonrpc: "2.0", id: req.id, error }
		: { jsonrpc: "2.0", id: req.id, result }

	process.stdout.write(`${JSON.stringify(response)}\n`)
})
