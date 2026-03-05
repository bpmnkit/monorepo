/**
 * Minimal stdio MCP server for BPMN diagram editing.
 * Zero external dependencies — pure Node.js built-ins + @bpmn-sdk/core (workspace package).
 *
 * State is stored as BpmnDefinitions (BPMN XML) so core builder APIs (e.g. restConnector)
 * produce the correct zeebe:ioMapping extension structure — not the lossy CompactDiagram format.
 *
 * Usage:
 *   node dist/mcp-server.js [--input <diagram.bpmn>] [--output <result.bpmn>]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import vm from "node:vm";
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
	type RestConnectorConfig,
	compactify,
	expand,
	layoutProcess,
} from "@bpmn-sdk/core";

// ── CLI args ──────────────────────────────────────────────────────────────────

function getArg(flag: string): string | undefined {
	const idx = process.argv.indexOf(flag);
	return idx !== -1 ? process.argv[idx + 1] : undefined;
}

const inputFile = getArg("--input");
const outputFile = getArg("--output");

// ── State ─────────────────────────────────────────────────────────────────────

let state: BpmnDefinitions = Bpmn.parse(Bpmn.makeEmpty("Process_1", "New Process"));

if (inputFile) {
	try {
		// Input is BPMN XML written by index.ts (expand + Bpmn.export)
		state = Bpmn.parse(readFileSync(inputFile, "utf8"));
	} catch {
		/* start with empty diagram if file is unreadable */
	}
}

function buildDiagram(proc: BpmnProcess): BpmnDiagram {
	const layout = layoutProcess(proc);
	const shapes: BpmnDiShape[] = layout.nodes.map((n) => ({
		id: `${n.id}_di`,
		bpmnElement: n.id,
		isExpanded: n.isExpanded,
		bounds: n.bounds,
		label: n.labelBounds ? { bounds: n.labelBounds } : undefined,
		unknownAttributes: {},
	}));
	const edges: BpmnDiEdge[] = layout.edges.map((e) => ({
		id: `${e.id}_di`,
		bpmnElement: e.id,
		waypoints: e.waypoints,
		unknownAttributes: {},
	}));
	return {
		id: `BPMNDiagram_${proc.id}`,
		plane: {
			id: `BPMNPlane_${proc.id}`,
			bpmnElement: proc.id,
			shapes,
			edges,
		},
	};
}

function saveState(): void {
	if (!outputFile) return;
	state.diagrams = state.processes.map((proc) => buildDiagram(proc));
	writeFileSync(outputFile, Bpmn.export(state));
}

function recomputeIncomingOutgoing(proc: BpmnProcess): void {
	const elementMap = new Map<string, BpmnFlowElement>();
	for (const el of proc.flowElements) {
		el.incoming = [];
		el.outgoing = [];
		elementMap.set(el.id, el);
	}
	for (const sf of proc.sequenceFlows) {
		const src = elementMap.get(sf.sourceRef);
		const tgt = elementMap.get(sf.targetRef);
		if (src) src.outgoing.push(sf.id);
		if (tgt) tgt.incoming.push(sf.id);
	}
}

function findProcess(processId: string): BpmnProcess | undefined {
	return state.processes.find((p) => p.id === processId);
}

function ensureProcess(processId: string): BpmnProcess {
	let proc = state.processes.find((p) => p.id === processId);
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
		};
		state.processes.push(proc);
	}
	return proc;
}

// ── Tool definitions ──────────────────────────────────────────────────────────
//
// IMPORTANT: add_http_call is listed FIRST (after get_diagram) so the LLM
// encounters it before add_elements and uses it for any HTTP/REST task.

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
};

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
};

const TOOLS = [
	{
		name: "get_diagram",
		description: "Return the current BPMN diagram. Call this first before making any changes.",
		inputSchema: { type: "object", properties: {} },
	},
	{
		name: "execute_code",
		description:
			"Execute JavaScript to make complex multi-step diagram changes in a single call.\n" +
			"Prefer this over multiple separate tool calls when building a process from scratch,\n" +
			"doing batch edits, or applying conditional logic.\n" +
			"\n" +
			"Bridge API (all JSON args are strings — use JSON.stringify/JSON.parse):\n" +
			"  Bridge.mcpGetDiagram() → CompactDiagram JSON string\n" +
			"  Bridge.mcpAddElements(processId, elementsJson, flowsJson) → result string\n" +
			"  Bridge.mcpRemoveElements(processId, elementIdsJson, flowIdsJson) → result string\n" +
			"  Bridge.mcpUpdateElement(processId, elementId, changesJson) → result string\n" +
			"  Bridge.mcpSetCondition(processId, flowId, conditionJson) → result string\n" +
			"  Bridge.mcpReplaceDiagram(compactJson) → result string\n" +
			"  Bridge.mcpAddHttpCall(processId, configJson) → result string\n" +
			"    configJson fields: {id, name, method, url, headers?, body?, resultVariable?}\n" +
			"  Bridge.mcpExportXml() → BPMN XML string\n" +
			"\n" +
			"Use `return` to return the final result string.\n" +
			"Example: const d=JSON.parse(Bridge.mcpGetDiagram()); " +
			"Bridge.mcpAddElements(d.processes[0].id, JSON.stringify([{id:'t1',type:'serviceTask',name:'Do Work'}]), JSON.stringify([{id:'f1',from:'start',to:'t1'}])); " +
			"return 'done';",
		inputSchema: {
			type: "object",
			properties: {
				code: { type: "string", description: "JavaScript code to execute against the Bridge API" },
			},
			required: ["code"],
		},
	},
	{
		name: "add_http_call",
		description:
			"⚠️ ALWAYS use this tool — not add_elements — for any HTTP/REST API call, webhook, or external service integration.\n" +
			"Adds a Camunda HTTP connector service task (jobType: io.camunda:http-json:1) with the correct zeebe:ioMapping inputs.\n" +
			"Use your knowledge of the target API to provide a real endpoint URL, not a placeholder.",
		inputSchema: {
			type: "object",
			properties: {
				processId: { type: "string" },
				id: { type: "string", description: "Unique element ID" },
				name: { type: "string", description: "Task display name" },
				url: {
					type: "string",
					description:
						"Full API endpoint URL. Use your knowledge — e.g. https://api.github.com/repos/{owner}/{repo}/issues for GitHub.",
				},
				method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] },
				headers: {
					type: "string",
					description:
						'Optional JSON string of HTTP headers, e.g. {"Authorization":"Bearer {{token}}","Accept":"application/json"}',
				},
				body: {
					type: "string",
					description: "Optional FEEL expression for the request body (POST/PUT/PATCH)",
				},
				resultVariable: {
					type: "string",
					description: "Optional process variable name to store the HTTP response",
				},
			},
			required: ["processId", "id", "name", "url", "method"],
		},
	},
	{
		name: "add_elements",
		description:
			"Add BPMN elements (tasks, events, gateways) and/or sequence flows to a process.\n" +
			"⚠️ NOT for HTTP/REST API calls — use add_http_call for those.\n" +
			"Creates the process if it does not exist.",
		inputSchema: {
			type: "object",
			properties: {
				processId: { type: "string", description: "Target process ID" },
				elements: {
					type: "array",
					items: ELEMENT_SCHEMA,
					description: "BPMN elements to add",
				},
				flows: {
					type: "array",
					items: FLOW_SCHEMA,
					description: "Sequence flows to add",
				},
			},
			required: ["processId"],
		},
	},
	{
		name: "remove_elements",
		description:
			"Remove BPMN elements and/or sequence flows. Removing an element also removes its connecting flows.",
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
					properties: { name: { type: "string", description: "New display name" } },
					description:
						"Fields to update — only name is supported; use remove + add for structural changes",
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
				condition: { description: "FEEL expression string, or null to remove the condition" },
			},
			required: ["processId", "flowId", "condition"],
		},
	},
	{
		name: "replace_diagram",
		description:
			"Replace the entire diagram. Use only when creating a new diagram from scratch or doing a full structural rewrite.",
		inputSchema: {
			type: "object",
			properties: {
				diagram: {
					type: "object",
					description:
						"Complete diagram object: { id, processes: [{ id, name?, elements: [...], flows: [...] }] }",
				},
			},
			required: ["diagram"],
		},
	},
];

// ── Tool execution ────────────────────────────────────────────────────────────

function callTool(name: string, args: Record<string, unknown>): string {
	process.stderr.write(`[mcp] tool: ${name} args: ${JSON.stringify(args)}\n`);
	switch (name) {
		case "get_diagram":
			return JSON.stringify(compactify(state), null, 2);

		case "add_elements": {
			const proc = ensureProcess(args.processId as string);
			const elements = (args.elements as CompactElement[] | undefined) ?? [];
			const flows = (args.flows as CompactFlow[] | undefined) ?? [];

			// Use expand() to create properly structured BpmnFlowElement objects
			const miniCompact: CompactDiagram = {
				id: "__temp__",
				processes: [{ id: proc.id, elements, flows }],
			};
			const tempDefs = expand(miniCompact);
			const tempProc = tempDefs.processes[0];
			if (!tempProc) return "Failed to expand elements.";

			let addedEls = 0;
			let addedFlows = 0;
			for (const el of tempProc.flowElements) {
				if (!proc.flowElements.some((e) => e.id === el.id)) {
					proc.flowElements.push(el);
					addedEls++;
				}
			}
			for (const sf of tempProc.sequenceFlows) {
				if (!proc.sequenceFlows.some((f) => f.id === sf.id)) {
					proc.sequenceFlows.push(sf);
					addedFlows++;
				}
			}
			recomputeIncomingOutgoing(proc);
			saveState();
			return `Added ${addedEls} element(s) and ${addedFlows} flow(s) to ${args.processId as string}.`;
		}

		case "remove_elements": {
			const proc = findProcess(args.processId as string);
			if (!proc) return `Process ${args.processId as string} not found.`;
			const dropEls = new Set((args.elementIds as string[] | undefined) ?? []);
			const dropFlows = new Set((args.flowIds as string[] | undefined) ?? []);
			const removedEls = proc.flowElements.filter((e) => dropEls.has(e.id)).length;
			proc.flowElements = proc.flowElements.filter((e) => !dropEls.has(e.id));
			const removedFlows = proc.sequenceFlows.filter(
				(f) => dropFlows.has(f.id) || dropEls.has(f.sourceRef) || dropEls.has(f.targetRef),
			).length;
			proc.sequenceFlows = proc.sequenceFlows.filter(
				(f) => !dropFlows.has(f.id) && !dropEls.has(f.sourceRef) && !dropEls.has(f.targetRef),
			);
			recomputeIncomingOutgoing(proc);
			saveState();
			return `Removed ${removedEls} element(s) and ${removedFlows} flow(s).`;
		}

		case "update_element": {
			const proc = findProcess(args.processId as string);
			if (!proc) return `Process ${args.processId as string} not found.`;
			const el = proc.flowElements.find((e) => e.id === (args.elementId as string));
			if (!el)
				return `Element ${args.elementId as string} not found in ${args.processId as string}.`;
			const changes = args.changes as Record<string, unknown>;
			if (changes.name !== undefined) el.name = changes.name as string;
			saveState();
			return `Updated element ${args.elementId as string}.`;
		}

		case "set_condition": {
			const proc = findProcess(args.processId as string);
			if (!proc) return `Process ${args.processId as string} not found.`;
			const sf = proc.sequenceFlows.find((f) => f.id === (args.flowId as string));
			if (!sf) return `Flow ${args.flowId as string} not found in ${args.processId as string}.`;
			if (args.condition === null) {
				sf.conditionExpression = undefined;
			} else {
				sf.conditionExpression = { text: args.condition as string, attributes: {} };
			}
			saveState();
			return `Condition set on flow ${args.flowId as string}.`;
		}

		case "add_http_call": {
			const proc = ensureProcess(args.processId as string);
			const config: RestConnectorConfig = {
				name: args.name as string,
				method: args.method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
				url: args.url as string,
			};
			if (args.headers) config.headers = args.headers as string;
			if (args.body) config.body = args.body as string;
			if (args.resultVariable) config.resultVariable = args.resultVariable as string;

			// Use ProcessBuilder.restConnector() to create the correct zeebe:ioMapping structure.
			// This is essential: compact.ts creates zeebe:taskHeaders, but the Camunda HTTP
			// connector reads from zeebe:ioMapping inputs — these are completely different.
			const tempDefs = Bpmn.createProcess("__temp__")
				.restConnector(args.id as string, config)
				.build();
			const tempProc = tempDefs.processes[0];
			const el = tempProc?.flowElements.find((e) => e.id === (args.id as string));
			if (!el) return "Failed to create REST connector element.";

			if (!proc.flowElements.some((e) => e.id === el.id)) {
				el.incoming = [];
				el.outgoing = [];
				proc.flowElements.push(el);
			}
			saveState();
			return `Added HTTP task "${args.name as string}" (${args.method as string} ${args.url as string}).`;
		}

		case "replace_diagram": {
			state = expand(args.diagram as CompactDiagram);
			saveState();
			return "Diagram replaced.";
		}

		case "execute_code": {
			const code = args.code as string;
			// Build a Bridge object that mirrors bridge.ts Bridge API, delegating to callTool.
			// Runs in a vm context: no fs, no net, no process — only Bridge and ECMAScript builtins.
			const bridge = {
				mcpGetDiagram: () => callTool("get_diagram", {}),
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
				mcpReplaceDiagram: (compactJson: string) =>
					callTool("replace_diagram", { diagram: JSON.parse(compactJson) }),
				mcpAddHttpCall: (processId: string, configJson: string) => {
					const cfg = JSON.parse(configJson) as Record<string, unknown>;
					return callTool("add_http_call", { processId, ...cfg });
				},
				mcpExportXml: () => {
					state.diagrams = state.processes.map((proc) => buildDiagram(proc));
					return Bpmn.export(state);
				},
			};
			const ctx = vm.createContext({ Bridge: bridge });
			try {
				const result = vm.runInContext(`(function(){\n${code}\n})()`, ctx, { timeout: 5000 });
				return typeof result === "string" ? result : JSON.stringify(result ?? null);
			} catch (err) {
				throw new Error(
					`Code execution failed: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		}

		default:
			throw new Error(`Unknown tool: ${name}`);
	}
}

// ── JSON-RPC 2.0 stdio loop ───────────────────────────────────────────────────

interface JsonRpcRequest {
	jsonrpc: string;
	id?: number | string;
	method: string;
	params?: unknown;
}

interface JsonRpcResponse {
	jsonrpc: "2.0";
	id: number | string | undefined;
	result?: unknown;
	error?: { code: number; message: string };
}

const rl = createInterface({ input: process.stdin, crlfDelay: Number.POSITIVE_INFINITY });

rl.on("line", (line) => {
	const trimmed = line.trim();
	if (!trimmed) return;

	let req: JsonRpcRequest;
	try {
		req = JSON.parse(trimmed) as JsonRpcRequest;
	} catch {
		return;
	}

	// Notifications have no id — ignore them (no response needed)
	if (!("id" in req)) return;

	let result: unknown;
	let error: { code: number; message: string } | undefined;

	try {
		switch (req.method) {
			case "initialize":
				result = {
					protocolVersion: "2024-11-05",
					capabilities: { tools: {} },
					serverInfo: { name: "bpmn-mcp", version: "1.0.0" },
				};
				break;

			case "tools/list":
				result = { tools: TOOLS };
				break;

			case "tools/call": {
				const params = req.params as { name: string; arguments?: Record<string, unknown> };
				const text = callTool(params.name, params.arguments ?? {});
				result = { content: [{ type: "text", text }], isError: false };
				break;
			}

			case "ping":
				result = {};
				break;

			default:
				error = { code: -32601, message: "Method not found" };
		}
	} catch (err) {
		if (req.method === "tools/call") {
			result = { content: [{ type: "text", text: String(err) }], isError: true };
		} else {
			error = { code: -32603, message: String(err) };
		}
	}

	const response: JsonRpcResponse = error
		? { jsonrpc: "2.0", id: req.id, error }
		: { jsonrpc: "2.0", id: req.id, result };

	process.stdout.write(`${JSON.stringify(response)}\n`);
});
