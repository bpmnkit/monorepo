import vm from "node:vm"
import {
	Bpmn,
	analyzeVariableFlow,
	applyAutoLayout,
	compactify,
	expand,
	optimize,
} from "@bpmnkit/core"
import { SDK_SPEC } from "./sdk-spec.js"

function buildSdkContext(xml?: string): Record<string, unknown> {
	return {
		xml: xml ?? "",
		sdk: {
			parse: (rawXml: unknown): string => {
				const defs = Bpmn.parse(String(rawXml))
				return JSON.stringify(compactify(defs))
			},
			exportXml: (compactJson: unknown): string => {
				const defs = expand(JSON.parse(String(compactJson)))
				const laidOut = applyAutoLayout(defs)
				return Bpmn.export(laidOut)
			},
			optimize: (compactJson: unknown): string => {
				const compact = JSON.parse(String(compactJson))
				const defs = expand(compact)
				const report = optimize(defs)
				return JSON.stringify({
					diagram: compact,
					findings: report.findings,
				})
			},
			layout: (compactJson: unknown): string => {
				const defs = expand(JSON.parse(String(compactJson)))
				const laidOut = applyAutoLayout(defs)
				return JSON.stringify(compactify(laidOut))
			},
			analyzeVariables: (compactJson: unknown): string => {
				const defs = expand(JSON.parse(String(compactJson)))
				// analyzeVariableFlow operates per-process; run on each and collect
				const results = defs.processes.map((p) => analyzeVariableFlow(p))
				return JSON.stringify(results)
			},
		},
	}
}

function runInVm(code: string, ctx: Record<string, unknown>, timeoutMs: number): unknown {
	const context = vm.createContext(ctx)
	try {
		return vm.runInContext(`(function(){\n${code}\n})()`, context, {
			timeout: timeoutMs,
		})
	} catch (err) {
		throw new Error(`Code execution failed: ${err instanceof Error ? err.message : String(err)}`)
	}
}

export function handleSdkSearch(code: string): string {
	// JSON round-trip ensures Object.keys works on plain objects inside the vm context
	const result = runInVm(code, { spec: JSON.parse(JSON.stringify(SDK_SPEC)) }, 5000)
	return JSON.stringify(result)
}

export function handleSdkExecute(code: string, xml?: string): string {
	const result = runInVm(code, buildSdkContext(xml), 10000)
	return JSON.stringify(result)
}
