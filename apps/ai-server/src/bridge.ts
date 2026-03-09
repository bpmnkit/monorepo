/**
 * QuickJS bridge — exposes all @bpmn-sdk/core operations as globalThis.Bridge.* functions.
 * Bundled as an IIFE (platform=neutral) and embedded in the Rust binaries via rquickjs.
 * All inputs/outputs are JSON strings or primitives.
 */

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
	optimize,
} from "@bpmn-sdk/core"

// ── MCP state (persists across calls within a single QuickJS runtime) ─────────

let __state: BpmnDefinitions | null = null

// ── Helpers (ported from mcp-server.ts) ───────────────────────────────────────

function buildDiagram(proc: BpmnProcess): BpmnDiagram {
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
	return __state?.processes.find((p) => p.id === processId)
}

function ensureProcess(processId: string): BpmnProcess {
	const existing = __state?.processes.find((p) => p.id === processId)
	if (existing) return existing
	const proc: BpmnProcess = {
		id: processId,
		isExecutable: true,
		extensionElements: [],
		flowElements: [],
		sequenceFlows: [],
		textAnnotations: [],
		associations: [],
		unknownAttributes: {},
	}
	__state?.processes.push(proc)
	return proc
}
// ── Bridge API ─────────────────────────────────────────────────────────────────

;(globalThis as Record<string, unknown>).Bridge = {
	// ── HTTP server (stateless) ────────────────────────────────────────────────

	/** Expand a CompactDiagram JSON string and export as BPMN XML. */
	expandAndExport(compactJson: string): string {
		return Bpmn.export(expand(JSON.parse(compactJson) as CompactDiagram))
	},

	/** Run optimize() on expanded compact, return findings as JSON string. */
	optimizeFindings(compactJson: string): string {
		const report = optimize(expand(JSON.parse(compactJson) as CompactDiagram))
		return JSON.stringify(
			report.findings.map((f) => ({
				category: f.category,
				severity: f.severity,
				message: f.message,
				suggestion: f.suggestion,
				elementIds: f.elementIds,
			})),
		)
	},

	// ── MCP server (stateful — __state persists in QuickJS runtime) ───────────

	/** Initialize MCP state from optional BPMN XML (or create empty diagram). */
	mcpInit(xml?: string): void {
		__state = Bpmn.parse(xml ?? Bpmn.makeEmpty("Process_1", "New Process"))
	},

	/** Return current diagram as CompactDiagram JSON string. */
	mcpGetDiagram(): string {
		if (!__state) throw new Error("mcpInit not called")
		return JSON.stringify(compactify(__state), null, 2)
	},

	/** Export current state as BPMN XML (rebuilds diagrams before export). */
	mcpExportXml(): string {
		if (!__state) throw new Error("mcpInit not called")
		__state.diagrams = __state.processes.map(buildDiagram)
		return Bpmn.export(__state)
	},

	/** Add elements and flows to a process. Returns result message. */
	mcpAddElements(processId: string, elementsJson: string, flowsJson: string): string {
		const proc = ensureProcess(processId)
		const elements = JSON.parse(elementsJson) as CompactElement[]
		const flows = JSON.parse(flowsJson) as CompactFlow[]

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
		return `Added ${addedEls} element(s) and ${addedFlows} flow(s) to ${processId}.`
	},

	/** Remove elements and flows from a process. Returns result message. */
	mcpRemoveElements(processId: string, elementIdsJson: string, flowIdsJson: string): string {
		const proc = findProcess(processId)
		if (!proc) return `Process ${processId} not found.`
		const dropEls = new Set(JSON.parse(elementIdsJson) as string[])
		const dropFlows = new Set(JSON.parse(flowIdsJson) as string[])
		const removedEls = proc.flowElements.filter((e) => dropEls.has(e.id)).length
		proc.flowElements = proc.flowElements.filter((e) => !dropEls.has(e.id))
		const removedFlows = proc.sequenceFlows.filter(
			(f) => dropFlows.has(f.id) || dropEls.has(f.sourceRef) || dropEls.has(f.targetRef),
		).length
		proc.sequenceFlows = proc.sequenceFlows.filter(
			(f) => !dropFlows.has(f.id) && !dropEls.has(f.sourceRef) && !dropEls.has(f.targetRef),
		)
		recomputeIncomingOutgoing(proc)
		return `Removed ${removedEls} element(s) and ${removedFlows} flow(s).`
	},

	/** Update element name. Returns result message. */
	mcpUpdateElement(processId: string, elementId: string, changesJson: string): string {
		const proc = findProcess(processId)
		if (!proc) return `Process ${processId} not found.`
		const el = proc.flowElements.find((e) => e.id === elementId)
		if (!el) return `Element ${elementId} not found in ${processId}.`
		const changes = JSON.parse(changesJson) as Record<string, unknown>
		if (changes.name !== undefined) el.name = changes.name as string
		return `Updated element ${elementId}.`
	},

	/** Set or clear condition on a sequence flow. Returns result message. */
	mcpSetCondition(processId: string, flowId: string, conditionJson: string): string {
		const proc = findProcess(processId)
		if (!proc) return `Process ${processId} not found.`
		const sf = proc.sequenceFlows.find((f) => f.id === flowId)
		if (!sf) return `Flow ${flowId} not found in ${processId}.`
		const condition = JSON.parse(conditionJson) as string | null
		if (condition === null) {
			sf.conditionExpression = undefined
		} else {
			sf.conditionExpression = { text: condition, attributes: {} }
		}
		return `Condition set on flow ${flowId}.`
	},

	/** Replace the entire diagram from CompactDiagram JSON. */
	mcpReplaceDiagram(compactJson: string): string {
		__state = expand(JSON.parse(compactJson) as CompactDiagram)
		return "Diagram replaced."
	},

	/**
	 * Execute arbitrary JavaScript in this context (code mode).
	 * The code has access to Bridge.*, __state, Bpmn, expand, compactify, etc.
	 * Wrap multi-statement code with return; the last expression value is the result.
	 */
	mcpExecuteCode(code: string): string {
		// biome-ignore lint/security/noGlobalEval: intentional — code mode runs LLM-generated JS in sandboxed QuickJS/vm context
		const result = eval(`(function(){\n${code}\n})()`)
		return typeof result === "string" ? result : JSON.stringify(result ?? null)
	},

	/** Add an HTTP connector task. Returns result message. */
	mcpAddHttpCall(processId: string, configJson: string): string {
		const proc = ensureProcess(processId)
		const args = JSON.parse(configJson) as {
			id: string
			name: string
			method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
			url: string
			headers?: string
			body?: string
			resultVariable?: string
		}

		const config: RestConnectorConfig = {
			name: args.name,
			method: args.method,
			url: args.url,
		}
		if (args.headers) config.headers = args.headers
		if (args.body) config.body = args.body
		if (args.resultVariable) config.resultVariable = args.resultVariable

		const tempDefs = Bpmn.createProcess("__temp__").restConnector(args.id, config).build()
		const tempProc = tempDefs.processes[0]
		const el = tempProc?.flowElements.find((e) => e.id === args.id)
		if (!el) return "Failed to create REST connector element."

		if (!proc.flowElements.some((e) => e.id === el.id)) {
			el.incoming = []
			el.outgoing = []
			proc.flowElements.push(el)
		}
		return `Added HTTP task "${args.name}" (${args.method} ${args.url}).`
	},
}
