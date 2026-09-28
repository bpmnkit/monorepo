import {
	Bpmn,
	analyzeVariableFlow,
	applyAutoLayout,
	compactify,
	expand,
	optimize,
} from "@bpmnkit/core"
import { runSandboxedSync } from "./sandbox.js"
import { SDK_SPEC } from "./sdk-spec.js"

function buildSdkContext(xml?: string): {
	xml: string
	sdk: Record<string, (...args: unknown[]) => unknown>
} {
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

/**
 * Runs model-written code in a separate isolate. `sdk` functions are reached
 * through copies of their arguments and results only; under node:vm the
 * functions themselves, and even the `spec` object, led back to the host.
 */
function runInSandbox(
	code: string,
	data: Record<string, unknown>,
	sdk: Record<string, (...args: unknown[]) => unknown> | null,
	timeoutMs: number,
): unknown {
	const functions: Record<string, (...args: unknown[]) => unknown> = {}
	let bootstrap: string | undefined
	if (sdk) {
		for (const [name, fn] of Object.entries(sdk)) functions[`__sdk_${name}`] = fn
		bootstrap = `const sdk = { ${Object.keys(sdk)
			.map((name) => `${name}: __sdk_${name}`)
			.join(", ")} }`
	}
	try {
		return runSandboxedSync(code, { data, functions, bootstrap }, timeoutMs)
	} catch (err) {
		throw new Error(`Code execution failed: ${err instanceof Error ? err.message : String(err)}`)
	}
}

export function handleSdkSearch(code: string): string {
	const result = runInSandbox(code, { spec: SDK_SPEC }, null, 5000)
	return JSON.stringify(result)
}

export function handleSdkExecute(code: string, xml?: string): string {
	const ctx = buildSdkContext(xml)
	const result = runInSandbox(code, { xml: ctx.xml }, ctx.sdk, 10000)
	return JSON.stringify(result)
}
